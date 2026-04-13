const express = require('express');
const router = express.Router();
const {
  addToCart,
  getCart,
  removeFromCart,
  updateCartItemQuantity,
  clearCart
} = require('../controllers/cartController');
const { optionalAuth } = require('../middleware/authMiddleware');

router.post('/add', optionalAuth, addToCart);
router.get('/', optionalAuth, getCart);
router.patch('/item/:itemId', optionalAuth, updateCartItemQuantity);
router.delete('/remove/:id', optionalAuth, removeFromCart);
router.delete('/clear', optionalAuth, clearCart);

module.exports = router;