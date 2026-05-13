const nodemailer = require('nodemailer');

let transporter = null; // cleared on server restart

const toBool = (value) => String(value || '').toLowerCase() === 'true';

const getTransporter = () => {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = toBool(process.env.SMTP_SECURE);
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const service = process.env.SMTP_SERVICE || '';

  if (!host || !port || !user || !pass) {
    return null;
  }

  const config = {
    host,
    port,
    secure,
    auth: { user, pass },
  };
  if (service) {
    config.service = service;
  }

  transporter = nodemailer.createTransport(config);

  return transporter;
};

const sendEmail = async ({ to, subject, html, text, replyTo, attachments }) => {
  const tx = getTransporter();
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER;
  if (!tx || !from) {
    return { skipped: true };
  }

  const fallbackText = text || String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const listUnsubscribe = process.env.MAIL_LIST_UNSUBSCRIBE || '';
  const headers = {
    'X-Auto-Response-Suppress': 'All',
  };
  if (listUnsubscribe) {
    headers['List-Unsubscribe'] = listUnsubscribe;
  }

  try {
    const fromAddress = String(from).includes('<') ? from : `"FarmyCure Naturals" <${from}>`;
    const info = await tx.sendMail({
      from: fromAddress,
      to,
      subject,
      html,
      text: fallbackText,
      replyTo,
      attachments,
      headers,
    });
    return { skipped: false, messageId: info?.messageId || '' };
  } catch (error) {
    console.log('Email sending:', error);
    throw error;
  }
};

const verifyEmailTransport = async () => {
  const tx = getTransporter();
  if (!tx) {
    return {
      ok: false,
      configured: false,
      message: 'SMTP is not fully configured',
    };
  }

  try {
    await tx.verify();
    return {
      ok: true,
      configured: true,
      message: 'SMTP connection verified',
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      message: error.message || 'SMTP verification failed',
    };
  }
};

module.exports = { sendEmail, verifyEmailTransport };
