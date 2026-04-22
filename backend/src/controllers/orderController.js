const Order = require('../models/Order');
const Cart = require('../models/Cart');
const User = require('../models/User');
const PDFDocument = require('pdfkit');
const { sendEmail } = require('../services/emailService');
const { orderConfirmationTemplate, orderStatusTemplate } = require('../services/emailTemplates');

const createOrder = async (req, res) => {
  try {
    const { shippingAddress } = req.body;
    const userId = req.user.id;

    const cart = await Cart.findOne({ user: userId }).populate('items.productId');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    const totalPrice = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const order = await Order.create({
      user: userId,
      items: cart.items.map(item => ({
        productId: item.productId._id,
        variant: item.variant,
        quantity: item.quantity,
        price: item.price
      })),
      totalPrice,
      shippingAddress
    });

    await Cart.findOneAndDelete({ user: userId });

    try {
      const user = await User.findById(userId).select('name email');
      const customerEmail = shippingAddress?.email || user?.email;
      if (customerEmail) {
        const mail = orderConfirmationTemplate({
          customerName: shippingAddress?.fullName || user?.name,
          orderId: order._id,
          items: cart.items,
          totalAmount: totalPrice,
          deliveryAddress: shippingAddress,
        });
        await sendEmail({ to: customerEmail, subject: mail.subject, html: mail.html });
      }
    } catch (mailError) {
      console.error('Order confirmation email failed:', mailError.message);
    }

    res.status(201).json(order);
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
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.productId');
    if (order) {
      res.json(order);
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
    res.json(order);
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

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const formatCurrency = (value) => `INR ${Number(value || 0).toFixed(2)}`;

const normalizeAddress = (address) => {
  if (!address) return 'N/A';
  if (typeof address === 'string') return address;
  if (typeof address === 'object') {
    const parts = [
      address.fullName,
      address.address,
      [address.city, address.state].filter(Boolean).join(', '),
      address.pincode,
      address.phone && `Phone: ${address.phone}`,
      address.email,
    ].filter(Boolean);
    return parts.join(', ') || 'N/A';
  }
  return 'N/A';
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

    const doc = new PDFDocument({ margin: 50 });
    const fileName = `invoice-${order._id}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    doc.pipe(res);

    doc.fontSize(20).text('FarmyCure Invoice', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12);
    doc.text(`Order ID: ${order._id}`);
    doc.text(`Order Date: ${new Date(order.createdAt).toLocaleString()}`);
    doc.text(`Customer Name: ${order.user?.name || 'N/A'}`);
    doc.text(`Delivery Address: ${normalizeAddress(order.shippingAddress)}`);
    doc.moveDown();

    doc.fontSize(14).text('Products');
    doc.moveDown(0.5);
    doc.fontSize(11).text('Name', 50, doc.y, { continued: true, width: 240 });
    doc.text('Quantity', 290, doc.y, { continued: true, width: 90 });
    doc.text('Price', 380, doc.y, { align: 'right', width: 80 });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    (order.items || []).forEach((item) => {
      const productName = item.productId?.title || item.productId?.name || 'Product';
      doc.text(productName, 50, doc.y, { continued: true, width: 240 });
      doc.text(String(item.quantity || 0), 290, doc.y, { continued: true, width: 90 });
      doc.text(formatCurrency(item.price), 380, doc.y, { align: 'right', width: 80 });
      doc.moveDown(0.4);
    });

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.8);
    doc.fontSize(13).text(`Total Amount: ${formatCurrency(order.totalPrice)}`, {
      align: 'right',
    });

    doc.end();
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