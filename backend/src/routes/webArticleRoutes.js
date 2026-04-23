const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { requireAnyPageAccess } = require('../middleware/rbacMiddleware');
const { searchWebArticles } = require('../controllers/webArticleController');

router.use(protect, requireAnyPageAccess(['/analysis-tools']));

router.get('/search', searchWebArticles);

module.exports = router;
