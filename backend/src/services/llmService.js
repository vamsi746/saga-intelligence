const OpenAI = require('openai');
const axios = require('axios');
const mappingService = require('./mappingService');
const {
  OUR_PARTY,
  OPPOSITION_PARTIES,
  OUR_LEADERS,
  OPPOSITION_LEADERS
} = require('../config/politicalData');

/**
 * LLM Classification Service (V7)
 *
 * Pure intent reasoner. Receives:
 *   - the post text
 *   - already-resolved persons (from personDetectionService)
 *   - resolved location (from locationExtractionService)
 *   - dynamic OUR / OPPOSITION leader lists from politicalData.js
 *
 * Returns a strict JSON contract: category, sentiment, target_party, stance,
 * grievance_type, risk_score, risk_level, reasoning.
 *
 * Sentiment is decided by the **client-perspective decision matrix**:
 *
 *                    Praise/Support    Criticism/Attack
 *   OUR side          positive          negative
 *   OPPOSITION        negative          positive
 *
 * Plus discipline rules that prevent shallow/emoji-driven negativity.
 */

// ─────────────────────────────────────────────────────────
// Prompt builders (dynamic — driven by politicalData.js)
// ─────────────────────────────────────────────────────────

const formatLeaderLine = (l) =>
  `- ${l.name}${l.shortName && l.shortName !== l.name ? ` ("${l.shortName}")` : ''} — ${l.role}${l.constituency ? `, ${l.constituency}` : ''}`;

const buildOurSideBlock = () => {
  const lines = OUR_LEADERS.map(formatLeaderLine).join('\n');
  return `OUR PARTY (CLIENT): ${OUR_PARTY.full_name} (${OUR_PARTY.name}) — ${OUR_PARTY.role} party in ${OUR_PARTY.state}.
Chief: ${OUR_PARTY.chief}.
Leaders (${OUR_LEADERS.length}):
${lines}`;
};

const buildOppositionBlock = () => {
  const partyChunks = OPPOSITION_PARTIES.map((p) => {
    const lines = p.leaders.map(formatLeaderLine).join('\n');
    return `${p.name} (${p.full_name}):\n${lines}`;
  }).join('\n\n');
  return `OPPOSITION PARTIES (NOT our client):\n${partyChunks}`;
};

const buildDetectedEntitiesBlock = (detectedPersons = [], detectedLocation = null) => {
  const ours = detectedPersons.filter((p) => p.side === 'ours');
  const opp = detectedPersons.filter((p) => p.side === 'opposition');
  const oursStr = ours.length
    ? ours.map((p) => `${p.name} (${p.role}, ${p.party})`).join('; ')
    : '— none —';
  const oppStr = opp.length
    ? opp.map((p) => `${p.name} (${p.role}, ${p.party})`).join('; ')
    : '— none —';
  const locStr = detectedLocation
    ? `${detectedLocation.city || ''}${detectedLocation.district ? `, ${detectedLocation.district}` : ''}`.trim()
    : '— not detected —';
  return `PRE-RESOLVED ENTITIES (already identified by deterministic detection — trust these):
  • OUR side mentioned : ${oursStr}
  • OPPOSITION mentioned: ${oppStr}
  • Location           : ${locStr}`;
};

