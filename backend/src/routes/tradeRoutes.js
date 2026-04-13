const express = require('express');
const router = express.Router();
const { submitTradeRequest } = require('../controllers/tradeController');

router.post('/', submitTradeRequest);

module.exports = router;
