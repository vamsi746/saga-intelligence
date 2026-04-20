/**
 * Backfill: Assign constituency via round-robin to Hyderabad/Telangana grievances
 * that have no constituency assigned yet.
 * 
 * Run: node scripts/backfill_hyd_constituency.js
 */
const mongoose = require('mongoose');
require('dotenv').config();

const MAHABUBNAGAR_ACS = ['Kodangal', 'Narayanpet', 'Mahbubnagar', 'Jadcherla', 'Devarkadra', 'Makthal', 'Shadnagar'];

async function backfill() {
    const dbUri = process.env.MONGODB_URI;
    const dbName = process.env.DB_NAME || 'apsagaclone';
    await mongoose.connect(dbUri, { dbName });
    console.log(`Connected to DB: ${dbName}`);

    const col = mongoose.connection.db.collection('grievances');

    // Find grievances where city/district/keyword is Hyderabad/Telangana but no constituency
    const query = {
        $and: [
            {
                $or: [
                    { 'detected_location.city': { $regex: /hyderabad|telangana/i } },
                    { 'detected_location.district': { $regex: /hyderabad|telangana/i } },
                    { 'detected_location.keyword_matched': { $regex: /hyderabad|telangana/i } },
                ]
            },
            {
                $or: [
                    { 'detected_location.constituency': { $exists: false } },
                    { 'detected_location.constituency': null },
                    { 'detected_location.constituency': '' },
                ]
            }
        ]
    };

    const docs = await col.find(query, { projection: { _id: 1, text: 1, 'detected_location': 1 } }).toArray();
    console.log(`Found ${docs.length} Hyderabad/Telangana grievances without constituency`);

    if (docs.length === 0) {
        console.log('Nothing to backfill.');
        await mongoose.disconnect();
        return;
    }

    // Get current round-robin index from last assigned constituency
    const lastAssigned = await col.findOne(
        { 'detected_location.constituency': { $in: MAHABUBNAGAR_ACS } },
        { sort: { updatedAt: -1 }, projection: { 'detected_location.constituency': 1 } }
    );
    let rrIndex = 0;
    if (lastAssigned?.detected_location?.constituency) {
        const idx = MAHABUBNAGAR_ACS.indexOf(lastAssigned.detected_location.constituency);
        if (idx >= 0) rrIndex = (idx + 1) % MAHABUBNAGAR_ACS.length;
    }
    console.log(`Starting round-robin at index ${rrIndex} (${MAHABUBNAGAR_ACS[rrIndex]})`);

    // Try to detect AC from text first, otherwise round-robin
    const AC_KEYWORDS = {
        'kodangal': 'Kodangal', 'narayanpet': 'Narayanpet', 'mahbubnagar': 'Mahbubnagar',
        'mahabubnagar': 'Mahbubnagar', 'jadcherla': 'Jadcherla', 'devarkadra': 'Devarkadra',
        'makthal': 'Makthal', 'shadnagar': 'Shadnagar',
    };

    let updated = 0;
    const distribution = {};

    for (const doc of docs) {
        let ac = null;
        // Check if text mentions a specific AC
        const text = (doc.text || '').toLowerCase();
        for (const [kw, acName] of Object.entries(AC_KEYWORDS)) {
            if (text.includes(kw)) {
                ac = acName;
                break;
            }
        }
        // Fallback: round-robin
        if (!ac) {
            ac = MAHABUBNAGAR_ACS[rrIndex];
            rrIndex = (rrIndex + 1) % MAHABUBNAGAR_ACS.length;
        }

        await col.updateOne(
            { _id: doc._id },
            { $set: { 'detected_location.constituency': ac } }
        );
        distribution[ac] = (distribution[ac] || 0) + 1;
        updated++;
    }

    console.log(`\nUpdated ${updated} grievances`);
    console.log('Distribution:', distribution);
    await mongoose.disconnect();
}

backfill().catch(err => { console.error(err); process.exit(1); });
