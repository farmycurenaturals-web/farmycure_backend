const Order = require('../models/Order');
const Cart = require('../models/Cart');
const User = require('../models/User');
const { sendEmail } = require('../services/emailService');
const { orderStatusTemplate } = require('../services/emailTemplates');
const { generateInvoicePdfBuffer, streamInvoicePdfToResponse } = require('../services/invoiceService');
const { sendOrderEmailWithRetry, shouldSendOrderEmail } = require('../services/orderEmailService');

const withLegacyStatus = (orderDocOrObject) => {
  if (!orderDocOrObject) return orderDocOrObject;
  const order =
    typeof orderDocOrObject.toObject === 'function'
      ? orderDocOrObject.toObject()
      : { ...orderDocOrObject };
  const resolvedStatus = String(order.orderStatus || order.status || '').trim();
  return { ...order, status: resolvedStatus };
};

const queueOrderConfirmationEmail = ({ orderId, customerEmail }) => {
  setImmediate(async () => {
    try {
      const orderForInvoice = await Order.findById(orderId)
        .populate('items.productId', 'title name')
        .populate('user', 'name');
      if (!orderForInvoice) {
        console.log('Order email skipped: order not found after creation', { orderId: String(orderId) });
        return;
      }
      if (!shouldSendOrderEmail(orderForInvoice)) {
        console.log('Order email skipped: payment status is pending or failed', {
          orderId: String(orderId),
          paymentStatus: orderForInvoice.paymentStatus || 'unknown',
        });
        return;
      }
      const pdfBuffer = await generateInvoicePdfBuffer(orderForInvoice);
      await sendOrderEmailWithRetry(orderForInvoice, pdfBuffer, customerEmail, {
        maxRetries: Number(process.env.ORDER_EMAIL_MAX_RETRIES || 1),
        retryDelayMs: Number(process.env.ORDER_EMAIL_RETRY_DELAY_MS || 3000),
      });
    } catch (error) {
      console.error('Queued order confirmation email failed:', error.message);
    }
  });
};

const createOrder = async (req, res) => {
  try {
    const { shippingAddress, paymentMethod, razorpay } = req.body;
    const userId = req.user.id;

    const cart = await Cart.findOne({ user: userId }).populate('items.productId');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    const totalPrice = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const normalizedPaymentMethod = String(paymentMethod || 'online').trim().toLowerCase();
    const isCod = normalizedPaymentMethod === 'cod';
    const finalPaymentMethod = isCod ? 'cod' : 'online';
    const paymentStatus = isCod ? 'cod' : 'paid';

    if (!isCod) {
      const orderId = String(razorpay?.orderId || '').trim();
      const paymentId = String(razorpay?.paymentId || '').trim();
      if (!orderId || !paymentId) {
        return res.status(400).json({ message: 'Online payment details are required' });
      }
    }

    const order = await Order.create({
      user: userId,
      items: cart.items.map(item => ({
        productId: item.productId._id,
        variant: item.variant,
        quantity: item.quantity,
        price: item.price
      })),
      totalPrice,
      shippingAddress,
      paymentMethod: finalPaymentMethod,
      paymentStatus
    });

    await Cart.findOneAndDelete({ user: userId });

    let emailQueued = false;
    try {
      const user = await User.findById(userId).select('name email');
      const customerEmail = shippingAddress?.email || user?.email;
      if (customerEmail) {
        queueOrderConfirmationEmail({ orderId: order._id, customerEmail });
        emailQueued = true;
      }
    } catch (mailError) {
      console.error('Order confirmation email queue failed:', mailError.message);
    }

    res.status(201).json({
      ...withLegacyStatus(order),
      emailQueued,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getOrders = async (req, res) => {
  try {
    const filter =
      req.query.scope === 'all' && ['admin', 'owner'].includes(req.user.role)
        ? {}
        : { user: req.user.id };
    const orders = await Order.find(filter).populate('items.productId').sort({ createdAt: -1 });
    res.json(orders.map((entry) => withLegacyStatus(entry)));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.productId');
    if (order) {
      res.json(withLegacyStatus(order));
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateOrder = async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(withLegacyStatus(order));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { status, trackingLink } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        orderStatus: status || 'processing',
        ...(trackingLink !== undefined ? { trackingLink: String(trackingLink || '').trim() } : {}),
      },
      { new: true }
    );
    if (!order) return res.status(404).json({ message: 'Order not found' });

    try {
      const user = await User.findById(order.user).select('name email');
      if (user?.email) {
        const mail = orderStatusTemplate({
          customerName: user.name,
          orderId: order._id,
          status: order.orderStatus || 'Processing',
          trackingLink: order.trackingLink,
        });
        await sendEmail({ to: user.email, subject: mail.subject, html: mail.html });
      }
    } catch (mailError) {
      console.error('Order status email failed:', mailError.message);
    }

    res.json(withLegacyStatus(order));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const generateOrderInvoice = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.productId', 'title name')
      .populate('user', 'name');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const isAdmin = ['admin', 'owner'].includes(req.user.role);
    const isOrderOwner = String(order.user?._id || order.user) === String(req.user.id);

    if (!isAdmin && !isOrderOwner) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const fileName = `invoice-${order._id}.pdf`;
    await streamInvoicePdfToResponse(order, res, fileName);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  updateOrderStatus,
  generateOrderInvoice,
};