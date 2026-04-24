const express = require('express');
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const { requireAnyPageAccess } = require('../middleware/rbacMiddleware');
const { transcribeMedia } = require('../controllers/transcribeController');

const router = express.Router();
router.use(protect, requireAnyPageAccess(['/settings']));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav',
      'audio/ogg', 'audio/flac', 'audio/aac', 'audio/mp4',
      'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo',
      'video/webm', 'video/x-matroska', 'application/octet-stream',
    ];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/')) {
      return cb(null, true);
    }
    cb(new Error('Only audio and video files are allowed'));
  },
});

router.post('/transcribe', upload.single('file'), transcribeMedia);

module.exports = router;
