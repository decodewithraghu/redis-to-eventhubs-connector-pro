// __tests__/unit/EventHubsService.test.js
const { EventHubProducerClient } = require('@azure/event-hubs');
const EventHubsService = require('../../src/services/EventHubsService');

// Mock Azure Event Hubs
jest.mock('@azure/event-hubs');

describe('EventHubsService', () => {
  let eventHubsService;
  let mockProducer;
  let mockBatch;
  let mockLogger;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock EventBatch
    mockBatch = {
      tryAdd: jest.fn(),
      count: 0,
    };

    // Mock EventHubProducerClient
    mockProducer = {
      createBatch: jest.fn().mockResolvedValue(mockBatch),
      sendBatch: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };

    EventHubProducerClient.mockImplementation(() => mockProducer);

    // Mock logger
    mockLogger = {
      child: jest.fn().mockReturnThis(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const config = {
      connectionString: 'Endpoint=sb://test.servicebus.windows.net/;...',
      hubName: 'test-hub',
    };

    eventHubsService = new EventHubsService(config, mockLogger);
  });

  describe('constructor', () => {
    it('should create EventHubProducerClient with config', () => {
      expect(EventHubProducerClient).toHaveBeenCalledWith(
        'Endpoint=sb://test.servicebus.windows.net/;...',
        'test-hub'
      );
    });
  });

  describe('sendBatch', () => {
    it('should send single batch successfully', async () => {
      const events = [
        { body: { temp: 20 }, correlationId: '1234-0' },
        { body: { temp: 21 }, correlationId: '1235-0' },
      ];

      mockBatch.tryAdd.mockReturnValue(true);
      mockBatch.count = 2;

      const result = await eventHubsService.sendBatch(events);

      expect(mockProducer.createBatch).toHaveBeenCalledTimes(1);
      expect(mockBatch.tryAdd).toHaveBeenCalledTimes(2);
      expect(mockProducer.sendBatch).toHaveBeenCalledWith(mockBatch);
      expect(result).toBe(2);
    });

    it('should return 0 for empty events array', async () => {
      const result = await eventHubsService.sendBatch([]);

      expect(mockProducer.createBatch).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it('should create multiple batches when first batch is full', async () => {
      const events = [
        { body: { temp: 20 }, correlationId: '1234-0' },
        { body: { temp: 21 }, correlationId: '1235-0' },
        { body: { temp: 22 }, correlationId: '1236-0' },
      ];

      // First batch - accepts first event, rejects second
      const mockBatch1 = {
        tryAdd: jest.fn()
          .mockReturnValueOnce(true)   // First event succeeds
          .mockReturnValueOnce(false), // Second event fails (batch full)
        count: 1,
      };

      // Second batch - accepts remaining events
      const mockBatch2 = {
        tryAdd: jest.fn()
          .mockReturnValueOnce(true)   // Second event succeeds
          .mockReturnValueOnce(true),  // Third event succeeds
        count: 2,
      };

      mockProducer.createBatch
        .mockResolvedValueOnce(mockBatch1)
        .mockResolvedValueOnce(mockBatch2);

      const result = await eventHubsService.sendBatch(events);

      expect(mockProducer.createBatch).toHaveBeenCalledTimes(2);
      expect(mockProducer.sendBatch).toHaveBeenCalledTimes(2);
      expect(mockProducer.sendBatch).toHaveBeenCalledWith(mockBatch1);
      expect(mockProducer.sendBatch).toHaveBeenCalledWith(mockBatch2);
      expect(result).toBe(3);
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
    });

    it('should skip events that are too large even for empty batch', async () => {
      const events = [
        { body: { temp: 20 }, correlationId: '1234-0' },
        { body: { huge: 'x'.repeat(10000) }, correlationId: '1235-0' }, // Too large
        { body: { temp: 22 }, correlationId: '1236-0' },
      ];

      const mockBatch1 = {
        tryAdd: jest.fn()
          .mockReturnValueOnce(true)   // First event succeeds
          .mockReturnValueOnce(false), // Second event fails (too large)
        count: 1,
      };

      const mockBatch2 = {
        tryAdd: jest.fn()
          .mockReturnValueOnce(false)  // Second event still fails in new batch
          .mockReturnValueOnce(true),  // Third event succeeds
        count: 1,
      };

      const mockBatch3 = {
        tryAdd: jest.fn()
          .mockReturnValueOnce(true),  // Third event succeeds
        count: 1,
      };

      mockProducer.createBatch
        .mockResolvedValueOnce(mockBatch1)
        .mockResolvedValueOnce(mockBatch2)
        .mockResolvedValueOnce(mockBatch3);

      const result = await eventHubsService.sendBatch(events);

      expect(result).toBe(2); // Only 2 out of 3 events sent
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: '1235-0' }),
        'Event is too large to fit in any batch and will be skipped.'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ failedCount: 1 }),
        'Some events were too large and could not be sent.'
      );
    });

    it('should throw error if sendBatch fails', async () => {
      const events = [{ body: { temp: 20 }, correlationId: '1234-0' }];
      mockBatch.tryAdd.mockReturnValue(true);
      mockBatch.count = 1;

      const error = new Error('Network error');
      mockProducer.sendBatch.mockRejectedValue(error);

      await expect(eventHubsService.sendBatch(events)).rejects.toThrow('Network error');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should log debug info for each batch sent', async () => {
      const events = [
        { body: { temp: 20 }, correlationId: '1234-0' },
        { body: { temp: 21 }, correlationId: '1235-0' },
      ];

      mockBatch.tryAdd.mockReturnValue(true);
      mockBatch.count = 2;

      await eventHubsService.sendBatch(events);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          batchNumber: 1,
          totalBatches: 1,
          eventsInBatch: 2,
        }),
        'Batch sent successfully.'
      );
    });
  });

  describe('disconnect', () => {
    it('should close producer client', async () => {
      await eventHubsService.disconnect();

      expect(mockProducer.close).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Closing Event Hubs producer...');
      expect(mockLogger.info).toHaveBeenCalledWith('Event Hubs producer closed.');
    });
  });
});
