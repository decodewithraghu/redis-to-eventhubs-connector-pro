// src/errors.js

/**
 * Base error class for the connector application
 */
class ConnectorError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = this.constructor.name;
    this.originalError = originalError;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when Redis connection or operations fail
 */
class RedisConnectionError extends ConnectorError {
  constructor(message, originalError = null) {
    super(message, originalError);
  }
}

/**
 * Error thrown when Redis stream operations fail
 */
class RedisStreamError extends ConnectorError {
  constructor(message, originalError = null) {
    super(message, originalError);
  }
}

/**
 * Error thrown when Event Hubs operations fail
 */
class EventHubsError extends ConnectorError {
  constructor(message, originalError = null) {
    super(message, originalError);
  }
}

/**
 * Error thrown when message processing fails
 */
class MessageProcessingError extends ConnectorError {
  constructor(message, originalError = null, messageId = null) {
    super(message, originalError);
    this.messageId = messageId || null;
  }
}

/**
 * Error thrown when configuration is invalid
 */
class ConfigurationError extends ConnectorError {
  constructor(message, originalError = null) {
    super(message, originalError);
  }
}

module.exports = {
  ConnectorError,
  RedisConnectionError,
  RedisStreamError,
  EventHubsError,
  MessageProcessingError,
  ConfigurationError,
};
