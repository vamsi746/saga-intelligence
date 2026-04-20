require('dotenv').config();
const mongoose = require('mongoose');

const Source = require('../src/models/Source');
const { scanSourceOnce } = require('../src/services/monitorService');

async function run() {
    const dbUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    const dbName = process.env.DB_NAME || 'apsagaclone';

    if (!dbUri) {
        throw new Error('MONGODB_URI/MONGO_URI is not configured');
    }

    process.env.MONITOR_LOOKBACK_DAYS = '1';

    await mongoose.connect(dbUri, { dbName });
    console.log(`[Monitor1D] Connected to DB: ${dbName}`);

    const sources = await Source.find({ is_active: true }).lean();
    console.log(`[Monitor1D] Active profile sources: ${sources.length}`);

    let ok = 0;
    let failed = 0;

    for (const source of sources) {
        const name = source.display_name || source.identifier || source.id;
        try {
            await scanSourceOnce(source);
            ok += 1;
            console.log(`[Monitor1D] OK: ${source.platform} -> ${name}`);
        } catch (error) {
            failed += 1;
            console.error(`[Monitor1D] FAIL: ${source.platform} -> ${name}: ${error.message}`);
        }
    }

    console.log(`[Monitor1D] Completed. total=${sources.length}, ok=${ok}, failed=${failed}`);
    await mongoose.disconnect();
}

run().catch(async (error) => {
    console.error('[Monitor1D] Fatal:', error.message);
    try { await mongoose.disconnect(); } catch (_) {}
    process.exit(1);
});
