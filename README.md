 =====================================================
  Redis Stream to Azure Event Hubs Connector
=====================================================

This project provides a robust, production-ready Node.js application designed to reliably connect a Redis Stream to an external system. It is built with a modular "adapter" pattern, allowing it to publish messages to either Microsoft Azure Event Hubs or a local file system for testing and development.

The core architecture is built around Redis Streams and Consumer Groups to ensure zero data loss, scalability, and reliable message processing.


Key Features
--------------------
* **Reliability**: Uses Redis Streams with Consumer Groups and message acknowledgements (XACK) to guarantee that messages are not lost if the connector application restarts or crashes.
* **Flexibility**: Implements an Adapter pattern, allowing easy switching between different output targets.
    *   **Azure Event Hubs Adapter**: Sends messages in batches to a specified Azure Event Hub.
    *   **Local File Adapter**: Writes messages as individual JSON files to a local directory, perfect for local development and testing without needing Azure.
* **Production-Ready Design**:
    *   **Separation of Concerns**: Logic is separated into services for Redis, configuration, logging, and output adapters.
    *   **Dependency Injection**: Services are injected into the main connector, making the application highly testable and modular.
    *   **Structured Logging**: Uses `pino` for machine-readable JSON logs, essential for monitoring in production.
    *   **Graceful Shutdown**: Catches termination signals (like Ctrl+C) to close connections cleanly.
* **Scalability**: The use of Consumer Groups means you can run multiple instances of the connector to share the processing load from a single Redis Stream.


Project Structure
--------------------
.
├── .env                  # Your local environment configuration (you must create this)
├── .env.example          # A template for the .env file
├── package.json          # Project dependencies and scripts
├── publisher.js          # A script to generate test data for the Redis Stream
└── src/
    ├── config.js         # Loads and validates configuration from .env
    ├── logger.js         # Configures the structured logger
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

# --- Output Adapter Configuration ---
# Choose where to send the data: 'LOCAL_FILE' or 'EVENT_HUBS'
OUTPUT_ADAPTER_TYPE="LOCAL_FILE"

# Directory for the LOCAL_FILE adapter (optional, defaults to './output')
# OUTPUT_DIRECTORY="./my-test-events"

# --- Azure Event Hubs Configuration (only needed if OUTPUT_ADAPTER_TYPE="EVENT_HUBS") ---
# EVENT_HUB_CONNECTION_STRING="Endpoint=sb://..."
# EVENT_HUB_NAME="your-event-hub-name"


```
# How to Run
You will need two separate terminal windows.
# Terminal 1: Start the Connector
This command starts the main application, which will listen for new messages from the Redis Stream. The | pino-pretty part makes the logs easy to read for development.
```
npm start
```
# The connector will initialize and then wait for messages.
Terminal 2: Start the Test Data Publisher
This script continuously adds new sample messages to the Redis Stream so you can test the connector.
```
npm run publish-test-data
```
You will see logs indicating that events are being published.
To stop the applications, press Ctrl+C in each terminal.

Troubleshooting
Error: Missing critical environment variable...
Solution: This means your .env file is missing, in the wrong location, or misconfigured.
Ensure the file is named exactly .env.
Ensure it is in the root directory of the project (next to package.json).
Check that the variable name (e.g., REDIS_URL) is spelled correctly inside the file.
Restart the application after making changes.
Error: ERR unknown command 'xgroup'
Solution: This is a confirmation that you are connected to a Redis server older than version 5.0.
Verify your Redis version using redis-cli and the INFO server command.
Upgrade your Redis server. For Windows users, the best method is to install Redis inside WSL 2 or use Docker.
Make sure you have stopped any old Redis services running on your machine to avoid port conflicts.

```