const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const userRoutes = require('./routes/user');

dotenv.config();

const app = express();

// Middleware-uri
app.use(express.json());

// Conectare la baza de date
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Conectat la baza de date'))
  .catch(err => console.error('Eroare la conectarea la baza de date:', err));

// Rute
userRoutes(app); // Apelați funcția pentru a asocia router-ul

// Gestionare erori
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'A apărut o eroare.' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Serverul rulează pe portul ${port}`));