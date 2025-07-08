// ✅ Load environment variables first
require('dotenv').config();

const { Redis } = require('@upstash/redis');
const mongoose = require('mongoose');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

console.log("🧪 Starting Kaapav WhatsApp Worker");

// ✅ Redis Connection — Using Upstash SDK (HTTPS not rediss)
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.error("❌ Redis URL or Token missing in .env");
  process.exit(1);
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

// 🔁 Optional Redis test
(async () => {
  try {
    await redis.set("kaapav_test", "success");
    const res = await redis.get("kaapav_test");
    console.log("✅ Redis Test Passed: ", res);
  } catch (err) {
    console.error("❌ Redis Error:", err.message);
  }
})();

// ✅ MongoDB Connection
(async () => {
  try {
    if (!process.env.MONGO_URI) throw new Error("❌ MONGO_URI is missing");

    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 20000
    });

    console.log("✅ WhatsApp Worker MongoDB Connected");
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1);
  }
})();

// ✅ Webhook Verification (GET) — for Meta
app.get('/webhooks/whatsapp/cloudapi', (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'kaapavverify';
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log("✅ WEBHOOK_VERIFIED by Meta");
    return res.status(200).send(challenge);
  } else {
    console.error("❌ Webhook verification failed");
    return res.sendStatus(403);
  }
});

// ✅ WhatsApp Message Receiver (POST)
app.use(express.json());
app.post('/webhooks/whatsapp/cloudapi', (req, res) => {
  console.log("📩 Incoming WhatsApp Message:");
  console.log(JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

// ✅ Start Express Server
app.listen(PORT, () => {
  console.log(`🚀 WhatsApp Worker Live on port ${PORT}`);
});
