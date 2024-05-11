const User = require('../models/user');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Email sau parolă incorecte.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Email sau parolă incorecte.' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);

    const refreshToken = jwt.sign({ userId: user._id }, process.env.REFRESH_TOKEN_SECRET);
    user.refreshToken = refreshToken;
    await user.save();

    res.json({ token, refreshToken });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'A apărut o eroare la autentificare.' });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token este necesar.' });
    }

    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, async (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Refresh token invalid.' });
      }

      const existingUser = await User.findById(user.userId);
      if (!existingUser || existingUser.refreshToken !== refreshToken) {
        return res.status(403).json({ error: 'Refresh token invalid.' });
      }

      const token = jwt.sign({ userId: user.userId }, process.env.JWT_SECRET);

      res.json({ token });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'A apărut o eroare la reîmprospătarea token-ului.' });
  }
};

// Alte funcții pentru gestionarea utilizatorilor (ex: register, getSettings, updateSettings)