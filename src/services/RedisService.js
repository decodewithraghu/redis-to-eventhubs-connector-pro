// src/services/RedisService.js
const Redis = require('ioredis');

/**
 * Service for interacting with Redis Streams
 */
class RedisService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger.child({ service: 'RedisService' });
    
    // Add connection timeout
    this.client = new Redis(config.url, {
      retryStrategy: (times) => {
        if (times > 3) {
          this.logger.error('Redis connection retry limit reached. Giving up.');
          return null; // Stop retrying
        }
        const delay = Math.min(times * 50, 2000);
        this.logger.warn({ attempt: times, delay }, 'Retrying Redis connection...');
        return delay;
      },
      maxRetriesPerRequest: 3,
      connectTimeout: 10000, // 10 seconds
      lazyConnect: true, // Don't connect immediately
    });

    this.client.on('error', (error) => {
      this.logger.error({ err: error }, 'Redis client error occurred.');
    });

    this.client.on('reconnecting', () => {
      this.logger.info('Redis client is reconnecting...');
    });
    
    this.client.on('close', () => {
      this.logger.warn('Redis connection closed.');
    });
  }

  async connect() {
    this.logger.info('Connecting to Redis...');
    try {
      await this.client.connect();
      await this.client.ping();
      this.logger.info('Successfully connected to Redis.');
    } catch (error) {
      this.logger.fatal({ err: error }, 'Failed to connect to Redis. Please ensure Redis server is running and accessible.');
      throw error;
    }
  }

  async initializeGroup(streamKey, groupName) {
    try {
      await this.client.xgroup('CREATE', streamKey, groupName, '$', 'MKSTREAM');
      this.logger.info({ streamKey, groupName }, 'Consumer group created.');
    } catch (error) {
      if (error.message.includes('BUSYGROUP')) {
        this.logger.info({ streamKey, groupName }, 'Consumer group already exists.');
      } else {
        this.logger.error({ err: error }, 'Failed to initialize consumer group.');
        throw error;
      }
    }
  }

  /**
   * Claims pending messages that have been idle for too long
   * @param {string} streamKey - Redis stream key
   * @param {string} groupName - Consumer group name
   * @param {string} consumerName - This consumer's name
   * @param {number} minIdleTimeMs - Minimum idle time in milliseconds
   * @returns {Promise<number>} Number of messages claimed
   */
  async claimPendingMessages(streamKey, groupName, consumerName, minIdleTimeMs = 60000) {
    try {
      // Get pending messages for the group
      const pendingInfo = await this.client.xpending(streamKey, groupName, '-', '+', 100);
      
      if (!pendingInfo || pendingInfo.length === 0) {
        return 0;
      }

      const messageIdsToClaim = pendingInfo
        .filter(([id, consumer, idleTime]) => idleTime >= minIdleTimeMs)
        .map(([id]) => id);

      if (messageIdsToClaim.length === 0) {
        return 0;
      }

      // Claim the messages
      const claimed = await this.client.xclaim(
        streamKey,
        groupName,
        consumerName,
        minIdleTimeMs,
        ...messageIdsToClaim
      );

      const claimedCount = claimed ? claimed.length : 0;
      if (claimedCount > 0) {
        this.logger.info({ 
          streamKey, 
          groupName, 
          claimedCount 
        }, 'Claimed pending messages.');
      }

      return claimedCount;
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to claim pending messages.');
      return 0;
    }
  }

  /**
   * Fetches messages from Redis stream
   * @param {string} streamKey - Redis stream key
   * @param {string} groupName - Consumer group name
   * @param {string} consumerName - This consumer's name
   * @param {number} count - Number of messages to fetch
   * @param {number} blockMs - Blocking timeout in milliseconds
   * @returns {Promise<Array<{id: string, fields: string[]}>>} Array of messages
   */
  async fetchMessages(streamKey, groupName, consumerName, count, blockMs) {
    const results = await this.client.xreadgroup('GROUP', groupName, consumerName, 'COUNT', count, 'BLOCK', blockMs, 'STREAMS', streamKey, '>');
    if (!results) return [];
    const messages = results[0][1];
    return messages.map(([id, fields]) => ({ id, fields }));
  }

  /**
   * Acknowledges processed messages
   * @param {string} streamKey - Redis stream key
   * @param {string} groupName - Consumer group name
   * @param {string[]} messageIds - Array of message IDs to acknowledge
   * @returns {Promise<number>} Number of messages acknowledged
   */
  async ackMessages(streamKey, groupName, messageIds) {
    if (messageIds.length === 0) return 0;
    return this.client.xack(streamKey, groupName, ...messageIds);
  }

  async disconnect() {
    this.logger.info('Disconnecting from Redis...');
    await this.client.quit();
    this.logger.info('Disconnected from Redis.');
  }
}

module.exports = RedisService;