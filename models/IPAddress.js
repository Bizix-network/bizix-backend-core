const mongoose = require('mongoose');

const IPAddressSchema = new mongoose.Schema({
  ipAddress: { type: String, required: true, unique: true },
  gateway: { type: String, required: true },
  allocatedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'VM', default: null },
  allocatedAt: { type: Date, default: null }
});

module.exports = mongoose.model('IPAddress', IPAddressSchema);