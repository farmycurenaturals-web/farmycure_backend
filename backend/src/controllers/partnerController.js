const Partner = require('../models/Partner');

const submitPartnerRequest = async (req, res) => {
  try {
    const { companyName, contactPerson, email, phone, businessType, productsInterested, message } = req.body;

    const partner = await Partner.create({
      companyName,
      contactPerson,
      email,
      phone,
      businessType,
      productsInterested,
      message
    });

    res.status(201).json({ message: 'Partner request submitted successfully', partner });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { submitPartnerRequest };