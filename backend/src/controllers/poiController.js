const POI = require('../models/POI');

const PROFILE_PLATFORMS = ['x', 'facebook', 'instagram', 'youtube', 'whatsapp'];

// GET /api/poi — List all POIs
const getAllPOIs = async (req, res) => {
    try {
        const { status, search, page = 1, limit = 50 } = req.query;

        const filter = {};
        if (search) {
            const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const searchRegex = { $regex: escapedSearch, $options: 'i' };
            filter.$or = [
                { name: searchRegex },
                { realName: searchRegex },
                { aliasNames: searchRegex },
                { mobileNumbers: searchRegex },
                { emailIds: searchRegex },
                { whatsappNumbers: searchRegex },
                { lastUsedIp: searchRegex },
                { softwareHardwareIdentifiers: searchRegex },
                { currentAddress: searchRegex },
                { psLimits: searchRegex },
                { districtCommisionerate: searchRegex },
                { firNo: searchRegex },
                { linkedIncidents: searchRegex },
                { briefSummary: searchRegex },
                { 'firDetails.firNo': searchRegex },
                { 'firDetails.psLimits': searchRegex },
                { 'firDetails.districtCommisionerate': searchRegex },
                { 'socialMedia.handle': searchRegex },
                { 'socialMedia.displayName': searchRegex },
                { 'socialMedia.followerCount': searchRegex },
                { 'socialMedia.createdDate': searchRegex },
                { 'previouslyDeletedProfiles.x': searchRegex },
                { 'previouslyDeletedProfiles.facebook': searchRegex },
                { 'previouslyDeletedProfiles.instagram': searchRegex },
                { 'previouslyDeletedProfiles.youtube': searchRegex },
                { 'previouslyDeletedProfiles.whatsapp': searchRegex },
                { 'customFields.value': searchRegex }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [pois, total] = await Promise.all([
            POI.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            POI.countDocuments(filter)
        ]);

        res.json({
            pois,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit))
        });
    } catch (error) {
        console.error('[POI] Error fetching POIs:', error.message);
        res.status(500).json({ message: 'Failed to fetch persons of interest', error: error.message });
    }
};

// GET /api/poi/:id — Get single POI
const getPOIById = async (req, res) => {
    try {
        const poi = await POI.findById(req.params.id).lean();
        if (!poi) {
            return res.status(404).json({ message: 'Person of interest not found' });
        }
        res.json(poi);
    } catch (error) {
        console.error('[POI] Error fetching POI:', error.message);
        res.status(500).json({ message: 'Failed to fetch person of interest', error: error.message });
    }
};

// POST /api/poi — Create new POI
const createPOI = async (req, res) => {
    try {
        const {
            name, realName, aliasNames, mobileNumbers, emailIds, whatsappNumbers,
            lastUsedIp, currentAddress, psLimits, districtCommisionerate,
            softwareHardwareIdentifiers, firNo, firDetails, linkedIncidents,
            previouslyDeletedProfiles, socialMedia,
            briefSummary, profileImage, customFields, status
        } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Name is required' });
        }

        const poi = await POI.create({
            name: name.trim(),
            realName: realName || '',
            aliasNames: aliasNames || [],
            mobileNumbers: mobileNumbers || [],
            emailIds: emailIds || [],
            whatsappNumbers: whatsappNumbers || [],
            lastUsedIp: lastUsedIp || '',
            currentAddress: currentAddress || '',
            psLimits: psLimits || '',
            districtCommisionerate: districtCommisionerate || '',
            softwareHardwareIdentifiers: softwareHardwareIdentifiers || '',
            firNo: firNo || '',
            firDetails: firDetails || [],
            linkedIncidents: linkedIncidents || '',
            previouslyDeletedProfiles: previouslyDeletedProfiles || {},
            socialMedia: socialMedia || [],
            briefSummary: briefSummary || '',
            profileImage: profileImage || '',
            customFields: customFields || [],
            status: status || 'active',
            createdBy: req.body.createdBy || 'system'
        });

        res.status(201).json(poi);
    } catch (error) {
        console.error('[POI] Error creating POI:', error.message);
        res.status(500).json({ message: 'Failed to create person of interest', error: error.message });
    }
};

// PUT /api/poi/:id — Update POI
const updatePOI = async (req, res) => {
    try {
        const poi = await POI.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        );

        if (!poi) {
            return res.status(404).json({ message: 'Person of interest not found' });
        }

        // Sync monitoring details to Source collection if linked
        if (req.body.socialMedia && Array.isArray(req.body.socialMedia)) {
            const Source = require('../models/Source');
            for (const sm of req.body.socialMedia) {
                if (sm.sourceId) {
                    const updateData = {};
                    if (sm.category) updateData.category = sm.category;
                    if (sm.priority) updateData.priority = sm.priority;
                    if (sm.displayName) updateData.display_name = sm.displayName;
                    if (sm.is_active !== undefined) updateData.is_active = sm.is_active;

                    if (Object.keys(updateData).length > 0) {
                        // Update by UUID (id) OR ObjectId (_id)
                        const mongoose = require('mongoose');
                        const query = { $or: [{ id: sm.sourceId }] };
                        if (mongoose.Types.ObjectId.isValid(sm.sourceId)) {
                            query.$or.push({ _id: sm.sourceId });
                        }

                        try {
                            await Source.findOneAndUpdate(query, { $set: updateData });
                        } catch (err) {
                            console.error(`[POI] Failed to sync Source ${sm.sourceId}:`, err.message);
                        }
                    }
                }
            }
        }

        res.json(poi);
    } catch (error) {
        console.error('[POI] Error updating POI:', error.message);
        res.status(500).json({ message: 'Failed to update person of interest', error: error.message });
    }
};

