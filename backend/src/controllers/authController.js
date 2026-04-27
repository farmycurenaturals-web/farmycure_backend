const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const OtpToken = require('../models/OtpToken');
const PasswordResetToken = require('../models/PasswordResetToken');
const { sendEmail } = require('../services/emailService');
const { otpVerificationTemplate, passwordResetTemplate } = require('../services/emailTemplates');
const signAccessToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'farmycure_secret_key', {
    expiresIn: '30d',
  });
const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ADMIN_USERNAME = 'mdfarmycure';
const ADMIN_PASSWORD = 'mdfarmycure@123';
const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES || 5);
const RESET_TOKEN_EXPIRY_MINUTES = Number(process.env.RESET_TOKEN_EXPIRY_MINUTES || 15);
const MAX_OTP_ATTEMPTS = 5;
const DEFAULT_FRONTEND_URL = 'http://localhost:5173';
const getGoogleClientId = () =>
  String(process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_WEB_CLIENT_ID || '').trim();
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const getGoogleOauthClient = () => {
  const googleClientId = getGoogleClientId();
  if (!googleClientId) return null;
  return new OAuth2Client(googleClientId);
};
const normalizeBaseUrl = (value) => String(value || '').trim().replace(/\/+$/, '');
const getRequestOrigin = (req) => {
  const candidates = [
    req.get('origin'),
    req.get('x-forwarded-origin'),
    req.get('referer'),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = new URL(candidate);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      continue;
    }
  }
  return '';
};
const buildResetLink = (req, rawToken) => {
  const resetBase = normalizeBaseUrl(process.env.FRONTEND_RESET_URL);
  const preferredBase = normalizeBaseUrl(process.env.FRONTEND_URL);
  const requestBase = normalizeBaseUrl(getRequestOrigin(req));
  const frontendBase = resetBase || preferredBase || requestBase || DEFAULT_FRONTEND_URL;
  const encodedToken = encodeURIComponent(rawToken);
  return `${frontendBase}/#/reset-password?token=${encodedToken}`;
};

const authResponse = (user, token) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone || '',
  profileImage: user.profileImage || '',
  token,
  accessToken: token,
  refreshToken: token,
});

const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password: hashedPassword
    });

    const token = signAccessToken(user);

    res.status(201).json(authResponse(user, token));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const loginUser = async (req, res) => {
  try {
    console.log('Login request body:', req.body);
    const { username, email, password } = req.body;
    const loginIdentifier = (username || email || '').trim().toLowerCase();
    if (!loginIdentifier || !password) {
      return res.status(400).json({ message: 'Username/email and password are required' });
    }

    if (loginIdentifier === ADMIN_USERNAME) {
      if (password !== ADMIN_PASSWORD) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }
      const adminUser = {
        _id: 'admin-fixed-user',
        name: ADMIN_USERNAME,
        email: `${ADMIN_USERNAME}@farmycure.com`,
        role: 'admin',
      };
      const token = signAccessToken(adminUser);
      return res.json({
        ...adminUser,
        token,
        accessToken: token,
        refreshToken: token,
      });
    }

    const exactOrQuery = {
      $or: [
        { email: loginIdentifier },
        { name: loginIdentifier },
        { username: loginIdentifier },
      ],
    };
    let user = await User.findOne(exactOrQuery);

    // Fallback for case differences in legacy admin usernames/names.
    if (!user) {
      const safePattern = new RegExp(`^${escapeRegex(loginIdentifier)}$`, 'i');
      user = await User.findOne({
        $or: [{ email: safePattern }, { name: safePattern }, { username: safePattern }],
      });
    }
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = signAccessToken(user);

    res.json(authResponse(user, token));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const findOrCreateGoogleUser = async ({ email, name, picture, googleId }) => {
  let user = await User.findOne({ email });
  if (!user) {
    const randomPassword = await bcrypt.hash(`${googleId}_${Date.now()}`, 10);
    user = await User.create({
      name: name || email.split('@')[0],
      email,
      password: randomPassword,
      profileImage: picture,
      googleId,
    });
    return user;
  }

  let shouldSave = false;
  if (!user.googleId) {
    user.googleId = googleId;
    shouldSave = true;
  }
  if (picture && !user.profileImage) {
    user.profileImage = picture;
    shouldSave = true;
  }
  if (name && !user.name) {
    user.name = name;
    shouldSave = true;
  }
  if (shouldSave) {
    await user.save();
  }
  return user;
};

const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ message: 'Google credential is required' });
    }
    const googleClientId = getGoogleClientId();
    if (!googleClientId) {
      return res.status(500).json({
        message: 'Google auth is not configured. Set GOOGLE_CLIENT_ID in backend environment and restart server.',
      });
    }
    const googleClient = getGoogleOauthClient();
    if (!googleClient) {
      return res.status(500).json({ message: 'Google auth is not configured' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: googleClientId,
    });
    const payload = ticket.getPayload();
    const email = String(payload?.email || '').trim().toLowerCase();
    const name = String(payload?.name || '').trim();
    const picture = String(payload?.picture || '').trim();
    const googleId = String(payload?.sub || '').trim();

    if (!email || !googleId) {
      return res.status(400).json({ message: 'Invalid Google account data' });
    }

    const user = await findOrCreateGoogleUser({ email, name, picture, googleId });

    const token = signAccessToken(user);
    return res.json(authResponse(user, token));
  } catch (error) {
    return res.status(401).json({ message: 'Google authentication failed' });
  }
};

