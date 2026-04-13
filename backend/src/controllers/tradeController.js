const Trade = require('../models/Trade');
const { sendTradeRequestMail } = require('../utils/mailer');
const { buildConvertedTimeIST } = require('../utils/tradeTime');

const submitTradeRequest = async (req, res) => {
  try {
    const { name, email, contact, product, quantity, timezone, preferredTime, contactMethod, legalName, gst, message } = req.body;

    if (!name || !email || !contact || !product || quantity == null || !timezone || !preferredTime || !contactMethod || !legalName || !gst) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    const parsedQuantity = Number(quantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity < 100) {
      return res.status(400).json({ message: 'Minimum quantity is 100 KGs' });
    }

    const cleanedMessage = String(message || '').trim();
    if (cleanedMessage.length > 200) {
      return res.status(400).json({ message: 'Message must be under 200 characters' });
    }

    const allowedMethods = new Set(['Call', 'WhatsApp', 'Email']);
    if (!allowedMethods.has(String(contactMethod).trim())) {
      return res.status(400).json({ message: 'Preferred contact method must be Call, WhatsApp, or Email' });
    }

    const tz = String(timezone).trim();
    const pref = String(preferredTime).trim();
    const istWindow = buildConvertedTimeIST(tz, pref);
    const convertedTimeIST = istWindow
      ? {
          start: istWindow.start,
          end: istWindow.end,
          outsideBusinessHours: istWindow.outsideBusinessHours,
        }
      : { start: '', end: '', outsideBusinessHours: false };

    const trade = await Trade.create({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      contact: String(contact).trim(),
      product: String(product).trim(),
      quantity: parsedQuantity,
      timezone: tz,
      preferredTime: pref,
      contactMethod: String(contactMethod).trim(),
      legalName: String(legalName).trim(),
      gst: String(gst).trim(),
      message: cleanedMessage,
      convertedTimeIST,
    });

    const emailSent = await sendTradeRequestMail(trade).catch(() => false);
    return res.status(201).json({
      message: 'Trade request submitted successfully',
      trade,
      emailSent,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = { submitTradeRequest };
