const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // ... alte câmpuri ...
  refreshToken: {
    type: String,
  },
});

module.exports = mongoose.model('User', userSchema);