// src/services/LocalEventHubService.js
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

/**
 * Service for writing events to local files (for testing/development)
 */
class LocalEventHubService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger.child({ service: 'LocalEventHubService' });
    this.outputDir = this.config.directory;
  }

  /**
   * Creates the output directory if it doesn't exist
   * @returns {Promise<void>}
   */
  async connect() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
      this.logger.info({ directory: this.outputDir }, 'Output directory is ready.');
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to create output directory.');
      throw error;
    }
  }

  /**
   * Writes events to local files as JSON
   * @param {Array<{body: Object, correlationId: string}>} events - Events to write
   * @returns {Promise<number>} Number of events successfully written
   */
  async sendBatch(events) {
    if (events.length === 0) return 0;
    const writePromises = events.map((event, index) => {
      const timestamp = Date.now();
      const uniqueId = crypto.randomBytes(4).toString('hex');
      const filename = `${timestamp}-${index}-${uniqueId}.json`;
      const filePath = path.join(this.outputDir, filename);
      const fileContent = JSON.stringify({
        ...event.body,
        _metadata: {
          correlationId: event.correlationId,
          writtenAt: new Date().toISOString()
        }
      }, null, 2);
      return fs.writeFile(filePath, fileContent).catch(err => {
        this.logger.error({ err, file: filePath }, 'Failed to write event to file.');
        return null;
      });
    });
    const results = await Promise.all(writePromises);
    const successCount = results.filter(r => r !== null).length;
    
    if (successCount < events.length) {
      this.logger.warn({ 
        total: events.length, 
        successful: successCount, 
        failed: events.length - successCount 
      }, 'Some events failed to write to disk.');
    }
    
    return successCount;
  }

  /**
   * No-op disconnect for local file service
   * @returns {Promise<void>}
   */
  async disconnect() {
    this.logger.info('Local file service requires no disconnection.');
    return Promise.resolve();
  }
}

module.exports = LocalEventHubService;