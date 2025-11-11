// src/services/LocalEventHubService.js
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

class LocalEventHubService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger.child({ service: 'LocalEventHubService' });
    this.outputDir = this.config.directory;
  }

  async connect() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
      this.logger.info({ directory: this.outputDir }, 'Output directory is ready.');
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to create output directory.');
      throw error;
    }
  }

  async sendBatch(events) {
    if (events.length === 0) return 0;
    const writePromises = events.map(event => {
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const uniqueId = crypto.randomBytes(4).toString('hex');
      const filename = `${timestamp}-${uniqueId}.json`;
      const filePath = path.join(this.outputDir, filename);
      const fileContent = JSON.stringify(event.body, null, 2);
      return fs.writeFile(filePath, fileContent).catch(err => {
        this.logger.error({ err, file: filePath }, 'Failed to write event to file.');
        return null;
      });
    });
    const results = await Promise.all(writePromises);
    return results.filter(r => r !== null).length;
  }

  async disconnect() {
    this.logger.info('Local file service requires no disconnection.');
    return Promise.resolve();
  }
}

module.exports = LocalEventHubService;