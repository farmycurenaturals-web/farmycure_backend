const express = require('express');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const router = express.Router();
const { hasGoogleOauthConfig } = require('../config/passport');
const {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
  forgotPassword,
  resetPassword,
  validateResetToken,
  googleLogin,
  googleTokenLogin,
  sendOtp,
  verifyOtp,
} = require('../controllers/authController');

const getAllowedFrontendOrigins = () =>
  new Set(
    [
      process.env.FRONTEND_URL,
      process.env.ADMIN_URL,
      'https://farmycure.com',
      'https://www.farmycure.com',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5174',
    ]
      .filter(Boolean)
      .map((entry) => String(entry).replace(/\/+$/, ''))
  );

const getFrontendBaseFromState = (req) => {
  const fallback = String(process.env.FRONTEND_URL || 'https://farmycure.com').replace(/\/+$/, '');
  const stateValue = String(req.query.state || '').trim();
  if (!stateValue) return fallback;
  const allowedOrigins = getAllowedFrontendOrigins();
  try {
    const parsed = new URL(stateValue);
    const origin = `${parsed.protocol}//${parsed.host}`;
    if (allowedOrigins.has(origin)) {
      return origin;
    }
    return fallback;
  } catch {
    return fallback;
  }
};

const getFrontendLoginRedirect = (req) => {
  const frontendBase = getFrontendBaseFromState(req);
  return `${frontendBase}/#/login`;
};
const ensureGoogleOauthConfigured = (req, res, next) => {
  if (!hasGoogleOauthConfig) {
    return res.status(503).json({
      message: 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
    });
  }
  return next();
};

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/refresh-token', refreshToken);
router.post('/google-login', googleLogin);
router.post('/google-token-login', googleTokenLogin);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/logout', logoutUser);
router.post('/forgot-password', forgotPassword);
router.post('/validate-reset-token', validateResetToken);
router.post('/reset-password', resetPassword);

router.get('/google', ensureGoogleOauthConfigured, (req, res, next) => {
  const requestedRedirect = String(req.query.redirect || '').trim();
  const state = requestedRedirect || String(process.env.FRONTEND_URL || 'https://farmycure.com').replace(/\/+$/, '');
  return passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    state,
  })(req, res, next);
});

router.get(
  '/google/callback',
  ensureGoogleOauthConfigured,
  (req, res, next) => {
    const failureRedirect = `${getFrontendLoginRedirect(req)}?error=google_auth_failed`;
    return passport.authenticate('google', { session: false }, async (error, user) => {
      if (error || !user) {
        console.log('Google callback error:', error);
        return res.redirect(failureRedirect);
      }
      try {
        console.log('Google user:', user);
        const token = jwt.sign(
          { id: user._id, role: user.role },
          process.env.JWT_SECRET || 'farmycure_secret_key',
          { expiresIn: '30d' }
        );
        const redirectUrl = `${getFrontendLoginRedirect(req)}?token=${encodeURIComponent(token)}`;
        return res.redirect(redirectUrl);
      } catch (tokenError) {
        console.log('Google callback error:', tokenError);
        return res.redirect(`${getFrontendLoginRedirect(req)}?error=google_callback_failed`);
      }
    })(req, res, next);
  }
);

module.exports = router;