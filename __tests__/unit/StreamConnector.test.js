// __tests__/unit/StreamConnector.test.js
const StreamConnector = require('../../src/StreamConnector');
const { MessageProcessingError } = require('../../src/errors');

describe('StreamConnector', () => {
  let connector;
  let mockConfig;
  let mockLogger;
  let mockRedisService;
  let mockOutputService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock config
    mockConfig = {
      stream: {
        key: 'test-stream',
        consumerGroup: 'test-group',
        consumerName: 'test-consumer',
      },
      processing: {
        batchSize: 10,
        pollTimeoutMs: 100,
        retryDelayMs: 100,
        shutdownGracePeriodMs: 50,
        pendingMessageClaimIntervalMs: 1000,
        pendingMessageMinIdleMs: 500,
      },
    };

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      fatal: jest.fn(),
    };

    // Mock RedisService
    mockRedisService = {
      connect: jest.fn().mockResolvedValue(undefined),
      initializeGroup: jest.fn().mockResolvedValue(undefined),
      fetchMessages: jest.fn().mockResolvedValue([]),
      claimPendingMessages: jest.fn().mockResolvedValue(0),
      ackMessages: jest.fn().mockResolvedValue(0),
      disconnect: jest.fn().mockResolvedValue(undefined),
    };

    // Mock OutputService
    mockOutputService = {
      sendBatch: jest.fn().mockResolvedValue(0),
      disconnect: jest.fn().mockResolvedValue(undefined),
    };

    connector = new StreamConnector({
      config: mockConfig,
      logger: mockLogger,
      redisService: mockRedisService,
      outputService: mockOutputService,
    });
  });

  afterEach(async () => {
    // Ensure connector is stopped after each test
    if (connector.isRunning) {
      await connector.stop();
    }
    // Clear any pending timers
    jest.clearAllTimers();
  });

  describe('constructor', () => {
    it('should initialize with provided dependencies', () => {
      expect(connector.config).toBe(mockConfig);
      expect(connector.logger).toBe(mockLogger);
      expect(connector.redisService).toBe(mockRedisService);
      expect(connector.outputService).toBe(mockOutputService);
      expect(connector.isRunning).toBe(false);
    });
  });

  describe('start', () => {
    it('should initialize Redis group and set isRunning to true', async () => {
      // Immediately stop after start to prevent infinite loop
      const originalProcessingLoop = connector.processingLoop;
      connector.processingLoop = jest.fn().mockResolvedValue();
      
      await connector.start();
      
      expect(connector.isRunning).toBe(true);
      expect(mockRedisService.initializeGroup).toHaveBeenCalledWith(
        'test-stream',
        'test-group'
      );
      expect(connector.pendingClaimInterval).not.toBeNull();
      
      connector.processingLoop = originalProcessingLoop;
    });

    it('should start pending message recovery interval', async () => {
      jest.useFakeTimers();
      
      // Mock processing loop to prevent infinite execution
      connector.processingLoop = jest.fn().mockResolvedValue();
      
      await connector.start();
      
      expect(connector.pendingClaimInterval).toBeDefined();
      
      // Fast-forward time
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      
      expect(mockRedisService.claimPendingMessages).toHaveBeenCalled();
      
      jest.useRealTimers();
    });
  });

  describe('stop', () => {
    it('should stop connector gracefully', async () => {
      connector.isRunning = true;
      
      // Mock the interval
      connector.pendingClaimInterval = setInterval(() => {}, 1000);
      
      await connector.stop();

      expect(connector.isRunning).toBe(false);
      expect(mockRedisService.disconnect).toHaveBeenCalled();
      expect(mockOutputService.disconnect).toHaveBeenCalled();
      expect(connector.pendingClaimInterval).toBeNull();
    });

    it('should wait for grace period before stopping', async () => {
      connector.isRunning = true;
      jest.useFakeTimers();
      
      const stopPromise = connector.stop();
      await jest.advanceTimersByTimeAsync(150);
      await stopPromise;
      
      expect(mockLogger.info).toHaveBeenCalledWith('Stopping Stream Connector...');
      expect(connector.isRunning).toBe(false);
      
      jest.useRealTimers();
    });
  });

  describe('processingLoop', () => {
    beforeEach(() => {
      // Set isRunning to true for these tests
      connector.isRunning = true;
    });

    it('should process messages from Redis stream', async () => {
      const mockMessages = [
        { id: '1-0', fields: ['key1', 'value1', 'data', 'test1'] },
        { id: '2-0', fields: ['key2', 'value2', 'data', 'test2'] },
      ];
      
      // Return messages once, then stop
      let callCount = 0;
      mockRedisService.fetchMessages.mockImplementation(async () => {
        if (callCount++ === 0) {
          return mockMessages;
        }
        connector.isRunning = false;
        return [];
      });
      
      mockOutputService.sendBatch.mockResolvedValue(2);
      mockRedisService.ackMessages.mockResolvedValue(2);
      
      await connector.processingLoop();
      
      expect(mockOutputService.sendBatch).toHaveBeenCalledWith([
        { body: { key1: 'value1', data: 'test1' }, correlationId: '1-0' },
        { body: { key2: 'value2', data: 'test2' }, correlationId: '2-0' },
      ]);
      expect(mockRedisService.ackMessages).toHaveBeenCalledWith(
        'test-stream',
        'test-group',
        ['1-0', '2-0']
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        { sentCount: 2, ackCount: 2 },
        expect.any(String)
      );
    });

    it('should handle empty message batches', async () => {
      mockRedisService.fetchMessages.mockResolvedValueOnce([]);
      connector.isRunning = false; // Exit immediately
      
      await connector.processingLoop();
      
      expect(mockOutputService.sendBatch).not.toHaveBeenCalled();
      expect(mockRedisService.ackMessages).not.toHaveBeenCalled();
    });

    it('should handle processing errors and retry', async () => {
      const mockMessages = [{ id: '1-0', fields: ['data', 'test1'] }];
      
      let callCount = 0;
      mockRedisService.fetchMessages.mockImplementation(async () => {
        if (callCount++ === 0) {
          return mockMessages;
        }
        connector.isRunning = false;
        return [];
      });
      
      mockOutputService.sendBatch.mockRejectedValueOnce(new Error('Send failed'));
      
      await connector.processingLoop();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ 
          err: expect.any(Error),
          messageCount: 1
        }),
        'Failed to send batch to output service. Messages will not be acknowledged and will be retried.'
      );
    });

    it('should handle errors when claiming pending messages', async () => {
      jest.useFakeTimers();
      
      // Mock processingLoop to prevent it from running
      connector.processingLoop = jest.fn().mockResolvedValue();
      
      mockRedisService.claimPendingMessages.mockRejectedValue(new Error('Claim failed'));
      
      await connector.start();
      
      // Advance timer to trigger claim attempt
      await jest.advanceTimersByTimeAsync(1000);
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Error claiming pending messages.'
      );
      
      jest.useRealTimers();
    });
  });
});
