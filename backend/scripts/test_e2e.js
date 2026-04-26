/**
 * END-TO-END PIPELINE TEST
 *
 * Runs each test case through the full analysis pipeline and prints
 * a clean per-case report:
 *
 *   1. Inputs (text + metadata)
 *   2. Pass A — Person Detection (who was identified, how)
 *   3. Pass B — Location Extraction
 *   4. Pass C — LLM Classification (raw + matrix-derived sentiment)
 *   5. Pass D — Mapping Engine (legal sections, platform policies)
 *   6. Final stored shape (what would be written to grievance.linked_persons)
 *   7. Filter preview (which leader handles this post would match)
 *
 * ────────────────────────────────────────────────────────────────
 * HOW TO ADD YOUR OWN TEST CONTENT
 * ────────────────────────────────────────────────────────────────
 * Edit the TEST_CASES array below. Each case is an object:
 *
 *   {
 *     label:           'Short description for the report header',
 *     text:            'The post text to analyze',
 *     mentions:        ['@handle1', '@handle2'],     // optional
 *     hashtags:        ['tag1', 'tag2'],             // optional (no '#')
 *     taggedAccount:   '@some_handle',               // optional
 *     authorHandle:    '@author',                    // optional
 *     filterHandle:    '@revanth_anumula'            // optional — preview which
 *                                                    //   handle filter would
 *                                                    //   surface this post
 *   }
 *
 * Only `text` is required. Everything else is optional metadata.
 *
 * ────────────────────────────────────────────────────────────────
 * RUN
 * ────────────────────────────────────────────────────────────────
 *   cd backend
 *   node scripts/test_e2e.js
 *
 * Optional: pass a single ad-hoc text from the CLI (overrides TEST_CASES):
 *   node scripts/test_e2e.js "Revanth Reddy is doing great work"
 *
 * No MongoDB required. LLM calls real Ollama (llama3.1) if reachable,
 * otherwise falls back to GitHub Models if GITHUB_TOKEN is set, otherwise
 * the LLM stage is skipped with a clear notice.
 */
require('dotenv').config({ path: './.env' });

const axios = require('axios');
const mongoose = require('mongoose');
const { analyzeContent } = require('../src/services/analysisService');
const { detectPersons } = require('../src/services/personDetectionService');

// Connect to MongoDB if MONGODB_URI is set, so mappingService /
// locationExtractionService can read their config from the DB.
// If the URI is missing or the DB is unreachable, both services fall back
// to bundled file data — the pipeline still works, just with noisier logs.
async function connectMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('  ⚠  MONGODB_URI not set — services will use fallback file data');
    return false;
  }
  try {
    mongoose.set('bufferTimeoutMS', 5000);
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('  ✓  MongoDB connected');
    return true;
  } catch (e) {
    console.log(`  ⚠  MongoDB connect failed (${e.message}) — using fallback file data`);
    return false;
  }
}

// ════════════════════════════════════════════════════════════════
// 👇  ADD YOUR TEST CONTENT HERE  👇
// ════════════════════════════════════════════════════════════════
const TEST_CASES = [
  {
    label: 'Praise our CM (handle tag)',
    text: `కొడంగల్‌లో రేవంత్‌కు 
హరీశ్‌రావు సవాల్‌
#HarishRao #cmrevanthreddy #kodangal #etvdigital
`,
    taggedAccount: '@revanth_anumula',
    authorHandle: '@citizen_one',
    filterHandle: '@revanth_anumula'
  }
];

// ════════════════════════════════════════════════════════════════
// Pretty printing helpers
// ════════════════════════════════════════════════════════════════
const HR = '─'.repeat(72);
const DHR = '═'.repeat(72);
const SHR = '┄'.repeat(72);

const banner = (title) => {
  console.log('\n' + DHR);
  console.log(`  ${title}`);
  console.log(DHR);
};

