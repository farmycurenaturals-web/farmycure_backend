const Partner = require('../models/Partner');

const submitPartnerRequest = async (req, res) => {
  try {
    const {
      companyName,
      contactPerson,
      email,
      phone,
      businessType,
      productsInterested,
      message,
      name,
      contact,
      product,
      quantity,
      timezone,
      preferredTime,
      contactMethod,
      legalName,
      gst,
    } = req.body;

    const partner = await Partner.create({
      companyName: companyName || legalName || name || 'N/A',
      contactPerson: contactPerson || name || 'N/A',
      email,
      phone: phone || contact || 'N/A',
      businessType: businessType || 'trade',
      productsInterested: productsInterested || product,
      message,
      product,
      quantity,
      timezone,
      preferredTime,
      contactMethod,
      legalName,
      gst,
      contact,
      name,
    });

    res.status(201).json({ message: 'Partner request submitted successfully', partner });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPartnerRequests = async (req, res) => {
  try {
    const trades = await Partner.find({}).sort({ createdAt: -1 });
    res.json(trades);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { submitPartnerRequest, getPartnerRequests };