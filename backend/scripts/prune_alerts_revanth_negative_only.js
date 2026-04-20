require('dotenv').config();
const mongoose = require('mongoose');

const Alert = require('../src/models/Alert');
const Content = require('../src/models/Content');

const REVANTH_TARGET_REGEX = /\b(revanth\s*reddy|revanth|a\.?\s*revanth\s*reddy|cm\s*revanth|chief\s*minister\s*revanth)\b/i;

function shouldKeep(content) {
    if (!content) return false;
    const sentiment = String(content.sentiment || '').toLowerCase().trim();
    if (sentiment !== 'negative') return false;
    const text = String(content.text || '').trim();
    if (!text) return false;
    return REVANTH_TARGET_REGEX.test(text);
}

async function run() {
    const dbUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    const dbName = process.env.DB_NAME || 'apsagaclone';

    if (!dbUri) {
        throw new Error('MONGODB_URI/MONGO_URI is not configured');
    }

    await mongoose.connect(dbUri, { dbName });
    console.log(`[AlertPrune] Connected to DB: ${dbName}`);

    const alerts = await Alert.find({}).select('id content_id status').lean();
    console.log(`[AlertPrune] Total alerts before prune: ${alerts.length}`);

    const contentIds = [...new Set(alerts.map(a => a.content_id).filter(Boolean))];
    const contents = await Content.find({ id: { $in: contentIds } }).select('id text sentiment').lean();
    const contentMap = new Map(contents.map(c => [c.id, c]));

    const toDeleteIds = [];
    let keepCount = 0;

    for (const alert of alerts) {
        const content = contentMap.get(alert.content_id);
        if (shouldKeep(content)) {
            keepCount += 1;
        } else {
            toDeleteIds.push(alert.id);
        }
    }

    if (toDeleteIds.length > 0) {
        const delResult = await Alert.deleteMany({ id: { $in: toDeleteIds } });
        console.log(`[AlertPrune] Deleted alerts: ${delResult.deletedCount}`);
    } else {
        console.log('[AlertPrune] No alerts deleted (all matched filter)');
    }

    const after = await Alert.countDocuments({});
    console.log(`[AlertPrune] Keep count: ${keepCount}`);
    console.log(`[AlertPrune] Total alerts after prune: ${after}`);

    await mongoose.disconnect();
}

run().catch(async (error) => {
    console.error('[AlertPrune] Fatal:', error.message);
    try { await mongoose.disconnect(); } catch (_) {}
    process.exit(1);
});
