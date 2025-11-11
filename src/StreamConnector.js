// src/StreamConnector.js
class StreamConnector {
  constructor({ config, logger, redisService, eventHubsService }) {
    this.config = config;
    this.logger = logger;
    this.redisService = redisService;
    this.eventHubsService = eventHubsService; // This will be the injected service (local or Azure)
    this.isRunning = false;
  }
  
  async start() {
    this.logger.info('Starting Stream Connector...');
    this.isRunning = true;
    
    await this.redisService.connect();
    await this.redisService.initializeGroup(this.config.stream.key, this.config.stream.consumerGroup);

    this.logger.info({ consumer: this.config.stream.consumerName }, 'Starting message processing loop.');
    this.processingLoop().catch(err => {
        this.logger.fatal({ err }, 'Processing loop crashed. The application will exit.');
        process.exit(1);
    });
  }

  async processingLoop() {
    while (this.isRunning) {
      try {
        const messages = await this.redisService.fetchMessages(
          this.config.stream.key, this.config.stream.consumerGroup, this.config.stream.consumerName,
          this.config.processing.batchSize, this.config.processing.pollTimeoutMs
        );

        if (messages.length === 0) continue;
        
        this.logger.debug(`Fetched ${messages.length} messages from Redis stream.`);
        
        const events = messages.map(msg => {
            const body = {};
            for (let i = 0; i < msg.fields.length; i += 2) {
                body[msg.fields[i]] = msg.fields[i + 1];
            }
            return { body, correlationId: msg.id };
        });

        const sentCount = await this.eventHubsService.sendBatch(events);
        const messageIdsToAck = messages.slice(0, sentCount).map(msg => msg.id);
        const ackCount = await this.redisService.ackMessages(this.config.stream.key, this.config.stream.consumerGroup, messageIdsToAck);

        this.logger.info({ sentCount, ackCount }, 'Successfully processed a batch of messages.');
      } catch (error) {
        this.logger.error({ err: error }, 'An error occurred in the processing loop. Retrying after delay...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  async stop() {
    if (!this.isRunning) return;
    this.logger.info('Stopping Stream Connector...');
    this.isRunning = false;

    await new Promise(resolve => setTimeout(resolve, this.config.processing.pollTimeoutMs + 1000));
    await this.redisService.disconnect();
    await this.eventHubsService.disconnect();
    this.logger.info('Stream Connector stopped successfully.');
  }
}

module.exports = StreamConnector;