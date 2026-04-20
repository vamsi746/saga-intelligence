/**
 * Backfill missing district fields for grievances that have city but no district.
 * Also populates the Mahabubnagar constituency via round-robin for grievances
 * tagged to Mahabubnagar-area locations.
 * 
 * Run: node scripts/backfill_locations.js
 * Dry run: node scripts/backfill_locations.js --dry-run
 */
const mongoose = require('mongoose');
require('dotenv').config();

const CITY_TO_DISTRICT = {
    'hyderabad': 'Hyderabad', 'secunderabad': 'Hyderabad', 'begumpet': 'Hyderabad',
    'ameerpet': 'Hyderabad', 'banjara hills': 'Hyderabad', 'jubilee hills': 'Hyderabad',
    'madhapur': 'Hyderabad', 'gachibowli': 'Hyderabad', 'kukatpally': 'Hyderabad',
    'miyapur': 'Hyderabad', 'dilsukhnagar': 'Hyderabad', 'malakpet': 'Hyderabad',
    'telangana': 'Hyderabad', 'telangana state': 'Hyderabad',
    'warangal': 'Warangal', 'hanamkonda': 'Warangal',
    'karimnagar': 'Karimnagar', 'nizamabad': 'Nizamabad', 'khammam': 'Khammam',
    'nalgonda': 'Nalgonda', 'adilabad': 'Adilabad', 'mahabubnagar': 'Mahabubnagar',
    'mahbubnagar': 'Mahabubnagar', 'rangareddy': 'Rangareddy',
    'medak': 'Medak', 'sangareddy': 'Sangareddy', 'siddipet': 'Siddipet',
    'vikarabad': 'Vikarabad', 'kodangal': 'Vikarabad', 'narayanpet': 'Narayanpet',
    'jadcherla': 'Mahabubnagar', 'devarkadra': 'Mahabubnagar', 'makthal': 'Narayanpet',
    'shadnagar': 'Rangareddy', 'suryapet': 'Suryapet', 'kamareddy': 'Kamareddy',
    'jagtial': 'Jagtial', 'peddapalli': 'Peddapalli', 'mancherial': 'Mancherial',
    'nirmal': 'Nirmal', 'wanaparthy': 'Wanaparthy', 'nagarkurnool': 'Nagarkurnool',
    'jangaon': 'Jangaon', 'mahabubabad': 'Mahabubabad', 'medchal': 'Medchal-Malkajgiri',
    'sircilla': 'Rajanna Sircilla', 'kaleshwaram': 'Jagtial',
    'bangalore': null, 'delhi': null, 'patna': null, 'kochi': null, 'agra': null,
    'bhubaneswar': null, 'vijayawada': null, 'nawanshahr': null,
};

const MAHABUBNAGAR_ACS = ['Kodangal', 'Narayanpet', 'Mahbubnagar', 'Jadcherla', 'Devarkadra', 'Makthal', 'Shadnagar'];

const CITY_TO_AC = {
    'kodangal': 'Kodangal', 'narayanpet': 'Narayanpet', 'mahbubnagar': 'Mahbubnagar',
    'mahabubnagar': 'Mahbubnagar', 'jadcherla': 'Jadcherla', 'devarkadra': 'Devarkadra',
    'makthal': 'Makthal', 'shadnagar': 'Shadnagar',
};

const dryRun = process.argv.includes('--dry-run');

async function backfill() {
    const dbUri = process.env.MONGODB_URI;
    const dbName = process.env.DB_NAME || 'apsagaclone';
    await mongoose.connect(dbUri, { dbName });
    console.log(`Connected to DB: ${dbName} (${dryRun ? 'DRY RUN' : 'LIVE'})`);

    const col = mongoose.connection.db.collection('grievances');

    // 1. Backfill missing district from city
    const missingDistrict = await col.find({
        is_active: true,
        'detected_location.city': { $exists: true, $nin: [null, ''] },
        $or: [
            { 'detected_location.district': { $exists: false } },
            { 'detected_location.district': null },
            { 'detected_location.district': '' }
        ]
    }).toArray();

    console.log(`\nGrievances with city but no district: ${missingDistrict.length}`);
    let districtFixed = 0;

    for (const doc of missingDistrict) {
        const city = String(doc.detected_location.city || '').toLowerCase().trim();
        const district = CITY_TO_DISTRICT[city];
        if (!district) {
            console.log(`  SKIP: city="${doc.detected_location.city}" → no district mapping`);
            continue;
        }
        console.log(`  FIX: ${doc._id} city="${doc.detected_location.city}" → district="${district}"`);
        if (!dryRun) {
            await col.updateOne(
                { _id: doc._id },
                { $set: { 'detected_location.district': district } }
            );
        }
        districtFixed++;
    }
    console.log(`District backfilled: ${districtFixed}${dryRun ? ' (dry run)' : ''}`);

    // 2. Backfill Mahabubnagar constituency via round-robin
    const mahbubnagarPattern = /mahabubnagar|mahbubnagar/i;
    const mahbubnagarGrievances = await col.find({
        is_active: true,
        $or: [
            { 'detected_location.city': mahbubnagarPattern },
            { 'detected_location.district': mahbubnagarPattern }
        ],
        $and: [
            {
                $or: [
                    { 'detected_location.constituency': { $exists: false } },
                    { 'detected_location.constituency': null },
                    { 'detected_location.constituency': '' }
                ]
            }
        ]
    }).toArray();

    console.log(`\nMahabubnagar grievances without constituency: ${mahbubnagarGrievances.length}`);
    let rrIndex = 0;

    for (const doc of mahbubnagarGrievances) {
        const city = String(doc.detected_location?.city || '').toLowerCase().trim();
        // Check if city maps to a specific AC
        const directAc = CITY_TO_AC[city];
        let assignedAc;
        if (directAc) {
            assignedAc = directAc;
        } else {
            assignedAc = MAHABUBNAGAR_ACS[rrIndex % MAHABUBNAGAR_ACS.length];
            rrIndex++;
        }
        console.log(`  AC: ${doc._id} city="${doc.detected_location.city}" → constituency="${assignedAc}"${directAc ? '' : ' (round-robin)'}`);
        if (!dryRun) {
            await col.updateOne(
                { _id: doc._id },
                {
                    $set: {
                        'detected_location.constituency': assignedAc,
                        'detected_location.source': (doc.detected_location.source || '') +
                            (directAc ? '' : ',mahabubnagar_ac_round_robin')
                    }
                }
            );
        }
    }
    console.log(`AC assigned: ${mahbubnagarGrievances.length}${dryRun ? ' (dry run)' : ''}`);

    // 3. Summary
    const total = await col.countDocuments({ is_active: true });
    const withCity = await col.countDocuments({ is_active: true, 'detected_location.city': { $exists: true, $nin: [null, ''] } });
    const withDist = await col.countDocuments({ is_active: true, 'detected_location.district': { $exists: true, $nin: [null, ''] } });
    const withConst = await col.countDocuments({ is_active: true, 'detected_location.constituency': { $exists: true, $nin: [null, ''] } });
    console.log(`\n=== Summary ===`);
    console.log(`Total active: ${total}`);
    console.log(`With city: ${withCity}`);
    console.log(`With district: ${withDist}`);
    console.log(`With constituency: ${withConst}`);

    await mongoose.disconnect();
}

backfill().catch(e => { console.error(e); process.exit(1); });
