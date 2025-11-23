// src/services/EventHubsService.js
const { EventHubProducerClient } = require('@azure/event-hubs');

/**
 * Service for sending events to Azure Event Hubs
 */
class EventHubsService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger.child({ service: 'EventHubsService' });
    this.producer = new EventHubProducerClient(config.connectionString, config.hubName);
  }

  /**
   * Sends events to Event Hubs, creating multiple batches if needed
   * @param {Array<{body: Object, correlationId: string}>} events - Events to send
   * @returns {Promise<number>} Number of events successfully sent
   */
  async sendBatch(events) {
    if (events.length === 0) return 0;
    
    const batches = [];
    let currentBatch = await this.producer.createBatch();
    let addedCount = 0;
    let failedEvents = [];

    for (const event of events) {
      if (!currentBatch.tryAdd(event)) {
        // Current batch is full, save it and create a new one
        if (currentBatch.count > 0) {
          batches.push(currentBatch);
          currentBatch = await this.producer.createBatch();
        }
        
        // Try adding to the new batch
        if (!currentBatch.tryAdd(event)) {
          // Event is too large even for an empty batch
          this.logger.error({ 
            eventId: event.correlationId,
            eventSize: JSON.stringify(event).length 
          }, 'Event is too large to fit in any batch and will be skipped.');
          failedEvents.push(event.correlationId);
          continue;
        }
      }
      addedCount++;
    }

    // Add the last batch if it has events
    if (currentBatch.count > 0) {
      batches.push(currentBatch);
    }

    // Send all batches
    for (let i = 0; i < batches.length; i++) {
      try {
        await this.producer.sendBatch(batches[i]);
        this.logger.debug({ 
          batchNumber: i + 1, 
          totalBatches: batches.length,
          eventsInBatch: batches[i].count 
        }, 'Batch sent successfully.');
      } catch (error) {
        this.logger.error({ 
          err: error, 
          batchNumber: i + 1,
          eventsInBatch: batches[i].count 
        }, 'Failed to send batch to Event Hubs.');
        throw error; // Re-throw to allow caller to handle
      }
    }

    if (failedEvents.length > 0) {
      this.logger.warn({ failedCount: failedEvents.length, failedEvents }, 'Some events were too large and could not be sent.');
    }

    return addedCount;
  }

  async disconnect() {
    this.logger.info('Closing Event Hubs producer...');
    await this.producer.close();
    this.logger.info('Event Hubs producer closed.');
  }
}

module.exports = EventHubsService;