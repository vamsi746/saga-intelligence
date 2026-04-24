/**
 * V7 Pipeline Verification Script
 *
 * Tests the dynamic perspective-aware pipeline in three layers:
 *   1. politicalData          — structure / dynamic data integrity
 *   2. personDetectionService — entity resolution (handle / name / role)
 *   3. llmService prompt      — dynamic injection of OUR / OPPOSITION / context
 *   4. analysisService E2E    — only if LLM is reachable (Ollama or GitHub)
 *
 * Run:
 *   node scripts/test_v7_pipeline.js
 *
 * No MongoDB needed for layers 1–3. Layer 4 is skipped automatically if neither
 * Ollama nor GITHUB_TOKEN is available.
 */
require('dotenv').config({ path: './.env' });

const axios = require('axios');

let pass = 0;
let fail = 0;
const failures = [];

const ok = (label) => { pass++; console.log(`  ✓ ${label}`); };
const ko = (label, detail) => {
  fail++;
  failures.push(`${label} :: ${detail}`);
  console.log(`  ✗ ${label}  →  ${detail}`);
};
const section = (n, title) => console.log(`\n══ ${n}. ${title} ══`);

// ─────────────────────────────────────────────────────────
// Layer 1: politicalData integrity
// ─────────────────────────────────────────────────────────
async function testPoliticalData() {
  section(1, 'politicalData.js — structure & dynamic tagging');

  const pd = require('../src/config/politicalData');

  pd.OUR_PARTY?.name === 'INC'
    ? ok('OUR_PARTY.name = INC')
    : ko('OUR_PARTY.name', `got ${pd.OUR_PARTY?.name}`);

  pd.OUR_LEADERS.length > 0
    ? ok(`OUR_LEADERS populated (${pd.OUR_LEADERS.length})`)
    : ko('OUR_LEADERS empty', '');

  pd.OPPOSITION_LEADERS.length > 0
    ? ok(`OPPOSITION_LEADERS populated (${pd.OPPOSITION_LEADERS.length})`)
    : ko('OPPOSITION_LEADERS empty', '');

  const ours = pd.OUR_LEADERS.every(l => l.side === 'ours' && l.party === 'INC');
  ours ? ok('every OUR_LEADER tagged side=ours, party=INC') : ko('OUR_LEADERS tagging', 'mismatched');

  const opp = pd.OPPOSITION_LEADERS.every(l => l.side === 'opposition' && l.party);
  opp ? ok('every OPPOSITION_LEADER tagged side=opposition + party set') : ko('OPP tagging', 'mismatched');

  const oppParties = new Set(pd.OPPOSITION_LEADERS.map(l => l.party));
  oppParties.size >= 3
    ? ok(`opposition spans ${oppParties.size} parties: ${[...oppParties].join(', ')}`)
    : ko('opposition party count', `${oppParties.size}`);

  const revanth = pd.OUR_LEADERS.find(l => l.id === 'revanth-reddy');
  revanth?.primary_handle_normalized === 'revanth_anumula'
    ? ok('Revanth primary_handle_normalized = revanth_anumula')
    : ko('Revanth handle normalization', revanth?.primary_handle_normalized);

  const ktr = pd.OPPOSITION_LEADERS.find(l => l.id === 'ktr');
  ktr?.handles_normalized?.includes('ktrbrs')
    ? ok('KTR handles_normalized contains ktrbrs')
    : ko('KTR handles normalization', JSON.stringify(ktr?.handles_normalized));

  pd.ALL_LEADERS.length === pd.OUR_LEADERS.length + pd.OPPOSITION_LEADERS.length
    ? ok('ALL_LEADERS = OUR + OPP')
    : ko('ALL_LEADERS count mismatch', '');
}

