const express = require('express');
const router = express.Router();
const {
  getAnalyticsOverview,
  getTrends,
  getUnifiedReportsAnalytics,
  getPostsAnalytics
} = require('../controllers/analyticsController');
const { protect } = require('../middleware/authMiddleware');
const { requireAnyPageAccess } = require('../middleware/rbacMiddleware');

router.use(protect, requireAnyPageAccess(['/analytics', '/unified-reports', '/intel-processed', '/settings']));

router.get('/overview', getAnalyticsOverview);
router.get('/trends', getTrends);
router.get('/unified-reports', getUnifiedReportsAnalytics);
router.get('/posts-stats', getPostsAnalytics);

module.exports = router;
