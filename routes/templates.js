const express = require('express');
const router = express.Router();
const Template = require('../models/Template');

// Endpoint pentru a obține toate template-urile
router.get('/', async (req, res) => {
  try {
    const templates = await Template.find();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;