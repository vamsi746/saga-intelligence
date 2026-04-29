const express = require('express');
const router = express.Router();
const {
  getKeywords, createKeyword, deleteKeyword, triggerRescan,
  fetchArticlesNow, stopArticleFetch, getArticleFetchStatus, getKeywordArticles,
  fetchGrievancesNow, stopGrievanceFetchNow, getGrievanceFetchStatusHandler
} = require('../controllers/keywordController');
const { protect } = require('../middleware/authMiddleware');
const { requireAnyPageAccess } = require('../middleware/rbacMiddleware');

router.get('/', protect, requireAnyPageAccess(['/settings', '/alerts']), getKeywords);
router.post('/', protect, requireAnyPageAccess(['/settings']), createKeyword);
router.post('/scan', protect, requireAnyPageAccess(['/settings']), triggerRescan);
router.delete('/:id', protect, requireAnyPageAccess(['/settings']), deleteKeyword);

// Article fetch routes
router.post('/articles/fetch', protect, requireAnyPageAccess(['/settings']), fetchArticlesNow);
router.post('/articles/stop', protect, requireAnyPageAccess(['/settings']), stopArticleFetch);
router.get('/articles/status', protect, requireAnyPageAccess(['/settings']), getArticleFetchStatus);
router.get('/articles', protect, requireAnyPageAccess(['/settings']), getKeywordArticles);

// Grievance fetch routes (RapidAPI + Ollama pipeline)
router.post('/grievance-fetch/fetch', protect, requireAnyPageAccess(['/settings']), fetchGrievancesNow);
router.post('/grievance-fetch/stop', protect, requireAnyPageAccess(['/settings']), stopGrievanceFetchNow);
router.get('/grievance-fetch/status', protect, requireAnyPageAccess(['/settings']), getGrievanceFetchStatusHandler);

module.exports = router;
