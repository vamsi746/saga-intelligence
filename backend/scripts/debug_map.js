const mongoose = require('mongoose');
require('dotenv').config();

async function debug() {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.DB_NAME || 'apsagaclone' });
    console.log('Connected');
    
    const Grievance = require('../src/models/Grievance');
    const since = new Date();
    since.setDate(since.getDate() - 30);

    // 1. Check constituency distribution
    const acRows = await Grievance.aggregate([
        { $match: { is_active: true, post_date: { $gte: since }, 'detected_location.constituency': { $exists: true, $nin: [null, ''] } } },
        { $addFields: { _c: { $toLower: { $trim: { input: { $ifNull: ['$detected_location.constituency', ''] } } } } } },
        { $group: { _id: '$_c', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ]);
    console.log('\n=== Constituency distribution ===');
    acRows.forEach(r => console.log(`  ${r._id}: ${r.count}`));

    // 2. Simulate what getMapGrievances scope=mahabubnagar returns
    const acAliasMap = {
        'kodangal': 'kodangal', 'narayanpet': 'narayanpet', 'mahbubnagar': 'mahbubnagar',
        'mahabubnagar': 'mahbubnagar', 'jadcherla': 'jadcherla', 'devarkadra': 'devarkadra',
        'makthal': 'makthal', 'shadnagar': 'shadnagar'
    };
    
    const rows = await Grievance.aggregate([
        { $match: { is_active: true, post_date: { $gte: since }, 'detected_location.constituency': { $exists: true, $nin: [null, ''] } } },
        { $addFields: { _constituency: { $toLower: { $trim: { input: { $ifNull: ['$detected_location.constituency', ''] } } } } } },
        { $match: { _constituency: { $in: Object.keys(acAliasMap) } } },
        { $group: { _id: '$_constituency', count: { $sum: 1 },
            positive: { $sum: { $cond: [{ $eq: ['$analysis.sentiment', 'positive'] }, 1, 0] } },
            negative: { $sum: { $cond: [{ $eq: ['$analysis.sentiment', 'negative'] }, 1, 0] } },
            neutral: { $sum: { $cond: [{ $eq: ['$analysis.sentiment', 'neutral'] }, 1, 0] } }
        } }
    ]);
    
    console.log('\n=== Mahabubnagar scope aggregation (raw rows) ===');
    rows.forEach(r => console.log(`  ${r._id}: count=${r.count}, pos=${r.positive}, neg=${r.negative}, neu=${r.neutral}`));

    // 3. Build the response like the controller does
    const results = {};
    for (const row of rows) {
        const canonical = acAliasMap[row._id] || null;
        if (!canonical) continue;
        if (!results[canonical]) results[canonical] = { count: 0, total: 0, positive: 0, negative: 0, neutral: 0 };
        results[canonical].count += row.count || 0;
        results[canonical].total += row.count || 0;
        results[canonical].positive += row.positive || 0;
        results[canonical].negative += row.negative || 0;
        results[canonical].neutral += row.neutral || 0;
    }
    
    console.log('\n=== Final API response (locations object) ===');
    Object.entries(results).forEach(([k, v]) => console.log(`  ${k}:`, JSON.stringify(v)));
    
    // 4. Check what frontend byAC would produce
    const CITY_TO_AC = {
        'kodangal': 'Kodangal', 'narayanpet': 'Narayanpet', 'mahbubnagar': 'Mahbubnagar',
        'mahabubnagar': 'Mahbubnagar', 'jadcherla': 'Jadcherla', 'devarkadra': 'Devarkadra',
        'makthal': 'Makthal', 'shadnagar': 'Shadnagar'
    };
    const byAC = {};
    Object.entries(results).forEach(([keyword, stats]) => {
        const ac = CITY_TO_AC[keyword];
        if (!ac) return;
        if (!byAC[ac]) byAC[ac] = { count: 0 };
        byAC[ac].count += stats.count || stats.total || 0;
    });
    console.log('\n=== Frontend byAC mapping ===');
    Object.entries(byAC).forEach(([k, v]) => console.log(`  ${k}: count=${v.count}`));

    // 5. Check sample record
    const sample = await Grievance.findOne({ 'detected_location.constituency': 'Kodangal' });
    console.log('\n=== Sample Kodangal record ===');
    console.log('  post_date:', sample?.post_date);
    console.log('  is_active:', sample?.is_active);
    console.log('  detected_location:', JSON.stringify(sample?.detected_location));
    console.log('  analysis.sentiment:', sample?.analysis?.sentiment);
    
    await mongoose.disconnect();
}

debug().catch(e => { console.error(e); process.exit(1); });
