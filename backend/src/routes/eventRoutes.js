const express = require('express');
const router = express.Router();

const {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  archiveEvent,
  deleteEvent,
  getEventDashboard,
  runEventScan
} = require('../controllers/eventController');

const { protect, authorize } = require('../middleware/authMiddleware');
const { requireAnyPageAccess } = require('../middleware/rbacMiddleware');

router.use(protect, requireAnyPageAccess(['/events']));

router.get('/', listEvents);
router.get('/:id', getEvent);
router.get('/:id/dashboard', getEventDashboard);

router.post('/', authorize('super_admin', 'analyst'), createEvent);
router.put('/:id', authorize('super_admin', 'analyst'), updateEvent);
router.post('/:id/archive', authorize('super_admin', 'analyst'), archiveEvent);
router.post('/:id/run', authorize('super_admin', 'analyst'), runEventScan);
router.delete('/:id', authorize('super_admin', 'analyst'), deleteEvent);

module.exports = router;
