const express = require('express');
const passport = require('passport');
const router = express.Router();

// Endpoint pentru a returna userID pe baza token-ului JWT
router.get('/', passport.authenticate('jwt', { session: false }), (req, res) => {
  try {
    const userId = req.user._id;
    res.json({ userId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;