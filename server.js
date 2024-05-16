const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const mongoose = require('mongoose');
require('dotenv').config(); // Incarca variabilele din .env
require('./config/passport'); // Configurare Passport
const authRoutes = require('./routes/auth');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Configurare CORS
app.use(cors({
    origin: 'http://127.0.0.1:5173', // Permite cereri de la această origine
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Permite aceste metode HTTP
    allowedHeaders: ['Content-Type', 'Authorization'], // Permite aceste headere
    credentials: true // Permite trimiterea cookie-urilor și a credențialelor
  }));
  

app.use(bodyParser.json());
app.use(passport.initialize());

app.use('/', authRoutes);

mongoose.connect(process.env.MONGODB_URI);
mongoose.connection.on('error', console.error.bind(console, 'MongoDB connection error:'));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
