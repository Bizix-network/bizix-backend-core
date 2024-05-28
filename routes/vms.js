const express = require('express');
const router = express.Router();
const passport = require('passport');
const VM = require('../models/VM');

// Endpoint pentru a obține toate VM-urile utilizatorului logat
router.get('/', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const userId = req.user._id;
    const vms = await VM.find({ userId });
    res.json(vms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;