const { verifyEmailTransport } = require('../services/emailService');
const { sendEmail } = require('../services/emailService');

let lastTestEmail = {
  sentAt: null,
  to: '',
  messageId: '',
};

const getEmailHealth = async (req, res) => {
  const result = await verifyEmailTransport();
  const statusCode = result.ok ? 200 : 503;
  return res.status(statusCode).json({
    status: result.ok ? 'ok' : 'degraded',
    email: {
      configured: result.configured,
      message: result.message,
    },
    lastTestEmail,
  });
};

const sendTestEmail = async (req, res) => {
  try {
    const to = String(req.body?.to || '').trim().toLowerCase();
    if (!to || !to.includes('@')) {
      return res.status(400).json({ message: 'Valid recipient email is required in "to"' });
    }

    const sentAt = new Date().toISOString();
    const subject = `FarmyCure test email - ${sentAt}`;
    const html = `
      <div style="font-family: Arial, sans-serif; line-height:1.6; color:#1f2937;">
        <h2 style="margin:0 0 12px;">FarmyCure Email Test</h2>
        <p>This is a test email generated from backend health endpoint.</p>
        <p><strong>Sent at:</strong> ${sentAt}</p>
      </div>
    `;
    const result = await sendEmail({ to, subject, html });
    lastTestEmail = {
      sentAt,
      to,
      messageId: result?.messageId || '',
    };

    return res.json({
      status: 'ok',
      message: 'Test email sent successfully',
      to,
      sentAt,
      messageId: result?.messageId || '',
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to send test email',
    });
  }
};

module.exports = { getEmailHealth, sendTestEmail };
