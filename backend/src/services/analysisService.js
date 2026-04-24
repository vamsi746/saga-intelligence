require('dotenv').config();
const axios = require('axios');
const { categorizeText } = require('./llmService');
const mappingService = require('./mappingService');
const personDetectionService = require('./personDetectionService');
const locationExtractionService = require('./locationExtractionService');

/**
 * Analysis Pipeline (V7 — Dynamic, Person-First)
 *
 *   Pass A — Person Detection      (deterministic, parallel with B)
 *   Pass B — Location Extraction   (deterministic, parallel with A)
 *   Pass C — LLM Classification    (receives A+B as structured context)
 *   Pass D — Mapping Engine        (legal sections + platform policies from category)
 *   Pass E — Forensics             (separate, async, optional)
 *
 * Sentiment is decided entirely by the LLM (perspective-aware) and passed
 * through unchanged to the grievance record.
 */

// Forensics queue — strictly serial to avoid GPU contention
let forensicLock = Promise.resolve();

const triggerForensicAnalysis = async (content, analysisId) => {
  const log = (msg) => console.log(`[ForensicLock] ${msg}`);
  const mlServiceUrl = process.env.DEEPFAKE_ML_URL || 'http://localhost:8001';

  return forensicLock = forensicLock.then(async () => {
    try {
      log(`Acquired lock for Analysis: ${analysisId}`);
      let mediaItems = content.media || [];

      if (mediaItems.length === 0 && (content.platform === 'youtube' || content.platform === 'facebook')) {
        const url = content.content_url || content.url;
        if (url) mediaItems = [{ url, type: 'video' }];
      }

      if (mediaItems.length === 0) return null;

      const payload = {
        media_items: mediaItems.map((m) => ({
          url: m.s3_url || m.video_url || m.url,
          type: m.type === 'video' ? 'video' : 'image'
        }))
      };

      log(`Triggering batch forensics for ${payload.media_items.length} items (Analysis: ${analysisId})`);
      const response = await axios.post(`${mlServiceUrl}/detect/batch`, payload, { timeout: 300000 });
      log(`Forensics Complete for ${analysisId}`);
      return response.data.results || null;
    } catch (err) {
      log(`Forensics Failed for ${analysisId}: ${err.message}`);
      return null;
    } finally {
      log(`Released lock for Analysis: ${analysisId}`);
    }
  });
};

const emptyResult = (msg) => ({
  risk_level: 'low',
  risk_score: 0,
  explanation: msg,
  violated_policies: [],
  legal_sections: [],
  triggered_keywords: [],
  linked_persons: [],
  detected_location: null
});

const analyzeContent = async (text, options = {}) => {
  const log = (msg) => console.log(`[AnalysisService] ${msg}`);

  if (!text || !text.trim()) {
    return emptyResult('No text provided.');
  }

  try {
    log(`Starting analysis: "${text.substring(0, 60)}..."`);

    // ─── Pass A + B in parallel (both deterministic, no AI) ───────────────
    log('Pass A+B: Person Detection + Location Extraction (parallel)');
    const [linkedPersons, detectedLocation] = await Promise.all([
      personDetectionService.detectPersons(text, {
        mentions: options.mentions || [],
        hashtags: options.hashtags || [],
        taggedAccount: options.taggedAccount || null,
        authorHandle: options.postedBy?.handle || null
      }),
      locationExtractionService.extractLocation(text, options.postedBy || {})
    ]);
    log(`  → Persons: ${linkedPersons.length} (ours=${linkedPersons.filter(p => p.side === 'ours').length}, opp=${linkedPersons.filter(p => p.side === 'opposition').length})`);
    log(`  → Location: ${detectedLocation ? detectedLocation.city : 'not found'}`);

    // ─── Pass C: LLM with resolved entities as context ────────────────────
    log('Pass C: LLM Classification (perspective-aware)');
    let llmResult = await categorizeText(text, {
      detectedPersons: linkedPersons,
      detectedLocation
    });

    if (!llmResult) {
      log('  → LLM unavailable; defaulting to Normal/neutral');
      llmResult = {
        category: 'Normal',
        target_party: 'NEUTRAL',
        stance: 'Neutral',
        reasoning: 'LLM unavailable.',
        grievance_type: 'Normal',
        grievance_reasoning: '',
        sentiment: 'neutral',
        risk_score: 0,
        risk_level: 'low'
      };
    }
    log(`  → Sentiment: ${llmResult.sentiment} | Category: ${llmResult.category} | Risk: ${llmResult.risk_level}(${llmResult.risk_score})`);

    // ─── Pass D: Deterministic mapping (legal/policy) ─────────────────────
    log('Pass D: Mapping Engine (legal + platform policies across all platforms)');
    const platforms = ['x', 'youtube', 'facebook', 'instagram'];
    let allViolatedPolicies = [];
    let aggregatedLegalSections = [];
    let aggregatedKeywords = [];

    platforms.forEach((p) => {
      const r = mappingService.resolveMapping(
        llmResult.category,
        text,
        p,
        options.country || 'IN'
      );
      if (r.platform_policies?.length) allViolatedPolicies.push(...r.platform_policies);
      if (!aggregatedLegalSections.length) aggregatedLegalSections = r.legal_sections || [];
      if (!aggregatedKeywords.length) aggregatedKeywords = r.triggered_keywords || [];
    });

    // ─── Consolidate ──────────────────────────────────────────────────────
    const finalResult = {
      // Sentiment & risk (from LLM, perspective-aware)
      sentiment: llmResult.sentiment,
      target_party: llmResult.target_party,
      stance: llmResult.stance,
      risk_level: llmResult.risk_level,
      risk_score: llmResult.risk_score,

      // Categorization (from LLM)
      category: llmResult.category,
      primary_intent: llmResult.category,
      intent: llmResult.category,
      grievance_type: llmResult.grievance_type,
      grievance_topic_reasoning: llmResult.grievance_reasoning,
      explanation: llmResult.reasoning,

      // Deterministic mapping
      violated_policies: allViolatedPolicies,
      legal_sections: aggregatedLegalSections,
      triggered_keywords: aggregatedKeywords,
      highlights: aggregatedKeywords,

      // Resolved entities (Pass A + B)
      detected_location: detectedLocation,
      linked_persons: linkedPersons,

      // Full LLM payload for ReasonModal
      llm_analysis: {
        category: llmResult.category,
        grievance_type: llmResult.grievance_type,
        grievance_reasoning: llmResult.grievance_reasoning,
        intent: llmResult.category,
        sentiment: llmResult.sentiment,
        target_party: llmResult.target_party,
        stance: llmResult.stance,
        reasoning: llmResult.reasoning,
        score: llmResult.risk_score,
        platform_policies_violated: allViolatedPolicies,
        bns_sections_violated: aggregatedLegalSections
      }
    };

    finalResult.reasons = [
      finalResult.explanation,
      `Risk Assessment: ${finalResult.risk_level.toUpperCase()} (${finalResult.risk_score}%)`,
      detectedLocation ? `Location: ${detectedLocation.city}` : null,
      ...allViolatedPolicies.map((p) => `Policy: ${p.policy_name}`),
      ...aggregatedLegalSections.map((l) => `Legal: ${l.act} ${l.section}`)
    ].filter(Boolean);

    return finalResult;
  } catch (err) {
    console.error(`[AnalysisService] Critical error: ${err.message}`);
    return emptyResult(`Analysis failed: ${err.message}`);
  }
};

module.exports = {
  analyzeContent,
  triggerForensicAnalysis
};
