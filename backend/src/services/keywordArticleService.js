const axios = require('axios');
const cheerio = require('cheerio');
const { v4: uuidv4 } = require('uuid');
const Keyword = require('../models/Keyword');
const Grievance = require('../models/Grievance');
const { searchPublicWebArticles } = require('./webArticleSearchService');
const { generateComplaintCode } = require('./complaintCodeService');
const { analyzeContent } = require('./analysisService');

let isFetching = false;
let stopRequested = false;
let lastFetchedAt = null;
let lastFetchStatus = 'idle';

const getStatus = () => ({ isFetching, lastFetchedAt, lastFetchStatus, stopRequested });

const stopFetch = () => {
  if (isFetching) { stopRequested = true; return true; }
  return false;
};

// ─── AP Location Detection ────────────────────────────────────────────────────
// Andhra Pradesh districts + cities (longest keyword first for greedy match)
const AP_LOCATIONS = [
  { keyword: 'visakhapatnam', city: 'Visakhapatnam', district: 'Visakhapatnam' },
  { keyword: 'vizianagaram',  city: 'Vizianagaram',  district: 'Vizianagaram' },
  { keyword: 'tadepalligudem', city: 'Tadepalligudem', district: 'West Godavari' },
  { keyword: 'rajamahendravaram', city: 'Rajahmundry', district: 'East Godavari' },
  { keyword: 'rajahmundry',   city: 'Rajahmundry',   district: 'East Godavari' },
  { keyword: 'narasaraopet',  city: 'Narasaraopet',  district: 'Palnadu' },
  { keyword: 'machilipatnam', city: 'Machilipatnam',  district: 'Krishna' },
  { keyword: 'mangalagiri',   city: 'Mangalagiri',    district: 'Guntur' },
  { keyword: 'bhimavaram',    city: 'Bhimavaram',     district: 'West Godavari' },
  { keyword: 'vijayawada',    city: 'Vijayawada',     district: 'NTR' },
  { keyword: 'amaravati',     city: 'Amaravati',      district: 'Guntur' },
  { keyword: 'kakinada',      city: 'Kakinada',       district: 'East Godavari' },
  { keyword: 'anantapur',     city: 'Anantapur',      district: 'Anantapur' },
  { keyword: 'srikakulam',    city: 'Srikakulam',     district: 'Srikakulam' },
  { keyword: 'nellore',       city: 'Nellore',        district: 'SPSR Nellore' },
  { keyword: 'tirupati',      city: 'Tirupati',       district: 'Tirupati' },
  { keyword: 'chittoor',      city: 'Chittoor',       district: 'Chittoor' },
  { keyword: 'proddatur',     city: 'Proddatur',      district: 'YSR Kadapa' },
  { keyword: 'hindupur',      city: 'Hindupur',       district: 'Sri Sathya Sai' },
  { keyword: 'bapatla',       city: 'Bapatla',        district: 'Bapatla' },
  { keyword: 'ongole',        city: 'Ongole',         district: 'Prakasam' },
  { keyword: 'nandyal',       city: 'Nandyal',        district: 'Nandyal' },
  { keyword: 'kurnool',       city: 'Kurnool',        district: 'Kurnool' },
  { keyword: 'palnadu',       city: 'Palnadu',        district: 'Palnadu' },
  { keyword: 'eluru',         city: 'Eluru',          district: 'West Godavari' },
  { keyword: 'guntur',        city: 'Guntur',         district: 'Guntur' },
  { keyword: 'kadapa',        city: 'Kadapa',         district: 'YSR Kadapa' },
  { keyword: 'tenali',        city: 'Tenali',         district: 'Guntur' },
  { keyword: 'vizag',         city: 'Visakhapatnam',  district: 'Visakhapatnam' },
  { keyword: 'andhra pradesh', city: 'Andhra Pradesh', district: null },
  { keyword: 'andhra',        city: 'Andhra Pradesh', district: null },
].sort((a, b) => b.keyword.length - a.keyword.length);

const detectApLocation = (text) => {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const loc of AP_LOCATIONS) {
    if (lower.includes(loc.keyword)) {
      return {
        city: loc.city,
        district: loc.district,
        constituency: null,
        keyword_matched: loc.keyword,
        confidence: 0.8,
        source: 'ap_keyword_match',
      };
    }
  }
  // Fallback: if article mentions AP political parties/leaders, tag as Andhra Pradesh
  const AP_POLITICAL_TERMS = [
    'tdp', 'telugu desam', 'janasena', 'jana sena', 'ysrcp', 'ysr congress',
    'ycp', 'chandrababu', 'pawan kalyan', 'nara lokesh', 'jagan mohan',
    'jagan reddy', 'ap government', 'andhra government', 'ap cm', 'ap minister',
    'andhra cm', 'andhra minister', 'polavaram', 'amaravati capital',
    'ap assembly', 'andhra assembly', 'ap cabinet', 'ap budget',
  ];
  const hasApPolitical = AP_POLITICAL_TERMS.some(term => lower.includes(term));
  if (hasApPolitical) {
    return {
      city: 'Andhra Pradesh',
      district: null,
      constituency: null,
      keyword_matched: 'ap_political_fallback',
      confidence: 0.5,
      source: 'ap_political_fallback',
    };
  }
  return null;
};

