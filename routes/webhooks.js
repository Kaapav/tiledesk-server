const express = require('express');
const router = express.Router();
const axios = require('axios');

// 🔐 Load environment variables
require('dotenv').config();

router.get('/whatsapp/cloudapi', (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'kaapavverify';
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook Verified from Meta');
    return res.status(200).send(challenge);
  } else {
    console.log('❌ Webhook verification failed');
    return res.sendStatus(403);
  }
});

router.post('/whatsapp/cloudapi', async (req, res) => {
  res.sendStatus(200); // Respond to Meta first

  try {
    const incoming = req.body;
    console.log('📩 Received from Meta:', JSON.stringify(incoming));

    // ✅ Forward to Render Worker
    await axios.post(process.env.RENDER_WORKER_URL, incoming, {
      headers: { 'Content-Type': 'application/json' }
    });

    console.log('🚀 Forwarded to Render Worker');
  } catch (err) {
    console.error('❌ Error forwarding to Render Worker:', err.message);
  }
});

module.exports = router;
