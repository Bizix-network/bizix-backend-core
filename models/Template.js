const mongoose = require('mongoose');

const TemplateSchema = new mongoose.Schema({
  proxmoxId: { type: Number, required: true, unique: true },
  templateName: { type: String, required: true },
  description:{ type: String, required: false },
  shortDescription: { type: String, required: false },
  category: { type: String, required: false },
  rating: { type: Number, default: 5 },
  version: { type: String, required: true },
  dateAdded: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
  blockNumber: { type: String, default: null }
});

module.exports = mongoose.model('Template', TemplateSchema);