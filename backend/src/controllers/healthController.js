const { verifyEmailTransport } = require('../services/emailService');

const getEmailHealth = async (req, res) => {
  const result = await verifyEmailTransport();
  const statusCode = result.ok ? 200 : 503;
  return res.status(statusCode).json({
    status: result.ok ? 'ok' : 'degraded',
    email: {
      configured: result.configured,
      message: result.message,
    },
  });
};

module.exports = { getEmailHealth };
