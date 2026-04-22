const Contact = require('../models/Contact');
const { sendEmail } = require('../services/emailService');
const { contactUserTemplate, contactAdminTemplate } = require('../services/emailTemplates');

const submitContactMessage = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    const contact = await Contact.create({
      name,
      email,
      subject,
      message
    });

    const adminEmail = process.env.ADMIN_EMAIL;
    const userMail = contactUserTemplate({ name, subject });
    const adminMail = contactAdminTemplate({ name, email, subject, message });

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
      console.error('Contact emails failed:', mailError.message);
    }

    res.status(201).json({ message: 'Message sent successfully', contact });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getContactMessages = async (req, res) => {
  try {
    const contacts = await Contact.find({}).sort({ createdAt: -1 });
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { submitContactMessage, getContactMessages };