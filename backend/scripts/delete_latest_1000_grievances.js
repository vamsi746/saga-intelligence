require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  const requestedLimit = Number(process.argv[2]);
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.floor(requestedLimit) : 1000;
  const dbUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  const dbName = process.env.DB_NAME || 'apsagaclone';

  if (!dbUri) throw new Error('MONGODB_URI/MONGO_URI missing');

  await mongoose.connect(dbUri, { dbName });
  const col = mongoose.connection.db.collection('grievances');

  const before = await col.countDocuments();
  const latest = await col
    .find({}, { projection: { _id: 1, id: 1, tweet_id: 1, detected_date: 1 } })
    .sort({ detected_date: -1, _id: -1 })
    .limit(limit)
    .toArray();

  const target = latest.length;
  if (target === 0) {
    console.log('BEFORE', before);
    console.log('TARGET', 0);
    console.log('DELETED', 0);
    console.log('AFTER', before);
    console.log('SAMPLE_IDS', '[]');
    await mongoose.disconnect();
    return;
  }

  const mongoIds = latest.map((d) => d._id);
  const del = await col.deleteMany({ _id: { $in: mongoIds } });
  const after = await col.countDocuments();
  const ids = latest.map((d) => d.id).filter(Boolean);

  console.log('BEFORE', before);
  console.log('TARGET', target);
  console.log('DELETED', del.deletedCount);
  console.log('AFTER', after);
  console.log('SAMPLE_IDS', JSON.stringify(ids.slice(0, 10)));

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('FAIL', error.message);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
