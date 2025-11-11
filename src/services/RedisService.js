// src/services/RedisService.js
const Redis = require('ioredis');

class RedisService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger.child({ service: 'RedisService' });
    this.client = new Redis(config.url);
  }

  async connect() {
    this.logger.info('Connecting to Redis...');
    await this.client.ping();
    this.logger.info('Successfully connected to Redis.');
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

  async fetchMessages(streamKey, groupName, consumerName, count, blockMs) {
    const results = await this.client.xreadgroup('GROUP', groupName, consumerName, 'COUNT', count, 'BLOCK', blockMs, 'STREAMS', streamKey, '>');
    if (!results) return [];
    const messages = results[0][1];
    return messages.map(([id, fields]) => ({ id, fields }));
  }

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