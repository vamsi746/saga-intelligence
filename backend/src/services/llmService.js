const OpenAI = require("openai");
const axios = require("axios");
const mappingService = require("./mappingService");

/**
 * Advanced Multi-Provider Categorization (V5.1)
 * Uses Local Ollama (llama3.1) as Primary for Unlimited Requests.
 * Uses GitHub Models (GPT-4o) as Reliability Fallback.
 */
async function categorizeText(text, retryCount = 1) {
  const primaryProvider = process.env.PRIMARY_LLM_PROVIDER || 'ollama';
  const currentProvider = (retryCount === 1) ? primaryProvider : 'github';

  // 1. Ensure Mapping Data is loaded (avoid empty categorization lists)
  await mappingService.waitForLoad();

  // 2. Resolve Provider Configuration
  let config = {
    apiKey: '',
    baseURL: '',
    model: ''
  };

  const { ALL_LEADERS } = require('../config/politicalData');
  const targetGroupStr = ALL_LEADERS.map(l => `- ${l.name} (${l.role}, ${l.constituency})`).join('\n');
  const targetHandlesStr = ALL_LEADERS.flatMap(l => l.handles || []).join(', ');

  if (currentProvider === 'ollama') {
    config.baseURL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    config.model = process.env.OLLAMA_MODEL || "llama3.1";
    config.apiKey = "ollama"; // Dummy key for OpenAI SDK compatibility
  } else if (currentProvider === 'github') {
    config.apiKey = process.env.GITHUB_TOKEN;
    config.baseURL = "https://models.inference.ai.azure.com";
    config.model = "gpt-4o";
  }

  // Early exit if missing primary config
  if (currentProvider === 'github' && !config.apiKey) {
    console.warn(`[LLM] No GITHUB_TOKEN found. Skipping fallback.`);
    return null;
  }

  // Dynamic Prompt Construction
  const categories = mappingService.mappingData.category_mappings || [];
  const categoryListStr = categories.map(c => `- ${c.category_id}`).join('\n');
  const definitionsStr = categories.map(c => `
- ${c.category_id}
  ${c.definition || "No definition provided."}
`).join('\n');

  const prompt = `
You are an elite multilingual content moderation and political intelligence expert for the Telangana region. 
You are working for the **INC (Congress) Party** led by **A. Revanth Reddy (Chief Minister)**.

════════════════════════
CLIENT PERSPECTIVE (CRITICAL)
════════════════════════
Our "PROTECTED GROUP" includes these leaders and their party:
${targetGroupStr}
Handles: ${targetHandlesStr}

Our "OPPOSITION" includes: 
1. BRS Party (KCR, KTR, Harish Rao).
2. BJP Party (Narendra Modi, Amit Shah, Kishan Reddy, Bandi Sanjay).
3. Any supporters or entities attacking the INC Government.

════════════════════════
JOB 1: CONTENT MODERATION & CATEGORIZATION
════════════════════════
Select EXACTLY ONE moderation category:
${categoryListStr}

DEFINITIONS:
${definitionsStr}

════════════════════════
SENTIMENT ANALYSIS LOGIC (STEP-BY-STEP)
════════════════════════
To determine sentiment, you MUST follow this 3-step internal logic:

STEP 1: Identify the "TARGET" of the post.
- Who is being criticized or praised? 
- Is it OUR GROUP (INC/Revanth Reddy) or the OPPOSITION (BRS/BJP/KCR/Modi)?

STEP 2: Identify the "STANCE".
- Is the content Support/Praise or Criticism/Attack/Sarcasm/Exposing Scams?

STEP 3: Map to Client Sentiment.
- [Target: OUR GROUP] + [Stance: Support] = **positive**
- [Target: OUR GROUP] + [Stance: Criticism] = **negative**
- [Target: OPPOSITION] + [Stance: Support] = **negative** (Bad for us)
- [Target: OPPOSITION] + [Stance: Criticism/Sarcasm] = **positive** (Good for us)

*NOTE*: If the post is a general civic complaint (Roads, Water, etc.) with no party mentioned, use standard sentiment (Complaint = Negative).

════════════════════════
JOB 3: GRIEVANCE TOPIC
════════════════════════
ALLOWED TOPICS:
- Political Criticism (Attacking us or opposition)
- Hate Speech
- Public Complaint (Civic issues)
- Corruption Complaint
- Government Praise
- Traffic Complaint
- Public Nuisance
- Road & Infrastructure
- Law & Order
- Normal

════════════════════════
JOB 4: RISK SCORING (0-100)
════════════════════════
- 0-15: Harmless / Supportive / Attacking Opposition.
- 16-39: Mild civic complaints.
- 40-69: Strong attacks on our leaders, disinformation, or communal tension.
- 70-100: Direct threats to our leaders, incitement to violence, or massive protests against us.

════════════════════════
OUTPUT FORMAT (STRICT JSON ONLY):
════════════════════════
{
  "category": "<moderation_category_ID>",
  "target_party": "OUR_GROUP | OPPOSITION | NEUTRAL",
  "stance": "Support | Criticism | Neutral",
  "reasoning": "<Step-by-step logic used for sentiment analysis>",
  "grievance_type": "<one of the allowed topics>",
  "grievance_reasoning": "<1-line summary>",
  "sentiment": "positive | negative | neutral",
  "risk_score": <integer>,
  "risk_level": "low | medium | high"
}

────────────────────────
TEXT TO ANALYZE:
<<<
${text}
>>>
`;

  try {
    let result;

    if (currentProvider === 'ollama') {
      // Use direct axios for Ollama as it's often more reliable for local setup than SDK
      const response = await axios.post(`${config.baseURL}/api/chat`, {
        model: config.model,
        messages: [{ role: "user", content: prompt }],
        stream: false,
        format: "json",
        options: {
          temperature: 0
        }
      }, { timeout: 120000 });

      const content = response.data?.message?.content;
      console.log(`[LLM] RAW RESPONSE: ${content}`);
      result = JSON.parse(content);
    } else {
      // Use OpenAI SDK for GitHub
      const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
      const response = await client.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: config.model,
        response_format: { type: "json_object" },
        temperature: 0
      });
      result = JSON.parse(response.choices[0].message.content);
    }

    // --- CATEGORY VALIDATION ---
    const availableCategories = (mappingService.mappingData.category_mappings || []).map(c => c.category_id);
    let finalCategory = result.category;

    console.log(`[LLM] Raw Category: "${finalCategory}"`);

    if (!availableCategories.includes(finalCategory)) {
      // Try strict case-insensitive match (trim + case)
      const exactMatch = availableCategories.find(c =>
        String(c).trim().toLowerCase() === String(finalCategory).trim().toLowerCase()
      );

      if (exactMatch) {
        finalCategory = exactMatch;
      } else {
        console.warn(`[LLM] INVALID CATEGORY: "${finalCategory}". Fallback to 'Normal'.`);
        finalCategory = 'Normal';
      }
    }

    // --- GRIEVANCE TOPIC VALIDATION ---
    const ALLOWED_TOPICS = [
      'Political Criticism', 'Hate Speech', 'Public Complaint', 'Corruption Complaint',
      'Government Praise', 'Traffic Complaint', 'Public Nuisance', 'Road & Infrastructure',
      'Law & Order', 'Normal'
    ];
    let finalTopic = result.grievance_type || 'Normal';
    if (!ALLOWED_TOPICS.includes(finalTopic)) {
      const topicMatch = ALLOWED_TOPICS.find(t => t.toLowerCase() === String(finalTopic).trim().toLowerCase());
      if (topicMatch) {
        finalTopic = topicMatch;
      } else {
        console.warn(`[LLM] INVALID TOPIC: "${finalTopic}". Fallback to 'Normal'.`);
        finalTopic = 'Normal';
      }
    }

    // --- SENTIMENT VALIDATION ---
    const ALLOWED_SENTIMENTS = ['positive', 'negative', 'neutral'];
    let finalSentiment = result.sentiment || 'neutral';
    if (!ALLOWED_SENTIMENTS.includes(finalSentiment)) {
      finalSentiment = 'neutral';
    }

    // --- RISK SCORE VALIDATION ---
    let finalRiskScore = parseInt(result.risk_score, 10);
    if (isNaN(finalRiskScore) || finalRiskScore < 0) finalRiskScore = 0;
    if (finalRiskScore > 100) finalRiskScore = 100;

    const ALLOWED_RISK_LEVELS = ['low', 'medium', 'high'];
    let finalRiskLevel = (result.risk_level || 'low').toLowerCase();
    // Map 'critical' to 'high' if LLM still returns it
    if (finalRiskLevel === 'critical') finalRiskLevel = 'high';
    if (!ALLOWED_RISK_LEVELS.includes(finalRiskLevel)) {
      // Derive from score if LLM gave invalid level
      if (finalRiskScore >= 70) finalRiskLevel = 'high';
      else if (finalRiskScore >= 40) finalRiskLevel = 'medium';
      else finalRiskLevel = 'low';
    }

    return {
      category: finalCategory,
      target_party: result.target_party || 'NEUTRAL',
      stance: result.stance || 'Neutral',
      reasoning: result.reasoning || "",
      grievance_type: finalTopic,
      grievance_reasoning: result.grievance_reasoning || "",
      sentiment: finalSentiment,
      risk_score: finalRiskScore,
      risk_level: finalRiskLevel
    };
  } catch (err) {
    console.error(`[LLM] [${currentProvider}] Analysis Failed:`, err.message);

    // Automatic Fallback to GitHub on first error
    if (currentProvider === 'ollama' && retryCount > 0) {
      console.log("[LLM] Local Ollama unavailable. Falling back to GitHub Models...");
      return categorizeText(text, retryCount - 1);
    }

    return null;
  }
}

module.exports = {
  categorizeText
};
