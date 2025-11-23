// __tests__/unit/validation.test.js
const ConfigValidator = require('../../src/validation');

describe('ConfigValidator', () => {
  // Suppress console.warn for tests
  let consoleWarnSpy;

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('isValidInteger', () => {
    it('should return true for valid integer within range', () => {
      expect(ConfigValidator.isValidInteger(50, 'TEST', 1, 100)).toBe(true);
      expect(ConfigValidator.isValidInteger('75', 'TEST', 1, 100)).toBe(true);
    });

    it('should return true for boundary values', () => {
      expect(ConfigValidator.isValidInteger(1, 'TEST', 1, 100)).toBe(true);
      expect(ConfigValidator.isValidInteger(100, 'TEST', 1, 100)).toBe(true);
    });

    it('should return false for non-integer values', () => {
      expect(ConfigValidator.isValidInteger('abc', 'TEST', 1, 100)).toBe(false);
      expect(ConfigValidator.isValidInteger(null, 'TEST', 1, 100)).toBe(false);
      expect(ConfigValidator.isValidInteger(undefined, 'TEST', 1, 100)).toBe(false);
      expect(console.warn).toHaveBeenCalled();
    });

    it('should return false for values below minimum', () => {
      expect(ConfigValidator.isValidInteger(0, 'TEST', 1, 100)).toBe(false);
      expect(ConfigValidator.isValidInteger(-5, 'TEST', 1, 100)).toBe(false);
      expect(console.warn).toHaveBeenCalled();
    });

    it('should return false for values above maximum', () => {
      expect(ConfigValidator.isValidInteger(101, 'TEST', 1, 100)).toBe(false);
      expect(ConfigValidator.isValidInteger(1000, 'TEST', 1, 100)).toBe(false);
      expect(console.warn).toHaveBeenCalled();
    });

    it('should use default min and max when not provided', () => {
      expect(ConfigValidator.isValidInteger(50, 'TEST')).toBe(true);
      expect(ConfigValidator.isValidInteger(0, 'TEST')).toBe(false);
    });

    it('should handle string numbers', () => {
      expect(ConfigValidator.isValidInteger('42', 'TEST', 1, 100)).toBe(true);
      expect(ConfigValidator.isValidInteger('3.14', 'TEST', 1, 100)).toBe(true); // parseInt will convert to 3
    });
  });

  describe('isValidRedisUrl', () => {
    it('should return true for valid redis:// URL', () => {
      expect(ConfigValidator.isValidRedisUrl('redis://localhost:6379')).toBe(true);
      expect(ConfigValidator.isValidRedisUrl('redis://user:pass@host:6379/0')).toBe(true);
    });

    it('should return true for valid rediss:// URL (SSL)', () => {
      expect(ConfigValidator.isValidRedisUrl('rediss://localhost:6379')).toBe(true);
      expect(ConfigValidator.isValidRedisUrl('rediss://secure-redis.example.com:6380')).toBe(true);
    });

    it('should return false for invalid URLs', () => {
      expect(ConfigValidator.isValidRedisUrl('http://localhost:6379')).toBe(false);
      expect(ConfigValidator.isValidRedisUrl('localhost:6379')).toBe(false);
      expect(ConfigValidator.isValidRedisUrl('tcp://localhost:6379')).toBe(false);
    });

    it('should return false for empty or null values', () => {
      expect(ConfigValidator.isValidRedisUrl('')).toBe(false);
      expect(ConfigValidator.isValidRedisUrl(null)).toBe(false);
      expect(ConfigValidator.isValidRedisUrl(undefined)).toBe(false);
    });
  });

  describe('isValidAdapterType', () => {
    it('should return true for LOCAL_FILE', () => {
      expect(ConfigValidator.isValidAdapterType('LOCAL_FILE')).toBe(true);
    });

    it('should return true for EVENT_HUBS', () => {
      expect(ConfigValidator.isValidAdapterType('EVENT_HUBS')).toBe(true);
    });

    it('should return false for invalid adapter types', () => {
      expect(ConfigValidator.isValidAdapterType('KAFKA')).toBe(false);
      expect(ConfigValidator.isValidAdapterType('local_file')).toBe(false);
      expect(ConfigValidator.isValidAdapterType('')).toBe(false);
      expect(ConfigValidator.isValidAdapterType(null)).toBe(false);
    });
  });

  describe('isValidLogLevel', () => {
    it('should return true for all valid log levels', () => {
      expect(ConfigValidator.isValidLogLevel('trace')).toBe(true);
      expect(ConfigValidator.isValidLogLevel('debug')).toBe(true);
      expect(ConfigValidator.isValidLogLevel('info')).toBe(true);
      expect(ConfigValidator.isValidLogLevel('warn')).toBe(true);
      expect(ConfigValidator.isValidLogLevel('error')).toBe(true);
      expect(ConfigValidator.isValidLogLevel('fatal')).toBe(true);
    });

    it('should return false for invalid log levels', () => {
      expect(ConfigValidator.isValidLogLevel('WARNING')).toBe(false);
      expect(ConfigValidator.isValidLogLevel('INFO')).toBe(false);
      expect(ConfigValidator.isValidLogLevel('verbose')).toBe(false);
      expect(ConfigValidator.isValidLogLevel('')).toBe(false);
      expect(ConfigValidator.isValidLogLevel(null)).toBe(false);
    });
  });
});
