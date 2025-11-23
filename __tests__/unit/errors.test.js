// __tests__/unit/errors.test.js
const {
  ConnectorError,
  RedisConnectionError,
  RedisStreamError,
  EventHubsError,
  MessageProcessingError,
  ConfigurationError,
} = require('../../src/errors');

describe('Custom Errors', () => {
  describe('ConnectorError', () => {
    it('should create error with message', () => {
      const error = new ConnectorError('Test error');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ConnectorError);
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('ConnectorError');
    });

    it('should store original error', () => {
      const originalError = new Error('Original');
      const error = new ConnectorError('Wrapped error', originalError);
      
      expect(error.originalError).toBe(originalError);
    });

    it('should have stack trace', () => {
      const error = new ConnectorError('Test error');
      
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ConnectorError');
    });
  });

  describe('RedisConnectionError', () => {
    it('should extend ConnectorError', () => {
      const error = new RedisConnectionError('Connection failed');
      
      expect(error).toBeInstanceOf(ConnectorError);
      expect(error).toBeInstanceOf(RedisConnectionError);
      expect(error.name).toBe('RedisConnectionError');
      expect(error.message).toBe('Connection failed');
    });

    it('should store original error', () => {
      const originalError = new Error('ECONNREFUSED');
      const error = new RedisConnectionError('Redis connection failed', originalError);
      
      expect(error.originalError).toBe(originalError);
    });
  });

  describe('RedisStreamError', () => {
    it('should extend ConnectorError', () => {
      const error = new RedisStreamError('Stream operation failed');
      
      expect(error).toBeInstanceOf(ConnectorError);
      expect(error).toBeInstanceOf(RedisStreamError);
      expect(error.name).toBe('RedisStreamError');
    });
  });

  describe('EventHubsError', () => {
    it('should extend ConnectorError', () => {
      const error = new EventHubsError('Event Hub send failed');
      
      expect(error).toBeInstanceOf(ConnectorError);
      expect(error).toBeInstanceOf(EventHubsError);
      expect(error.name).toBe('EventHubsError');
    });
  });

  describe('MessageProcessingError', () => {
    it('should extend ConnectorError', () => {
      const error = new MessageProcessingError('Processing failed');
      
      expect(error).toBeInstanceOf(ConnectorError);
      expect(error).toBeInstanceOf(MessageProcessingError);
      expect(error.name).toBe('MessageProcessingError');
    });

    it('should store message ID', () => {
      const error = new MessageProcessingError(
        'Processing failed',
        null,
        '1234-0'
      );
      
      expect(error.messageId).toBe('1234-0');
    });

    it('should handle null message ID', () => {
      const error = new MessageProcessingError('Processing failed');
      
      expect(error.messageId).toBeNull();
    });
  });

  describe('ConfigurationError', () => {
    it('should extend ConnectorError', () => {
      const error = new ConfigurationError('Invalid configuration');
      
      expect(error).toBeInstanceOf(ConnectorError);
      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.name).toBe('ConfigurationError');
    });
  });

  describe('Error inheritance chain', () => {
    it('should all be instances of Error', () => {
      const errors = [
        new ConnectorError('test'),
        new RedisConnectionError('test'),
        new RedisStreamError('test'),
        new EventHubsError('test'),
        new MessageProcessingError('test'),
        new ConfigurationError('test'),
      ];

      errors.forEach(error => {
        expect(error).toBeInstanceOf(Error);
      });
    });

    it('should have proper prototype chain', () => {
      const error = new RedisConnectionError('test');
      
      expect(Object.getPrototypeOf(error).constructor.name).toBe('RedisConnectionError');
      expect(Object.getPrototypeOf(Object.getPrototypeOf(error)).constructor.name).toBe('ConnectorError');
    });
  });

  describe('Error catching', () => {
    it('should be catchable by specific type', () => {
      try {
        throw new RedisConnectionError('Connection failed');
      } catch (error) {
        expect(error).toBeInstanceOf(RedisConnectionError);
        expect(error).not.toBeInstanceOf(EventHubsError);
      }
    });

    it('should be catchable by base type', () => {
      try {
        throw new RedisConnectionError('Connection failed');
      } catch (error) {
        expect(error).toBeInstanceOf(ConnectorError);
      }
    });
  });
});
