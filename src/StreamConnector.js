// src/StreamConnector.js
const { MessageProcessingError } = require('./errors');

/**
 * Main connector class that orchestrates message processing from Redis to output service
 */
class StreamConnector {
  constructor({ config, logger, redisService, outputService }) {
    this.config = config;
    this.logger = logger;
    this.redisService = redisService;
    this.outputService = outputService;
    this.isRunning = false;
    this.pendingClaimInterval = null;
  }
  
  async start() {
    this.logger.info('Starting Stream Connector...');
    this.isRunning = true;
    
    await this.redisService.initializeGroup(this.config.stream.key, this.config.stream.consumerGroup);

    // Start periodic pending message recovery
    this.startPendingMessageRecovery();

    this.logger.info({ consumer: this.config.stream.consumerName }, 'Starting message processing loop.');
    this.processingLoop().catch(err => {
        this.logger.fatal({ err }, 'Processing loop crashed. The application will exit.');
        process.exit(1);
    });
  }

  /**
   * Starts a periodic task to claim pending messages
   */
  startPendingMessageRecovery() {
    this.pendingClaimInterval = setInterval(async () => {
      try {
        await this.redisService.claimPendingMessages(
          this.config.stream.key,
          this.config.stream.consumerGroup,
          this.config.stream.consumerName,
          this.config.processing.pendingMessageMinIdleMs
        );
      } catch (error) {
        this.logger.error({ err: error }, 'Error claiming pending messages.');
      }
    }, this.config.processing.pendingMessageClaimIntervalMs);
  }

  /**
   * Main processing loop that fetches and processes messages
   */
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

        try {
          const sentCount = await this.outputService.sendBatch(events);
          
          if (sentCount === 0) {
            throw new MessageProcessingError('No events were successfully sent to output service.');
          }
          
          const messageIdsToAck = messages.slice(0, sentCount).map(msg => msg.id);
          const ackCount = await this.redisService.ackMessages(
            this.config.stream.key, 
            this.config.stream.consumerGroup, 
            messageIdsToAck
          );

          this.logger.info({ sentCount, ackCount }, 'Successfully processed a batch of messages.');
          
          // If not all messages were sent, log a warning (they will be retried via pending recovery)
          if (sentCount < messages.length) {
            this.logger.warn({ 
              total: messages.length, 
              sent: sentCount, 
              failed: messages.length - sentCount 
            }, 'Some messages were not sent and will be retried.');
          }
        } catch (sendError) {
          // If sending fails, don't ACK messages - they'll be claimed and retried later
          this.logger.error({ 
            err: sendError, 
            messageCount: messages.length 
          }, 'Failed to send batch to output service. Messages will not be acknowledged and will be retried.');
        }
      } catch (error) {
        this.logger.error({ err: error }, 'An error occurred in the processing loop. Retrying after delay...');
        await new Promise(resolve => setTimeout(resolve, this.config.processing.retryDelayMs));
      }
    }
  }

  async stop() {
    if (!this.isRunning) return;
    this.logger.info('Stopping Stream Connector...');
    this.isRunning = false;

    // Stop pending message recovery
    if (this.pendingClaimInterval) {
      clearInterval(this.pendingClaimInterval);
      this.pendingClaimInterval = null;
    }

    await new Promise(resolve => setTimeout(resolve, this.config.processing.pollTimeoutMs + this.config.processing.shutdownGracePeriodMs));
    await this.redisService.disconnect();
    await this.outputService.disconnect();
    this.logger.info('Stream Connector stopped successfully.');
  }
}

module.exports = StreamConnector;