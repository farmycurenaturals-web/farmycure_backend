const express = require('express');
const router = express.Router();
const { getEmailHealth } = require('../controllers/healthController');

router.get('/email', getEmailHealth);

module.exports = router;
