const Partner = require('../models/Partner');
const { sendEmail } = require('../services/emailService');
const { tradeUserTemplate, tradeAdminTemplate } = require('../services/emailTemplates');

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

    const adminEmail = process.env.ADMIN_EMAIL;
    const normalizedName = contactPerson || name;
    const userMail = tradeUserTemplate({ name: normalizedName });
    const adminMail = tradeAdminTemplate({
      companyName: companyName || legalName || name,
      contactPerson: normalizedName,
      email,
      phone: phone || contact,
      message,
    });

    try {
      await sendEmail({ to: email, subject: userMail.subject, html: userMail.html });
      if (adminEmail) {
        await sendEmail({
          to: adminEmail,
          subject: adminMail.subject,
          html: adminMail.html,
          replyTo: email,
        });
      }
    } catch (mailError) {
      console.error('Trade emails failed:', mailError.message);
    }

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