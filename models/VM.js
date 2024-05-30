const mongoose = require('mongoose');

const VMSchema = new mongoose.Schema({
  vmid: {
    type: Number,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  node: {
    type: String,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['created', 'running', 'stopped', 'deleted'],
    default: 'created'
  },
  companyName: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  publicURL: {
    type: String,
    required: false
  },
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Template',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('VM', VMSchema);