// src/index.js
const config = require('./config');
const logger = require('./logger');
const RedisService = require('./services/RedisService');
const EventHubsService = require('./services/EventHubsService');
const LocalEventHubService = require('./services/LocalEventHubService');
const StreamConnector = require('./StreamConnector');

function createOutputService() {
  const adapterType = config.outputAdapter.type;
  logger.info({ adapter: adapterType }, 'Initializing output service...');
  switch (adapterType) {
    case 'LOCAL_FILE':
      return new LocalEventHubService(config.outputAdapter.localFile, logger);
    case 'EVENT_HUBS':
      return new EventHubsService(config.outputAdapter.eventHubs, logger);
    default:
      throw new Error(`Invalid OUTPUT_ADAPTER_TYPE: '${adapterType}'. Must be 'LOCAL_FILE' or 'EVENT_HUBS'.`);
  }
}

async function main() {
  logger.info('Application starting up...');
  const redisService = new RedisService(config.redis, logger);
  const outputService = createOutputService();
  if (outputService.connect) await outputService.connect();

  const connector = new StreamConnector({
    config, logger, redisService, eventHubsService: outputService,
  });

  const shutdown = async (signal) => {
    logger.warn(`Received ${signal}. Shutting down gracefully...`);
    await connector.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  await connector.start();
  logger.info('Application is running. Press Ctrl+C to exit.');
}

main().catch(err => {
  logger.fatal({ err }, 'Application failed to start.');
  process.exit(1);
});