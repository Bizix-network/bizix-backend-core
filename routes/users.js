const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('../models/User');

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