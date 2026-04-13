const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  sessionId: {
    type: String,
    index: true
  },
  items: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
      },
      variant: {
        type: String,
        required: true
      },
      quantity: {
        type: Number,
        required: true
      },
      price: {
        type: Number,
        required: true
      },
      title: {
        type: String
      },
      image: {
        type: String
      },
      category: {
        type: String
      }
    }
  ],
  totalPrice: {
    type: Number,
    required: true
  },
  paymentStatus: {
    type: String,
    default: 'pending'
  },
  status: {
    type: String,
    enum: ['Placed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Placed'
  },
  shippingAddress: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  razorpay: {
    orderId: String,
    paymentId: String,
    signature: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);