const buildPrompt = (text, ctx) => {
  const categories = mappingService.mappingData.category_mappings || [];
  const categoryListStr = categories.map((c) => `- ${c.category_id}`).join('\n');
  const definitionsStr = categories
    .map((c) => `- ${c.category_id}: ${c.definition || 'No definition provided.'}`)
    .join('\n');

  return `You are an elite political-intelligence and content-moderation analyst for ${OUR_PARTY.full_name} (${OUR_PARTY.name}) in ${OUR_PARTY.state}.
Your CLIENT is the government led by ${OUR_PARTY.chief}.
Your job is to classify a single post the way it matters to the CLIENT.

════════════════════════
1. POLITICAL UNIVERSE (dynamic)
════════════════════════
${buildOurSideBlock()}

${buildOppositionBlock()}

════════════════════════
2. PRE-RESOLVED CONTEXT
════════════════════════
${buildDetectedEntitiesBlock(ctx.detectedPersons, ctx.detectedLocation)}

You do NOT need to re-extract entities. They are already resolved above.
Your only job is to decide the post's INTENT and STANCE toward those entities.

════════════════════════
3. SENTIMENT DECISION MATRIX (client perspective)
════════════════════════
Apply in this strict order:

STEP 1 — Identify the SUBJECT:
  (a) Is OUR side mentioned/implied?
  (b) Is OPPOSITION mentioned/implied?
  (c) Neither?

STEP 2 — Identify the TONE toward that subject:
  Support / Praise   |   Criticism / Attack   |   Neutral mention

STEP 3 — Map to CLIENT BENEFIT:
  ┌──────────────────┬────────────────┬────────────────────┐
  │                  │ Support        │ Criticism / Attack │
  ├──────────────────┼────────────────┼────────────────────┤
  │ OUR side         │ positive       │ negative           │
  │ OPPOSITION       │ negative       │ positive           │
  │ Both (compare)   │ judge by primary subject of post    │
  └──────────────────┴────────────────┴────────────────────┘

STEP 4 — If NEITHER side is mentioned, apply the DISCIPLINE RULES below.

════════════════════════
4. DISCIPLINE RULES (anti-noise)
════════════════════════
These prevent shallow / emoji / venting posts from being mislabeled negative:

D1. Sentiment is decided by SUBSTANCE, not emojis, exclamation marks,
    or isolated negative words. A post with 😡😡 but no real complaint
    is NEUTRAL, not negative.

D2. Casual personal venting ("ugh", "hate Mondays", "feeling tired")
    with no policy/civic/leader target → NEUTRAL.

D3. Off-topic posts (memes, sports, weather, food, personal updates,
    entertainment) → NEUTRAL, category "Normal".

D4. A REAL civic grievance about ${OUR_PARTY.state} (water, roads, power,
    law-and-order, public service failure) — even with no leader named —
    → NEGATIVE (it reflects on the ruling party). Category "Public_Complaint".

D5. A civic grievance about a NON-${OUR_PARTY.state} state → NEUTRAL for our dashboard.

D6. Misinformation / fake news ABOUT our side → NEGATIVE.
    Misinformation / fake news ABOUT opposition → POSITIVE only if it weakens
    them; otherwise NEUTRAL. Flag in reasoning either way.

D7. Threats, hate speech, communal incitement targeting our side or our
    voter base → NEGATIVE with high risk_score (70+).

════════════════════════
5. CATEGORY (pick exactly one)
════════════════════════
${categoryListStr}

DEFINITIONS:
${definitionsStr}

════════════════════════
6. GRIEVANCE TOPIC (pick exactly one)
════════════════════════
- Political Criticism
- Hate Speech
- Public Complaint
- Corruption Complaint
- Government Praise
- Traffic Complaint
- Public Nuisance
- Road & Infrastructure
- Law & Order
- Normal

════════════════════════
7. RISK SCORE (0–100)
════════════════════════
0–15   : Harmless, supportive, attacking opposition, off-topic
16–39  : Mild civic complaints, low-engagement criticism
40–69  : Strong attacks on our leaders, disinformation, communal tension
70–100 : Direct threats to our leaders, incitement to violence, mass mobilization against us

════════════════════════
8. WORKED EXAMPLES
════════════════════════
EX1 "Great work by Chandrababu Naidu on Polavaram project 👏"
   → OUR side, Support → positive, Normal, Government Praise, score 5

EX2 "Jagan Reddy exposed in corruption scam. YSRCP looted AP funds for 5 years."
   → OPPOSITION, Criticism → positive, Misinformation, Political Criticism, score 10

EX3 "YSRCP is doing great service in Pulivendula, Jagan cares for the poor"
   → OPPOSITION, Support → negative, Normal, Political Criticism, score 35

EX4 "Ugh Mondays 😡😡😡"
   → Neither, no substance → neutral, Normal, Normal, score 0

EX5 "No water in Vijayawada for 3 days, what is the govt doing"
   → Neither named, real civic grievance in Andhra Pradesh → negative, Public_Complaint, Public Complaint, score 45

EX6 "@naralokesh thank you sir for the school reforms in AP 🙏"
   → OUR side handle, Support → positive, Normal, Government Praise, score 3

EX7 "RCB will win IPL this year 🔥"
   → Off-topic sports → neutral, Normal, Normal, score 0

EX8 "Chandrababu Naidu is destroying Andhra Pradesh, worst CM ever"
   → OUR side, Criticism → negative, Political_Attack, Political Criticism, score 55

════════════════════════
9. STRICT JSON OUTPUT (no markdown, no prose)
════════════════════════
{
  "category": "<category_id>",
  "target_party": "OUR_GROUP | OPPOSITION | NEUTRAL",
  "stance": "Support | Criticism | Neutral",
  "reasoning": "<short step-by-step: subject -> tone -> client benefit>",
  "grievance_type": "<one of the allowed topics>",
  "grievance_reasoning": "<one line>",
  "sentiment": "positive | negative | neutral",
  "risk_score": <integer 0-100>,
  "risk_level": "low | medium | high"
}

────────────────────────
TEXT TO ANALYZE:
<<<
${text}
>>>
`;
};

