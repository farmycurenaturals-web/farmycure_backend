const nodemailer = require('nodemailer');

const canSendMail = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);

const createTransport = () => nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || 'false') === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const canSendNotificationMail = () =>
  Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);

const createNotificationTransport = () =>
  nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

const sendPasswordResetMail = async ({ to, resetLink }) => {
  if (!canSendMail()) return false;
  const transporter = createTransport();
  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: 'FarmyCure Password Reset',
    text: `Reset your password using this link: ${resetLink}`,
    html: `<p>Reset your password using this link:</p><p><a href="${resetLink}">${resetLink}</a></p>`
  });
  return true;
};

const sendTradeRequestMail = async (trade) => {
  if (!canSendNotificationMail()) return false;
  const transporter = createNotificationTransport();
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: 'md@farmycure.com',
    subject: 'New Trade Request',
    text: [
      `name: ${trade.name}`,
      `email: ${trade.email}`,
      `contact: ${trade.contact}`,
      `product: ${trade.product}`,
      `quantity: ${trade.quantity}`,
      `timezone: ${trade.timezone || ''}`,
      `preferredTime: ${trade.preferredTime || ''}`,
      `convertedTimeIST: ${trade.convertedTimeIST?.start || ''} - ${trade.convertedTimeIST?.end || ''}${trade.convertedTimeIST?.outsideBusinessHours ? ' (outside typical India business hours)' : ''}`,
      `contactMethod: ${trade.contactMethod || ''}`,
      `legalName: ${trade.legalName}`,
      `gst: ${trade.gst}`,
      `message: ${trade.message || ''}`,
    ].join('\n'),
  });
  return true;
};

const sendContactMessageMail = async (contact) => {
  if (!canSendNotificationMail()) return false;
  const transporter = createNotificationTransport();
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: 'md@farmycure.com',
    subject: 'New Contact Message',
    text: [
      `name: ${contact.name}`,
      `email: ${contact.email}`,
      `subject: ${contact.subject}`,
      `message: ${contact.message}`,
    ].join('\n'),
  });
  return true;
};

module.exports = {
  canSendMail,
  sendPasswordResetMail,
  canSendNotificationMail,
  sendTradeRequestMail,
  sendContactMessageMail,
};