// ─── Image domain blocklist (Google News intermediate pages return Google icons) ──
const BLOCKED_IMAGE_HOSTS = ['google.com', 'gstatic.com', 'googleusercontent.com', 'googleapis.com'];
const isBlockedImageUrl = (url) => {
  if (!url) return true;
  try {
    const host = new URL(url).hostname;
    return BLOCKED_IMAGE_HOSTS.some(d => host === d || host.endsWith('.' + d));
  } catch { return false; }
};

// ─── Scrape article page ──────────────────────────────────────────────────────
// Returns { image: string|null, bodyText: string|null, finalUrl: string }
// Handles: HTTP redirects (maxRedirects:10), meta-refresh redirects (one hop)
const SCRAPE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

const scrapeArticlePage = async (url, _depth = 0) => {
  const empty = { image: null, bodyText: null, finalUrl: url };
  if (_depth > 2) return empty;  // guard against infinite loops

  try {
    const res = await axios.get(url, {
      timeout: 8000,
      headers: SCRAPE_HEADERS,
      maxRedirects: 10,
    });
    const html = res.data || '';
    if (typeof html !== 'string' || html.length < 200) return empty;

    const $ = cheerio.load(html);

    // Follow meta-refresh redirect (Google News intermediate page uses this)
    const metaRefreshContent = $('meta[http-equiv="refresh"]').attr('content') || '';
    if (metaRefreshContent) {
      const m = metaRefreshContent.match(/url=["']?([^"'\s]+)/i);
      if (m && m[1]) {
        let redirectUrl = m[1].trim();
        if (redirectUrl.startsWith('/')) {
          const base = new URL(url);
          redirectUrl = `${base.protocol}//${base.host}${redirectUrl}`;
        }
        if (redirectUrl !== url) return scrapeArticlePage(redirectUrl, _depth + 1);
      }
    }

    // Extract og:image / twitter:image — reject Google-hosted placeholder images
    const rawImage =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="og:image"]').attr('content') ||
      $('meta[property="twitter:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('meta[property="twitter:image:src"]').attr('content') ||
      null;
    const image = rawImage && !isBlockedImageUrl(rawImage) ? rawImage : null;

    // Extract body text from article containers
    let bodyText = '';
    const selectors = [
      'article p',
      '[class*="article-body"] p',
      '[class*="article-content"] p',
      '[class*="story-body"] p',
      '[class*="post-content"] p',
      '[class*="entry-content"] p',
      '[itemprop="articleBody"] p',
      'main p',
    ];
    for (const sel of selectors) {
      const paras = [];
      $(sel).each((_, el) => {
        const t = $(el).text().trim();
        if (t.length > 40) paras.push(t);
      });
      if (paras.length >= 2) {
        bodyText = paras.slice(0, 6).join(' ').slice(0, 1200);
        break;
      }
    }

    return { image, bodyText: bodyText || null, finalUrl: url };
  } catch {
    return empty;
  }
};

// ─── Ollama analysis + AP location ───────────────────────────────────────────
// Separated try/catch blocks so AP location runs even when Ollama is down
const analyzeAndLocate = async (grievanceId, fullText) => {
  // Pass 1: analysis (sentiment, category, risk, intent, persons)
  // Skip detected_location from analysis — it uses Telangana location service internally
  try {
    const analysisData = await analyzeContent(fullText, { platform: 'rss', skipForensics: true });
    if (analysisData) {
      const update = {
        $set: {
          'analysis.sentiment':           analysisData.sentiment || 'neutral',
          'analysis.target_party':        analysisData.target_party,
          'analysis.stance':              analysisData.stance,
          'analysis.risk_level':          analysisData.risk_level,
          'analysis.risk_score':          analysisData.risk_score,
          'analysis.category':            analysisData.category,
          'analysis.grievance_type':      analysisData.grievance_type || 'Normal',
          'analysis.intent':              analysisData.intent,
          'analysis.explanation':         analysisData.explanation,
          'analysis.triggered_keywords':  analysisData.triggered_keywords || [],
          'analysis.analyzed_at':         new Date(),
          'linked_persons':               analysisData.linked_persons || [],
        }
      };
      // Auto-escalate high-risk articles
      if ((analysisData.risk_score || 0) >= 80) {
        update.$set.workflow_status = 'escalated';
        update.$set['workflow_timestamps.escalated_at'] = new Date();
      }
      await Grievance.findOneAndUpdate({ id: grievanceId }, update);
    }
  } catch (err) {
    console.warn(`[KeywordArticleService] Analysis failed for ${grievanceId}:`, err.message);
  }

  // Pass 2: AP-specific keyword location (runs independently of Ollama)
  try {
    const apLoc = detectApLocation(fullText);
    if (apLoc) {
      await Grievance.findOneAndUpdate(
        { id: grievanceId },
        {
          $set: {
            'detected_location.city':            apLoc.city,
            'detected_location.district':        apLoc.district,
            'detected_location.constituency':    null,
            'detected_location.keyword_matched': apLoc.keyword_matched,
            'detected_location.confidence':      apLoc.confidence,
            'detected_location.source':          apLoc.source,
          }
        }
      );
    }
  } catch (err) {
    console.warn(`[KeywordArticleService] AP location failed for ${grievanceId}:`, err.message);
  }
};

// ─── Main fetch loop ──────────────────────────────────────────────────────────
const runKeywordArticleFetch = async ({ triggeredBy = 'scheduler' } = {}) => {
  if (isFetching) {
    console.log('[KeywordArticleService] Fetch already running, skipping');
    return { skipped: true };
  }

  isFetching = true;
  stopRequested = false;
  lastFetchStatus = 'running';

  try {
    const keywords = await Keyword.find({ is_active: true }).lean();
    if (!keywords.length) {
      console.log('[KeywordArticleService] No active keywords found');
      lastFetchStatus = 'done';
      return { fetched: 0 };
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let totalSaved = 0;

    for (const kw of keywords) {
      if (stopRequested) {
        console.log('[KeywordArticleService] Stop requested, halting');
        break;
      }

      try {
        const articles = await searchPublicWebArticles({ query: kw.keyword, limit: 25 });
        const recent = articles.filter(a => new Date(a.publishedAt) >= since);

        for (const article of recent) {
          if (stopRequested) break;

          try {
            const existing = await Grievance.findOne({ tweet_id: `rss:${article.url}` }).lean();
            if (existing) continue;

            // Scrape article page: follow redirects, get real og:image + body
            const { image: scrapedImage, bodyText } = await scrapeArticlePage(article.url);

            // Image: prefer scraped og:image → fall back to image from RSS feed tags
            const imageUrl = scrapedImage || article.image || null;

            const complaintCode = await generateComplaintCode();
            const grievanceId = uuidv4();

            // full_text: scraped body >> RSS summary (if it adds info) >> just title
            // article.summary is already filtered to exclude Google News "Title - Source" noise
            const bodyContent = bodyText || article.summary || '';
            const fullText = bodyContent
              ? `${article.title}. ${bodyContent}`
              : article.title;

            const grievance = new Grievance({
              id: grievanceId,
              complaint_code: complaintCode,
              tweet_id: `rss:${article.url}`,
              tagged_account: 'rss',
              tagged_account_normalized: 'rss',
              platform: 'rss',
              posted_by: {
                handle: article.source || 'rss',
                display_name: article.source || 'RSS Feed',
              },
              content: {
                text: article.title,   // clean headline for card title display
                full_text: fullText,   // headline + body for Ollama analysis & card summary
                media: imageUrl
                  ? [{ type: 'photo', url: imageUrl, media_url: imageUrl }]
                  : [],
              },
              tweet_url: article.url,
              post_date: article.publishedAt ? new Date(article.publishedAt) : new Date(),
              detected_date: new Date(),
              workflow_status: 'received',
              workflow_timestamps: { received_at: new Date() },
              escalation_count: 0,
              'analysis.triggered_keywords': [kw.keyword],
            });

            await grievance.save();
            totalSaved++;

            // Ollama + AP location — async, never blocks article saving
            analyzeAndLocate(grievanceId, fullText).catch(() => {});
          } catch (e) {
            if (e.code !== 11000) {
              console.warn(`[KeywordArticleService] Save error for "${article.url}":`, e.message);
            }
          }
        }
      } catch (err) {
        console.error(`[KeywordArticleService] Error fetching keyword "${kw.keyword}":`, err.message);
      }
    }

    lastFetchedAt = new Date();
    lastFetchStatus = stopRequested ? 'stopped' : 'done';
    console.log(`[KeywordArticleService] Done | new=${totalSaved} | by=${triggeredBy}`);
    return { fetched: totalSaved };
  } catch (err) {
    lastFetchStatus = 'error';
    console.error('[KeywordArticleService] Fatal error:', err.message);
    return { error: err.message };
  } finally {
    isFetching = false;
    stopRequested = false;
  }
};

module.exports = { runKeywordArticleFetch, stopFetch, getStatus };