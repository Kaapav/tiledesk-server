const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL); // non-SSL Upstash Redis

async function logToRedisIfNeeded(data) {
  try {
    const key = `wa_event_${Date.now()}`;
    await redis.set(key, JSON.stringify(data), 'EX', 3600); // 1-hour expiry
  } catch (err) {
    console.error("❌ Redis Log Error:", err.message);
  }
}
