// src/config.js
require('dotenv').config();
const path = require('path');

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
    key: 'telemetry:events',
    consumerGroup: 'eventhub-connector-group',
    consumerName: `connector-instance-${process.pid}`,
  },
  processing: {
    batchSize: 50,
    pollTimeoutMs: 5000,
  },
};

if (!config.redis.url) {
  throw new Error('Missing critical environment variable: REDIS_URL');
}

if (config.outputAdapter.type === 'EVENT_HUBS' && (!config.outputAdapter.eventHubs.connectionString || !config.outputAdapter.eventHubs.hubName)) {
  throw new Error('When using EVENT_HUBS adapter, EVENT_HUB_CONNECTION_STRING and EVENT_HUB_NAME are required.');
}

if (config.outputAdapter.type === 'LOCAL_FILE' && !config.outputAdapter.localFile.directory) {
    throw new Error('When using LOCAL_FILE adapter, an output directory path is required.');
}

module.exports = config;