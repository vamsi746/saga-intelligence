/**
 * Seed grievance keywords for Revanth Reddy / Telangana monitoring
 * Run: node scripts/seed_grievance_keywords.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const Keyword = require('../src/models/Keyword');

const KEYWORDS = [
  // ============================================================
  // BATCH 1: Original keywords (already seeded)
  // ============================================================
  // === Hashtags (English) ===
  { keyword: '#RevanthReddy', category: 'hate', language: 'en', weight: 90 },
  { keyword: '#6GuaranteeScam', category: 'hate', language: 'en', weight: 85 },
  { keyword: '#TelanganaDrohi', category: 'hate', language: 'en', weight: 85 },
  { keyword: '#CongressMosam', category: 'hate', language: 'en', weight: 80 },
  { keyword: '#RevanthFailure', category: 'hate', language: 'en', weight: 80 },
  { keyword: '#ArachakaPalana', category: 'hate', language: 'en', weight: 80 },
  { keyword: '#GuaranteeMosam', category: 'hate', language: 'en', weight: 80 },
  { keyword: '#KaleshwaramScam', category: 'hate', language: 'en', weight: 75 },
  { keyword: '#LandScam', category: 'hate', language: 'en', weight: 75 },
  { keyword: '#WomenBetrayal', category: 'hate', language: 'en', weight: 75 },
  // === Telugu phrases ===
  { keyword: 'Revanth Reddy మోసం చేశాడు', category: 'hate', language: 'te', weight: 90 },
  { keyword: '6 గ్యారంటీల మోసం', category: 'hate', language: 'te', weight: 85 },
  { keyword: 'తెలంగాణ ద్రోహి Revanth Reddy', category: 'hate', language: 'te', weight: 85 },
  { keyword: 'అరాచక పాలన', category: 'hate', language: 'te', weight: 80 },
  // === English phrases ===
  { keyword: "Revanth's U-Turn", category: 'hate', language: 'en', weight: 75 },
  { keyword: 'Puppet CM', category: 'hate', language: 'en', weight: 70 },

  // ============================================================
  // BATCH 2: Expanded trolling keywords
  // ============================================================

  // --- HIGH-PRIORITY TROLLING HASHTAGS (English) ---
  { keyword: '#RevanthResign', category: 'hate', language: 'en', weight: 85 },
  { keyword: '#CashForVoteRevanth', category: 'hate', language: 'en', weight: 85 },
  { keyword: '#RevanthFakePromises', category: 'hate', language: 'en', weight: 85 },
  { keyword: '#CongressFailsTelangana', category: 'hate', language: 'en', weight: 80 },
  { keyword: '#RevanthLies', category: 'hate', language: 'en', weight: 80 },
  { keyword: '#TelanganaDebt', category: 'other', language: 'en', weight: 75 },
  { keyword: '#RevanthScam', category: 'hate', language: 'en', weight: 80 },
  { keyword: '#HYDRAATerror', category: 'hate', language: 'en', weight: 75 },
  { keyword: '#RevanthAntiPeople', category: 'hate', language: 'en', weight: 75 },
  { keyword: '#CongressBetraysTelangana', category: 'hate', language: 'en', weight: 80 },
  { keyword: '#RevanthCorruption', category: 'hate', language: 'en', weight: 80 },
  { keyword: '#FarmersBetrayalTelangana', category: 'other', language: 'en', weight: 75 },
  { keyword: '#RevanthGoBack', category: 'hate', language: 'en', weight: 80 },
  { keyword: '#TelanganaAgainstRevanth', category: 'hate', language: 'en', weight: 75 },
  { keyword: '#RevanthFlop', category: 'hate', language: 'en', weight: 70 },
  { keyword: '#RevanthJootaCM', category: 'hate', language: 'en', weight: 75 },
  { keyword: '#HighCommandPuppet', category: 'hate', language: 'en', weight: 70 },
  { keyword: '#SoniaKaGulam', category: 'hate', language: 'en', weight: 70 },
  { keyword: '#DelhiKaDalal', category: 'hate', language: 'en', weight: 75 },
  { keyword: '#RevanthDeepalseVideo', category: 'hate', language: 'en', weight: 70 },
  { keyword: '#TelanganaInDebt', category: 'other', language: 'en', weight: 70 },
  { keyword: '#RevanthAntiTelangana', category: 'hate', language: 'en', weight: 80 },
  { keyword: '#GuaranteeFraud', category: 'hate', language: 'en', weight: 80 },
  { keyword: '#RevanthMosam', category: 'hate', language: 'en', weight: 80 },

  // --- TELUGU TROLLING HASHTAGS ---
  { keyword: '#రేవంత్_మోసం', category: 'hate', language: 'te', weight: 85 },
  { keyword: '#తెలంగాణ_ద్రోహి', category: 'hate', language: 'te', weight: 85 },
  { keyword: '#కాంగ్రెస్_మోసం', category: 'hate', language: 'te', weight: 80 },
  { keyword: '#గ్యారంటీల_మోసం', category: 'hate', language: 'te', weight: 80 },
  { keyword: '#రేవంత్_వైఫల్యం', category: 'hate', language: 'te', weight: 80 },
  { keyword: '#రేవంత్_రాజీనామా', category: 'hate', language: 'te', weight: 75 },
  { keyword: '#రేవంత్_అబద్ధాలు', category: 'hate', language: 'te', weight: 75 },
  { keyword: '#రైతు_ద్రోహి_రేవంత్', category: 'hate', language: 'te', weight: 75 },

  // --- TELUGU TROLLING PHRASES (most viral combos) ---
  { keyword: 'రేవంత్ రెడ్డి మోసగాడు', category: 'hate', language: 'te', weight: 90 },
  { keyword: 'కాంగ్రెస్ మోసం తెలంగాణ', category: 'hate', language: 'te', weight: 85 },
  { keyword: 'రేవంత్ అబద్ధాల రాజు', category: 'hate', language: 'te', weight: 80 },
  { keyword: 'గ్యారంటీలు ఎక్కడ', category: 'other', language: 'te', weight: 85 },
  { keyword: 'ఆరు గ్యారంటీలు అబద్ధం', category: 'hate', language: 'te', weight: 85 },
  { keyword: 'రేవంత్ ఫేక్ ప్రామిస్', category: 'hate', language: 'te', weight: 80 },
  { keyword: 'రేవంత్ రెడ్డి రాజీనామా చేయాలి', category: 'hate', language: 'te', weight: 80 },
  { keyword: 'రేవంత్ పప్పెట్ సీఎం', category: 'hate', language: 'te', weight: 75 },
  { keyword: 'డిల్లీ బానిస రేవంత్', category: 'hate', language: 'te', weight: 75 },
  { keyword: 'హైకమాండ్ బానిస రేవంత్', category: 'hate', language: 'te', weight: 75 },
  { keyword: 'రేవంత్ యూటర్న్ సీఎం', category: 'hate', language: 'te', weight: 75 },
  { keyword: 'తెలంగాణ అప్పుల రాష్ట్రం', category: 'other', language: 'te', weight: 70 },
  { keyword: 'రేవంత్ రెడ్డి అసమర్థుడు', category: 'hate', language: 'te', weight: 75 },
  { keyword: 'రైతులను మోసం చేశాడు రేవంత్', category: 'hate', language: 'te', weight: 80 },
  { keyword: 'మహిళల వంచన కాంగ్రెస్', category: 'hate', language: 'te', weight: 75 },
  { keyword: 'క్యాష్ ఫర్ వోట్ రేవంత్', category: 'hate', language: 'te', weight: 80 },
  { keyword: 'రేవంత్ భూ కుంభకోణం', category: 'hate', language: 'te', weight: 75 },
  { keyword: 'నిరుద్యోగులను మోసం చేశాడు', category: 'other', language: 'te', weight: 75 },

  // --- ENGLISH TROLLING PHRASES ---
  { keyword: 'Revanth Reddy worst CM', category: 'hate', language: 'en', weight: 80 },
  { keyword: 'Revanth Reddy resign', category: 'hate', language: 'en', weight: 80 },
  { keyword: 'Congress cheated Telangana', category: 'hate', language: 'en', weight: 80 },
  { keyword: 'Revanth fake promises', category: 'hate', language: 'en', weight: 80 },
  { keyword: 'Revanth Reddy scam', category: 'hate', language: 'en', weight: 80 },
  { keyword: 'Revanth cash for vote', category: 'hate', language: 'en', weight: 80 },
  { keyword: '6 guarantees fraud', category: 'hate', language: 'en', weight: 85 },
  { keyword: 'Revanth high command puppet', category: 'hate', language: 'en', weight: 75 },
  { keyword: 'Delhi remote control CM', category: 'hate', language: 'en', weight: 70 },
  { keyword: 'Revanth anti farmer', category: 'hate', language: 'en', weight: 75 },
  { keyword: 'Revanth Reddy corruption', category: 'hate', language: 'en', weight: 80 },
  { keyword: 'Telangana debt crisis Revanth', category: 'other', language: 'en', weight: 70 },
  { keyword: 'HYDRAA demolition injustice', category: 'other', language: 'en', weight: 70 },
  { keyword: 'Revanth betrayed farmers', category: 'hate', language: 'en', weight: 75 },
  { keyword: 'Revanth betrayed women', category: 'hate', language: 'en', weight: 75 },
  { keyword: 'Revanth betrayed youth', category: 'hate', language: 'en', weight: 75 },
  { keyword: 'Congress looting Telangana', category: 'hate', language: 'en', weight: 75 },
  { keyword: 'Revanth Reddy incompetent', category: 'hate', language: 'en', weight: 70 },
  { keyword: 'Revanth party jumper', category: 'hate', language: 'en', weight: 70 },
  { keyword: 'Revanth TDP defector', category: 'hate', language: 'en', weight: 65 },

  // --- BILINGUAL / MIXED (Tenglish - common on social media) ---
  { keyword: 'Revanth mosam', category: 'hate', language: 'all', weight: 80 },
  { keyword: 'Revanth drohi', category: 'hate', language: 'all', weight: 80 },
  { keyword: 'guarantee lu ekkada', category: 'other', language: 'all', weight: 75 },
  { keyword: 'Revanth abaddalu', category: 'hate', language: 'all', weight: 75 },
  { keyword: 'Revanth Reddy mosagadu', category: 'hate', language: 'all', weight: 80 },
  { keyword: 'Congress mosam chesindi', category: 'hate', language: 'all', weight: 75 },
  { keyword: 'Revanth rajinaama', category: 'hate', language: 'all', weight: 70 },
  { keyword: 'Revanth Reddy flop show', category: 'hate', language: 'en', weight: 70 },
  { keyword: 'aaru guarantee lu bogus', category: 'hate', language: 'all', weight: 75 },
];

async function seed() {
  await connectDB();
  console.log('Connected to DB');

  let added = 0, skipped = 0;
  for (const kw of KEYWORDS) {
    try {
      await Keyword.findOneAndUpdate(
        { keyword: kw.keyword },
        { $setOnInsert: { ...kw, is_active: true } },
        { upsert: true, new: true }
      );
      const exists = await Keyword.findOne({ keyword: kw.keyword });
      if (exists.created_at && (Date.now() - exists.created_at.getTime()) < 5000) {
        added++;
        console.log(`  + Added: ${kw.keyword}`);
      } else {
        skipped++;
        console.log(`  ~ Already exists: ${kw.keyword}`);
      }
    } catch (err) {
      if (err.code === 11000) {
        skipped++;
        console.log(`  ~ Already exists: ${kw.keyword}`);
      } else {
        console.error(`  ✗ Error adding "${kw.keyword}":`, err.message);
      }
    }
  }

  console.log(`\nDone: ${added} added, ${skipped} already existed`);

  // Show all active keywords
  const all = await Keyword.find({ is_active: true }).sort({ weight: -1 });
  console.log(`\nAll active keywords (${all.length}):`);
  all.forEach(k => console.log(`  [${k.weight}] ${k.keyword} (${k.language}, ${k.category})`));

  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
