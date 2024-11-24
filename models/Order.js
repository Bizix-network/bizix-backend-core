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
    required: function() { return this.status !== 'deployed'; }
  },
  merchId: {
    type: String,
    required: function() { return this.status !== 'deployed'; }
  },
  timestamp: {
    type: String,
    required: function() { return this.status !== 'deployed'; }
  },
  nonce: {
    type: String,
    required: function() { return this.status !== 'deployed'; }
  },
  fpHash: {
    type: String,
    required: function() { return this.status !== 'deployed'; }
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