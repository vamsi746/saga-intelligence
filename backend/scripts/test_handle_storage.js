/**
 * Storage + Filter Verification
 *
 * Proves the end-to-end claim:
 *   "When a leader is identified by NAME in content (not tagged), the post
 *    is stored under that leader's handle so filtering by handle returns
 *    BOTH directly-tagged posts AND name-mentioned posts."
 *
 * Strategy (no MongoDB needed):
 *   1. Run personDetectionService on representative posts.
 *   2. Show the exact `linked_persons` array that would be written to the DB.
 *   3. Build the controller's filter query for `?handle=@revanth_anumula`
 *      and run it against the in-memory docs to confirm matches.
 *
 * Run:
 *   node scripts/test_handle_storage.js
 */
require('dotenv').config({ path: './.env' });

const { detectPersons } = require('../src/services/personDetectionService');

// Same normalization the controller uses
const normalizeHandle = (v) => String(v || '').trim().replace(/^@/, '').toLowerCase();

// In-memory replica of the relevant Grievance fields the controller filters on.
// (We skip the LLM call since storage shape is what's under test here.)
async function buildGrievance({ id, text, taggedAccount, mentions = [], authorHandle }) {
  const linked_persons = await detectPersons(text, { taggedAccount, mentions, authorHandle });
  return {
    id,
    content: { text },
    tagged_account: taggedAccount || authorHandle,
    tagged_account_normalized: normalizeHandle(taggedAccount || authorHandle),
    posted_by: { handle: authorHandle },
    linked_persons,
    is_active: true
  };
}

// Mirror of the controller's handle filter (grievanceController.js:158-172)
function matchesHandleFilter(doc, rawHandle) {
  const norm = normalizeHandle(rawHandle);
  return (
    doc.tagged_account_normalized === norm ||
    doc.linked_persons.some((p) => p.handle_normalized === norm)
  );
}

(async () => {
  console.log('═════════════════════════════════════════════════════════');
  console.log('  HANDLE STORAGE + FILTER VERIFICATION');
  console.log('═════════════════════════════════════════════════════════\n');

  // The 4-post scenario from your spec:
  //   Posts 1–2: directly tagged @revanth_anumula
  //   Posts 3–4: random users, but text mentions Revanth Reddy by name
  //   Post 5  : control — random user, no mention (should NOT appear)
  //   Post 6  : opposition mention (KTR) — should NOT appear in Revanth filter
  const posts = [
    await buildGrievance({
      id: 'p1', text: 'Sir please look into water issue in Kodangal',
      taggedAccount: '@revanth_anumula', authorHandle: '@citizen_one'
    }),
    await buildGrievance({
      id: 'p2', text: 'Thank you sir for the women bus scheme 🙏',
      taggedAccount: '@revanth_anumula', authorHandle: '@citizen_two'
    }),
    await buildGrievance({
      id: 'p3', text: 'Revanth Reddy is doing great work for farmers',
      authorHandle: '@random_user_a'
    }),
    await buildGrievance({
      id: 'p4', text: 'CM Revanth announced new policy for backward classes today',
      authorHandle: '@random_user_b'
    }),
    await buildGrievance({
      id: 'p5', text: 'Traffic in HiTec city is unbearable today',
      authorHandle: '@random_user_c'
    }),
    await buildGrievance({
      id: 'p6', text: 'KTR slammed the government on irrigation project',
      authorHandle: '@brs_supporter'
    })
  ];

  // ── 1. Storage shape per post ───────────────────────────────────────
  console.log('── STORAGE: what each post writes to grievance.linked_persons ──\n');
  for (const p of posts) {
    console.log(`[${p.id}] "${p.content.text.substring(0, 60)}..."`);
    console.log(`     tagged_account_normalized = "${p.tagged_account_normalized}"`);
    if (p.linked_persons.length === 0) {
      console.log('     linked_persons = [] (no leader identified)');
    } else {
      p.linked_persons.forEach((lp) => {
        console.log(`     linked_persons[] → name="${lp.name}" side=${lp.side} party=${lp.party} handle_normalized="${lp.handle_normalized}" match_type=${lp.match_type}`);
      });
    }
    console.log();
  }

  // ── 2. Apply filter ?handle=@revanth_anumula ────────────────────────
  console.log('── FILTER: ?handle=@revanth_anumula  (mirrors controller logic) ──\n');
  const matched = posts.filter((p) => matchesHandleFilter(p, '@revanth_anumula'));

  console.log(`MATCHED ${matched.length} posts:\n`);
  matched.forEach((p) => {
    const reason = p.tagged_account_normalized === 'revanth_anumula'
      ? 'tagged directly'
      : 'identified in content text';
    console.log(`  ✓ [${p.id}] (${reason}) — "${p.content.text.substring(0, 60)}..."`);
  });

  // ── 3. Assertions ───────────────────────────────────────────────────
  const expectMatched = ['p1', 'p2', 'p3', 'p4'];
  const expectExcluded = ['p5', 'p6'];

  let pass = 0, fail = 0;
  console.log('\n── ASSERTIONS ──\n');

  for (const id of expectMatched) {
    if (matched.find((p) => p.id === id)) {
      console.log(`  ✓ ${id} matched (expected)`); pass++;
    } else {
      console.log(`  ✗ ${id} MISSING from results`); fail++;
    }
  }
  for (const id of expectExcluded) {
    if (!matched.find((p) => p.id === id)) {
      console.log(`  ✓ ${id} excluded (expected)`); pass++;
    } else {
      console.log(`  ✗ ${id} INCORRECTLY included`); fail++;
    }
  }

  // Verify side/party are populated for the identified-by-name posts
  for (const id of ['p3', 'p4']) {
    const p = posts.find((x) => x.id === id);
    const lp = p.linked_persons[0];
    if (lp && lp.side === 'ours' && lp.party === 'INC' && lp.handle_normalized === 'revanth_anumula') {
      console.log(`  ✓ ${id} stored with full leader metadata (side=ours, party=INC, handle_normalized=revanth_anumula)`); pass++;
    } else {
      console.log(`  ✗ ${id} missing leader metadata: ${JSON.stringify(lp)}`); fail++;
    }
  }

  console.log('\n═════════════════════════════════════════════════════════');
  console.log(`  RESULT: ${pass} passed, ${fail} failed`);
  console.log('═════════════════════════════════════════════════════════');
  process.exit(fail === 0 ? 0 : 1);
})();
