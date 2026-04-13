const Order = require('../models/Order');

const ORDER_STATUSES = ['Placed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

const isValidOrderStatus = (s) => ORDER_STATUSES.includes(String(s || '').trim());
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const {
  resolveStockSlot,
  getStockAtSlot,
  applyDeduction,
  setStockAtSlot,
  productLabel,
  slotKey,
  getStructuredVariants
} = require('../utils/orderStock');

const createOrder = async (req, res) => {
  const { shippingAddress, items, totalPrice, razorpay } = req.body;
  const sessionId = req.header('x-session-id');
  const userId = req.user?.id;

  if (!shippingAddress || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'shippingAddress and items are required' });
  }

  const computedTotal = items.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0
  );

  const productIds = [...new Set(items.map((item) => String(item.productId)))];
  let products;
  try {
    products = await Product.find({ _id: { $in: productIds } });
  } catch (_e) {
    return res.status(400).json({ message: 'Invalid product reference' });
  }

  const byId = new Map(products.map((p) => [p._id.toString(), p]));
  if (byId.size !== productIds.length) {
    return res.status(400).json({ message: 'One or more products were not found' });
  }

  /** @type {Map<string, { product: object, slot: object, need: number }>} */
  const bucket = new Map();

  for (const item of items) {
    const pid = String(item.productId);
    const product = byId.get(pid);
    if (!product) {
      return res.status(400).json({ message: 'Product not found' });
    }

    const qty = Math.floor(Number(item.quantity));
    if (!Number.isFinite(qty) || qty < 1) {
      return res.status(400).json({ message: `Invalid quantity for ${productLabel(product)}` });
    }

    const slot = resolveStockSlot(product, item.variant);
    if (slot.kind === 'none') {
      return res.status(400).json({
        message: `Could not match variant for ${productLabel(product)}`
      });
    }

    const mapKey = `${pid}|${slotKey(slot)}`;
    const cur = bucket.get(mapKey) || { product, slot, need: 0 };
    cur.need += qty;
    bucket.set(mapKey, cur);
  }

  for (const { product, slot, need } of bucket.values()) {
    const available = getStockAtSlot(product, slot);
    if (available < need) {
      return res.status(400).json({
        message: `Insufficient stock for ${productLabel(product)}`
      });
    }
  }

  const snapshots = [];
  try {
    for (const { product, slot, need } of bucket.values()) {
      const before = getStockAtSlot(product, slot);
      applyDeduction(product, slot, need);
      snapshots.push({ productId: product._id, slot, before });
    }

    const uniqueIds = [...new Set([...bucket.values()].map((b) => b.product._id.toString()))];
    for (const pid of uniqueIds) {
      const p = byId.get(pid);
      if (getStructuredVariants(p).length > 0) {
        p.markModified('variants');
      }
      await p.save();
    }

    const order = await Order.create({
      user: userId,
      sessionId: userId ? undefined : sessionId,
      items,
      totalPrice: Number(totalPrice || computedTotal),
      shippingAddress,
      paymentStatus: razorpay?.paymentId ? 'paid' : 'pending',
      status: 'Placed',
      razorpay
    });

    if (userId) {
      await Cart.findOneAndDelete({ user: userId });
    } else if (sessionId) {
      await Cart.findOneAndDelete({ sessionId });
    }

    return res.status(201).json(order);
  } catch (error) {
    const snapsByProduct = new Map();
    for (const snap of snapshots) {
      const id = snap.productId.toString();
      if (!snapsByProduct.has(id)) snapsByProduct.set(id, []);
      snapsByProduct.get(id).push(snap);
    }
    for (const [, snaps] of snapsByProduct) {
      try {
        const fresh = await Product.findById(snaps[0].productId);
        if (!fresh) continue;
        for (const s of snaps) {
          setStockAtSlot(fresh, s.slot, s.before);
        }
        if (getStructuredVariants(fresh).length > 0) {
          fresh.markModified('variants');
        }
        await fresh.save();
      } catch (_restoreErr) {
        /* best-effort rollback */
      }
    }
    return res.status(500).json({ message: error.message });
  }
};

const getOrders = async (req, res) => {
  try {
    const isAdminRequest = req.query.scope === 'all';
    if (isAdminRequest && !['admin', 'owner'].includes(req.user?.role)) {
      return res.status(403).json({ message: 'Forbidden: insufficient role permissions' });
    }
    const query = isAdminRequest ? {} : req.user?.id ? { user: req.user.id } : {};
    const orders = await Order.find(query).populate('items.productId').sort({ createdAt: -1 });
    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.productId');
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const isAdmin = req.user && ['admin', 'owner'].includes(req.user.role);
    if (isAdmin) {
      return res.json(order);
    }

    if (!req.user?.id) {
      return res.status(401).json({ message: 'Please login to view this order' });
    }

    if (order.user) {
      if (order.user.toString() !== req.user.id) {
        return res.status(403).json({ message: 'You do not have access to this order' });
      }
    } else {
      const sessionId = req.header('x-session-id');
      if (!sessionId || String(order.sessionId || '') !== String(sessionId)) {
        return res.status(403).json({ message: 'You do not have access to this order' });
      }
    }

    return res.json(order);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateOrder = async (req, res) => {
  try {
    const { status, paymentStatus } = req.body;
    const update = {};
    if (status !== undefined && status !== null && String(status).trim() !== '') {
      if (!isValidOrderStatus(status)) {
        return res.status(400).json({
          message: `Invalid status. Allowed: ${ORDER_STATUSES.join(', ')}`
        });
      }
      update.status = String(status).trim();
    }
    if (paymentStatus !== undefined && paymentStatus !== null) {
      update.paymentStatus = paymentStatus;
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: 'Nothing to update' });
    }
    const order = await Order.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true
    });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    return res.json(order);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!isValidOrderStatus(status)) {
      return res.status(400).json({
        message: `Invalid status. Allowed: ${ORDER_STATUSES.join(', ')}`
      });
    }
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: String(status).trim() },
      { new: true, runValidators: true }
    );
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    return res.json(order);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  updateOrderStatus
};