const googleTokenLogin = async (req, res) => {
  try {
    const accessToken = String(req.body.accessToken || '').trim();
    if (!accessToken) {
      return res.status(400).json({ message: 'Google access token is required' });
    }

    const googleClient = getGoogleOauthClient();
    if (!googleClient) {
      return res.status(500).json({ message: 'Google auth is not configured' });
    }

    // Validate token first to ensure audience and scopes are correct.
    const tokenInfo = await googleClient.getTokenInfo(accessToken);
    const expectedAudience = getGoogleClientId();
    const audience = String(tokenInfo?.aud || '').trim();
    if (expectedAudience && audience && audience !== expectedAudience) {
      return res.status(401).json({ message: 'Google authentication failed' });
    }

    const profileResponse = await googleClient.request({
      url: GOOGLE_USERINFO_URL,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = profileResponse?.data || {};
    if (!payload || typeof payload !== 'object') {
      return res.status(401).json({ message: 'Google authentication failed' });
    }
    const email = String(payload?.email || '').trim().toLowerCase();
    const emailVerified = Boolean(payload?.email_verified);
    const name = String(payload?.name || '').trim();
    const picture = String(payload?.picture || '').trim();
    const googleId = String(payload?.sub || '').trim();

    if (!email || !googleId || !emailVerified) {
      return res.status(400).json({ message: 'Invalid Google account data' });
    }

    const user = await findOrCreateGoogleUser({ email, name, picture, googleId });
    const token = signAccessToken(user);
    return res.json(authResponse(user, token));
  } catch (error) {
    return res.status(401).json({ message: 'Google authentication failed' });
  }
};

const refreshToken = async (req, res) => {
  try {
    const token = req.body.refreshToken;
    if (!token) return res.status(400).json({ message: 'Refresh token is required' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'farmycure_secret_key');
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const accessToken = signAccessToken(user);
    res.json({ accessToken, token: accessToken });
  } catch (error) {
    res.status(401).json({ message: 'Invalid refresh token' });
  }
};

const logoutUser = async (req, res) => {
  res.json({ message: 'Logged out successfully' });
};

const forgotPassword = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    console.log('Forgot password requested for:', email);
    if (!email || !email.includes('@')) {
      return res.status(400).json({ message: 'Valid email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({
        message: 'If this email exists, reset instructions have been sent',
        emailDelivery: true,
        expiresInMinutes: RESET_TOKEN_EXPIRY_MINUTES,
      });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(`${rawToken}|${process.env.JWT_SECRET || 'farmycure_secret_key'}`)
      .digest('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

    await PasswordResetToken.deleteMany({ user: user._id });
    await PasswordResetToken.create({
      user: user._id,
      tokenHash,
      expiresAt,
      used: false,
    });

    const resetLink = buildResetLink(req, rawToken);
    const mail = passwordResetTemplate({ resetLink, expiresInMinutes: RESET_TOKEN_EXPIRY_MINUTES });
    const sendResult = await sendEmail({ to: email, subject: mail.subject, html: mail.html });
    console.log('Forgot password email delivery result:', sendResult);

    return res.json({
      message: 'If this email exists, reset instructions have been sent',
      emailDelivery: !sendResult?.skipped,
      expiresInMinutes: RESET_TOKEN_EXPIRY_MINUTES,
      ...(sendResult?.skipped ? { resetLink } : {}),
    });
  } catch (error) {
    console.log('Email sending:', error);
    return res.status(500).json({ message: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const resetToken = String(req.body.resetToken || '').trim();
    const newPassword = String(req.body.newPassword || '');
    if (!resetToken || !newPassword) {
      return res.status(400).json({ message: 'Reset token and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const tokenHash = crypto
      .createHash('sha256')
      .update(`${resetToken}|${process.env.JWT_SECRET || 'farmycure_secret_key'}`)
      .digest('hex');
    const tokenDoc = await PasswordResetToken.findOne({
      tokenHash,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!tokenDoc) {
      return res.status(400).json({ message: 'Reset link is invalid or expired' });
    }

    const user = await User.findById(tokenDoc.user);
    if (!user) {
      tokenDoc.used = true;
      tokenDoc.usedAt = new Date();
      await tokenDoc.save();
      return res.status(404).json({ message: 'User not found' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    tokenDoc.used = true;
    tokenDoc.usedAt = new Date();
    await tokenDoc.save();
    await PasswordResetToken.deleteMany({ user: user._id, _id: { $ne: tokenDoc._id } });

    return res.json({ message: 'Password reset successful. Please login with your new password.' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const validateResetToken = async (req, res) => {
  try {
    const resetToken = String(req.body.resetToken || '').trim();
    if (!resetToken) {
      return res.status(400).json({ message: 'Reset token is required' });
    }
    const tokenHash = crypto
      .createHash('sha256')
      .update(`${resetToken}|${process.env.JWT_SECRET || 'farmycure_secret_key'}`)
      .digest('hex');
    const tokenDoc = await PasswordResetToken.findOne({
      tokenHash,
      used: false,
      expiresAt: { $gt: new Date() },
    });
    if (!tokenDoc) {
      return res.status(400).json({ message: 'Reset link is invalid or expired', valid: false });
    }
    return res.json({ message: 'Reset link is valid', valid: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const normalizePurpose = (value) => String(value || 'login').trim().toLowerCase();
const findUserByEmailForOtpLogin = async (email) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;
  let user = await User.findOne({ email: normalizedEmail });
  if (user) return user;
  const safePattern = new RegExp(`^${escapeRegex(normalizedEmail)}$`, 'i');
  user = await User.findOne({ email: safePattern });
  return user;
};
const buildOtpHash = (email, purpose, otp) =>
  crypto
    .createHash('sha256')
    .update(`${String(email).toLowerCase()}|${purpose}|${otp}|${process.env.JWT_SECRET || 'farmycure_secret_key'}`)
    .digest('hex');
const normalizeOtpCode = (value) =>
  String(value || '')
    .replace(/\D/g, '')
    .slice(0, 6);

const sendOtp = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const purpose = normalizePurpose(req.body.purpose);
    if (!email || !email.includes('@')) {
      return res.status(400).json({ message: 'Valid email is required' });
    }
    if (purpose === 'login') {
      const user = await findUserByEmailForOtpLogin(email);
      if (!user) {
        return res.status(404).json({ message: 'No account found with this email. Please create an account first.' });
      }
    }

    const otp = String(crypto.randomInt(100000, 1000000));
    const codeHash = buildOtpHash(email, purpose, otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await OtpToken.deleteMany({ email, purpose });
    await OtpToken.create({
      email,
      purpose,
      codeHash,
      expiresAt,
      used: false,
      attempts: 0,
    });

    const mail = otpVerificationTemplate({ otp, expiresInMinutes: OTP_EXPIRY_MINUTES });
    await sendEmail({ to: email, subject: mail.subject, html: mail.html });

    return res.json({
      message: 'OTP sent successfully',
      expiresInMinutes: OTP_EXPIRY_MINUTES,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const purpose = normalizePurpose(req.body.purpose);
    const otp = normalizeOtpCode(req.body.otp);

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }
    if (otp.length !== 6) {
      return res.status(400).json({ message: 'OTP must be 6 digits' });
    }

    const records = await OtpToken.find({
      email,
      purpose,
      used: false,
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: -1 })
      .limit(5);

    if (!records.length) {
      return res.status(400).json({ message: 'OTP is invalid or expired' });
    }

    const expectedHash = buildOtpHash(email, purpose, otp);
    const matchedRecord = records.find((entry) => entry.codeHash === expectedHash);

    if (!matchedRecord) {
      const latestRecord = records[0];
      if (latestRecord) {
        latestRecord.attempts = Number(latestRecord.attempts || 0) + 1;
        if (latestRecord.attempts >= MAX_OTP_ATTEMPTS) {
          latestRecord.used = true;
          latestRecord.usedAt = new Date();
        }
        await latestRecord.save();
      }
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    matchedRecord.used = true;
    matchedRecord.usedAt = new Date();
    await matchedRecord.save();

    if (purpose === 'login') {
      const user = await findUserByEmailForOtpLogin(email);
      if (!user) {
        return res.status(404).json({ message: 'No account found with this email. Please create an account first.' });
      }
      const token = signAccessToken(user);
      return res.json({
        message: 'OTP verified',
        verified: true,
        ...authResponse(user, token),
      });
    }

    return res.json({ message: 'OTP verified', verified: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
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
};