const Contact = require('../models/Contact');
const { sendContactMessageMail } = require('../utils/mailer');

const submitContactMessage = async (req, res) => {
  try {
    const { name, email, message, subject } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ message: 'name, email, subject and message are required' });
    }

    const contact = await Contact.create({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      subject: String(subject).trim(),
      message: String(message).trim(),
    });

    const emailSent = await sendContactMessageMail(contact).catch(() => false);
    res.status(201).json({ message: 'Message sent successfully', contact, emailSent });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { submitContactMessage };