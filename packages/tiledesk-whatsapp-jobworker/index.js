 // ✅ Load environment variables first
require('dotenv').config();

// ✅ Force override for Tilebot and Tiledesk Redis
const upstashRedis = 'redis://default:AV1FAAIjcDFkMGExMzk3YzNiOTU0YTg4OGE4ZDY4NTk5MzJlZmQ5NHAxMA@set-rodent-23877.upstash.io:6379';
process.env.REDIS_URL = upstashRedis;
process.env.TD_REDIS_URI = upstashRedis;
process.env.TILEBOT_REDIS_URI = upstashRedis;
process.env.TD_REDIS_ENABLED = 'true';
process.env.TILEBOT_REDIS_ENABLED = 'true';

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { Redis } = require('@upstash/redis');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

let mongoConnected = false;
console.log("🔍 Redis URL =", upstashRedis);

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

// ✅ MongoDB Retry Connection
async function connectMongoWithRetry() {
  try {
    if (!process.env.MONGO_URI) throw new Error("❌ MONGO_URI missing");
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000
      socketTimeoutMS: 45000,          // added socket timeout
      autoIndex: false                 // disable auto-index creation on every startup
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

// ✅ Health Check
app.get('/ping', (req, res) => res.status(200).send("pong"));

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

// ✅ WhatsApp Webhook Handler
app.post('/webhooks/whatsapp/cloudapi', async (req, res) => {
  res.sendStatus(200);
  const data = req.body;
  console.log("📩 Webhook Hit:", JSON.stringify(data));

  await saveToMongo(data);
  await logToRedisIfNeeded(data);

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
async function connectMongoWithRetry() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      autoIndex: false
    });
    console.log("✅ Mongo Connected");
  } catch (err) {
    console.error("❌ Mongo Connect Error:", err.message);
    setTimeout(connectMongoWithRetry, 5000);
  }
}
