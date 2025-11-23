// __tests__/unit/LocalEventHubService.test.js
const fs = require('fs/promises');
const path = require('path');
const LocalEventHubService = require('../../src/services/LocalEventHubService');

// Mock fs/promises
jest.mock('fs/promises');

describe('LocalEventHubService', () => {
  let localService;
  let mockLogger;
  const testOutputDir = '/test/output';

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock logger
    mockLogger = {
      child: jest.fn().mockReturnThis(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const config = { directory: testOutputDir };
    localService = new LocalEventHubService(config, mockLogger);
  });

  describe('constructor', () => {
    it('should set output directory from config', () => {
      expect(localService.outputDir).toBe(testOutputDir);
    });
  });

  describe('connect', () => {
    it('should create output directory successfully', async () => {
      fs.mkdir.mockResolvedValue(undefined);

      await localService.connect();

      expect(fs.mkdir).toHaveBeenCalledWith(testOutputDir, { recursive: true });
      expect(mockLogger.info).toHaveBeenCalledWith(
        { directory: testOutputDir },
        'Output directory is ready.'
      );
    });

    it('should throw error if directory creation fails', async () => {
      const error = new Error('Permission denied');
      fs.mkdir.mockRejectedValue(error);

      await expect(localService.connect()).rejects.toThrow('Permission denied');
      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: error },
        'Failed to create output directory.'
      );
    });
  });

  describe('sendBatch', () => {
    beforeEach(() => {
      fs.writeFile.mockResolvedValue(undefined);
      // Mock Date.now for consistent timestamps
      jest.spyOn(Date, 'now').mockReturnValue(1234567890000);
      jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2023-01-01T00:00:00.000Z');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should write all events to files successfully', async () => {
      const events = [
        { body: { temp: 20, device: 'sensor1' }, correlationId: '1234-0' },
        { body: { temp: 21, device: 'sensor2' }, correlationId: '1235-0' },
      ];

      const result = await localService.sendBatch(events);

      expect(fs.writeFile).toHaveBeenCalledTimes(2);
      expect(result).toBe(2);

      // Verify file content structure
      const firstCallArgs = fs.writeFile.mock.calls[0];
      const fileContent = JSON.parse(firstCallArgs[1]);
      expect(fileContent).toMatchObject({
        temp: 20,
        device: 'sensor1',
        _metadata: {
          correlationId: '1234-0',
          writtenAt: '2023-01-01T00:00:00.000Z',
        },
      });
    });

    it('should return 0 for empty events array', async () => {
      const result = await localService.sendBatch([]);

      expect(fs.writeFile).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it('should use timestamp and index in filename', async () => {
      const events = [
        { body: { temp: 20 }, correlationId: '1234-0' },
        { body: { temp: 21 }, correlationId: '1235-0' },
      ];

      await localService.sendBatch(events);

      const firstCallPath = fs.writeFile.mock.calls[0][0];
      const secondCallPath = fs.writeFile.mock.calls[1][0];

      // Both should contain timestamp
      expect(firstCallPath).toContain('1234567890000');
      expect(secondCallPath).toContain('1234567890000');

      // Should contain index
      expect(firstCallPath).toContain('-0-');
      expect(secondCallPath).toContain('-1-');

      // Should be in correct directory (normalize path separators)
      expect(path.normalize(firstCallPath)).toContain(path.normalize(testOutputDir));
      expect(path.normalize(secondCallPath)).toContain(path.normalize(testOutputDir));
    });

    it('should handle partial write failures gracefully', async () => {
      const events = [
        { body: { temp: 20 }, correlationId: '1234-0' },
        { body: { temp: 21 }, correlationId: '1235-0' },
        { body: { temp: 22 }, correlationId: '1236-0' },
      ];

      fs.writeFile
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Disk full'))
        .mockResolvedValueOnce(undefined);

      const result = await localService.sendBatch(events);

      expect(result).toBe(2); // 2 out of 3 succeeded
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          total: 3,
          successful: 2,
          failed: 1,
        }),
        'Some events failed to write to disk.'
      );
    });

    it('should include metadata in written files', async () => {
      const events = [
        { body: { temp: 20, humidity: 50 }, correlationId: '1234-0' },
      ];

      await localService.sendBatch(events);

      const fileContent = JSON.parse(fs.writeFile.mock.calls[0][1]);
      expect(fileContent).toEqual({
        temp: 20,
        humidity: 50,
        _metadata: {
          correlationId: '1234-0',
          writtenAt: '2023-01-01T00:00:00.000Z',
        },
      });
    });

    it('should format JSON with proper indentation', async () => {
      const events = [{ body: { temp: 20 }, correlationId: '1234-0' }];

      await localService.sendBatch(events);

      const fileContent = fs.writeFile.mock.calls[0][1];
      // JSON.stringify with null, 2 should create indented JSON
      expect(fileContent).toContain('\n');
      expect(fileContent).toContain('  '); // 2 spaces indentation
    });

    it('should not log warning if all writes succeed', async () => {
      const events = [
        { body: { temp: 20 }, correlationId: '1234-0' },
        { body: { temp: 21 }, correlationId: '1235-0' },
      ];

      await localService.sendBatch(events);

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should resolve immediately without action', async () => {
      await localService.disconnect();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Local file service requires no disconnection.'
      );
    });
  });
});
