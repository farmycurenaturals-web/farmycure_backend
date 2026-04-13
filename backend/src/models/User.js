const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'owner', 'trade'],
    default: 'user'
  },
  profileImage: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: '',
    trim: true
  },
  refreshTokens: [
    {
      token: {
        type: String
      },
      expiresAt: {
        type: Date
      }
    }
  ],
  passwordResetTokenHash: {
    type: String
  },
  passwordResetExpiresAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);