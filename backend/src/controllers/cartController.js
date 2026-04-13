const Cart = require('../models/Cart');
const Product = require('../models/Product');

const getOwnerFilter = (req) => {
  if (req.user?.id) return { user: req.user.id };
  if (req.header('x-session-id')) return { sessionId: req.header('x-session-id') };
  return null;
};

const addToCart = async (req, res) => {
  try {
    const { productId, variant, quantity, price, title, image, category } = req.body;
    const ownerFilter = getOwnerFilter(req);
    if (!ownerFilter) {
      return res.status(400).json({ message: 'Missing user token or x-session-id header' });
    }

    let cart = await Cart.findOne(ownerFilter);

    if (!cart) {
      cart = await Cart.create({
        ...ownerFilter,
        items: [{ productId, variant, quantity, price, title, image, category }]
      });
    } else {
      const existingItem = cart.items.find(
        (item) => item.productId.toString() === productId && item.variant === variant
      );

      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        let hydratedMeta = { title, image, category };
        if (!title || !image || !category) {
          const dbProduct = await Product.findById(productId).lean();
          if (dbProduct) {
            hydratedMeta = {
              title: title || dbProduct.title || dbProduct.name,
              image: image || dbProduct.image,
              category: category || dbProduct.category
            };
          }
        }
        cart.items.push({ productId, variant, quantity, price, ...hydratedMeta });
      }

      await cart.save();
    }

    return res.json(cart);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getCart = async (req, res) => {
  try {
    const ownerFilter = getOwnerFilter(req);
    if (!ownerFilter) {
      return res.json({ items: [] });
    }
    const cart = await Cart.findOne(ownerFilter).populate('items.productId');
    if (cart) {
      return res.json(cart);
    }
    return res.json({ ...ownerFilter, items: [] });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateCartItemQuantity = async (req, res) => {
  try {
    const ownerFilter = getOwnerFilter(req);
    if (!ownerFilter) {
      return res.status(400).json({ message: 'Missing user token or x-session-id header' });
    }
    const { itemId } = req.params;
    const { quantity } = req.body;
    const cart = await Cart.findOne(ownerFilter);

    if (cart) {
      const item = cart.items.find((entry) => entry._id.toString() === itemId);
      if (!item) {
        return res.status(404).json({ message: 'Cart item not found' });
      }
      if (Number(quantity) <= 0) {
        cart.items = cart.items.filter((entry) => entry._id.toString() !== itemId);
      } else {
        item.quantity = Number(quantity);
      }
      await cart.save();
      return res.json(cart);
    }
    return res.status(404).json({ message: 'Cart not found' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const removeFromCart = async (req, res) => {
  try {
    const ownerFilter = getOwnerFilter(req);
    if (!ownerFilter) {
      return res.status(400).json({ message: 'Missing user token or x-session-id header' });
    }
    const itemId = req.params.id;
    const cart = await Cart.findOne(ownerFilter);

    if (cart) {
      cart.items = cart.items.filter((item) => item._id.toString() !== itemId);
      await cart.save();
      return res.json(cart);
    }
    return res.status(404).json({ message: 'Cart not found' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const clearCart = async (req, res) => {
  try {
    const ownerFilter = getOwnerFilter(req);
    if (!ownerFilter) {
      return res.status(400).json({ message: 'Missing user token or x-session-id header' });
    }
    await Cart.findOneAndDelete(ownerFilter);
    return res.json({ message: 'Cart cleared' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = { addToCart, getCart, removeFromCart, updateCartItemQuantity, clearCart };