// GET /api/poi/:id/report/latest — Redirect to latest S3 report
const getLatestReport = async (req, res) => {
    try {
        const poi = await POI.findById(req.params.id);
        if (!poi || !poi.s3ReportUrl) {
            console.log(`[POI] No report found for ID: ${req.params.id}`);
            return res.status(404).send('<h1>No report found</h1><p>The report for this profile has not been uploaded yet.</p>');
        }
        console.log(`[POI] Redirecting to report: ${poi.s3ReportUrl}`);
        res.redirect(poi.s3ReportUrl);
    } catch (error) {
        console.error('[POI] Error redirecting to report:', error.message);
        res.status(500).json({ message: 'Failed to find report', error: error.message });
    }
};

// DELETE /api/poi/:id — Delete POI
const deletePOI = async (req, res) => {
    try {
        const poi = await POI.findByIdAndDelete(req.params.id);

        if (!poi) {
            return res.status(404).json({ message: 'Person of interest not found' });
        }

        res.json({ message: 'Person of interest deleted successfully' });
    } catch (error) {
        console.error('[POI] Error deleting POI:', error.message);
        res.status(500).json({ message: 'Failed to delete person of interest', error: error.message });
    }
};

// GET /api/poi/by-source/:sourceId — Find POI linked to a source
const getPoiBySourceId = async (req, res) => {
    try {
        const { sourceId } = req.params;
        // Try matching by sourceId first
        let poi = await POI.findOne({ 'socialMedia.sourceId': sourceId }).lean();
        if (!poi) {
            // Fallback: try matching by handle + platform from query params
            const { handle, platform } = req.query;
            if (handle && platform) {
                const normalizedPlatform = platform === 'twitter' ? 'x' : platform;
                poi = await POI.findOne({
                    'socialMedia.handle': { $regex: `^${handle.replace(/^@/, '')}$`, $options: 'i' },
                    'socialMedia.platform': normalizedPlatform
                }).lean();
            }
        }
        if (!poi) {
            return res.status(404).json({ message: 'No POI found for this source' });
        }
        res.json(poi);
    } catch (error) {
        console.error('[POI] Error finding POI by source:', error.message);
        res.status(500).json({ message: 'Failed to find POI', error: error.message });
    }
};

// GET /api/poi/stats — Platform-wise profile stats (active/inactive)
const getPoiStats = async (_req, res) => {
    try {
        const rows = await POI.aggregate([
            {
                $project: {
                    createdAt: '$createdAt',
                    state: {
                        $cond: [{ $eq: ['$status', 'active'] }, 'active', 'inactive']
                    },
                    platforms: {
                        $map: {
                            input: { $ifNull: ['$socialMedia', []] },
                            as: 'social',
                            in: {
                                $let: {
                                    vars: {
                                        platform: {
                                            $toLower: {
                                                $trim: {
                                                    input: {
                                                        $convert: {
                                                            input: '$$social.platform',
                                                            to: 'string',
                                                            onError: '',
                                                            onNull: ''
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    },
                                    in: {
                                        $switch: {
                                            branches: [
                                                { case: { $eq: ['$$platform', 'twitter'] }, then: 'x' },
                                                { case: { $eq: ['$$platform', 'x'] }, then: 'x' },
                                                { case: { $eq: ['$$platform', 'facebook'] }, then: 'facebook' },
                                                { case: { $eq: ['$$platform', 'instagram'] }, then: 'instagram' },
                                                { case: { $eq: ['$$platform', 'youtube'] }, then: 'youtube' },
                                                { case: { $eq: ['$$platform', 'whatsapp'] }, then: 'whatsapp' }
                                            ],
                                            default: null
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        ]);

        const init = () => ({ total: 0, active: 0, inactive: 0, today_added: 0, week_added: 0 });
        const byPlatform = {
            all: init(),
            x: init(),
            facebook: init(),
            instagram: init(),
            youtube: init(),
            whatsapp: init()
        };

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayStartMs = todayStart.getTime();

        const weekStart = new Date();
        weekStart.setHours(0, 0, 0, 0);
        const dayOfWeek = weekStart.getDay();
        const daysSinceMonday = (dayOfWeek + 6) % 7;
        weekStart.setDate(weekStart.getDate() - daysSinceMonday);
        const weekStartMs = weekStart.getTime();

        rows.forEach((row) => {
            const state = row?.state === 'inactive' ? 'inactive' : 'active';
            const createdAtMs = row?.createdAt ? new Date(row.createdAt).getTime() : Number.NaN;
            const isTodayAdded = !Number.isNaN(createdAtMs) && createdAtMs >= todayStartMs;
            const isWeekAdded = !Number.isNaN(createdAtMs) && createdAtMs >= weekStartMs;

            byPlatform.all[state] += 1;
            byPlatform.all.total += 1;
            if (isTodayAdded) byPlatform.all.today_added += 1;
            if (isWeekAdded) byPlatform.all.week_added += 1;

            const uniquePlatforms = [...new Set(
                (row?.platforms || []).filter((platform) => PROFILE_PLATFORMS.includes(platform))
            )];

            uniquePlatforms.forEach((platform) => {
                byPlatform[platform][state] += 1;
                byPlatform[platform].total += 1;
                if (isTodayAdded) byPlatform[platform].today_added += 1;
                if (isWeekAdded) byPlatform[platform].week_added += 1;
            });
        });

        res.json({ byPlatform });
    } catch (error) {
        console.error('[POI] Error fetching POI stats:', error.message);
        res.status(500).json({ message: 'Failed to fetch POI stats', error: error.message });
    }
};

module.exports = {
    getAllPOIs,
    getPOIById,
    createPOI,
    updatePOI,
    deletePOI,
    getLatestReport,
    getPoiBySourceId,
    getPoiStats
};
