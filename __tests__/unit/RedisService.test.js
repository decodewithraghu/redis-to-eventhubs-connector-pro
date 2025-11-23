// __tests__/unit/RedisService.test.js
const Redis = require('ioredis');
const RedisService = require('../../src/services/RedisService');

// Mock ioredis
jest.mock('ioredis');

describe('RedisService', () => {
  let redisService;
  let mockRedisClient;
  let mockLogger;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock Redis client
    mockRedisClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      ping: jest.fn().mockResolvedValue('PONG'),
      xgroup: jest.fn().mockResolvedValue('OK'),
      xreadgroup: jest.fn(),
      xpending: jest.fn(),
      xclaim: jest.fn(),
      xack: jest.fn(),
      quit: jest.fn().mockResolvedValue('OK'),
      on: jest.fn(),
    };

    Redis.mockImplementation(() => mockRedisClient);

    // Mock logger
    mockLogger = {
      child: jest.fn().mockReturnThis(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      fatal: jest.fn(),
    };

    const config = { url: 'redis://localhost:6379' };
    redisService = new RedisService(config, mockLogger);
  });

  describe('constructor', () => {
    it('should create Redis client with retry strategy', () => {
      expect(Redis).toHaveBeenCalledWith(
        'redis://localhost:6379',
        expect.objectContaining({
          retryStrategy: expect.any(Function),
          maxRetriesPerRequest: 3,
          connectTimeout: 10000,
          lazyConnect: true,
        })
      );
    });

    it('should register error event handler', () => {
      expect(mockRedisClient.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should register reconnecting event handler', () => {
      expect(mockRedisClient.on).toHaveBeenCalledWith('reconnecting', expect.any(Function));
    });

    it('should register close event handler', () => {
      expect(mockRedisClient.on).toHaveBeenCalledWith('close', expect.any(Function));
    });
  });

  describe('connect', () => {
    it('should successfully connect to Redis', async () => {
      await redisService.connect();

      expect(mockRedisClient.connect).toHaveBeenCalled();
      expect(mockRedisClient.ping).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Connecting to Redis...');
      expect(mockLogger.info).toHaveBeenCalledWith('Successfully connected to Redis.');
    });

    it('should throw error if connection fails', async () => {
      const error = new Error('Connection failed');
      mockRedisClient.connect.mockRejectedValue(error);

      await expect(redisService.connect()).rejects.toThrow('Connection failed');
      expect(mockLogger.fatal).toHaveBeenCalled();
    });

    it('should throw error if ping fails', async () => {
      const error = new Error('Ping failed');
      mockRedisClient.ping.mockRejectedValue(error);

      await expect(redisService.connect()).rejects.toThrow('Ping failed');
      expect(mockLogger.fatal).toHaveBeenCalled();
    });
  });

  describe('initializeGroup', () => {
    it('should create consumer group successfully', async () => {
      await redisService.initializeGroup('test-stream', 'test-group');

      expect(mockRedisClient.xgroup).toHaveBeenCalledWith(
        'CREATE',
        'test-stream',
        'test-group',
        '$',
        'MKSTREAM'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        { streamKey: 'test-stream', groupName: 'test-group' },
        'Consumer group created.'
      );
    });

    it('should handle existing group gracefully', async () => {
      const error = new Error('BUSYGROUP Consumer Group name already exists');
      mockRedisClient.xgroup.mockRejectedValue(error);

      await redisService.initializeGroup('test-stream', 'test-group');

      expect(mockLogger.info).toHaveBeenCalledWith(
        { streamKey: 'test-stream', groupName: 'test-group' },
        'Consumer group already exists.'
      );
    });

    it('should throw on other errors', async () => {
      const error = new Error('Some other error');
      mockRedisClient.xgroup.mockRejectedValue(error);

      await expect(
        redisService.initializeGroup('test-stream', 'test-group')
      ).rejects.toThrow('Some other error');
    });
  });

  describe('fetchMessages', () => {
    it('should fetch messages successfully', async () => {
      const mockMessages = [
        [
          'test-stream',
          [
            ['1234-0', ['field1', 'value1', 'field2', 'value2']],
            ['1235-0', ['field1', 'value3', 'field2', 'value4']],
          ],
        ],
      ];
      mockRedisClient.xreadgroup.mockResolvedValue(mockMessages);

      const result = await redisService.fetchMessages(
        'test-stream',
        'test-group',
        'consumer1',
        10,
        5000
      );

      expect(mockRedisClient.xreadgroup).toHaveBeenCalledWith(
        'GROUP',
        'test-group',
        'consumer1',
        'COUNT',
        10,
        'BLOCK',
        5000,
        'STREAMS',
        'test-stream',
        '>'
      );
      expect(result).toEqual([
        { id: '1234-0', fields: ['field1', 'value1', 'field2', 'value2'] },
        { id: '1235-0', fields: ['field1', 'value3', 'field2', 'value4'] },
      ]);
    });

    it('should return empty array when no messages', async () => {
      mockRedisClient.xreadgroup.mockResolvedValue(null);

      const result = await redisService.fetchMessages(
        'test-stream',
        'test-group',
        'consumer1',
        10,
        5000
      );

      expect(result).toEqual([]);
    });
  });

  describe('claimPendingMessages', () => {
    it('should claim pending messages successfully', async () => {
      const pendingInfo = [
        ['1234-0', 'old-consumer', 120000, 1],
        ['1235-0', 'old-consumer', 150000, 2],
      ];
      mockRedisClient.xpending.mockResolvedValue(pendingInfo);
      mockRedisClient.xclaim.mockResolvedValue([
        ['1234-0', ['field1', 'value1']],
        ['1235-0', ['field1', 'value2']],
      ]);

      const result = await redisService.claimPendingMessages(
        'test-stream',
        'test-group',
        'consumer1',
        60000
      );

      expect(mockRedisClient.xclaim).toHaveBeenCalledWith(
        'test-stream',
        'test-group',
        'consumer1',
        60000,
        '1234-0',
        '1235-0'
      );
      expect(result).toBe(2);
      expect(mockLogger.info).toHaveBeenCalledWith(
        { streamKey: 'test-stream', groupName: 'test-group', claimedCount: 2 },
        'Claimed pending messages.'
      );
    });

    it('should return 0 when no pending messages', async () => {
      mockRedisClient.xpending.mockResolvedValue([]);

      const result = await redisService.claimPendingMessages(
        'test-stream',
        'test-group',
        'consumer1',
        60000
      );

      expect(result).toBe(0);
      expect(mockRedisClient.xclaim).not.toHaveBeenCalled();
    });

    it('should not claim messages below idle threshold', async () => {
      const pendingInfo = [['1234-0', 'old-consumer', 30000, 1]]; // Only 30s idle
      mockRedisClient.xpending.mockResolvedValue(pendingInfo);

      const result = await redisService.claimPendingMessages(
        'test-stream',
        'test-group',
        'consumer1',
        60000
      );

      expect(result).toBe(0);
      expect(mockRedisClient.xclaim).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('XPENDING failed');
      mockRedisClient.xpending.mockRejectedValue(error);

      const result = await redisService.claimPendingMessages(
        'test-stream',
        'test-group',
        'consumer1',
        60000
      );

      expect(result).toBe(0);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('ackMessages', () => {
    it('should acknowledge messages successfully', async () => {
      mockRedisClient.xack.mockResolvedValue(2);

      const result = await redisService.ackMessages(
        'test-stream',
        'test-group',
        ['1234-0', '1235-0']
      );

      expect(mockRedisClient.xack).toHaveBeenCalledWith(
        'test-stream',
        'test-group',
        '1234-0',
        '1235-0'
      );
      expect(result).toBe(2);
    });

    it('should return 0 for empty message list', async () => {
      const result = await redisService.ackMessages('test-stream', 'test-group', []);

      expect(mockRedisClient.xack).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });
  });

  describe('disconnect', () => {
    it('should disconnect from Redis', async () => {
      await redisService.disconnect();

      expect(mockRedisClient.quit).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Disconnecting from Redis...');
      expect(mockLogger.info).toHaveBeenCalledWith('Disconnected from Redis.');
    });
  });
});
