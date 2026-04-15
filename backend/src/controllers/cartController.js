const Cart = require('../models/Cart');

const addToCart = async (req, res) => {
  try {
    const { productId, variant, quantity, price } = req.body;
    const userId = req.user.id;

    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      cart = await Cart.create({
        user: userId,
        items: [{ productId, variant, quantity, price }]
      });
    } else {
      const existingItem = cart.items.find(
        item => item.productId.toString() === productId && item.variant === variant
      );

      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        cart.items.push({ productId, variant, quantity, price });
      }

      await cart.save();
    }

    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id }).populate('items.productId');
    if (cart) {
      res.json(cart);
    } else {
      res.json({ user: req.user.id, items: [] });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const removeFromCart = async (req, res) => {
  try {
    const itemId = req.params.id;
    const cart = await Cart.findOne({ user: req.user.id });

    if (cart) {
      cart.items = cart.items.filter(item => item._id.toString() !== itemId);
      await cart.save();
      res.json(cart);
    } else {
      res.status(404).json({ message: 'Cart not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { addToCart, getCart, removeFromCart };