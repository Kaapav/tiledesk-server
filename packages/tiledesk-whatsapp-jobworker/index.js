// ✅ Load environment variables first
require('dotenv').config();
console.log("🔍 UPSTASH_REDIS_REST_URL =", process.env.UPSTASH_REDIS_REST_URL);
console.log("🔍 UPSTASH_REDIS_REST_TOKEN =", process.env.UPSTASH_REDIS_REST_TOKEN);

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { Redis } = require('@upstash/redis');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

console.log("🧪 Starting Kaapav WhatsApp Worker");

// ✅ Redis (Upstash via HTTPS)
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.error("❌ Redis credentials missing in .env");
  process.exit(1);
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

(async () => {
  try {
    await redis.set("kaapav_test", "success");
    const test = await redis.get("kaapav_test");
    console.log("✅ Redis Test Passed:", test);
  } catch (err) {
    console.error("❌ Redis Connection Failed:", err.message);
  }
})();

// ✅ MongoDB Connection
let mongoConnected = false;
(async () => {
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
    console.error("❌ MongoDB Connection Failed:", err.message);
  }
})();

// ✅ Mongoose Schema
const WhatsAppLog = mongoose.model('whatsapp_logs', new mongoose.Schema({
  data: Object,
  createdAt: { type: Date, default: Date.now }
}));

// ✅ Mongo Save Function
async function saveToMongo(data) {
  if (!mongoConnected) return console.warn("⚠️ Mongo not connected, skipping save.");
  try {
    await WhatsAppLog.create({ data });
    console.log("💾 MongoDB: Logged");
  } catch (err) {
    console.error("❌ MongoDB Save Error:", err.message);
  }
}

// ✅ Redis Backup Function
async function logToRedisIfNeeded(data) {
  try {
    const key = `wa_event_${Date.now()}`;
    await redis.set(key, JSON.stringify(data), { ex: 3600 });
    console.log("📦 Redis: Backup saved");
  } catch (err) {
    console.error("❌ Redis Save Error:", err.message);
  }
}

// ✅ Health check
app.get('/ping', (req, res) => res.send("OK"));

// ✅ Meta Webhook Verification
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

// ✅ Meta WhatsApp Webhook Receiver
app.post('/webhooks/whatsapp/cloudapi', async (req, res) => {
  res.sendStatus(200); // Always respond fast

  const data = req.body;
  console.log("📩 WhatsApp Message Received:\n", JSON.stringify(data));

  await saveToMongo(data);
  await logToRedisIfNeeded(data);

  // ✅ Optional forward to n8n
  if (process.env.N8N_WEBHOOK_URL) {
    try {
      await axios.post(process.env.N8N_WEBHOOK_URL, data);
      console.log("🚀 n8n: Data forwarded");
    } catch (err) {
      console.error("❌ n8n Forward Error:", err.message);
    }
  } else {
    console.warn("⚠️ N8N_WEBHOOK_URL not set — skipping forward");
  }
});

// ✅ Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Kaapav WhatsApp Worker LIVE on port ${PORT}`);
});
