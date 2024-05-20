const mongoose = require('mongoose');

const vmSchema = new mongoose.Schema({
  vmid: { type: Number, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  node: { type: String, required: true },
  storage: { type: String, required: true },
  memory: { type: Number, required: true },
  cores: { type: Number, required: true },
  diskSize: { type: Number, required: true },
  companyName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  status: { type: String, default: 'created' }
});

module.exports = mongoose.model('VM', vmSchema);