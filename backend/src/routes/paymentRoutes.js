const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;
const razorpay = keyId && keySecret
  ? new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    })
  : null;

router.post('/create-order', authMiddleware, async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(500).json({ message: 'Razorpay is not configured on server' });
    }

    const amount = Number(req.body.amount) || 0;
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Invalid order amount' });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount),
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
      notes: {
        userId: String(req.user?.id || ''),
      },
    });

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error?.error?.description || error.message || 'Failed to create payment order' });
  }
});

router.post('/verify-signature', authMiddleware, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing Razorpay signature fields' });
    }
    if (!keySecret) {
      return res.status(500).json({ message: 'Razorpay secret not configured' });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');

    if (expected !== razorpay_signature) {
      return res.status(400).json({ message: 'Invalid Razorpay signature' });
    }

    res.json({
      verified: true,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Payment verification failed' });
  }
});

module.exports = router;