// ─────────────────────────────────────────────────────────
// Layer 2: personDetectionService
// ─────────────────────────────────────────────────────────
async function testPersonDetection() {
  section(2, 'personDetectionService — multi-tier matching');

  const { detectPersons } = require('../src/services/personDetectionService');

  const cases = [
    {
      label: 'OUR side handle tag',
      text: 'Thanks for the women bus scheme',
      meta: { taggedAccount: '@revanth_anumula' },
      expect: { id: 'revanth-reddy', side: 'ours', party: 'INC', match_type: 'mention', handle_normalized: 'revanth_anumula' }
    },
    {
      label: 'OUR side full name in text',
      text: 'Revanth Reddy did good work on Rythu Bharosa',
      meta: {},
      expect: { id: 'revanth-reddy', side: 'ours', match_type: 'text_match' }
    },
    {
      label: 'OPPOSITION handle in mentions',
      text: 'Loot exposed',
      meta: { mentions: ['@KTRBRS'] },
      expect: { id: 'ktr', side: 'opposition', party: 'BRS', match_type: 'mention', handle_normalized: 'ktrbrs' }
    },
    {
      label: 'OPPOSITION full name in text',
      text: 'Narendra Modi visited Kashi today',
      meta: {},
      expect: { id: 'modi', side: 'opposition', party: 'BJP', match_type: 'text_match' }
    },
    {
      label: 'Role + short name combo (CM Revanth)',
      text: 'CM Revanth Reddy announced new policy',
      meta: {},
      expect: { id: 'revanth-reddy', side: 'ours' }
    },
    {
      label: 'No leader → empty array',
      text: 'Traffic is bad in Gachibowli today',
      meta: {},
      expect: null
    },
    {
      label: 'BOTH sides in same post (alias KCR)',
      text: 'Revanth Reddy is doing better than KCR ever did',
      meta: {},
      expect: 'multiple'
    },
    {
      label: 'OPPOSITION via alias (KTR in plain text)',
      text: 'KTR slammed the government today',
      meta: {},
      expect: { id: 'ktr', side: 'opposition', party: 'BRS', match_type: 'text_match' }
    }
  ];

  for (const c of cases) {
    const out = await detectPersons(c.text, c.meta);

    if (c.expect === null) {
      out.length === 0
        ? ok(`${c.label} → no match`)
        : ko(c.label, `expected empty, got ${out.map(p => p.name).join(', ')}`);
      continue;
    }

    if (c.expect === 'multiple') {
      const sides = new Set(out.map(p => p.side));
      sides.has('ours') && sides.has('opposition')
        ? ok(`${c.label} → both sides detected (${out.length} persons)`)
        : ko(c.label, `expected both sides, got sides=${[...sides].join(',')}`);
      continue;
    }

    const hit = out.find(p => p.person_id === c.expect.id);
    if (!hit) {
      ko(c.label, `expected ${c.expect.id}, got ${JSON.stringify(out.map(p => p.person_id))}`);
      continue;
    }

    let allFieldsOk = true;
    for (const [k, v] of Object.entries(c.expect)) {
      if (k === 'id') continue;
      if (hit[k] !== v) {
        ko(c.label, `field ${k} expected=${v} got=${hit[k]}`);
        allFieldsOk = false;
        break;
      }
    }
    if (allFieldsOk) ok(`${c.label} → ${hit.name} [${hit.side}/${hit.party}/${hit.match_type}]`);
  }
}

// ─────────────────────────────────────────────────────────
// Layer 3: LLM prompt builder (no LLM call)
// ─────────────────────────────────────────────────────────
async function testPromptBuilder() {
  section(3, 'llmService — dynamic prompt construction');

  // Force-load mappingService data first
  const mappingService = require('../src/services/mappingService');
  await mappingService.waitForLoad();

  // We can't import the internal buildPrompt; instead re-create the prompt
  // by calling categorizeText with a stubbed provider OR by importing internals.
  // Trick: temporarily monkey-patch axios.post + OpenAI to capture the prompt.

  let capturedPrompt = null;

  // Patch axios so Ollama call is intercepted
  const origPost = axios.post;
  axios.post = async (url, body) => {
    if (url.includes('/api/chat')) {
      capturedPrompt = body.messages[0].content;
      // Return a valid JSON shape so categorizeText doesn't throw
      return {
        data: {
          message: {
            content: JSON.stringify({
              category: 'Normal',
              target_party: 'NEUTRAL',
              stance: 'Neutral',
              reasoning: 'stub',
              grievance_type: 'Normal',
              grievance_reasoning: 'stub',
              sentiment: 'neutral',
              risk_score: 0,
              risk_level: 'low'
            })
          }
        }
      };
    }
    return origPost(url, body);
  };

  // Force ollama as primary
  const prevPrimary = process.env.PRIMARY_LLM_PROVIDER;
  process.env.PRIMARY_LLM_PROVIDER = 'ollama';

  // Bust llmService cache so new env is picked up (not strictly needed since
  // categorizeText reads env on each call)
  delete require.cache[require.resolve('../src/services/llmService')];
  const { categorizeText } = require('../src/services/llmService');

  const detectedPersons = [
    { name: 'A. Revanth Reddy', role: 'Chief Minister', side: 'ours', party: 'INC' },
    { name: 'KT Rama Rao', role: 'BRS Working President', side: 'opposition', party: 'BRS' }
  ];
  const detectedLocation = { city: 'Hyderabad', district: 'Hyderabad' };

  await categorizeText('Sample post for prompt verification', {
    detectedPersons,
    detectedLocation
  });

  // Restore
  axios.post = origPost;
  if (prevPrimary === undefined) delete process.env.PRIMARY_LLM_PROVIDER;
  else process.env.PRIMARY_LLM_PROVIDER = prevPrimary;

  if (!capturedPrompt) {
    ko('prompt capture', 'axios.post was not called');
    return;
  }

  const checks = [
    ['mentions OUR PARTY', /OUR PARTY \(CLIENT\)/],
    ['mentions Revanth Reddy in OUR list', /A\. Revanth Reddy/],
    ['mentions OPPOSITION PARTIES section', /OPPOSITION PARTIES/],
    ['mentions BRS', /BRS \(Bharat Rashtra Samithi\)/],
    ['mentions BJP', /BJP \(Bharatiya Janata Party\)/],
    ['mentions AIMIM', /AIMIM/],
    ['injects pre-resolved OUR side', /OUR side mentioned : .*Revanth Reddy/],
    ['injects pre-resolved OPPOSITION', /OPPOSITION mentioned: .*KT Rama Rao/],
    ['injects detected location', /Location\s*: Hyderabad/],
    ['contains decision matrix', /SENTIMENT DECISION MATRIX/],
    ['contains discipline rules D1–D7', /D1\..*D2\..*D3\..*D4\..*D5\..*D6\..*D7\./s],
    ['contains worked examples', /WORKED EXAMPLES/],
    ['demands strict JSON output', /STRICT JSON OUTPUT/]
  ];

  for (const [label, rx] of checks) {
    rx.test(capturedPrompt)
      ? ok(label)
      : ko(label, 'pattern not found in prompt');
  }
}

