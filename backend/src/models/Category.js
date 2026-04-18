const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  categoryCode: {
    type: String,
    trim: true,
    index: true,
  },
  description: {
    type: String,
    default: '',
  },
  image: {
    type: String,
    default: '',
  },
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);