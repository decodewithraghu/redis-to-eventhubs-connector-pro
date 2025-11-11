// src/logger.js
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  name: 'redis-eventhubs-connector',
});

module.exports = logger;