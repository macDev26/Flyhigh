const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, 'env.txt') });
const { MongoClient } = require('mongodb');
const { ensureFlyhighNetwork } = require('./airline');
const { ensureLocalMongo } = require('./localMongo');
async function run() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
  await ensureLocalMongo(uri);
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(process.env.MONGO_DB_NAME || 'Airline');
    await ensureFlyhighNetwork(db);
    console.log('Flyhigh routes and the next 14 days of demo departures are ready. Existing seats, bookings and historical records were preserved.');
  } finally { await client.close(); }
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
