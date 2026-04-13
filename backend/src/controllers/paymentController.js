const crypto = require('crypto');
const Razorpay = require('razorpay');

const getRazorpay = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return null;
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
};

const createRazorpayOrder = async (req, res) => {
  try {
    const razorpay = getRazorpay();
    if (!razorpay) {
      return res.status(400).json({ message: 'Razorpay keys are not configured on server' });
    }
    const { amount, currency = 'INR', receipt } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ message: 'Valid amount is required' });
    }
    const order = await razorpay.orders.create({
      amount: Number(amount),
      currency,
      receipt: receipt || `rcpt_${Date.now()}`
    });
    return res.status(201).json(order);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const verifyRazorpaySignature = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing Razorpay signature payload' });
    }

    const generated = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generated !== razorpay_signature) {
      return res.status(400).json({ message: 'Invalid payment signature', verified: false });
    }
    return res.json({ verified: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = { createRazorpayOrder, verifyRazorpaySignature };
