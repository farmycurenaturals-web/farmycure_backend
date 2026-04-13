const express = require('express');
const router = express.Router();
const { submitPartnerRequest } = require('../controllers/partnerController');

router.post('/', submitPartnerRequest);

module.exports = router;