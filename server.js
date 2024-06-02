const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const mongoose = require('mongoose');
require('dotenv').config(); // Incarca variabilele din .env
require('./config/passport'); // Configurare Passport

const authRoutes = require('./routes/auth');
const proxmoxRoutes = require('./routes/proxmox');
const templatesRoute = require('./routes/templates'); 
const vmsRoute = require('./routes/vms');
const usersRoute = require('./routes/users');
const userRoute = require('./routes/user'); 

const ordersRoute = require('./routes/orders');
const webhookRoute = require('./routes/webhook');

const cors = require('cors');
const logger = require('./utils/logger.js');

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
app.use('/proxmox', proxmoxRoutes);
app.use('/api/templates', templatesRoute);
app.use('/api/vms', vmsRoute);
app.use('/api/users', usersRoute);
app.use('/api/user', userRoute); 

app.use('/api/orders', ordersRoute);
app.use('/api/webhook', webhookRoute); 

// Setarea strictQuery
mongoose.set('strictQuery', true);

mongoose.connect(process.env.MONGODB_URI, {
});
mongoose.connection.on('error', console.error.bind(console, 'MongoDB connection error:'));

app.listen(PORT, () => {
  logger(`Server running on port ${PORT}`);
});
