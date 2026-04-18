const mongoose = require('mongoose');

const dbReadyMiddleware = (req, res, next) => {
  if (mongoose.connection.readyState === 1) {
    return next();
  }

  return res.status(503).json({
    message: 'Database connection unavailable',
  });
};

module.exports = dbReadyMiddleware;
