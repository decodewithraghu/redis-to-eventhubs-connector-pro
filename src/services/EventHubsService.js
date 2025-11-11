// src/services/EventHubsService.js
const { EventHubProducerClient } = require('@azure/event-hubs');

class EventHubsService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger.child({ service: 'EventHubsService' });
    this.producer = new EventHubProducerClient(config.connectionString, config.hubName);
  }

  async sendBatch(events) {
    if (events.length === 0) return 0;
    const batch = await this.producer.createBatch();
    let addedCount = 0;
    for (const event of events) {
        if (batch.tryAdd(event)) {
            addedCount++;
        } else {
            this.logger.warn({ eventId: event.correlationId }, 'Event was too large for the batch and was skipped.');
        }
    }
    if (addedCount > 0) await this.producer.sendBatch(batch);
    return addedCount;
  }

  async disconnect() {
    this.logger.info('Closing Event Hubs producer...');
    await this.producer.close();
    this.logger.info('Event Hubs producer closed.');
  }
}

module.exports = EventHubsService;