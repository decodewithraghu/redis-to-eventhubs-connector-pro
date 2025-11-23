// __tests__/integration/connector.integration.test.js
/**
 * Integration tests for the Redis to Event Hubs connector
 * 
 * These tests require:
 * - Redis server running on localhost:6379
 * - Set INTEGRATION_TESTS=true to run these tests
 * 
 * Run with: INTEGRATION_TESTS=true npm test -- integration
 */

const Redis = require('ioredis');
const RedisService = require('../../src/services/RedisService');
const LocalEventHubService = require('../../src/services/LocalEventHubService');
const StreamConnector = require('../../src/StreamConnector');
const fs = require('fs/promises');
const path = require('path');

const SKIP_INTEGRATION = !process.env.INTEGRATION_TESTS;

describe('Integration Tests', () => {
  if (SKIP_INTEGRATION) {
    test.skip('Skipping integration tests. Set INTEGRATION_TESTS=true to run.', () => {});
    return;
  }

  let redisClient;
  let redisService;
  let outputService;
  let connector;
  let mockLogger;
  let testOutputDir;

  const TEST_STREAM = 'test-integration-stream';
  const TEST_GROUP = 'test-integration-group';
  const TEST_CONSUMER = 'test-integration-consumer';

  beforeAll(async () => {
    // Create test output directory
    testOutputDir = path.join(__dirname, '../../test-output');
    await fs.mkdir(testOutputDir, { recursive: true });
  });

  beforeEach(async () => {
    // Create Redis client for test setup
    redisClient = new Redis({
      host: 'localhost',
      port: 6379,
      retryStrategy: () => null, // Don't retry on connection failure
    });

    // Wait for connection
    await redisClient.ping();

    // Clean up test stream if it exists
    try {
      await redisClient.del(TEST_STREAM);
    } catch (err) {
      // Ignore if doesn't exist
    }

    // Mock logger
    mockLogger = {
      child: jest.fn().mockReturnThis(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      fatal: jest.fn(),
    };

    // Create services
    redisService = new RedisService(
      { url: 'redis://localhost:6379' },
      mockLogger
    );

    outputService = new LocalEventHubService(
      { directory: testOutputDir },
      mockLogger
    );

    const config = {
      stream: {
        key: TEST_STREAM,
        consumerGroup: TEST_GROUP,
        consumerName: TEST_CONSUMER,
      },
      processing: {
        batchSize: 10,
        pollTimeoutMs: 1000,
        retryDelayMs: 1000,
        shutdownGracePeriodMs: 100,
        pendingMessageClaimIntervalMs: 5000,
        pendingMessageMinIdleMs: 2000,
      },
    };

    connector = new StreamConnector({
      config,
      logger: mockLogger,
      redisService,
      outputService,
    });
  });

  afterEach(async () => {
    // Stop connector if running
    if (connector && connector.isRunning) {
      await connector.stop();
    }

    // Clean up test stream
    try {
      await redisClient.del(TEST_STREAM);
    } catch (err) {
      // Ignore
    }

    await redisClient.quit();

    // Clean up test output files
    try {
      const files = await fs.readdir(testOutputDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(testOutputDir, file)))
      );
    } catch (err) {
      // Ignore
    }
  });

  afterAll(async () => {
    // Remove test output directory
    try {
      await fs.rmdir(testOutputDir);
    } catch (err) {
      // Ignore
    }
  });

  describe('End-to-End Message Flow', () => {
    it('should process messages from Redis to local files', async () => {
      // Publish test messages to Redis stream
      await redisClient.xadd(TEST_STREAM, '*', 'device', 'sensor1', 'temp', '20');
      await redisClient.xadd(TEST_STREAM, '*', 'device', 'sensor2', 'temp', '21');
      await redisClient.xadd(TEST_STREAM, '*', 'device', 'sensor3', 'temp', '22');

      // Start connector
      await connector.start();

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Stop connector
      await connector.stop();

      // Verify files were created
      const files = await fs.readdir(testOutputDir);
      expect(files.length).toBe(3);

      // Verify file contents
      const fileContents = await Promise.all(
        files.map(file => fs.readFile(path.join(testOutputDir, file), 'utf8'))
      );

      const parsedData = fileContents.map(content => JSON.parse(content));
      
      expect(parsedData).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ device: 'sensor1', temp: '20' }),
          expect.objectContaining({ device: 'sensor2', temp: '21' }),
          expect.objectContaining({ device: 'sensor3', temp: '22' }),
        ])
      );

      // Verify metadata
      parsedData.forEach(data => {
        expect(data._metadata).toBeDefined();
        expect(data._metadata.correlationId).toBeDefined();
        expect(data._metadata.writtenAt).toBeDefined();
      });
    });

    it('should acknowledge processed messages', async () => {
      // Publish messages
      await redisClient.xadd(TEST_STREAM, '*', 'test', 'value1');
      await redisClient.xadd(TEST_STREAM, '*', 'test', 'value2');

      // Start connector
      await connector.start();
      await new Promise(resolve => setTimeout(resolve, 2000));
      await connector.stop();

      // Check pending messages (should be 0 as they were ACKed)
      const pending = await redisClient.xpending(TEST_STREAM, TEST_GROUP);
      expect(pending[0]).toBe(0); // No pending messages
    });

    it('should handle consumer group creation', async () => {
      // Connector should create the group
      await connector.start();
      await new Promise(resolve => setTimeout(resolve, 500));
      await connector.stop();

      // Verify group exists by trying to read from it
      const groups = await redisClient.xinfo('GROUPS', TEST_STREAM);
      expect(groups.length).toBeGreaterThan(0);
      
      const groupNames = groups.map((g, i) => 
        i % 2 === 0 && groups[i] === 'name' ? groups[i + 1] : null
      ).filter(Boolean);
      
      expect(groupNames).toContain(TEST_GROUP);
    });

    it('should process batches correctly', async () => {
      // Publish more messages than batch size
      for (let i = 0; i < 25; i++) {
        await redisClient.xadd(TEST_STREAM, '*', 'index', i.toString(), 'batch', 'test');
      }

      await connector.start();
      await new Promise(resolve => setTimeout(resolve, 3000));
      await connector.stop();

      const files = await fs.readdir(testOutputDir);
      expect(files.length).toBe(25);
    });
  });

  describe('Pending Message Recovery', () => {
    it('should recover pending messages after restart', async () => {
      // Publish messages
      await redisClient.xadd(TEST_STREAM, '*', 'test', 'pending1');
      await redisClient.xadd(TEST_STREAM, '*', 'test', 'pending2');

      // Read messages but don't ACK (simulate crash)
      await redisService.connect();
      await redisService.initializeGroup(TEST_STREAM, TEST_GROUP);
      
      const messages = await redisService.fetchMessages(
        TEST_STREAM,
        TEST_GROUP,
        TEST_CONSUMER,
        10,
        100
      );

      expect(messages.length).toBe(2);
      // Don't ACK - simulate crash
      await redisService.disconnect();

      // Wait for messages to become idle
      await new Promise(resolve => setTimeout(resolve, 2500));

      // Start new connector instance (simulating restart)
      const newRedisService = new RedisService(
        { url: 'redis://localhost:6379' },
        mockLogger
      );

      await newRedisService.connect();
      
      // Claim pending messages
      const claimed = await newRedisService.claimPendingMessages(
        TEST_STREAM,
        TEST_GROUP,
        'new-consumer',
        2000
      );

      expect(claimed).toBe(2);
      await newRedisService.disconnect();
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection errors', async () => {
      const badRedisService = new RedisService(
        { url: 'redis://invalid-host:6379' },
        mockLogger
      );

      await expect(badRedisService.connect()).rejects.toThrow();
    });

    it('should continue processing after temporary errors', async () => {
      // Publish messages
      for (let i = 0; i < 5; i++) {
        await redisClient.xadd(TEST_STREAM, '*', 'index', i.toString());
      }

      // Mock temporary failure
      const originalSendBatch = outputService.sendBatch.bind(outputService);
      let callCount = 0;
      
      outputService.sendBatch = jest.fn(async (events) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Temporary failure');
        }
        return originalSendBatch(events);
      });

      await connector.start();
      await new Promise(resolve => setTimeout(resolve, 4000));
      await connector.stop();

      // Should have retried and eventually succeeded
      expect(outputService.sendBatch).toHaveBeenCalled();
      
      const files = await fs.readdir(testOutputDir);
      expect(files.length).toBeGreaterThan(0); // Some messages should have been processed
    });
  });

  describe('Performance', () => {
    it('should handle high message throughput', async () => {
      const messageCount = 100;
      
      // Publish many messages
      const publishPromises = [];
      for (let i = 0; i < messageCount; i++) {
        publishPromises.push(
          redisClient.xadd(TEST_STREAM, '*', 'index', i.toString(), 'data', `value${i}`)
        );
      }
      await Promise.all(publishPromises);

      const startTime = Date.now();
      
      await connector.start();
      
      // Wait for all messages to be processed
      let processed = 0;
      while (processed < messageCount && Date.now() - startTime < 30000) {
        const files = await fs.readdir(testOutputDir);
        processed = files.length;
        
        if (processed < messageCount) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      await connector.stop();
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify all messages processed
      const files = await fs.readdir(testOutputDir);
      expect(files.length).toBe(messageCount);

      // Log performance metrics
      console.log(`Processed ${messageCount} messages in ${duration}ms`);
      console.log(`Throughput: ${(messageCount / (duration / 1000)).toFixed(2)} msg/sec`);
    }, 35000); // Extended timeout for this test
  });
});
