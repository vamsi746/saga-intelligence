const express = require('express');
const router = express.Router();
const mediaAnalyzerService = require('../services/mediaAnalyzerService');
const rapidApiXService = require('../services/rapidApiXService');
const AuditLog = require('../models/AuditLog');
const { protect } = require('../middleware/authMiddleware');
const { requireAnyPageAccess } = require('../middleware/rbacMiddleware');

router.use(protect, requireAnyPageAccess(['/x-monitor']));

// Keep legacy call sites but preserve authenticated user identity.
const mockUser = (req, res, next) => {
    if (!req.user) {
        req.user = {
            id: 'unknown',
            email: 'unknown@local',
            full_name: 'Unknown User'
        };
    }
    req.user.name = req.user.name || req.user.full_name || req.user.email || req.user.id;
    next();
};

const logAction = async (user, action, resourceType, resourceId, details) => {
    try {
        await AuditLog.create({
            user_id: user.id,
            user_email: user.email,
            user_name: user.name,
            action: action,
            resource_type: resourceType,
            resource_id: resourceId,
            details: details
        });
    } catch (error) {
        console.error('Audit Log Error:', error);
    }
};

const RAPID_ENDPOINT_ALIASES = {
    // User Endpoint
    'user/by-username': 'user',
    'users/by-ids': 'users',
    'users/by-ids-v2': 'users-v2',
    'user/replies': 'user-replies',
    'user/replies-v2': 'user-replies-v2',
    'user/media': 'user-media',
    'user/tweets': 'user-tweets',
    'user/followings': 'user-followings',
    'user/following-ids': 'user-following-ids',
    'user/followers': 'user-followers',
    'user/verified-followers': 'user-verified-followers',
    'user/followers-ids': 'user-followers-ids',
    'user/highlights': 'user-highlights',
    'user/about': 'user-about',

    // Posts Endpoint
    'post/comments': 'tweet-comments',
    'post/comments-v2': 'tweet-comments-v2',
    'post/quotes': 'tweet-quotes',
    'post/retweets': 'tweet-retweets',
    'tweet/details-v2': 'tweet-details',
    'tweets/details-by-ids': 'tweets',
    'tweets/details-by-ids-v2': 'tweets-v2',

    // Explore Endpoint
    'explore/search': 'search',
    'explore/search-v2': 'search-v2',
    'explore/search-v3': 'search-v3',
    'explore/autocomplete': 'auto-complete',

    // Lists Endpoint
    'lists/search': 'search-lists',
    'lists/details': 'list-details',
    'lists/timeline': 'list-timeline',
    'lists/followers': 'list-followers',
    'lists/members': 'list-members',

    // Community Endpoint
    'community/search': 'search-community',
    'community/topics': 'community-topics',
    'community/timeline': 'community-timeline',
    'community/popular': 'community-popular',
    'community/members': 'community-members',
    'community/members-v2': 'community-members-v2',
    'community/moderators': 'community-moderators',
    'community/tweets': 'community-tweets',
    'community/about': 'community-about',
    'community/details': 'community-details',

    // Trends Endpoint
    'trends/locations': 'trends-available',
    'trends/by-location': 'trends'
};

const proxyRapidEndpoint = async (endpoint, req, res) => {
    try {
        const data = await rapidApiXService.rapidGet(endpoint, req.query);
        res.json(data);
    } catch (error) {
        res.status(500).json({
            error: 'RapidAPI request failed',
            message: error.message
        });
    }
};

// --- X / TWITTER VIDEO DOWNLOAD ---
router.post('/download-video', mockUser, async (req, res) => {
    try {
        const { content_url, media_url, tweet_url, content_id } = req.body;
        const mediaUrl = media_url || content_url || tweet_url;

        if (!mediaUrl) {
            return res.status(400).json({ error: 'media_url is required' });
        }

        console.log(`Initiating X video download for: ${mediaUrl}`);

        const result = await mediaAnalyzerService.downloadVideo(mediaUrl);

        await logAction(req.user, 'download_video', 'content', content_id || result.video_id, {
            media_url: mediaUrl,
            video_id: result.video_id,
            filename: result.filename
        });

        res.json({
            success: true,
            video_id: result.video_id,
            filename: result.filename,
            download_url: result.download_url,
            title: result.title,
            duration_seconds: result.duration_seconds
        });
    } catch (error) {
        console.error('X video download error:', error);
        res.status(error.statusCode || 500).json({
            error: error.message || 'Failed to download video'
        });
    }
});

// Get video download URL (if already downloaded)
router.get('/video-url/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        const downloadUrl = mediaAnalyzerService.getVideoDownloadUrl(videoId);
        res.json({ download_url: downloadUrl });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get video URL' });
    }
});

// Generic RapidAPI proxy for any GET endpoint (provide ?endpoint=path)
router.get('/rapid', async (req, res) => {
    const { endpoint } = req.query;
    if (!endpoint) {
        return res.status(400).json({ error: 'endpoint query parameter is required' });
    }
    return proxyRapidEndpoint(endpoint, req, res);
});

// Aliased RapidAPI endpoints for convenience
Object.entries(RAPID_ENDPOINT_ALIASES).forEach(([alias, endpoint]) => {
    router.get(`/rapid/${alias}`, async (req, res) => proxyRapidEndpoint(endpoint, req, res));
});

module.exports = router;
