const adminMiddleware = (req, res, next) => {
  const role = String(req.user?.role || '').trim().toLowerCase();
  if (role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  return next();
};

module.exports = adminMiddleware;
