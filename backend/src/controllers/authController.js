const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { sendPasswordResetMail, canSendMail } = require('../utils/mailer');

const ACCESS_SECRET = process.env.JWT_SECRET || 'farmycure_secret_key';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'farmycure_refresh_secret_key';

const buildAccessToken = (user) => jwt.sign(
  { id: user._id, role: user.role },
  ACCESS_SECRET,
  { expiresIn: '15m' }
);

const buildRefreshToken = (user) => jwt.sign(
  { id: user._id, role: user.role, type: 'refresh' },
  REFRESH_SECRET,
  { expiresIn: '30d' }
);

const authResponse = (user, accessToken, refreshToken) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  profileImage: user.profileImage || '',
  phone: user.phone || '',
  token: accessToken,
  accessToken,
  refreshToken
});

const registerUser = async (req, res) => {
  try {
    const { name, password, role, phone } = req.body;
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email and password are required' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const requestedRole = role || 'user';
    if (['admin', 'owner'].includes(requestedRole)) {
      return res.status(403).json({ message: 'Admin registration is not allowed' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: requestedRole,
      ...(phone !== undefined && phone !== null ? { phone: String(phone).trim() } : {})
    });

    const accessToken = buildAccessToken(user);
    const refreshToken = buildRefreshToken(user);
    user.refreshTokens.push({
      token: refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
    await user.save();

    res.status(201).json(authResponse(user, accessToken, refreshToken));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const loginId = String(username || email || '')
      .trim()
      .toLowerCase();
    if (!loginId || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const user = await User.findOne({ email: loginId });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const accessToken = buildAccessToken(user);
    const refreshToken = buildRefreshToken(user);
    user.refreshTokens = (user.refreshTokens || []).filter((entry) => entry.expiresAt > new Date());
    user.refreshTokens.push({
      token: refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
    await user.save();

    res.json(authResponse(user, accessToken, refreshToken));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }
    const tokenExists = (user.refreshTokens || []).some((entry) => entry.token === refreshToken);
    if (!tokenExists) {
      return res.status(401).json({ message: 'Refresh token not recognized' });
    }

    const newAccessToken = buildAccessToken(user);
    return res.json({ accessToken: newAccessToken, token: newAccessToken });
  } catch (error) {
    return res.status(401).json({ message: 'Refresh token expired or invalid' });
  }
};

const logoutUser = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.json({ message: 'Logged out' });
    const decoded = jwt.decode(refreshToken);
    if (!decoded?.id) return res.json({ message: 'Logged out' });
    const user = await User.findById(decoded.id);
    if (!user) return res.json({ message: 'Logged out' });
    user.refreshTokens = (user.refreshTokens || []).filter((entry) => entry.token !== refreshToken);
    await user.save();
    return res.json({ message: 'Logged out' });
  } catch (_error) {
    return res.json({ message: 'Logged out' });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    if (!email) {
      return res.status(400).json({ message: 'email is required' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ message: 'If the email exists, reset instructions are generated.' });
    }
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetTokenHash = tokenHash;
    user.passwordResetExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    const baseUrl = process.env.FRONTEND_BASE_URL || 'http://localhost:5173';
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;
    const mailSent = await sendPasswordResetMail({ to: user.email, resetLink });

    if (mailSent) {
      return res.json({ message: 'Password reset link sent to your email' });
    }
    return res.json({
      message: 'SMTP not configured. Reset token generated for development.',
      resetToken,
      resetLink,
      emailDelivery: false,
      smtpConfigured: canSendMail()
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      return res.status(400).json({ message: 'resetToken and newPassword are required' });
    }

    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() }
    });
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    user.refreshTokens = [];
    await user.save();

    return res.json({ message: 'Password reset successful. Please login again.' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = { registerUser, loginUser, refreshAccessToken, logoutUser, forgotPassword, resetPassword };