// ─────────────────────────────────────────────────────────
// Layer 4: optional E2E (real LLM)
// ─────────────────────────────────────────────────────────
async function testLLMIfReachable() {
  section(4, 'analysisService — E2E (real LLM, if reachable)');

  // Probe Ollama
  let ollamaUp = false;
  try {
    const r = await axios.get(`${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}/api/tags`, { timeout: 2000 });
    ollamaUp = r.status === 200;
  } catch (_) { /* down */ }

  const githubUp = !!process.env.GITHUB_TOKEN;

  if (!ollamaUp && !githubUp) {
    console.log('  ⚠ Skipping E2E — no LLM provider reachable (Ollama down + no GITHUB_TOKEN)');
    return;
  }
  console.log(`  Provider available — Ollama: ${ollamaUp ? 'yes' : 'no'}, GitHub: ${githubUp ? 'yes' : 'no'}`);

  // Bust cache
  delete require.cache[require.resolve('../src/services/llmService')];
  delete require.cache[require.resolve('../src/services/analysisService')];
  const { analyzeContent } = require('../src/services/analysisService');

  const cases = [
    {
      label: 'praise OUR CM → positive, Government Praise',
      text: 'Great work being done by Revanth Reddy on Rythu Bharosa',
      assert: (r) => r.sentiment === 'positive' && /praise|positive|support/i.test(r.stance + ' ' + r.grievance_type)
    },
    {
      label: 'attack OUR CM → negative',
      text: 'Revanth Reddy is destroying Telangana, worst CM ever',
      assert: (r) => r.sentiment === 'negative'
    },
    {
      label: 'attack OPPOSITION → positive (helps us)',
      text: 'KTR exposed in irrigation scam under BRS regime',
      assert: (r) => r.sentiment === 'positive'
    },
    {
      label: 'praise OPPOSITION → negative',
      text: 'Modi did amazing work in Kashi, India is lucky to have him',
      assert: (r) => r.sentiment === 'negative'
    },
    {
      label: 'silly emoji vent → neutral (discipline rule D1)',
      text: 'Ugh Mondays 😡😡😡',
      assert: (r) => r.sentiment === 'neutral'
    },
    {
      label: 'sports off-topic → neutral (D3)',
      text: 'RCB will win IPL this year 🔥🔥',
      assert: (r) => r.sentiment === 'neutral'
    },
    {
      label: 'real civic grievance, no leader → negative (D4)',
      text: 'No water in Gachibowli for 3 days, what is the govt doing',
      assert: (r) => r.sentiment === 'negative'
    }
  ];

  for (const c of cases) {
    try {
      const r = await analyzeContent(c.text, { platform: 'x' });
      const passed = c.assert(r);
      const summary = `sentiment=${r.sentiment}, stance=${r.stance}, target=${r.target_party}, persons=${r.linked_persons.length}`;
      passed ? ok(`${c.label} → ${summary}`) : ko(c.label, summary);
    } catch (e) {
      ko(c.label, `threw: ${e.message}`);
    }
  }
}

// ─────────────────────────────────────────────────────────
// Run all
// ─────────────────────────────────────────────────────────
(async () => {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  V7 PIPELINE VERIFICATION');
  console.log('═══════════════════════════════════════════════════════');

  await testPoliticalData();
  await testPersonDetection();
  await testPromptBuilder();
  await testLLMIfReachable();

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  RESULT: ${pass} passed, ${fail} failed`);
  if (failures.length) {
    console.log('  FAILURES:');
    failures.forEach(f => console.log(`    - ${f}`));
  }
  console.log('═══════════════════════════════════════════════════════');
  process.exit(fail === 0 ? 0 : 1);
})();
