const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  billing: {
    firstName: {
      type: String,
      required: false
    },
    lastName: {
      type: String,
      required: false
    },
    address: {
      type: String,
      required: false
    },
    city: {
      type: String,
      required: false
    },
    state: {
      type: String,
      required: false
    },
    zip: {
      type: String,
      required: false
    },
    country: {
      type: String,
      required: false
    },
    phone: {
      type: String,
      required: false
    },
    currency: {
      type: String,
      required: false,
      default: 'RON'
    },
    facebookId: { type: String },
    googleId: { type: String }
  }
});

// Hashing the password before saving the user
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Comparing password for login
UserSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', UserSchema);