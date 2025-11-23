// src/index.js
const config = require('./config');
const logger = require('./logger');
const RedisService = require('./services/RedisService');
const EventHubsService = require('./services/EventHubsService');
const LocalEventHubService = require('./services/LocalEventHubService');
const StreamConnector = require('./StreamConnector');

/**
 * Creates the appropriate output service based on configuration
 * @returns {EventHubsService|LocalEventHubService} The configured output service
 * @throws {Error} If adapter type is invalid
 */
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
  
  try {
    // Connect to Redis first
    await redisService.connect();
    
    // Connect to output service if needed
    if (outputService.connect) await outputService.connect();
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to initialize services. Application cannot start.');
    logger.error('Please check:');
    logger.error('  1. Redis server is running and accessible');
    logger.error('  2. REDIS_URL in .env is correct');
    logger.error('  3. Network connectivity is available');
    process.exit(1);
  }

  const connector = new StreamConnector({
    config, logger, redisService, outputService,
  });

  /**
   * Handles graceful shutdown on signals
   * @param {string} signal - The signal received (SIGINT or SIGTERM)
   */
  const shutdown = async (signal) => {
    logger.warn(`Received ${signal}. Shutting down gracefully...`);
    try {
      await connector.stop();
      logger.info('Application shutdown completed successfully.');
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, 'Error during shutdown.');
      process.exit(1);
    }
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await connector.start();
    logger.info('Application is running. Press Ctrl+C to exit.');
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start connector.');
    await shutdown('ERROR');
  }
}

main().catch(err => {
  logger.fatal({ err }, 'Unhandled error in application startup.');
  process.exit(1);
});