const Keyword = require('../models/Keyword');
const Grievance = require('../models/Grievance');
const { createAuditLog } = require('../services/auditService');
const { runKeywordArticleFetch, stopFetch, getStatus } = require('../services/keywordArticleService');
const {
  runKeywordGrievanceFetch,
  stopFetch: stopGrievanceFetch,
  getStatus: getGrievanceFetchStatus
} = require('../services/keywordGrievanceSchedulerService');
const { rescanContent } = require('../services/monitorService');

const getKeywords = async (req, res) => {
  try {
    const query = {};
    if (req.query.category) query.category = req.query.category;
    const keywords = await Keyword.find(query).limit(1000);
    res.status(200).json(keywords);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createKeyword = async (req, res) => {
  try {
    const keyword = await Keyword.create(req.body);
    await createAuditLog(req.user, 'create', 'keyword', keyword.id, { keyword: keyword.keyword });
    res.status(201).json(keyword);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteKeyword = async (req, res) => {
  try {
    const keyword = await Keyword.findOne({ id: req.params.id });
    if (!keyword) return res.status(404).json({ message: 'Keyword not found' });
    await keyword.deleteOne();
    await createAuditLog(req.user, 'delete', 'keyword', req.params.id, {});
    res.status(204).json(null);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const triggerRescan = async (req, res) => {
  try {
    const result = await rescanContent();
    await createAuditLog(req.user, 'scan', 'content', 'retroactive', { count: result.scanned });
    res.status(200).json({ message: 'Retroactive scan started', result });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Keyword Article Fetch ──────────────────────────────────────────────────

const fetchArticlesNow = async (req, res) => {
  try {
    if (getStatus().isFetching) {
      return res.status(409).json({ message: 'Fetch already in progress' });
    }
    // Fire and forget — client polls /status
    runKeywordArticleFetch({ triggeredBy: 'manual' });
    res.status(202).json({ message: 'Fetch started' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const stopArticleFetch = async (req, res) => {
  const stopped = stopFetch();
  res.status(200).json({ message: stopped ? 'Stop signal sent' : 'No fetch in progress' });
};

const getArticleFetchStatus = async (req, res) => {
  res.status(200).json(getStatus());
};

const getKeywordArticles = async (req, res) => {
  try {
    const { keyword, limit = 50, page = 1 } = req.query;
    const query = { platform: 'rss' };
    if (keyword) query['analysis.triggered_keywords'] = keyword;

    const [grievances, total] = await Promise.all([
      Grievance.find(query)
        .sort({ post_date: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean(),
      Grievance.countDocuments(query)
    ]);

    // Transform Grievance documents to the shape Settings.js expects
    const articles = grievances.map(g => {
      const title = g.content?.text || '';
      const fullText = g.content?.full_text || '';
      const body = fullText.startsWith(title + '. ')
        ? fullText.slice(title.length + 2).trim()
        : (fullText !== title ? fullText : '');
      return {
        _id: g._id,
        url: g.tweet_url,
        title,
        source: g.posted_by?.display_name || g.posted_by?.handle || '',
        publishedAt: g.post_date,
        summary: body.slice(0, 200),
        keyword: (g.analysis?.triggered_keywords || [])[0] || '',
        sentiment: g.analysis?.sentiment || null,
        location: g.detected_location?.city || null,
      };
    });

    res.status(200).json({ articles, total });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Keyword Grievance Fetch ────────────────────────────────────────────────

const fetchGrievancesNow = async (req, res) => {
  try {
    if (getGrievanceFetchStatus().isFetching) {
      return res.status(409).json({ message: 'Grievance fetch already in progress' });
    }
    const { platform } = req.query; // optional: x, facebook, all
    runKeywordGrievanceFetch({ triggeredBy: 'manual', platformFilter: platform || null });
    res.status(202).json({ message: 'Grievance fetch started' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const stopGrievanceFetchNow = async (req, res) => {
  const stopped = stopGrievanceFetch();
  res.status(200).json({ message: stopped ? 'Stop signal sent — current fetch will finish then stop' : 'No fetch in progress' });
};

const getGrievanceFetchStatusHandler = async (req, res) => {
  res.status(200).json(getGrievanceFetchStatus());
};

module.exports = {
  getKeywords,
  createKeyword,
  deleteKeyword,
  triggerRescan,
  fetchArticlesNow,
  stopArticleFetch,
  getArticleFetchStatus,
  getKeywordArticles,
  fetchGrievancesNow,
  stopGrievanceFetchNow,
  getGrievanceFetchStatusHandler
};
