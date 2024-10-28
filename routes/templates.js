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

// Endpoint pentru a obține detaliile unui template specific după ID
router.get('/:id', async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template-ul nu a fost găsit' });
    }
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint pentru a căuta template-uri după nume și versiune
router.get('/search/:name/:version', async (req, res) => {
  try {
    const { name, version } = req.params;
    const template = await Template.findOne({ 
      templateName: name,
      version: version,
      active: true 
    });
    
    if (!template) {
      return res.status(404).json({ error: 'Template-ul nu a fost găsit' });
    }
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;