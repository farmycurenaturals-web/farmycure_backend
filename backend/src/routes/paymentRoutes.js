const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

router.post('/create-order', authMiddleware, async (req, res) => {
  const amount = Number(req.body.amount) || 0;
  res.json({
    id: `pay_${Date.now()}`,
    amount,
    currency: 'INR',
    status: 'created',
  });
});

router.post('/verify-signature', authMiddleware, async (req, res) => {
  res.json({ verified: true, payload: req.body });
});

module.exports = router;
