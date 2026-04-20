const Event = require('../models/Event');
const Content = require('../models/Content');
const Alert = require('../models/Alert');
const Comment = require('../models/Comment');
const Keyword = require('../models/Keyword');

const youtubeService = require('./youtube.service');
const rapidApiXService = require('./rapidApiXService');
const rapidApiFacebookService = require('./rapidApiFacebookService');
const { analyzeContent, analyzeComment } = require('./analysisService');

const normalizeText = (text) => String(text || '').toLowerCase();

const nowUtc = () => new Date();

const getActiveEvents = async () => {
  const now = nowUtc();
  const events = await Event.find({ status: { $ne: 'archived' } }).sort({ start_date: 1 });
  return events.filter((e) => now >= e.start_date && now <= e.end_date);
};

const autoArchiveEndedEvents = async () => {
  const now = nowUtc();
  const ended = await Event.find({
    status: { $ne: 'archived' },
    auto_archive: true,
    end_date: { $lt: now }
  });

  for (const event of ended) {
    event.status = 'archived';
    event.archived_at = now;
    await event.save();
  }

  return { archived: ended.length };
};

const buildEventQuery = (event) => {
  const parts = [];
  if (event.name) parts.push(event.name);
  if (event.location) parts.push(event.location);

  const keywords = (event.keywords || [])
    .map((k) => (typeof k === 'string' ? k : k.keyword))
    .filter(Boolean);

  // Keep query short; RapidAPI/X and YouTube search degrade on overly long strings.
  if (keywords.length > 0) {
    parts.push(keywords.slice(0, 6).join(' OR '));
  }

  return parts.filter(Boolean).join(' ');
};

const computeEventThresholds = (settings, event) => {
  const globalHigh = settings?.high_risk_threshold ?? settings?.risk_threshold_high ?? 70;
  const globalMedium = settings?.medium_risk_threshold ?? settings?.risk_threshold_medium ?? 40;

  // Apply lower thresholds during active events by default.
  const loweredHigh = Math.max(0, globalHigh - 10);
  const loweredMedium = Math.max(0, globalMedium - 10);

  return {
    high: event?.high_risk_threshold ?? loweredHigh,
    medium: event?.medium_risk_threshold ?? loweredMedium
  };
};

