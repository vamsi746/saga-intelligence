const Report = require('../models/Report');
const Alert = require('../models/Alert');
const Content = require('../models/Content');
const Analysis = require('../models/Analysis');
const cacheService = require('./cacheService');

/**
 * Generate a unique serial number for a report.
 * Format: PLATFORM-SN-MM-DD-YYYY
 */
const generateSerialNumber = async (platform) => {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();

    const platformCode = platform.toUpperCase().substring(0, 1); // X, Y, F, I
    const dateStr = `${dd}${mm}${yyyy}`; // ddmmyyyy

    // Count ALL reports created for this platform (no date filter)
    const count = await Report.countDocuments({
        platform: platform.toLowerCase()
    });

    const sn = String(count + 1).padStart(4, '0'); // 0001
    return `${platformCode}${sn}-${dateStr}`; // x0001-ddmmyyyy
};

/**
 * Create a new report based on an alert.
 */
const createReportFromAlert = async (alertId) => {
    const alert = await Alert.findOne({ id: alertId });
    if (!alert) throw new Error('Alert not found');

    const content = await Content.findOne({ id: alert.content_id });
    const analysis = await Analysis.findOne({ id: alert.analysis_id });

    // Check if report already exists
    const existingReport = await Report.findOne({ alert_id: alertId });
    if (existingReport) {
        return existingReport;
    }

    const serialNumber = await generateSerialNumber(alert.platform);

    const reportData = {
        serial_number: serialNumber,
        alert_id: alertId,
        platform: alert.platform,
        target_user_details: {
            name: alert.author || 'Unknown',
            handle: content?.author_handle || alert.author,
            profile_url: `https://x.com/${(content?.author_handle || alert.author).replace('@', '')}`,
            avatar_url: content?.original_author_avatar || '',
            is_verified: false // Source model would have this
        },
        content_summary: content?.text || alert.description,
        media_links: content?.media?.map(m => m.url) || [],
        legal_sections: alert.legal_sections || [],
        violated_policies: alert.violated_policies || [],
        status: 'sent_to_intermediary'
    };

    const report = new Report(reportData);
    await report.save();

    // Update alert status to escalated
    alert.status = 'escalated';
    await alert.save();
    await cacheService.invalidatePrefix('reports:stats:v1');
    await cacheService.invalidatePrefix('dashboard:v2');
    await cacheService.invalidatePrefix('alerts:stats:v2');

    // --- ML FEEDBACK LOOP ---
    // Recording report generation as confirmed escalation (HIGH risk)
    try {
        const feedbackService = require('./feedbackService');
        if (content && content.text) {
            await feedbackService.recordFeedback({
                text: content.text,
                category: alert.category_id || 'Abusive',
                legal_sections: alert.legal_sections,
                review_status: 'escalated',
                current_risk: 'HIGH'
            });
            console.log(`[ReportService] Recorded feedback for report: ${alertId}`);
        }
    } catch (fbError) {
        console.error('[ReportService] Feedback recording failed:', fbError);
    }

    return report;
};

/**
 * Get all reports with filtering and pagination.
 */