// ─────────────────────────────────────────────────────────
// Output validation
// ─────────────────────────────────────────────────────────

const ALLOWED_TOPICS = [
  'Political Criticism', 'Hate Speech', 'Public Complaint', 'Corruption Complaint',
  'Government Praise', 'Traffic Complaint', 'Public Nuisance', 'Road & Infrastructure',
  'Law & Order', 'Normal'
];
const ALLOWED_SENTIMENTS = ['positive', 'negative', 'neutral'];
const ALLOWED_RISK_LEVELS = ['low', 'medium', 'high'];
const ALLOWED_TARGETS = ['OUR_GROUP', 'OPPOSITION', 'NEUTRAL'];
const ALLOWED_STANCES = ['Support', 'Criticism', 'Neutral'];

/**
 * Deterministic sentiment derivation from (target_party, stance).
 *
 * The LLM is good at extracting structured fields like "who is this about"
 * and "what tone is being used", but inconsistent at applying the client-
 * perspective inversion. So we let the LLM extract target+stance, and we
 * compute sentiment from the matrix:
 *
 *                    Support     Criticism    Neutral
 *   OUR_GROUP        positive    negative     neutral
 *   OPPOSITION       negative    positive     neutral
 *   NEUTRAL          → fall back to LLM's sentiment (discipline rules apply)
 *
 * Returns { sentiment, derived } — derived=true when the matrix overrode
 * the LLM's raw sentiment. Logged so we can monitor drift.
 */
const deriveSentiment = (target, stance, llmSentiment) => {
  if (target === 'OUR_GROUP') {
    if (stance === 'Support')   return { sentiment: 'positive', derived: true };
    if (stance === 'Criticism') return { sentiment: 'negative', derived: true };
    return { sentiment: 'neutral', derived: true };
  }
  if (target === 'OPPOSITION') {
    if (stance === 'Support')   return { sentiment: 'negative', derived: true };
    if (stance === 'Criticism') return { sentiment: 'positive', derived: true };
    return { sentiment: 'neutral', derived: true };
  }
  // NEUTRAL target → trust LLM (discipline rules already applied in prompt)
  return { sentiment: llmSentiment, derived: false };
};

