const Event = require('../models/Event');
const Content = require('../models/Content');
const Alert = require('../models/Alert');
const Settings = require('../models/Settings');
const { createAuditLog } = require('../services/auditService');
const { scanEventOnce } = require('../services/eventMonitorService');

const normalizeEventPayload = (body) => {
  const payload = { ...body };

  if (payload.start_date) payload.start_date = new Date(payload.start_date);
  if (payload.end_date) payload.end_date = new Date(payload.end_date);

  if (typeof payload.location === 'string') payload.location = payload.location.trim();

  if (Array.isArray(payload.keywords)) {
    payload.keywords = payload.keywords
      .map((k) => {
        if (typeof k === 'string') return { keyword: k.trim(), language: 'all' };
        if (!k) return null;
        return {
          keyword: String(k.keyword || '').trim(),
          language: k.language || 'all'
        };
      })
      .filter((k) => k && k.keyword);
  }

  if (Array.isArray(payload.platforms)) {
    payload.platforms = payload.platforms.filter(Boolean);
  }

  return payload;
};

// @desc    List events
// @route   GET /api/events
// @access  Private
const listEvents = async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status;

    const events = await Event.find(query).sort({ start_date: -1 });
    res.status(200).json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get one event
// @route   GET /api/events/:id
// @access  Private
const getEvent = async (req, res) => {
  try {
    const event = await Event.findOne({ id: req.params.id });
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.status(200).json(event);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create event
// @route   POST /api/events
// @access  Private (Admin/Analyst)
const createEvent = async (req, res) => {
  try {
    const payload = normalizeEventPayload(req.body);

    if (!payload.name || !payload.start_date || !payload.end_date) {
      return res.status(400).json({ message: 'name, start_date, end_date are required' });
    }

    if (payload.end_date < payload.start_date) {
      return res.status(400).json({ message: 'end_date must be after start_date' });
    }

    const event = await Event.create({
      ...payload,
      created_by: req.user?.email || req.user?.id || 'system'
    });

    await createAuditLog(req.user, 'create', 'event', event.id, { name: event.name });

    res.status(201).json(event);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update event
// @route   PUT /api/events/:id
// @access  Private (Admin/Analyst)
const updateEvent = async (req, res) => {
  try {
    const existing = await Event.findOne({ id: req.params.id });
    if (!existing) return res.status(404).json({ message: 'Event not found' });

    const payload = normalizeEventPayload(req.body);

    if (payload.start_date && payload.end_date && payload.end_date < payload.start_date) {
      return res.status(400).json({ message: 'end_date must be after start_date' });
    }

    const updated = await Event.findOneAndUpdate(
      { id: req.params.id },
      { ...payload, updated_at: new Date() },
      { new: true }
    );

    await createAuditLog(req.user, 'update', 'event', req.params.id, { name: updated.name });

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Archive event
// @route   POST /api/events/:id/archive
// @access  Private (Admin/Analyst)
const archiveEvent = async (req, res) => {
  try {
    const event = await Event.findOne({ id: req.params.id });
    if (!event) return res.status(404).json({ message: 'Event not found' });

    event.status = 'archived';
    event.archived_at = new Date();
    await event.save();

    await createAuditLog(req.user, 'archive', 'event', req.params.id, { name: event.name });

    res.status(200).json(event);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete event
// @route   DELETE /api/events/:id
// @access  Private (Admin/Analyst)
const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findOne({ id: req.params.id });
    if (!event) return res.status(404).json({ message: 'Event not found' });

    await Event.deleteOne({ id: req.params.id });

    await createAuditLog(req.user, 'delete', 'event', req.params.id, { name: event.name });

    res.status(200).json({ message: 'Event deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  archiveEvent,
  deleteEvent,
  // Extra endpoints for dashboard
  getEventDashboard: async (req, res) => {
    try {
      const event = await Event.findOne({ id: req.params.id });
      if (!event) return res.status(404).json({ message: 'Event not found' });

      const content = await Content.find({ event_ids: event.id })
        .sort({ published_at: -1 })
        .limit(200);

      const alerts = await Alert.find({ event_id: event.id })
        .sort({ created_at: -1 })
        .limit(200);

      const byPlatform = content.reduce((acc, c) => {
        const p = c.platform || 'unknown';
        acc[p] = (acc[p] || 0) + 1;
        return acc;
      }, {});

      const priorityAlerts = alerts.filter((a) => a.is_priority).length;
      const activeAlerts = alerts.filter((a) => a.status === 'active').length;

      res.status(200).json({
        event,
        stats: {
          content_total: content.length,
          alerts_total: alerts.length,
          alerts_active: activeAlerts,
          alerts_priority: priorityAlerts,
          content_by_platform: byPlatform
        },
        recent_content: content.slice(0, 50),
        recent_alerts: alerts.slice(0, 50)
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
  runEventScan: async (req, res) => {
    try {
      const event = await Event.findOne({ id: req.params.id });
      if (!event) return res.status(404).json({ message: 'Event not found' });

      const settings = await Settings.findOne({ id: 'global_settings' });
      const result = await scanEventOnce({ event, settings });

      await createAuditLog(req.user, 'run', 'event', req.params.id, { action: 'manual_scan', result });

      res.status(200).json({ message: 'Event scan completed', ...result });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};
