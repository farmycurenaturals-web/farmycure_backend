const express = require('express');
const router = express.Router();
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  updateOrderStatus
} = require('../controllers/orderController');
const { optionalAuth, requireAuth, allowRoles } = require('../middleware/authMiddleware');

router.post('/', optionalAuth, createOrder);
router.get('/', optionalAuth, getOrders);
router.get('/:id', optionalAuth, getOrderById);
router.put('/:id/status', requireAuth, allowRoles('admin', 'owner'), updateOrderStatus);
router.put('/:id', requireAuth, allowRoles('admin', 'owner'), updateOrder);

module.exports = router;