const sub = (title) => console.log(`\n${HR}\n  ${title}\n${HR}`);

const kv = (k, v) => console.log(`  ${(k + ':').padEnd(22)} ${v}`);

// ════════════════════════════════════════════════════════════════
// LLM availability probe (purely informational)
// ════════════════════════════════════════════════════════════════
async function probeProviders() {
  let ollama = false;
  try {
    const r = await axios.get(
      `${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}/api/tags`,
      { timeout: 2000 }
    );
    ollama = r.status === 200;
  } catch (_) { /* down */ }
  const github = !!process.env.GITHUB_TOKEN;
  return { ollama, github };
}

// ════════════════════════════════════════════════════════════════
// Filter preview — mirrors grievanceController handle filter
// ════════════════════════════════════════════════════════════════
const normalize = (v) => String(v || '').trim().replace(/^@/, '').toLowerCase();

function previewHandleFilter(grievanceShape, handle) {
  const norm = normalize(handle);
  const taggedHit = grievanceShape.tagged_account_normalized === norm;
  const linkedHit = (grievanceShape.linked_persons || []).some(
    (p) => p.handle_normalized === norm
  );
  return {
    matches: taggedHit || linkedHit,
    via: taggedHit ? 'tagged directly' : (linkedHit ? 'identified in content' : '—')
  };
}

