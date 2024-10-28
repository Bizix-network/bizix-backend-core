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
app.set('trust proxy', ['127.0.0.1', '10.2.3.3/8', '167.86.73.223/24']);

const PORT = process.env.PORT || 5000;

// Configurare CORS
const allowedOrigins = ['http://127.0.0.1:5173', 'http://localhost:3002', 'http://localhost:3001', 'http://localhost:3000', 'http://localhost:5173'];

app.use(cors({
  origin: function (origin, callback) {
    // Permite cereri fără origine (de exemplu, cereri de la un client local)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
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
