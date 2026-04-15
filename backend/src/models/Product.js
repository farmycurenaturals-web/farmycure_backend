const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
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
    type: String
  },
  variants: [
    {
      variantName: {
        type: String,
        required: true
      },
      price: {
        type: Number,
        required: true
      },
      stock: {
        type: Number,
        default: 0
      },
      quantityOptions: [
        {
          type: String
        }
      ]
    }
  ]
});

module.exports = mongoose.model('Product', productSchema);