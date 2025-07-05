const mongoose = require('mongoose');

mongoose.connect("mongodb+srv://kaapavin:Kaapav@1428@cluster0.usauxbv.mongodb.net/tiledesk?retryWrites=true&w=majority&appName=Cluster0")
  .then(() => console.log("✅ WhatsApp Worker MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Webhook Verification Route
app.get('/webhooks/whatsapp/cloudapi', (req, res) => {
  const verify_token = process.env.VERIFY_TOKEN || 'kaapavverify';

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === verify_token) {
    console.log('WEBHOOK_VERIFIED');
    res.status(200).send(challenge);
  } else {
    console.error('WEBHOOK_VERIFICATION_FAILED');
    res.sendStatus(403);
  }
});

app.use(express.json());

// Optional: Your POST route for incoming WhatsApp messages
app.post('/webhooks/whatsapp/cloudapi', (req, res) => {
  console.log('📩 Incoming message:', JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`🚀 WhatsApp bot running on port ${PORT}`);
});
