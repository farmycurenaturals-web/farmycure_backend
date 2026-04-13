const mongoose = require('mongoose');

const variantOptionSchema = new mongoose.Schema(
  {
    quantity: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, default: 0, min: 0 }
  },
  { _id: false }
);

const variantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    image: { type: String, default: '' },
    options: { type: [variantOptionSchema], default: [] }
  },
  { _id: false }
);

const productSchema = new mongoose.Schema({
  productCode: {
    type: String,
    unique: true,
    sparse: true
  },
  title: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  image: {
    type: String,
    default: ''
  },
  variants: {
    type: [variantSchema],
    default: []
  },
  price: {
    type: Number,
    default: 0
  },
  stock: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);