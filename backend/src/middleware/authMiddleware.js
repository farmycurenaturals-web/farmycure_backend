const jwt = require('jsonwebtoken');

const requireAuth = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'farmycure_secret_key');
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Token is not valid' });
  }
};

const optionalAuth = (req, _res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) {
    return next();
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'farmycure_secret_key');
    req.user = decoded;
  } catch (_error) {
    // Ignore invalid token in optional mode.
  }
  return next();
};

const allowRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden: insufficient role permissions' });
  }
  return next();
};

module.exports = { requireAuth, optionalAuth, allowRoles };