const validateResult = (raw) => {
  const availableCategories = (mappingService.mappingData.category_mappings || [])
    .map((c) => c.category_id);

  let category = raw.category;
  if (!availableCategories.includes(category)) {
    const ci = availableCategories.find(
      (c) => String(c).trim().toLowerCase() === String(category).trim().toLowerCase()
    );
    category = ci || 'Normal';
  }

  let topic = raw.grievance_type || 'Normal';
  if (!ALLOWED_TOPICS.includes(topic)) {
    const ci = ALLOWED_TOPICS.find((t) => t.toLowerCase() === String(topic).trim().toLowerCase());
    topic = ci || 'Normal';
  }

  let llmSentiment = String(raw.sentiment || 'neutral').toLowerCase();
  if (!ALLOWED_SENTIMENTS.includes(llmSentiment)) llmSentiment = 'neutral';

  let target = String(raw.target_party || 'NEUTRAL').toUpperCase();
  if (!ALLOWED_TARGETS.includes(target)) target = 'NEUTRAL';

  let stance = raw.stance ? String(raw.stance).charAt(0).toUpperCase() + String(raw.stance).slice(1).toLowerCase() : 'Neutral';
  if (!ALLOWED_STANCES.includes(stance)) stance = 'Neutral';

  // Derive sentiment from the structured (target, stance) — LLM-given sentiment
  // is only used as fallback when target is NEUTRAL.
  const { sentiment, derived } = deriveSentiment(target, stance, llmSentiment);
  if (derived && sentiment !== llmSentiment) {
    console.log(`[LLM] sentiment overridden by matrix: target=${target} stance=${stance} → ${sentiment} (LLM said ${llmSentiment})`);
  }

  let riskScore = parseInt(raw.risk_score, 10);
  if (isNaN(riskScore) || riskScore < 0) riskScore = 0;
  if (riskScore > 100) riskScore = 100;

  let riskLevel = String(raw.risk_level || 'low').toLowerCase();
  if (riskLevel === 'critical') riskLevel = 'high';
  if (!ALLOWED_RISK_LEVELS.includes(riskLevel)) {
    if (riskScore >= 70) riskLevel = 'high';
    else if (riskScore >= 40) riskLevel = 'medium';
    else riskLevel = 'low';
  }

  return {
    category,
    target_party: target,
    stance,
    reasoning: raw.reasoning || '',
    grievance_type: topic,
    grievance_reasoning: raw.grievance_reasoning || '',
    sentiment,
    risk_score: riskScore,
    risk_level: riskLevel
  };
};

// ─────────────────────────────────────────────────────────
// Keyword-based fallback (both LLM providers down)
// Produces a deterministic client-perspective result from
// party keywords + tone words — no AI required.
// ─────────────────────────────────────────────────────────

const PARTY_KEYWORDS = {
  TDP:      ['tdp', 'chandrababu', 'nara lokesh', 'lokesh', 'cbn', 'naidu'],
  JANASENA: ['janasena', 'jana sena', 'pawan kalyan', 'pawan'],
  BJP_AP:   ['bjp'],
  YSRCP:    ['ysrcp', 'ysr congress', 'ycp', 'jagan mohan', 'jagan reddy', 'jagan'],
  INC_AP:   ['ys sharmila', 'apcc', 'congress ap'],
};
// TDP + JANASENA + BJP_AP are our side; YSRCP + INC_AP are opposition
const PARTY_SIDE = { TDP: 'ours', JANASENA: 'ours', BJP_AP: 'ours', YSRCP: 'opposition', INC_AP: 'opposition' };

const CRITICISM_TERMS = [
  'scam', 'fraud', 'corrupt', 'failed', 'failure', 'loot', 'arrested',
  'controversy', 'resign', 'protest', 'allegation', 'accused', 'misuse',
  'mismanagement', 'bribe', 'scandal', 'exposed', 'betrayed', 'destroyed',
  'worst', 'against', 'criticized', 'attacked',
];
const PRAISE_TERMS = [
  'good work', 'great work', 'excellent', 'appreciate', 'thanks', 'well done',
  'development', 'progress', 'success', 'launched', 'inaugurated', 'announced',
  'congratulations', 'proud', 'achievement',
];

