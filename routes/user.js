const express = require('express');
const router = express.Router();
const userController = require('../controllers/user');

router.post('/auth/login', userController.login);
router.post('/auth/refresh-token', userController.refreshToken);

// Alte rute pentru gestionarea utilizatorilor (ex: /register, /settings/:id)

module.exports = (app) => {
    app.use('/user', router); // Asociați router-ul la o cale
  };