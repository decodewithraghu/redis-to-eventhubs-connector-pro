 =====================================================
  Redis Stream to Azure Event Hubs Connector
=====================================================

This project provides a robust, production-ready Node.js application designed to reliably connect a Redis Stream to an external system. It is built with a modular "adapter" pattern, allowing it to publish messages to either Microsoft Azure Event Hubs or a local file system for testing and development.

The core architecture is built around Redis Streams and Consumer Groups to ensure zero data loss, scalability, and reliable message processing.


Key Features
--------------------
* **Reliability**: Uses Redis Streams with Consumer Groups and message acknowledgements (XACK) to guarantee that messages are not lost if the connector application restarts or crashes.
    *   **Pending Message Recovery**: Automatically claims and retries messages that were not acknowledged (e.g., due to crashes).
    *   **Multiple Batch Handling**: Creates additional batches when needed to prevent message loss when batch limits are reached.
    *   **Connection Resilience**: Configurable retry strategy with timeout and graceful error handling.
* **Flexibility**: Implements an Adapter pattern, allowing easy switching between different output targets.
    *   **Azure Event Hubs Adapter**: Sends messages in batches to a specified Azure Event Hub.
    *   **Local File Adapter**: Writes messages as individual JSON files to a local directory, perfect for local development and testing without needing Azure.
* **Production-Ready Design**:
    *   **Separation of Concerns**: Logic is separated into services for Redis, configuration, logging, and output adapters.
    *   **Dependency Injection**: Services are injected into the main connector, making the application highly testable and modular.
    *   **Structured Logging**: Uses `pino` for machine-readable JSON logs, essential for monitoring in production.
    *   **Graceful Shutdown**: Catches termination signals (like Ctrl+C) to close connections cleanly.
    *   **Custom Error Hierarchy**: Specific error classes for better error tracking and handling.
    *   **Configuration Validation**: Validates all environment variables at startup with helpful error messages.
* **Scalability**: The use of Consumer Groups means you can run multiple instances of the connector to share the processing load from a single Redis Stream.
* **Comprehensive Testing**: 93 unit and integration tests with 90%+ code coverage ensure reliability and maintainability.


Project Structure
--------------------
.
├── .env                  # Your local environment configuration (you must create this)
├── .env.example          # A template for the .env file
├── package.json          # Project dependencies and scripts
├── jest.config.js        # Jest test configuration
├── publisher.js          # A script to generate test data for the Redis Stream
├── __tests__/            # Comprehensive test suite
│   ├── unit/            # Unit tests for all modules
│   │   ├── config.test.js
│   │   ├── errors.test.js
│   │   ├── validation.test.js
│   │   ├── RedisService.test.js
│   │   ├── EventHubsService.test.js
│   │   ├── LocalEventHubService.test.js
│   │   └── StreamConnector.test.js
│   └── integration/     # Integration tests
│       └── connector.integration.test.js
└── src/
    ├── config.js         # Loads and validates configuration from .env
    ├── logger.js         # Configures the structured logger
    ├── errors.js         # Custom error classes
    ├── validation.js     # Configuration validation utilities
    ├── StreamConnector.js  # The main application class that orchestrates the process
    ├── index.js          # The application entry point (wires everything together)
    └── services/
        ├── RedisService.js     # Handles all logic for interacting with Redis Streams
        ├── EventHubsService.js # Adapter for sending data to Azure Event Hubs
        └── LocalEventHubService.js # Adapter for writing data to local files


Prerequisites
--------------------
Before you begin, ensure you have the following installed:

1.  **Node.js**: Version 16.x or newer.
2.  **Redis Server**: **Version 5.0 or newer.**
    *   **CRITICAL**: This project relies on Redis Streams, which were introduced in Redis 5.0. If you use an older version, you will get an `ERR unknown command 'xgroup'` error.
    *   **For Windows Users**: The recommended way to run a modern Redis server is by using **WSL 2** or **Docker Desktop**. The old native Windows builds of Redis are outdated and will not work.
3.  **An Azure Event Hubs Namespace** (Optional): Only required if you plan to use the `EVENT_HUBS` output adapter.


Setup and Installation
--------------------

1.  **Clone the Repository**
    ```bash
    git clone <your-repository-url>
    cd redis-to-eventhubs-connector-pro
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Create Your Configuration File**
    Copy the example environment file to a new `.env` file. This file will hold your local secrets and configuration.
    ```bash
    cp .env.example .env
    ```
    **Now, open the `.env` file and edit it with your settings.**


Configuration (`.env` file)
--------------------
This file controls how the application behaves.

```ini
# --- Redis Configuration ---
# Ensure this URL points to your Redis v5.0+ server
REDIS_URL="redis://localhost:6379"

# --- Stream Configuration ---
STREAM_KEY="telemetry:events"
CONSUMER_GROUP_NAME="eventhub-connector-group"
# CONSUMER_NAME="connector-instance-1"  # Optional, defaults to connector-instance-{PID}

# --- Output Adapter Configuration ---
# Choose where to send the data: 'LOCAL_FILE' or 'EVENT_HUBS'
OUTPUT_ADAPTER_TYPE="LOCAL_FILE"

# Directory for the LOCAL_FILE adapter (optional, defaults to './output')
# OUTPUT_DIRECTORY="./my-test-events"

# --- Azure Event Hubs Configuration (only needed if OUTPUT_ADAPTER_TYPE="EVENT_HUBS") ---
# EVENT_HUB_CONNECTION_STRING="Endpoint=sb://..."
# EVENT_HUB_NAME="your-event-hub-name"

