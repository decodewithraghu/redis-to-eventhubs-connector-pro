# Testing Guide

## Overview

This project includes comprehensive test coverage with both unit and integration tests.

## Test Structure

```
__tests__/
├── unit/                           # Unit tests for individual modules
│   ├── RedisService.test.js       # Redis service tests
│   ├── EventHubsService.test.js   # Event Hubs service tests
│   ├── LocalEventHubService.test.js # Local file service tests
│   ├── StreamConnector.test.js    # Main connector tests
│   ├── validation.test.js         # Configuration validation tests
│   ├── errors.test.js             # Custom error classes tests
│   └── config.test.js             # Configuration loading tests
└── integration/                    # Integration tests
    └── connector.integration.test.js # End-to-end tests
```

## Running Tests

### Install Dependencies

First, install the test dependencies:

```bash
npm install
```

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Only Unit Tests

```bash
npm run test:unit
```

### Run Only Integration Tests

**Important:** Integration tests require a running Redis server on `localhost:6379`

```bash
INTEGRATION_TESTS=true npm run test:integration
```

Or on Windows PowerShell:

```powershell
$env:INTEGRATION_TESTS="true"; npm run test:integration
```

### View Test Coverage

```bash
npm test
```

Coverage report will be generated in the `coverage/` directory. Open `coverage/index.html` in a browser to view detailed coverage.

## Test Categories

### Unit Tests

Unit tests use mocks and stubs to test individual components in isolation:

- **RedisService**: Tests Redis operations (connect, fetch, ACK, claim pending)
- **EventHubsService**: Tests Event Hubs batch creation and sending
- **LocalEventHubService**: Tests local file writing
- **StreamConnector**: Tests message processing orchestration
- **Validation**: Tests configuration validation logic
- **Errors**: Tests custom error classes
- **Config**: Tests configuration loading and validation

### Integration Tests

Integration tests verify the entire system working together:

- **End-to-End Message Flow**: Complete Redis → Processing → Output flow
- **Pending Message Recovery**: Verify messages are reclaimed after failures
- **Error Handling**: Test recovery from temporary errors
- **Performance**: Measure throughput with high message volumes

**Prerequisites for Integration Tests:**

1. Redis server running on `localhost:6379`
2. Set `INTEGRATION_TESTS=true` environment variable

## Test Coverage Goals

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

## Writing New Tests

### Unit Test Example

```javascript
const MyService = require('../../src/services/MyService');

describe('MyService', () => {
  let service;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    };
    
    service = new MyService(config, mockLogger);
  });

  it('should do something', async () => {
    const result = await service.doSomething();
    expect(result).toBe(expected);
  });
});
```

### Integration Test Example

```javascript
describe('Integration Test', () => {
  if (!process.env.INTEGRATION_TESTS) {
    test.skip('Set INTEGRATION_TESTS=true to run', () => {});
    return;
  }

  beforeEach(async () => {
    // Setup test environment
  });

  afterEach(async () => {
    // Cleanup
  });

  it('should work end-to-end', async () => {
    // Test implementation
  });
});
```

## Mocking Guidelines

### Mocking External Dependencies

```javascript
// Mock ioredis
jest.mock('ioredis');

// Mock Azure Event Hubs
jest.mock('@azure/event-hubs');

// Mock fs/promises
jest.mock('fs/promises');
```

### Mock Logger

```javascript
const mockLogger = {
  child: jest.fn().mockReturnThis(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  fatal: jest.fn(),
};
```

## Common Test Patterns

### Testing Async Operations

```javascript
it('should handle async operation', async () => {
  await expect(service.asyncMethod()).resolves.toBe(value);
  await expect(service.failingMethod()).rejects.toThrow('Error message');
});
```

### Testing Timers

```javascript
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

it('should handle intervals', () => {
  service.start();
  jest.advanceTimersByTime(1000);
  expect(mockCallback).toHaveBeenCalled();
});
```

### Testing Error Handling

```javascript
it('should handle errors gracefully', async () => {
  mockDependency.method.mockRejectedValue(new Error('Failed'));
  
  await service.handleOperation();
  
  expect(mockLogger.error).toHaveBeenCalledWith(
    expect.objectContaining({ err: expect.any(Error) }),
    expect.stringContaining('Failed')
  );
});
```

## Debugging Tests

### Run Single Test File

```bash
npm test -- RedisService.test.js
```

### Run Single Test

```bash
npm test -- -t "should fetch messages"
```

### Verbose Output

```bash
npm test -- --verbose
```

### See Console Logs

```bash
npm test -- --silent=false
```

## Continuous Integration

Tests should run on every commit and pull request:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      redis:
        image: redis:7
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
      - run: INTEGRATION_TESTS=true npm run test:integration
```

## Troubleshooting

### Integration Tests Fail to Connect to Redis

- Ensure Redis is running: `redis-cli ping` should return `PONG`
- Check Redis is on default port 6379
- Verify no firewall blocking localhost connections

### Tests Timeout

- Increase Jest timeout: Add `jest.setTimeout(10000)` in test
- Check for async operations not resolving
- Look for missing `await` keywords

### Mock Not Working

- Ensure mock is defined before requiring the module
- Check mock is reset between tests: `jest.clearAllMocks()`
- Verify correct mock path

### Coverage Not Generated

- Ensure `collectCoverageFrom` in `jest.config.js` includes your files
- Check files are not in `.gitignore` or `node_modules`

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always cleanup in `afterEach`/`afterAll`
3. **Descriptive Names**: Test names should describe what they test
4. **Arrange-Act-Assert**: Structure tests clearly
5. **Mock External Dependencies**: Don't rely on external services in unit tests
6. **Test Edge Cases**: Include error scenarios and boundary conditions
7. **Keep Tests Fast**: Unit tests should run in milliseconds
8. **One Assertion Per Test**: Focus each test on one thing

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Jest Mocking Guide](https://jestjs.io/docs/mock-functions)
- [Testing Best Practices](https://testingjavascript.com/)
