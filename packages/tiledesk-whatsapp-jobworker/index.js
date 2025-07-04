const mongoose = require('mongoose');

mongoose.connect("mongodb+srv://kaapavin:Kaapav@1428@cluster0.usauxbv.mongodb.net/tiledesk?retryWrites=true&w=majority&appName=Cluster0")
  .then(() => console.log("✅ WhatsApp Worker MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));
