const express = require('express');
const router = express.Router();
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  updateOrderStatus,
} = require('../controllers/orderController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/', authMiddleware, createOrder);
router.get('/', authMiddleware, getOrders);
router.get('/:id', authMiddleware, getOrderById);
router.put('/:id', authMiddleware, updateOrder);
router.put('/:id/status', authMiddleware, updateOrderStatus);

module.exports = router;