# --- Processing Configuration (optional, uses defaults if not set) ---
# BATCH_SIZE=100                              # Messages to fetch per batch
# POLL_TIMEOUT_MS=5000                        # Time to wait for new messages
# RETRY_DELAY_MS=5000                         # Delay between retries on error
# SHUTDOWN_GRACE_PERIOD_MS=2000               # Grace period for shutdown
# PENDING_MESSAGE_CLAIM_INTERVAL_MS=30000     # How often to check for pending messages
# PENDING_MESSAGE_MIN_IDLE_MS=60000           # Min idle time before claiming pending messages

# --- Logging Configuration (optional) ---
# LOG_LEVEL="info"  # Options: trace, debug, info, warn, error, fatal
```

See `.env.example` for a complete template with all available options and detailed comments.
# How to Run
You will need two separate terminal windows.

## Terminal 1: Start the Connector
This command starts the main application, which will listen for new messages from the Redis Stream. The `| pino-pretty` part makes the logs easy to read for development.
```bash
npm start
```
The connector will initialize and then wait for messages.

## Terminal 2: Start the Test Data Publisher
This script continuously adds new sample messages to the Redis Stream so you can test the connector.
```bash
npm run publish-test-data
```
You will see logs indicating that events are being published.

To stop the applications, press Ctrl+C in each terminal.

## Running Tests
Run the comprehensive test suite to verify everything is working correctly:
```bash
# Run all tests with coverage
npm test

# Run only unit tests
npm test -- __tests__/unit

# Run integration tests (requires Redis server running)
INTEGRATION_TESTS=true npm test -- __tests__/integration

# Run tests in watch mode during development
npm test -- --watch
```

**Test Coverage**: The project has 93 tests with over 90% code coverage across all modules.

Troubleshooting
--------------------

### Error: Missing critical environment variable...
**Solution**: This means your .env file is missing, in the wrong location, or misconfigured.
- Ensure the file is named exactly `.env`.
- Ensure it is in the root directory of the project (next to `package.json`).
- Check that the variable name (e.g., `REDIS_URL`) is spelled correctly inside the file.
- Restart the application after making changes.

### Error: ERR unknown command 'xgroup'
**Solution**: This is a confirmation that you are connected to a Redis server older than version 5.0.
- Verify your Redis version using `redis-cli` and the `INFO server` command.
- Upgrade your Redis server. For Windows users, the best method is to install Redis inside WSL 2 or use Docker.
- Make sure you have stopped any old Redis services running on your machine to avoid port conflicts.

### Application exits immediately: "Failed to connect to Redis"
**Solution**: The connector cannot reach Redis and will gracefully shutdown instead of hanging.
- **Verify Redis is running**: Run `redis-cli ping` in your terminal. You should see `PONG`.
- **Check Redis URL**: Ensure `REDIS_URL` in your `.env` file is correct (default: `redis://localhost:6379`).
- **Check network connectivity**: If using a remote Redis server, verify firewall rules and network access.
- **Check Redis logs**: Look for errors in Redis server logs that might indicate why connections are being rejected.
- **Connection timeout**: The application waits up to 10 seconds and retries 3 times before giving up.

The application will display helpful error messages and exit cleanly if it cannot connect to Redis, rather than hanging indefinitely.

### Error: Redis is already connecting/connected
**Solution**: This means there's a duplicate connection attempt in the code.
- This has been fixed in the latest version - ensure you're using the most recent code.
- The connector now connects to Redis only once during initialization.

### Tests are failing
**Solution**: Ensure your development environment is set up correctly.
- Run `npm install` to ensure all dependencies are installed.
- Check that Node.js version is 16.x or newer: `node --version`
- For integration tests, ensure Redis server is running and set `INTEGRATION_TESTS=true`
- Run `npm test -- --verbose` for detailed test output

## Advanced Configuration

### Pending Message Recovery
The connector automatically recovers messages that were not acknowledged (e.g., due to crashes):
- **PENDING_MESSAGE_CLAIM_INTERVAL_MS**: How often to check for pending messages (default: 30000ms)
- **PENDING_MESSAGE_MIN_IDLE_MS**: Minimum idle time before claiming a pending message (default: 60000ms)

This ensures zero message loss even in failure scenarios.

### Performance Tuning
- **BATCH_SIZE**: Larger batches improve throughput but increase memory usage
- **POLL_TIMEOUT_MS**: Lower values reduce latency but increase CPU usage
- **Connection Pooling**: The connector uses a single Redis connection per instance; run multiple instances for higher throughput

### Running Multiple Instances
To scale horizontally, run multiple connector instances:
```bash
# Each instance will automatically share the workload via consumer groups
# Instance 1
CONSUMER_NAME="connector-1" npm start

# Instance 2 (in another terminal/server)
CONSUMER_NAME="connector-2" npm start
```

## Architecture

### Error Handling
The application uses a custom error hierarchy for better error tracking:
- `ConnectorError` - Base error class
- `RedisConnectionError` - Redis connection failures
- `RedisStreamError` - Redis stream operation errors
- `EventHubsError` - Event Hubs specific errors
- `MessageProcessingError` - Message processing failures
- `ConfigurationError` - Configuration validation errors

### Logging
Structured JSON logging with `pino` provides:
- Request correlation via correlation IDs
- Performance metrics (batch size, processing time)
- Error tracking with stack traces
- Development-friendly pretty printing

### Testing
- **Unit Tests**: Mock all external dependencies for isolated testing
- **Integration Tests**: Test end-to-end flows with real Redis
- **Code Coverage**: >90% coverage across all modules
- **CI/CD Ready**: Tests run in CI pipelines without external dependencies

## Contributing

When contributing to this project:
1. Ensure all tests pass: `npm test`
2. Maintain code coverage above 90%
3. Follow the existing code style
4. Add tests for new features
5. Update documentation as needed

## License

See LICENSE file for details.


```
