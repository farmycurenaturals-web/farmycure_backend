const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const signAccessToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'farmycure_secret_key', {
    expiresIn: '30d',
  });
const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ADMIN_USERNAME = 'mdfarmycure';
const ADMIN_PASSWORD = 'mdfarmycure@123';

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

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token,
      accessToken: token,
      refreshToken: token,
    });
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

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token,
      accessToken: token,
      refreshToken: token,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
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
  console.log('Forgot password request body:', req.body);
  res.json({ message: 'If this email exists, reset instructions have been sent' });
};

const resetPassword = async (req, res) => {
  console.log('Reset password request body:', req.body);
  res.json({ message: 'Password reset flow is accepted' });
};

module.exports = {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
  forgotPassword,
  resetPassword,
};