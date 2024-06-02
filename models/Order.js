const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Template',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['awaiting payment', 'deployed', 'failed'],
    default: 'awaiting payment'
  },
  billingDetails: {
    companyName: String,
    companyID: String,
    firstName: String,
    lastName: String,
    address: String,
    city: String,
    state: String,
    zip: String,
    country: String,
    phone: String,
    email: String
  },
  orderDesc: {
    type: String,
    required: true
  },
  merchId: {
    type: String,
    required: true
  },
  timestamp: {
    type: String,
    required: true
  },
  nonce: {
    type: String,
    required: true
  },
  fpHash: {
    type: String,
    required: true
  },
  node: {
    type: String,
    required: true
  },
  vmName: {
    type: String,
    required: true
  },
  vmVersion: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Order', OrderSchema);