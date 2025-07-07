require('dotenv').config(); // ✅ Always load .env first

const Redis = require('ioredis');
const mongoose = require('mongoose');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Redis Setup with Cloud URI
if (!process.env.REDIS_URI) {
  throw new Error("❌ REDIS_URI is missing");
}

const redis = new Redis(process.env.REDIS_URI);
redis.on('connect', () => console.log('✅ Connected to Redis Cloud'));
redis.on('error', (err) => console.error('❌ Redis Error:', err));

// ✅ MongoDB Connection (Error-handled)
(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 20000
    });
    console.log("✅ WhatsApp Worker MongoDB Connected");
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1); // Exit on failure
  }
})();

// ✅ Webhook Verification (GET)
app.get('/webhooks/whatsapp/cloudapi', (req, res) => {
  const verify_token = process.env.VERIFY_TOKEN || 'kaapavverify';
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === verify_token) {
    console.log('✅ WEBHOOK_VERIFIED');
    return res.status(200).send(challenge);
  } else {
    console.error('❌ WEBHOOK_VERIFICATION_FAILED');
    return res.sendStatus(403);
  }
});

// ✅ WhatsApp Message Receiver (POST)
app.use(express.json());
app.post('/webhooks/whatsapp/cloudapi', (req, res) => {
  console.log('📩 Incoming WhatsApp message:', JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

// ✅ Start Server
app.listen(PORT, () => {
  console.log(`🚀 WhatsApp bot running on port ${PORT}`);
});