const mergeKeywords = (globalKeywordDocs, event) => {
  const merged = [...(globalKeywordDocs || [])];

  const eventKeywords = (event?.keywords || [])
    .map((k) => {
      if (!k) return null;
      const keyword = typeof k === 'string' ? k : k.keyword;
      if (!keyword) return null;
      return {
        keyword: String(keyword).trim(),
        category: 'other',
        language: k.language || 'all',
        weight: 10
      };
    })
    .filter((k) => k && k.keyword);

  merged.push(...eventKeywords);

  // Deduplicate by lower-cased keyword
  const seen = new Set();
  return merged.filter((k) => {
    const key = normalizeText(k.keyword);
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const upsertEventContent = async ({ eventId, platform, contentId, payload }) => {
  const existing = await Content.findOne({ platform, content_id: contentId });

  if (!existing) {
    const created = await Content.create({
      ...payload,
      platform,
      content_id: contentId,
      event_ids: [eventId]
    });
    return { content: created, isNew: true };
  }

  const updatedEventIds = Array.isArray(existing.event_ids) ? existing.event_ids : [];
  if (!updatedEventIds.includes(eventId)) updatedEventIds.push(eventId);

  existing.event_ids = updatedEventIds;

  // Best-effort engagement history
  if (payload.engagement) {
    existing.engagement = { ...existing.engagement, ...payload.engagement };
    existing.engagement_history = existing.engagement_history || [];
    existing.engagement_history.push({
      timestamp: new Date(),
      views: existing.engagement.views,
      likes: existing.engagement.likes,
      comments: existing.engagement.comments
    });
  }

  // Prefer latest text
  if (payload.text) existing.text = payload.text;
  if (payload.published_at) existing.published_at = payload.published_at;

  // Safeguard Author Updates: Don't overwrite valid author with "Unknown"
  const isUnknown = (val) => !val || String(val).trim().toLowerCase() === 'unknown' || String(val).trim().toLowerCase() === 'unknown user';

  if (payload.author && (!isUnknown(payload.author) || isUnknown(existing.author))) {
    existing.author = payload.author;
  }
  if (payload.author_handle && (!isUnknown(payload.author_handle) || isUnknown(existing.author_handle))) {
    existing.author_handle = payload.author_handle;
  }

  if (payload.content_url) existing.content_url = payload.content_url;
  if (payload.thumbnails) existing.thumbnails = payload.thumbnails;
  if (payload.duration) existing.duration = payload.duration;
  if (payload.tags) existing.tags = payload.tags;
  if (payload.media) existing.media = payload.media;
  if (payload.quoted_content) {
    // Only overwrite if new one is valid (not Unknown) or if existing is already Unknown/missing
    const isNewUnknown = !payload.quoted_content.author_name || payload.quoted_content.author_name === 'Unknown';
    const isExistingUnknown = !existing.quoted_content || !existing.quoted_content.author_name || existing.quoted_content.author_name === 'Unknown';

    if (!isNewUnknown || isExistingUnknown) {
      existing.quoted_content = payload.quoted_content;
    }
  }
  if (payload.url_cards) existing.url_cards = payload.url_cards;
  if (payload.scraped_content) existing.scraped_content = payload.scraped_content;
  if (payload.raw_data) existing.raw_data = payload.raw_data;

  await existing.save();
  return { content: existing, isNew: false };
};

const maybeCreatePriorityAlert = async ({ event, content, analysis, analysisData, reason }) => {
  if (!analysis && !analysisData) return null;

  const effective = analysisData || analysis;

  const shouldAlert = ['MEDIUM', 'HIGH'].includes(String(effective.risk_level || '').toUpperCase());
  if (!shouldAlert) return null;

  const existing = await Alert.findOne({ content_id: content.id, event_id: event.id });
  if (existing) return existing;

  const riskLevel = String(effective.risk_level || '').toUpperCase() === 'HIGH' ? 'high' : 'medium';

  return await Alert.create({
    content_id: content.id,
    analysis_id: analysis.id,
    event_id: event.id,
    risk_level: riskLevel,
    title: `Event Priority: ${event.name}`,
    description: effective.explanation || 'Event-related risk signal detected.',
    threat_details: {
      intent: effective.intent || 'Unknown',
      reasons: effective.reasons || [],
      highlights: effective.highlights || [],
      risk_score: effective.risk_score || 0,
      confidence: effective.confidence || 0
    },
    violated_policies: effective.violated_policies || [],
    legal_sections: effective.legal_sections || [],
    classification_explanation: effective.explanation || '',
    ml_analysis: effective.ml_analysis || null,
    llm_analysis: effective.llm_analysis || null,
    content_url: content.content_url,
    platform: content.platform,
    author: content.author,
    is_priority: true,
    priority_reason: reason || ''
  });
};

const scanEventOnce = async ({ event, settings }) => {
  const thresholds = computeEventThresholds(settings, event);
  const globalKeywords = await Keyword.find({ is_active: true });
  const keywordDocs = mergeKeywords(globalKeywords, event);

  const query = buildEventQuery(event);
  if (!query) return { scanned: 0, ingested: 0, alerts: 0 };

  let ingested = 0;
  let alerts = 0;
  let scanned = 0;

  const tweetMediaCache = new Map();
  const getHandleMediaMap = async (handle) => {
    if (!handle) return null;
    const cleanHandle = String(handle).replace('@', '').trim();
    if (!cleanHandle) return null;

    if (tweetMediaCache.has(cleanHandle)) return tweetMediaCache.get(cleanHandle);

    try {
      const result = await rapidApiXService.fetchUserTweets(cleanHandle);
      const tweets = Array.isArray(result) ? result : (result.tweets || []);
      const map = new Map();
      for (const t of tweets) {
        if (t?.id) map.set(t.id, t);
      }
      tweetMediaCache.set(cleanHandle, map);
      return map;
    } catch (error) {
      console.warn(`[EventScan] Failed to hydrate media for @${cleanHandle}:`, error.message);
      tweetMediaCache.set(cleanHandle, null);
      return null;
    }
  };

  const platforms = event.platforms && event.platforms.length > 0 ? event.platforms : ['youtube', 'x', 'facebook'];

  // X / Twitter
  if (platforms.includes('x')) {
    try {
      const tweets = await rapidApiXService.searchTweets(query);
      scanned += tweets.length;

      for (const t of tweets) {
        if ((!t.media || t.media.length === 0) && t.author_handle) {
          // Add a delay to avoid spraying requests if many tweets need hydration
          await new Promise(r => setTimeout(r, 1500));
          const mediaMap = await getHandleMediaMap(t.author_handle);
          const enriched = mediaMap?.get(t.id);
          if (enriched?.media?.length) {
            t.media = enriched.media;
            if (!t.quoted_content && enriched.quoted_content) t.quoted_content = enriched.quoted_content;
            if ((!t.url_cards || t.url_cards.length === 0) && enriched.url_cards) t.url_cards = enriched.url_cards;
          }
        }

        const { content, isNew } = await upsertEventContent({
          eventId: event.id,
          platform: 'x',
          contentId: t.id,
          payload: {
            source_id: null,
            content_url: t.url,
            text: t.text || '',
            author: t.author || t.author_handle || 'Unknown',
            author_handle: t.author_handle || 'unknown',
            published_at: t.created_at ? new Date(t.created_at) : new Date(),
            engagement: {
              views: Number(t.metrics?.views || 0),
              likes: Number(t.metrics?.likes || 0),
              retweets: Number(t.metrics?.retweets || 0),
              comments: Number(t.metrics?.reply || 0)
            },
            media: t.media || [],
            quoted_content: t.quoted_content,
            raw_data: t.raw_data,
            url_cards: t.url_cards || [],
            scraped_content: t.media && t.media.length > 0 ? `Media Count: ${t.media.length}` : ''
          }
        });

        if (isNew) ingested++;

        const analysisData = await analyzeContent(content.text, keywordDocs, {
          highThreshold: thresholds.high,
          mediumThreshold: thresholds.medium
        });

        // persist analysis + content intelligence using existing pipeline shape
        const Analysis = require('../models/Analysis');
        const analysis = await Analysis.create({ content_id: content.id, ...analysisData });
        const riskEvidence = (analysisData.custom_evidence || analysisData.evidence || []);
        const uniqueRiskFactors = [];
        const seenRiskKeywords = new Set();
        for (const e of riskEvidence) {
          const key = String(e.keyword || '').trim().toLowerCase();
          if (!key || seenRiskKeywords.has(key)) continue;
          seenRiskKeywords.add(key);
          uniqueRiskFactors.push({
            keyword: e.keyword,
            weight: e.weight ?? 10,
            category: e.category || 'other',
            context: e.context || ''
          });
        }

        await Content.findOneAndUpdate(
          { id: content.id },
          {
            risk_score: analysisData.risk_score ?? 0,
            risk_level: String(analysisData.risk_level || '').toLowerCase(),
            risk_factors: uniqueRiskFactors,
            sentiment: analysisData.sentiment || 'neutral'
          }
        );

        const eventKeywordsLower = new Set((event.keywords || []).map((k) => normalizeText(typeof k === 'string' ? k : k.keyword)));
        const triggered = (analysisData.triggered_keywords || []).some((k) => eventKeywordsLower.has(normalizeText(k)));
        const hasViolence = (analysisData.evidence || []).some((e) => e.category === 'violence');

        const shouldPriority = triggered || hasViolence;
        if (shouldPriority) {
          const a = await maybeCreatePriorityAlert({
            event,
            content,
            analysis,
            analysisData,
            reason: triggered ? 'Event keyword match' : 'Violence signal'
          });
          if (a) alerts++;
        }
      }
    } catch (error) {
      console.error(`[EventMonitor] Error monitoring X for event ${event.name}: ${error.message}`);
    }
  }

  // YouTube
  if (platforms.includes('youtube')) {
    try {
      const videos = await youtubeService.searchVideos(query);
      scanned += videos.length;

      for (const v of videos) {
        const text = `${v.title || ''}\n${v.description || ''}`.trim();
        const { content, isNew } = await upsertEventContent({
          eventId: event.id,
          platform: 'youtube',
          contentId: v.id,
          payload: {
            source_id: null,
            content_url: `https://www.youtube.com/watch?v=${v.id}`,
            text: text || v.title || 'Untitled',
            author: v.channelTitle || 'Unknown',
            author_handle: v.channelId || 'unknown',
            published_at: v.publishedAt ? new Date(v.publishedAt) : new Date(),
            duration: v.duration,
            thumbnails: v.thumbnails,
            tags: v.tags,
            category_id: v.categoryId,
            engagement: {
              views: Number(v.statistics?.viewCount || 0),
              likes: Number(v.statistics?.likeCount || 0),
              comments: Number(v.statistics?.commentCount || 0)
            },
            media: [{
              url: `https://www.youtube.com/watch?v=${v.id}`,
              type: 'video'
            }]
          }
        });

        if (isNew) ingested++;

        const analysisData = await analyzeContent(content.text, keywordDocs, {
          highThreshold: thresholds.high,
          mediumThreshold: thresholds.medium
        });

        const Analysis = require('../models/Analysis');
        const analysis = await Analysis.create({ content_id: content.id, ...analysisData });
        await Content.findOneAndUpdate(
          { id: content.id },
          {
            risk_score: analysisData.risk_score ?? 0,
            risk_level: String(analysisData.risk_level || '').toLowerCase(),
            risk_factors: (analysisData.evidence || []).map((e) => ({
              keyword: e.keyword,
              weight: e.weight ?? 10,
              category: e.category || 'other',
              context: e.context || ''
            })),
            sentiment: analysisData.sentiment || 'neutral'
          }
        );

        // Comments ingestion + threat detection
        try {
          const comments = await youtubeService.getVideoComments(v.id, 50);
          for (const c of comments) {
            const existing = await Comment.findOne({ comment_id: c.id });
            if (existing) continue;

            const commentAnalysis = analyzeComment(c);
            await Comment.create({
              content_id: content.id,
              video_id: v.id,
              comment_id: c.id,
              author_channel_id: c.authorChannelId,
              author_display_name: c.authorDisplayName,
              author_profile_image: c.authorProfileImageUrl,
              text: c.textDisplay,
              like_count: c.likeCount,
              published_at: c.publishedAt ? new Date(c.publishedAt) : new Date(),
              sentiment: commentAnalysis.riskScore > 50 ? 'negative' : 'neutral',
              threat_score: commentAnalysis.riskScore,
              is_threat: commentAnalysis.riskLevel !== 'low'
            });
          }
        } catch {
          // Ignore comment ingestion failures
        }

        const eventKeywordsLower = new Set((event.keywords || []).map((k) => normalizeText(typeof k === 'string' ? k : k.keyword)));
        const triggered = (analysisData.triggered_keywords || []).some((k) => eventKeywordsLower.has(normalizeText(k)));
        const hasViolence = (analysisData.evidence || []).some((e) => e.category === 'violence');

        const shouldPriority = triggered || hasViolence;
        if (shouldPriority) {
          const a = await maybeCreatePriorityAlert({
            event,
            content,
            analysis,
            analysisData,
            reason: triggered ? 'Event keyword match' : 'Violence signal'
          });
          if (a) alerts++;
        }
      }
    } catch (error) {
      if (error.code === 403 || (error.message && error.message.includes('quota'))) {
        console.warn(`[EventMonitor] YouTube Quota Exceeded for event ${event.name}. Skipping YouTube scan.`);
      } else {
        console.error(`[EventMonitor] Error monitoring YouTube for event ${event.name}: ${error.message}`);
      }
    }
  }

  // Facebook
  if (platforms.includes('facebook')) {
    const posts = await rapidApiFacebookService.searchPosts(query);
    scanned += posts.length;

    for (const p of posts) {
      const { content, isNew } = await upsertEventContent({
        eventId: event.id,
        platform: 'facebook',
        contentId: p.id,
        payload: {
          source_id: null,
          content_url: p.url || `https://facebook.com/${p.id}`,
          text: p.text || '',
          author: p.author || 'Unknown',
          author_handle: p.author_handle || 'unknown',
          published_at: p.created_at ? new Date(p.created_at) : new Date(),
          engagement: {
            views: Number(p.metrics?.views || 0),
            likes: Number(p.metrics?.likes || 0),
            comments: Number(p.metrics?.comments || 0),
            retweets: Number(p.metrics?.shares || 0)
          }
        }
      });

      if (isNew) ingested++;

      const analysisData = await analyzeContent(content.text, keywordDocs, {
        highThreshold: thresholds.high,
        mediumThreshold: thresholds.medium
      });

      const Analysis = require('../models/Analysis');
      const analysis = await Analysis.create({ content_id: content.id, ...analysisData });
      await Content.findOneAndUpdate(
        { id: content.id },
        {
          risk_score: analysisData.risk_score ?? 0,
          risk_level: String(analysisData.risk_level || '').toLowerCase(),
          risk_factors: (analysisData.evidence || []).map((e) => ({
            keyword: e.keyword,
            weight: e.weight ?? 10,
            category: e.category || 'other',
            context: e.context || ''
          })),
          sentiment: analysisData.sentiment || 'neutral'
        }
      );

      // Fetch comments for Facebook posts
      try {
        if (p.metrics?.comments > 0) {
          const comments = await rapidApiFacebookService.fetchPostComments(p.id, 30);
          for (const c of comments) {
            const existing = await Comment.findOne({ comment_id: c.id });
            if (existing) continue;

            const commentAnalysis = analyzeComment({ textDisplay: c.text });
            await Comment.create({
              content_id: content.id,
              video_id: p.id,
              comment_id: c.id,
              author_channel_id: c.author_id || 'unknown',
              author_display_name: c.author_name || 'Unknown',
              author_profile_image: c.author_image,
              text: c.text,
              like_count: c.likes || 0,
              published_at: c.created_at ? new Date(c.created_at) : new Date(),
              sentiment: commentAnalysis.riskScore > 50 ? 'negative' : 'neutral',
              threat_score: commentAnalysis.riskScore,
              is_threat: commentAnalysis.riskLevel !== 'low'
            });
          }
        }
      } catch {
        // Ignore comment ingestion failures
      }

      const eventKeywordsLower = new Set((event.keywords || []).map((k) => normalizeText(typeof k === 'string' ? k : k.keyword)));
      const triggered = (analysisData.triggered_keywords || []).some((k) => eventKeywordsLower.has(normalizeText(k)));
      const hasViolence = (analysisData.evidence || []).some((e) => e.category === 'violence');

      const shouldPriority = triggered || hasViolence;
      if (shouldPriority) {
        const a = await maybeCreatePriorityAlert({
          event,
          content,
          analysis,
          analysisData,
          reason: triggered ? 'Event keyword match' : 'Violence signal'
        });
        if (a) alerts++;
      }
    }
  }

  event.last_polled_at = new Date();
  if (event.status !== 'active') event.status = 'active';
  await event.save();

  return { scanned, ingested, alerts };
};

const shouldPollEvent = (event, pollingIntervalMinutes) => {
  if (!pollingIntervalMinutes) return true;
  if (!event.last_polled_at) return true;
  const last = new Date(event.last_polled_at).getTime();
  const now = Date.now();
  return now - last >= pollingIntervalMinutes * 60 * 1000;
};

module.exports = {
  getActiveEvents,
  autoArchiveEndedEvents,
  scanEventOnce,
  shouldPollEvent
};
