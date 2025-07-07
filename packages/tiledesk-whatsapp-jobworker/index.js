const Redis = require('ioredis');

// 🧠 Use secure Redis Cloud URI (from .env)
if (!process.env.REDIS_URI) {
  throw new Error("❌ REDIS_URI is missing");
}

const redis = new Redis(process.env.REDIS_URI);

// Optional: Confirm Redis Connection
redis.on('connect', () => {
  console.log('✅ Connected to Redis Cloud');
});
redis.on('error', (err) => {
  console.error('❌ Redis Error:', err);
});

const mongoose = require('mongoose');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// 🛡️ MongoDB Connection (Error-proofed)
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
    process.exit(1); // exit if DB fails
  }
})();

// ✅ Webhook Verification Route
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

// ✅ Incoming WhatsApp Message Route
app.use(express.json());
app.post('/webhooks/whatsapp/cloudapi', (req, res) => {
  console.log('📩 Incoming WhatsApp message:', JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`🚀 WhatsApp bot running on port ${PORT}`);
});
