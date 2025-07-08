// ✅ Load environment variables
require('dotenv').config();

// ✅ Imports
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { Redis } = require('@upstash/redis');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// ✅ Health flag
let mongoConnected = false;

console.log("🔍 UPSTASH_REDIS_REST_URL =", process.env.UPSTASH_REDIS_REST_URL);
console.log("🔍 UPSTASH_REDIS_REST_TOKEN =", process.env.UPSTASH_REDIS_REST_TOKEN);

// ✅ Redis (Upstash SDK via HTTPS)
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.error("❌ Redis URL or Token missing in .env");
  process.exit(1);
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

// ✅ MongoDB Retry Connection
async function connectMongoWithRetry() {
  try {
    if (!process.env.MONGO_URI) throw new Error("❌ MONGO_URI is missing");

    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 20000
    });

    mongoConnected = true;
    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.error("❌ MongoDB Connect Failed:", err.message);
    mongoConnected = false;
    setTimeout(connectMongoWithRetry, 5000); // Retry every 5s
  }
}
connectMongoWithRetry();

// ✅ MongoDB Schema
const WhatsAppLog = mongoose.model('whatsapp_logs', new mongoose.Schema({
  data: Object,
  createdAt: { type: Date, default: Date.now }
}));

// ✅ Save to Mongo
async function saveToMongo(data) {
  if (!mongoConnected) {
    console.warn("⚠️ Mongo not connected. Skipping save.");
    return;
  }

  try {
    await WhatsAppLog.create({ data });
    console.log("💾 Mongo: Message logged");
  } catch (err) {
    console.error("❌ Mongo Save Error:", err.message);
  }
}

// ✅ Log to Redis (1hr expiry)
async function logToRedisIfNeeded(data) {
  try {
    const key = `wa_event_${Date.now()}`;
    await redis.set(key, JSON.stringify(data), { ex: 3600 });
    console.log("📦 Redis: Backup saved");
  } catch (err) {
    console.error("❌ Redis Log Error:", err.message);
  }
}

// ✅ Health Check
app.get('/ping', (req, res) => {
  res.send("OK");
});

// ✅ Meta Webhook Verification (GET)
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

// ✅ WhatsApp Webhook Handler (POST)
app.post('/webhooks/whatsapp/cloudapi', async (req, res) => {
  try {
    res.sendStatus(200); // 💥 Respond fast to Meta

    const data = req.body;
    console.log("📩 Webhook Hit:", JSON.stringify(data));

    // Log to Mongo & Redis
    await saveToMongo(data);
    await logToRedisIfNeeded(data);

    // 🔁 Forward to n8n webhook
    await axios.post(process.env.N8N_WEBHOOK_URL, data);
    console.log("🚀 n8n Forwarded");
  } catch (error) {
    console.error("❌ Webhook Error:", error.message);
  }
});

// ✅ Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Kaapav WhatsApp Worker LIVE on port ${PORT}`);
});
