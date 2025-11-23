// src/validation.js

/**
 * Validates configuration values
 */
class ConfigValidator {
  /**
   * Validates that a value is a positive integer
   * @param {any} value - Value to validate
   * @param {string} name - Name of the configuration parameter
   * @param {number} min - Minimum allowed value
   * @param {number} max - Maximum allowed value
   * @returns {boolean}
   */
  static isValidInteger(value, name, min = 1, max = Number.MAX_SAFE_INTEGER) {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      console.warn(`Warning: ${name} is not a valid integer. Using default.`);
      return false;
    }
    if (num < min || num > max) {
      console.warn(`Warning: ${name} must be between ${min} and ${max}. Using default.`);
      return false;
    }
    return true;
  }

  /**
   * Validates Redis URL format
   * @param {string} url - Redis URL to validate
   * @returns {boolean}
   */
  static isValidRedisUrl(url) {
    if (!url) return false;
    return url.startsWith('redis://') || url.startsWith('rediss://');
  }

  /**
   * Validates adapter type
   * @param {string} type - Adapter type to validate
   * @returns {boolean}
   */
  static isValidAdapterType(type) {
    return ['LOCAL_FILE', 'EVENT_HUBS'].includes(type);
  }

  /**
   * Validates log level
   * @param {string} level - Log level to validate
   * @returns {boolean}
   */
  static isValidLogLevel(level) {
    return ['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(level);
  }
}

module.exports = ConfigValidator;
