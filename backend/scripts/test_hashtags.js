/**
 * Hashtag detection coverage test.
 * Run: node scripts/test_hashtags.js
 */
require('dotenv').config({ path: './.env' });
const { detectPersons } = require('../src/services/personDetectionService');

const cases = [
  // Full name variants
  { label: '#RevanthReddy (CamelCase no space)',        text: 'Great work #RevanthReddy',              expectId: 'revanth-reddy' },
  { label: '#revanthreddy (lowercase no space)',        text: 'great work #revanthreddy',              expectId: 'revanth-reddy' },
  { label: '#Revanth_Reddy (underscore)',               text: 'thanks #Revanth_Reddy',                 expectId: 'revanth-reddy' },

  // Aliases
  { label: '#KTR alone',                                 text: '#KTR is attacking govt',                expectId: 'ktr' },
  { label: '#KCR at end of sentence',                    text: 'Stop defending #KCR',                   expectId: 'kcr' },

  // Role + Name compound hashtags
  { label: '#CMRevanth compound (no space)',             text: 'Thanks #CMRevanth for the scheme',      expectId: 'revanth-reddy' },
  { label: '#MinisterSridharBabu compound',              text: 'Met #MinisterSridharBabu today',        expectId: 'sridhar-babu' },

  // Handle-as-hashtag
  { label: '#revanth_anumula (handle as hashtag)',       text: 'Please respond #revanth_anumula',       expectId: 'revanth-reddy', checkHandle: true },
  { label: '#KTRBRS (handle as hashtag)',                text: 'Watch #KTRBRS speech',                  expectId: 'ktr',          checkHandle: true },

  // Negative control — ambiguous compound should NOT match
  { label: '#KCRFailsAgain (KCR embedded, no boundary)', text: '#KCRFailsAgain',                        expectId: 'kcr',          expectMatch: false },
  { label: '#Modinomics (Modi embedded)',                text: 'Debate on #Modinomics',                 expectId: 'modi',         expectMatch: false }
];

(async () => {
  console.log('════════════════════════════════════════════');
  console.log('  HASHTAG DETECTION COVERAGE');
  console.log('════════════════════════════════════════════\n');

  let pass = 0, fail = 0;
  for (const c of cases) {
    const out = await detectPersons(c.text, {});
    const hit = out.find((p) => p.person_id === c.expectId);
    const shouldMatch = c.expectMatch !== false;

    if (shouldMatch && hit) {
      console.log(`  ✓ ${c.label}  →  matched ${hit.name} (${hit.match_type})`);
      pass++;
    } else if (!shouldMatch && !hit) {
      console.log(`  ✓ ${c.label}  →  correctly did NOT match`);
      pass++;
    } else if (shouldMatch && !hit) {
      console.log(`  ✗ ${c.label}  →  expected ${c.expectId}, got nothing`);
      fail++;
    } else {
      console.log(`  ✗ ${c.label}  →  false positive: matched ${hit.name}`);
      fail++;
    }
  }

  console.log('\n════════════════════════════════════════════');
  console.log(`  RESULT: ${pass} passed, ${fail} failed`);
  console.log('════════════════════════════════════════════');
  process.exit(fail === 0 ? 0 : 1);
})();
