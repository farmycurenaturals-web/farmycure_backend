const nodemailer = require('nodemailer');

let transporter = null;

const toBool = (value) => String(value || '').toLowerCase() === 'true';

const getTransporter = () => {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = toBool(process.env.SMTP_SECURE);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  return transporter;
};

const sendEmail = async ({ to, subject, html, text, replyTo }) => {
  const tx = getTransporter();
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  if (!tx || !from) {
    return { skipped: true };
  }

  await tx.sendMail({
    from: `"FarmyCure Naturals" <${from}>`,
    to,
    subject,
    html,
    text,
    replyTo,
  });
  return { skipped: false };
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
