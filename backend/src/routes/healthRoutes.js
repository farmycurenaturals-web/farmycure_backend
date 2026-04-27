const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const emailTestRateLimitMiddleware = require('../middleware/emailTestRateLimitMiddleware');
const { getEmailHealth, sendTestEmail } = require('../controllers/healthController');

router.get('/email', getEmailHealth);
router.post('/email/test', authMiddleware, adminMiddleware, emailTestRateLimitMiddleware, sendTestEmail);

module.exports = router;
