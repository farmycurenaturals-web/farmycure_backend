const express = require('express');
const router = express.Router();
const { getAdminTrades, getAdminContacts } = require('../controllers/adminController');
const { requireAuth, allowRoles } = require('../middleware/authMiddleware');

router.get('/trade', requireAuth, allowRoles('admin', 'owner'), getAdminTrades);
router.get('/contact', requireAuth, allowRoles('admin', 'owner'), getAdminContacts);

module.exports = router;
