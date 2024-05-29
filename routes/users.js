const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('../models/User');

// Endpoint pentru preluarea profilului utilizatorului
router.get('/profile', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -__v');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint pentru actualizarea profilului utilizatorului
router.put('/profile', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { firstName, lastName, address, city, state, zip, country, phone, currency } = req.body;
    
    const updatedUser = await User.findByIdAndUpdate(req.user._id, {
      billing: {
        firstName,
        lastName,
        address,
        city,
        state,
        zip,
        country,
        phone,
        currency
      }
    }, { new: true });

    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;