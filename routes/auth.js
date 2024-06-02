const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();
const jwtSecret = process.env.JWT_SECRET || 'secret';
const logger = require('../utils/logger.js');

// Login Route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await user.comparePassword(password))) {
    logger(`login - error`);
    return res.status(400).json({ error: 'Invalid email or password' });
  }
  const token = jwt.sign({ id: user._id }, jwtSecret, { expiresIn: '1h' });
  logger(`login - success`);
  res.json({ message: 'Success! You are logged in.', token });
});

// Signup Route
router.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    logger(`signup - error`);
    return res.status(400).json({ error: 'Email already in use' });
  }
  const user = new User({ email, password });
  await user.save();
  const token = jwt.sign({ id: user._id }, jwtSecret, { expiresIn: '1h' });
  res.status(201).json({ message: 'User created successfully', token });
  logger(`signup - success`);
});

// Facebook Auth
router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));

router.get('/facebook/callback', passport.authenticate('facebook', { session: false }), (req, res) => {
  res.json({ message: 'Success! You are logged in.', token: req.user.token });
  logger(`facebook - success`);
});

// Google Auth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', passport.authenticate('google', { session: false }), (req, res) => {
  res.json({ message: 'Success! You are logged in.', token: req.user.token });
  logger(`google - success`);
});

// Verify Token Route - GET
/*
router.get('/verify_token', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1]; // Expecting Bearer <token>
  if (!token) {
    logger(`verify_token - error`);
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, jwtSecret, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.json({ message: 'Token is valid', user: decoded });
    logger(`verify_token - success`);
  });
});
*/

// Verify Token Route POST
router.post('/verify_token', (req, res) => {
    const token = req.body.api_token;
    logger(`Received token: ${token}`); // Debug
  
    if (!token) {
      logger(`verify_token - No token provided`);
      return res.status(401).json({ error: 'No token provided' });
    }
  
    jwt.verify(token, jwtSecret, (err, decoded) => {
      if (err) {
        logger(`verify_token - Invalid token received: ${token}`);
        return res.status(401).json({ error: 'Invalid token' });
      }
      res.json({ message: 'Token is valid', user: decoded });
      logger(`verify_token - success`);
    });
  });
  
  
  module.exports = router;

module.exports = router;
