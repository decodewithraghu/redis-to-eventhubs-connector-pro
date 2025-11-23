// src/config.js
require('dotenv').config();
const path = require('path');
const { ConfigurationError } = require('./errors');
const ConfigValidator = require('./validation');

// Helper function to get validated integer from env
const getIntOrDefault = (envVar, defaultValue, min, max) => {
  const value = process.env[envVar];
  if (!value) return defaultValue;
  return ConfigValidator.isValidInteger(value, envVar, min, max) 
    ? parseInt(value, 10) 
    : defaultValue;
};

const config = {
  redis: {
    url: process.env.REDIS_URL,
  },
  outputAdapter: {
    type: process.env.OUTPUT_ADAPTER_TYPE || 'LOCAL_FILE', 
    eventHubs: {
      connectionString: process.env.EVENT_HUB_CONNECTION_STRING,
      hubName: process.env.EVENT_HUB_NAME,
    },
    localFile: {
      directory: process.env.OUTPUT_DIRECTORY || path.join(__dirname, '..', 'output'),
    },
  },
  stream: {
    key: process.env.STREAM_KEY || 'telemetry:events',
    consumerGroup: process.env.CONSUMER_GROUP || 'eventhub-connector-group',
    consumerName: process.env.CONSUMER_NAME || `connector-instance-${process.pid}`,
  },
  processing: {
    batchSize: getIntOrDefault('BATCH_SIZE', 50, 1, 1000),
    pollTimeoutMs: getIntOrDefault('POLL_TIMEOUT_MS', 5000, 100, 60000),
    retryDelayMs: getIntOrDefault('RETRY_DELAY_MS', 5000, 100, 60000),
    shutdownGracePeriodMs: getIntOrDefault('SHUTDOWN_GRACE_PERIOD_MS', 1000, 0, 30000),
    pendingMessageClaimIntervalMs: getIntOrDefault('PENDING_CLAIM_INTERVAL_MS', 60000, 10000, 600000),
    pendingMessageMinIdleMs: getIntOrDefault('PENDING_MIN_IDLE_MS', 60000, 10000, 600000),
  },
};

// Validation
if (!config.redis.url) {
  throw new ConfigurationError('Missing critical environment variable: REDIS_URL');
}

if (!ConfigValidator.isValidRedisUrl(config.redis.url)) {
  throw new ConfigurationError('REDIS_URL must start with redis:// or rediss://');
}

if (!ConfigValidator.isValidAdapterType(config.outputAdapter.type)) {
  throw new ConfigurationError(`Invalid OUTPUT_ADAPTER_TYPE: '${config.outputAdapter.type}'. Must be 'LOCAL_FILE' or 'EVENT_HUBS'.`);
}

if (config.outputAdapter.type === 'EVENT_HUBS' && (!config.outputAdapter.eventHubs.connectionString || !config.outputAdapter.eventHubs.hubName)) {
  throw new ConfigurationError('When using EVENT_HUBS adapter, EVENT_HUB_CONNECTION_STRING and EVENT_HUB_NAME are required.');
}

if (config.outputAdapter.type === 'LOCAL_FILE' && !config.outputAdapter.localFile.directory) {
    throw new ConfigurationError('When using LOCAL_FILE adapter, an output directory path is required.');
}

module.exports = config;