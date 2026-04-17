const express = require('express');
const router = express.Router();
const {
  addToCart,
  getCart,
  removeFromCart,
  updateCartItemQuantity,
  clearCart,
} = require('../controllers/cartController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/add', authMiddleware, addToCart);
router.get('/', authMiddleware, getCart);
router.patch('/item/:id', authMiddleware, updateCartItemQuantity);
router.delete('/remove/:id', authMiddleware, removeFromCart);
router.delete('/clear', authMiddleware, clearCart);

module.exports = router;