const keywordFallback = (text) => {
  const lower = (text || '').toLowerCase();

  let detectedParty = null;
  for (const [party, words] of Object.entries(PARTY_KEYWORDS)) {
    if (words.some((w) => lower.includes(w))) { detectedParty = party; break; }
  }

  if (!detectedParty) {
    return {
      category: 'Normal', target_party: 'NEUTRAL', stance: 'Neutral',
      reasoning: 'Keyword fallback: no AP political entity detected.',
      grievance_type: 'Normal', grievance_reasoning: '',
      sentiment: 'neutral', risk_score: 5, risk_level: 'low'
    };
  }

  const hasCriticism = CRITICISM_TERMS.some((w) => lower.includes(w));
  const hasPraise    = PRAISE_TERMS.some((w) => lower.includes(w));
  const stance = hasCriticism && !hasPraise ? 'Criticism'
               : hasPraise   && !hasCriticism ? 'Support'
               : 'Neutral';

  const side = PARTY_SIDE[detectedParty];
  const target = side === 'ours' ? 'OUR_GROUP' : 'OPPOSITION';

  let sentiment = 'neutral';
  if (target === 'OUR_GROUP')  sentiment = stance === 'Support' ? 'positive' : stance === 'Criticism' ? 'negative' : 'neutral';
  if (target === 'OPPOSITION') sentiment = stance === 'Support' ? 'negative' : stance === 'Criticism' ? 'positive' : 'neutral';

  const riskScore = stance === 'Criticism' && target === 'OUR_GROUP' ? 45 : stance === 'Criticism' ? 15 : 5;

  return {
    category: stance === 'Criticism' ? 'Political_Attack' : 'Normal',
    target_party: target,
    stance,
    reasoning: `Keyword fallback (LLM unavailable): party=${detectedParty} stance=${stance}`,
    grievance_type: stance === 'Criticism' ? 'Political Criticism' : 'Normal',
    grievance_reasoning: '',
    sentiment,
    risk_score: riskScore,
    risk_level: riskScore >= 40 ? 'medium' : 'low'
  };
};

// ─────────────────────────────────────────────────────────
// Provider routing (Ollama primary → GitHub Models fallback)
// ─────────────────────────────────────────────────────────

const callOllama = async (prompt) => {
  const baseURL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'llama3.1';
  const response = await axios.post(
    `${baseURL}/api/chat`,
    {
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      format: 'json',
      options: { temperature: 0 }
    },
    { timeout: 120000 }
  );
  const content = response.data?.message?.content;
  console.log(`[LLM][ollama] RAW: ${content}`);
  return JSON.parse(content);
};

const callGithub = async (prompt) => {
  const apiKey = process.env.GITHUB_TOKEN;
  if (!apiKey) {
    console.warn('[LLM][github] GITHUB_TOKEN missing — cannot fallback');
    return null;
  }
  const client = new OpenAI({ apiKey, baseURL: 'https://models.inference.ai.azure.com' });
  const response = await client.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    temperature: 0
  });
  return JSON.parse(response.choices[0].message.content);
};

/**
 * Classify a post.
 * @param {string} text
 * @param {object} [ctx]
 *   - detectedPersons: Array (from personDetectionService)
 *   - detectedLocation: object|null (from locationExtractionService)
 */
async function categorizeText(text, ctx = {}) {
  await mappingService.waitForLoad();

  const prompt = buildPrompt(text, {
    detectedPersons: ctx.detectedPersons || [],
    detectedLocation: ctx.detectedLocation || null
  });

  const primary = process.env.PRIMARY_LLM_PROVIDER || 'ollama';

  // Try primary
  try {
    const raw = primary === 'ollama' ? await callOllama(prompt) : await callGithub(prompt);
    if (raw) return validateResult(raw);
  } catch (err) {
    console.error(`[LLM][${primary}] failed: ${err.message}`);
  }

  // Try fallback (only if different from primary)
  const fallback = primary === 'ollama' ? 'github' : 'ollama';
  try {
    console.log(`[LLM] Falling back to ${fallback}`);
    const raw = fallback === 'ollama' ? await callOllama(prompt) : await callGithub(prompt);
    if (raw) return validateResult(raw);
  } catch (err) {
    console.error(`[LLM][${fallback}] also failed: ${err.message}`);
  }

  // Both providers failed — deterministic keyword fallback so analysis is never blank
  console.log('[LLM] Both providers failed — using keyword fallback');
  return validateResult(keywordFallback(text));
}

module.exports = {
  categorizeText
};
