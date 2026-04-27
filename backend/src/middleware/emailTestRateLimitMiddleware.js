const WINDOW_MS = Number(process.env.EMAIL_TEST_RATE_LIMIT_WINDOW_MS || 60 * 1000);
const MAX_REQUESTS = Number(process.env.EMAIL_TEST_RATE_LIMIT_MAX || 3);

const requestLog = new Map();

const getClientKey = (req) => {
  const userId = String(req.user?.id || '').trim();
  if (userId) return `user:${userId}`;
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || req.ip || 'unknown';
  return `ip:${ip}`;
};

const emailTestRateLimitMiddleware = (req, res, next) => {
  const now = Date.now();
  const key = getClientKey(req);
  const existing = requestLog.get(key) || [];
  const recent = existing.filter((timestamp) => now - timestamp < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS) {
    const oldest = recent[0];
    const retryAfterMs = Math.max(0, WINDOW_MS - (now - oldest));
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
    return res.status(429).json({
      message: `Too many test email requests. Try again in ${retryAfterSeconds}s.`,
      retryAfterSeconds,
    });
  }

  recent.push(now);
  requestLog.set(key, recent);
  return next();
};

module.exports = emailTestRateLimitMiddleware;
