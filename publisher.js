// publisher.js
require('dotenv').config();
const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const STREAM_KEY = 'telemetry:events';
const PUBLISH_INTERVAL_MS = 1000;

if (!REDIS_URL) {
  console.error("Error: REDIS_URL is not defined. Please check your .env file.");
  process.exit(1);
}

const redis = new Redis(REDIS_URL);

redis.on('connect', () => console.log('Publisher connected to Redis.'));
redis.on('error', (err) => console.error('Publisher Redis connection error:', err));

async function publishEvent() {
  const eventData = {
    deviceId: `device-${Math.floor(Math.random() * 100)}`,
    temperature: (20 + Math.random() * 15).toFixed(2),
    humidity: (40 + Math.random() * 20).toFixed(2),
    timestamp: new Date().toISOString(),
  };

  try {
    const messageId = await redis.xadd(STREAM_KEY, '*', ...Object.entries(eventData).flat());
    console.log(`Published event with ID: ${messageId} | Device: ${eventData.deviceId}`);
  } catch (err) {
    console.error('Error publishing event to Redis Stream:', err.message);
  }
}

console.log(`Starting data publisher for stream '${STREAM_KEY}'...`);
console.log('Press Ctrl+C to stop.');

const intervalId = setInterval(publishEvent, PUBLISH_INTERVAL_MS);

const shutdown = () => {
  console.log('\nShutting down publisher...');
  clearInterval(intervalId);
  redis.quit();
  console.log('Publisher stopped.');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);