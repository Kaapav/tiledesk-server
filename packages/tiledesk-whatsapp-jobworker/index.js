// 🔐 Force-set Redis URL for safety (if any code uses it)
process.env.REDIS_URL = process.env.TILEBOT_REDIS_URI || process.env.UPSTASH_REDIS_REST_URL;

require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { Redis } = require('@upstash/redis');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

let mongoConnected = false;
console.log("🔍 Redis URL =", process.env.UPSTASH_REDIS_REST_URL);

// ✅ Redis Init
let redis;
try {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN
  });
  console.log("✅ Redis Client Initialized");
} catch (err) {
  console.error("❌ Redis Init Failed:", err.message);
}

// ✅ Mongo Connection with Retry
async function connectMongoWithRetry() {
  try {
    if (!process.env.MONGO_URI) throw new Error("❌ MONGO_URI missing");
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 20000
    });
    mongoConnected = true;
    console.log("✅ MongoDB Connected");
  } catch (err) {
    mongoConnected = false;
    console.error("❌ MongoDB Connection Failed:", err.message);
    setTimeout(connectMongoWithRetry, 5000);
  }
}
connectMongoWithRetry();

// ✅ Schema
const WhatsAppLog = mongoose.model('whatsapp_logs', new mongoose.Schema({
  data: Object,
  createdAt: { type: Date, default: Date.now }
}));

// ✅ Mongo Save
async function saveToMongo(data) {
  if (!mongoConnected) return console.warn("⚠️ Mongo not connected, skipping");
  try {
    await WhatsAppLog.create({ data });
    console.log("💾 Mongo: Saved");
  } catch (err) {
    console.error("❌ Mongo Save Error:", err.message);
  }
}

// ✅ Redis Log
async function logToRedisIfNeeded(data) {
  try {
    const key = `wa_event_${Date.now()}`;
    await redis.set(key, JSON.stringify(data), { ex: 3600 });
    console.log("📦 Redis: Backup logged");
  } catch (err) {
    console.error("❌ Redis Log Error:", err.message);
  }
}

// ✅ Health
app.get('/ping', (req, res) => res.send("OK"));

// ✅ Meta Verify (GET)
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

// ✅ WhatsApp Webhook (POST)
app.post('/webhooks/whatsapp/cloudapi', async (req, res) => {
  res.sendStatus(200); // Always fast reply to Meta

  const data = req.body;
  console.log("📩 Webhook Hit:\n", JSON.stringify(data));

  // Mongo + Redis log
  await saveToMongo(data);
  await logToRedisIfNeeded(data);

  // Forward to n8n webhook
  if (process.env.N8N_WEBHOOK_URL) {
    try {
      await axios.post(process.env.N8N_WEBHOOK_URL, data);
      console.log("🚀 n8n: Forwarded");
    } catch (err) {
      console.error("❌ n8n Forward Failed:", err.message);
    }
  } else {
    console.warn("⚠️ N8N_WEBHOOK_URL not set — skipping forward");
  }
});

// ✅ Server Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Kaapav WhatsApp Worker LIVE on port ${PORT}`);
});
