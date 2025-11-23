# Quick Reference: New Features

## 🔄 Automatic Pending Message Recovery

The connector now automatically recovers messages that were read but not acknowledged (e.g., due to crashes or failures).

**How it works:**
- Every 60 seconds (configurable), checks for pending messages
- Claims messages that have been idle for > 60 seconds (configurable)
- Retries processing those messages

**Configuration:**
```bash
PENDING_CLAIM_INTERVAL_MS=60000   # Check every minute
PENDING_MIN_IDLE_MS=60000         # Claim messages idle > 1 minute
```

## 📦 Multiple Batch Creation

Events are no longer dropped when a batch fills up.

**Before:**
```
Batch [Event1, Event2, Event3] - Full!
Event4 - DROPPED ❌
```

**After:**
```
Batch 1 [Event1, Event2, Event3] - Full, send it
Batch 2 [Event4] - Send it too ✅
```

## 🔧 Configurable Settings

All major settings are now configurable via environment variables:

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| `BATCH_SIZE` | 50 | 1-1000 | Messages per batch |
| `POLL_TIMEOUT_MS` | 5000 | 100-60000 | How long to wait for messages |
| `RETRY_DELAY_MS` | 5000 | 100-60000 | Delay between retries on error |
| `PENDING_CLAIM_INTERVAL_MS` | 60000 | 10000-600000 | How often to check for pending |
| `PENDING_MIN_IDLE_MS` | 60000 | 10000-600000 | Min idle time before claiming |

## 🚨 Custom Error Types

Better error tracking and debugging:

```javascript
try {
  // ... code
} catch (error) {
  if (error instanceof RedisConnectionError) {
    // Handle Redis connection issues
  } else if (error instanceof EventHubsError) {
    // Handle Event Hubs issues
  }
}
```

**Available error types:**
- `ConfigurationError` - Invalid configuration
- `RedisConnectionError` - Redis connection failures
- `RedisStreamError` - Redis stream operation failures
- `EventHubsError` - Event Hubs operation failures
- `MessageProcessingError` - Message processing failures

## 🔌 Redis Auto-Reconnect

Redis client now automatically reconnects on connection loss:

- Exponential backoff (50ms, 100ms, 150ms, ...)
- Max 2 second delay between retries
- Logged reconnection attempts
- No manual intervention needed

## 📝 Enhanced Logging

More detailed logs with better context:

```json
{
  "level": "info",
  "sentCount": 45,
  "ackCount": 45,
  "msg": "Successfully processed a batch of messages"
}

{
  "level": "warn",
  "total": 50,
  "sent": 45,
  "failed": 5,
  "msg": "Some messages were not sent and will be retried"
}
```

## 🛡️ Improved Reliability

**No data loss scenarios:**

1. **Connector crashes mid-processing**
   - ✅ Pending messages are automatically reclaimed and retried

2. **Event Hubs temporarily unavailable**
   - ✅ Messages stay in Redis, retry after delay

3. **Batch full with more events**
   - ✅ Creates additional batches automatically

4. **Redis connection lost**
   - ✅ Automatically reconnects and continues

5. **Partial batch send failure**
   - ✅ Only successful messages are acknowledged

## 📊 Monitoring Tips

**Check for issues:**

```bash
# Look for pending message recovery
grep "Claimed pending messages" logs.txt

# Look for multiple batch creation
grep "totalBatches" logs.txt

# Look for connection issues
grep "reconnecting" logs.txt

# Look for failed messages
grep "will be retried" logs.txt
```

## ⚡ Performance Tuning

**High throughput scenario:**
```bash
BATCH_SIZE=200
POLL_TIMEOUT_MS=1000
PENDING_CLAIM_INTERVAL_MS=30000
```

**Low latency scenario:**
```bash
BATCH_SIZE=10
POLL_TIMEOUT_MS=500
PENDING_CLAIM_INTERVAL_MS=10000
```

**Balanced (default):**
```bash
BATCH_SIZE=50
POLL_TIMEOUT_MS=5000
PENDING_CLAIM_INTERVAL_MS=60000
```

## 🧪 Testing the Improvements

1. **Test pending recovery:**
   ```bash
   # Start connector and publisher
   npm run publish-test-data
   npm start
   
   # Ctrl+C to stop mid-processing
   # Restart - should see "Claimed pending messages"
   npm start
   ```

2. **Test multiple batches:**
   ```bash
   # Set small batch size
   BATCH_SIZE=5 npm start
   
   # Watch logs for "totalBatches: 2" or more
   ```

3. **Test auto-reconnect:**
   ```bash
   # Start connector
   npm start
   
   # Restart Redis
   # Watch for "reconnecting" messages
   ```

## 📚 Additional Resources

- See `IMPROVEMENTS.md` for detailed technical changes
- See `.env.example` for all configuration options
- See `src/errors.js` for error type definitions
- See `src/validation.js` for validation logic
