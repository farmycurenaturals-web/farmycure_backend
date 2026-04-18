const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema(
  {
    quantity: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const variantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    image: { type: String, default: '' },
    options: { type: [optionSchema], default: [] },
    // Backward compatibility fields for older records/readers.
    variantName: { type: String },
    price: { type: Number, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    quantityOptions: { type: [String], default: [] },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  title: {
    type: String,
    default: '',
  },
  category: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  image: {
    type: String
  },
  isFeatured: {
    type: Boolean,
    default: false,
  },
  price: {
    type: Number,
    min: 0,
    default: 0,
  },
  stock: {
    type: Number,
    min: 0,
    default: 0,
  },
  variants: {
    type: [variantSchema],
    default: [],
  },
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);