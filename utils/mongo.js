const { MongoClient } = require('mongodb');

async function saveToMongo(data) {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const db = client.db("tiledesk");
    const collection = db.collection("whatsapp_logs");
    await collection.insertOne({ data, createdAt: new Date() });
  } catch (err) {
    console.error("❌ Mongo Save Error:", err.message);
  } finally {
    await client.close();
  }
}