const getAllReports = async (filters = {}) => {
    const { platform, status, search, startDate, endDate, page = 1, limit = 50, keyword, alert_type, risk_level, category } = filters;
    const query = {};

    if (platform && platform !== 'all') query.platform = platform;
    if (status && status !== 'all') query.status = status;
    if (startDate || endDate) {
        query.generated_at = {};
        if (startDate) query.generated_at.$gte = new Date(startDate);
        if (endDate) query.generated_at.$lte = new Date(endDate);
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // optimization: if no filters require lookups, we paginate first.
    // however, search usually covers content_data.text and target_user_details (now in Report model).
    // alert_data filters (risk_level, alert_type) and source_data (category) always need joins.

    const needsJoinsForFiltering = category && category !== 'all' ||
        keyword && keyword !== 'all' ||
        risk_level && risk_level !== 'all' ||
        alert_type && alert_type !== 'all' ||
        (search && search.includes(' ')); // complex search might hit content text

    let pipeline = [];

    if (!needsJoinsForFiltering) {
        // Optimized path: Sort and Paginate Report collection FIRST
        pipeline.push({ $match: query });

        // Target handle-based search directly on Report model if simple search
        if (search) {
            const searchTerms = search.split(',').map(s => s.trim()).filter(Boolean);
            if (searchTerms.length > 0) {
                pipeline.push({
                    $match: {
                        $or: [
                            { serial_number: { $regex: search, $options: 'i' } },
                            { 'target_user_details.name': { $regex: search, $options: 'i' } },
                            { 'target_user_details.handle': { $regex: search, $options: 'i' } }
                        ]
                    }
                });
            }
        }

        pipeline.push({ $sort: { generated_at: -1 } });
        pipeline.push({ $skip: skip });
        pipeline.push({ $limit: limitNum });

        // Now add the lookups for only the returned page
        pipeline.push(
            {
                $lookup: {
                    from: 'alerts',
                    localField: 'alert_id',
                    foreignField: 'id',
                    as: 'alert_data'
                }
            },
            { $unwind: { path: '$alert_data', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'contents',
                    localField: 'alert_data.content_id',
                    foreignField: 'id',
                    as: 'content_data'
                }
            },
            { $unwind: { path: '$content_data', preserveNullAndEmptyArrays: true } }
        );
    } else {
        // Legacy path: Joins must happen before filtering
        pipeline = [
            { $match: query },
            {
                $lookup: {
                    from: 'alerts',
                    localField: 'alert_id',
                    foreignField: 'id',
                    as: 'alert_data'
                }
            },
            { $unwind: { path: '$alert_data', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'contents',
                    localField: 'alert_data.content_id',
                    foreignField: 'id',
                    as: 'content_data'
                }
            },
            { $unwind: { path: '$content_data', preserveNullAndEmptyArrays: true } }
        ];

        if (category && category !== 'all') {
            pipeline.push(
                {
                    $lookup: {
                        from: 'sources',
                        localField: 'content_data.source_id',
                        foreignField: 'id',
                        as: 'source_data'
                    }
                },
                { $unwind: { path: '$source_data', preserveNullAndEmptyArrays: true } },
                { $match: { 'source_data.category': category } }
            );
        }

        if (keyword && keyword !== 'all') {
            pipeline.push({
                $match: {
                    'content_data.risk_factors.keyword': { $regex: `^${keyword}`, $options: 'i' }
                }
            });
        }

        if (risk_level && risk_level !== 'all') {
            pipeline.push({
                $match: { 'alert_data.risk_level': risk_level }
            });
        }

        if (alert_type && alert_type !== 'all') {
            if (alert_type === 'risk') {
                pipeline.push({
                    $match: { 'alert_data.alert_type': { $in: ['keyword_risk', 'ai_risk', null] } }
                });
            } else {
                pipeline.push({
                    $match: { 'alert_data.alert_type': alert_type }
                });
            }
        }

        if (search) {
            pipeline.push({
                $match: {
                    $or: [
                        { serial_number: { $regex: search, $options: 'i' } },
                        { 'target_user_details.name': { $regex: search, $options: 'i' } },
                        { 'target_user_details.handle': { $regex: search, $options: 'i' } },
                        { 'content_data.text': { $regex: search, $options: 'i' } }
                    ]
                }
            });
        }

        pipeline.push(
            { $sort: { generated_at: -1 } },
            { $skip: skip },
            { $limit: limitNum }
        );
    }

    pipeline.push(
        {
            $addFields: {
                id: '$_id',
                joined_content_url: '$alert_data.content_url'
            }
        }
    );

    return await Report.aggregate(pipeline);
};
const updateReport = async (alertId, updateData) => {
    const report = await Report.findOneAndUpdate(
        { alert_id: alertId },
        {
            $set: updateData
        },
        { new: true }
    );
    if (!report) throw new Error('Report not found');
    await cacheService.invalidatePrefix('reports:stats:v1');
    await cacheService.invalidatePrefix('dashboard:v2');
    return report;
};

const getReportStats = async () => {
    const cacheKey = 'reports:stats:v1:all';
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const grouped = await Report.aggregate([
        {
            $group: {
                _id: { platform: '$platform', status: '$status' },
                count: { $sum: 1 }
            }
        }
    ]);

    const normalizePlatform = (platform) => (platform === 'x' ? 'twitter' : platform);
    const statuses = ['generated', 'printed', 'sent', 'sent_to_intermediary', 'awaiting_reply', 'closed'];
    const platforms = ['all', 'twitter', 'youtube', 'facebook', 'instagram', 'whatsapp'];
    const byPlatform = {};
    const byStatus = Object.fromEntries(statuses.map((s) => [s, 0]));
    const totals = { total: 0 };

    platforms.forEach((p) => {
        byPlatform[p] = { total: 0 };
        statuses.forEach((s) => {
            byPlatform[p][s] = 0;
        });
    });

    grouped.forEach(({ _id, count }) => {
        const platform = normalizePlatform(_id.platform || 'unknown');
        const status = _id.status;
        if (!statuses.includes(status)) return;
        if (!byPlatform[platform]) {
            byPlatform[platform] = { total: 0 };
            statuses.forEach((s) => {
                byPlatform[platform][s] = 0;
            });
        }
        byPlatform[platform][status] += count;
        byPlatform[platform].total += count;
        byPlatform.all[status] += count;
        byPlatform.all.total += count;
        byStatus[status] += count;
        totals.total += count;
    });

    const payload = { byPlatform, byStatus, totals };
    await cacheService.set(cacheKey, payload, 30);
    return payload;
};

module.exports = {
    generateSerialNumber,
    createReportFromAlert,
    getAllReports,
    updateReport,
    getReportStats
};