// ════════════════════════════════════════════════════════════════
// Run one case end-to-end
// ════════════════════════════════════════════════════════════════
async function runCase(idx, total, tc, providers) {
  banner(`CASE ${idx + 1}/${total}  —  ${tc.label || '(no label)'}`);

  // --- 1. Inputs ---
  sub('1. INPUTS');
  console.log(`  text: "${tc.text}"`);
  if (tc.taggedAccount) kv('taggedAccount', tc.taggedAccount);
  if (tc.authorHandle)  kv('authorHandle', tc.authorHandle);
  if (tc.mentions)      kv('mentions', JSON.stringify(tc.mentions));
  if (tc.hashtags)      kv('hashtags', JSON.stringify(tc.hashtags));

  // --- 2. Person detection (standalone view) ---
  sub('2. PASS A — PERSON DETECTION');
  const persons = await detectPersons(tc.text, {
    mentions: tc.mentions || [],
    hashtags: tc.hashtags || [],
    taggedAccount: tc.taggedAccount,
    authorHandle: tc.authorHandle
  });
  if (persons.length === 0) {
    console.log('  (no leaders identified)');
  } else {
    persons.forEach((p, i) => {
      console.log(`  [${i + 1}] ${p.name}`);
      console.log(`        side=${p.side}  party=${p.party}  role=${p.role}`);
      console.log(`        handle=${p.handle}  handle_normalized=${p.handle_normalized}`);
      console.log(`        match_type=${p.match_type}`);
    });
  }

  // --- 3+4+5. Full pipeline through analysisService ---
  sub('3-5. PIPELINE (Person + Location + LLM + Mapping)');
  if (!providers.ollama && !providers.github) {
    console.log('  ⚠  Skipping LLM-dependent stages — no provider reachable');
    console.log('     (set OLLAMA up or export GITHUB_TOKEN to run full E2E)');
    return;
  }

  let result;
  try {
    result = await analyzeContent(tc.text, {
      platform: 'x',
      mentions: tc.mentions || [],
      hashtags: tc.hashtags || [],
      taggedAccount: tc.taggedAccount,
      postedBy: { handle: tc.authorHandle }
    });
  } catch (e) {
    console.log(`  ✗ Pipeline error: ${e.message}`);
    return;
  }

  console.log('\n  PASS B — LOCATION');
  if (result.detected_location) {
    kv('city',         result.detected_location.city);
    kv('district',     result.detected_location.district);
    kv('constituency', result.detected_location.constituency);
    kv('source',       result.detected_location.source);
  } else {
    console.log('  (no location detected)');
  }

  console.log('\n  PASS C — LLM CLASSIFICATION');
  kv('sentiment',     result.sentiment);
  kv('target_party',  result.target_party);
  kv('stance',        result.stance);
  kv('category',      result.category);
  kv('grievance_type', result.grievance_type);
  kv('risk',          `${result.risk_level} (${result.risk_score})`);
  kv('reasoning',     (result.explanation || '').slice(0, 120) + (result.explanation?.length > 120 ? '...' : ''));

  console.log('\n  PASS D — MAPPING ENGINE');
  kv('legal_sections',   `${result.legal_sections.length} matched`);
  result.legal_sections.slice(0, 3).forEach((l) =>
    console.log(`     - ${l.act || ''} ${l.section || ''} ${l.title ? '· ' + l.title : ''}`));
  kv('platform_policies', `${result.violated_policies.length} matched`);
  result.violated_policies.slice(0, 3).forEach((p) =>
    console.log(`     - ${p.platform || ''}: ${p.policy_name || ''}`));
  kv('triggered_keywords', JSON.stringify(result.triggered_keywords || []));

  // --- 6. Final stored shape (mirrors what grievanceService writes) ---
  sub('6. WHAT WOULD BE STORED');
  const grievanceShape = {
    tagged_account_normalized: normalize(tc.taggedAccount || tc.authorHandle),
    linked_persons: result.linked_persons || [],
    analysis: {
      sentiment: result.sentiment,
      target_party: result.target_party,
      stance: result.stance,
      category: result.category,
      grievance_type: result.grievance_type,
      risk_level: result.risk_level,
      risk_score: result.risk_score
    },
    detected_location: result.detected_location
  };
  kv('tagged_account_normalized', grievanceShape.tagged_account_normalized);
  console.log('  linked_persons:');
  if (grievanceShape.linked_persons.length === 0) {
    console.log('     (empty)');
  } else {
    grievanceShape.linked_persons.forEach((lp, i) => {
      console.log(`     [${i + 1}] ${lp.name}  →  handle_normalized=${lp.handle_normalized}  side=${lp.side}  party=${lp.party}  match_type=${lp.match_type}`);
    });
  }

  // --- 7. Filter preview ---
  if (tc.filterHandle) {
    sub(`7. FILTER PREVIEW  —  ?handle=${tc.filterHandle}`);
    const fp = previewHandleFilter(grievanceShape, tc.filterHandle);
    console.log(`  ${fp.matches ? '✓ MATCH' : '✗ NO MATCH'}   ${fp.via !== '—' ? '(via ' + fp.via + ')' : ''}`);
  }
}

// ════════════════════════════════════════════════════════════════
// Main
// ════════════════════════════════════════════════════════════════
(async () => {
  console.log(DHR);
  console.log('  END-TO-END PIPELINE TEST');
  console.log(DHR);

  console.log('\n  MongoDB:');
  await connectMongo();

  const providers = await probeProviders();
  console.log('\n  LLM providers:');
  console.log(`    Ollama (local): ${providers.ollama ? '✓ available' : '✗ not reachable'}`);
  console.log(`    GitHub Models : ${providers.github ? '✓ token set'   : '✗ no token'}`);

  // Allow ad-hoc CLI test: node test_e2e.js "your text here"
  const cliText = process.argv.slice(2).join(' ').trim();
  const cases = cliText
    ? [{ label: 'CLI input', text: cliText, authorHandle: '@cli_user' }]
    : TEST_CASES;

  console.log(`\n  Running ${cases.length} test case(s)`);
  console.log(SHR);

  for (let i = 0; i < cases.length; i++) {
    await runCase(i, cases.length, cases[i], providers);
  }

  console.log('\n' + DHR);
  console.log('  DONE');
  console.log(DHR + '\n');
  process.exit(0);
})().catch((e) => {
  console.error('\nFATAL:', e);
  process.exit(1);
});
