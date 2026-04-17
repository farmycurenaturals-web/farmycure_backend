const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { getPartnerRequests } = require('../controllers/partnerController');
const { getContactMessages } = require('../controllers/contactController');

router.get('/trade', authMiddleware, getPartnerRequests);
router.get('/contact', authMiddleware, getContactMessages);

module.exports = router;
