const mongoose = require('mongoose');
const IPAddress = require('../models/IPAddress');
const Template = require('../models/Template');
const VM = require('../models/VM');
const User = require('../models/User');
const logger = require('../utils/logger.js');
require('dotenv').config();

//mongoose.connect('mongodb://bizixdb:asdadasdadadssad@127.0.0.1:27017/bizix1');
mongoose.connect(process.env.MONGODB_URI);

const ipAddresses = [
  { ipAddress: '10.2.3.120', gateway: '10.2.3.1' },
  { ipAddress: '10.2.3.121', gateway: '10.2.3.1' },
  { ipAddress: '10.2.3.122', gateway: '10.2.3.1' },
  { ipAddress: '10.2.3.123', gateway: '10.2.3.1' },
  { ipAddress: '10.2.3.124', gateway: '10.2.3.1' },
  { ipAddress: '10.2.3.125', gateway: '10.2.3.1' },
  { ipAddress: '10.2.3.126', gateway: '10.2.3.1' },
  { ipAddress: '10.2.3.127', gateway: '10.2.3.1' },
  { ipAddress: '10.2.3.128', gateway: '10.2.3.1' },
  { ipAddress: '10.2.3.129', gateway: '10.2.3.1' }
];

const templates = [
  { proxmoxId: 1003, templateName: 'ERP', version: '1.0', active: true },
  { proxmoxId: 1004, templateName: 'ERP', version: '1.1', active: true },
  { proxmoxId: 1101, templateName: 'CRM', version: '1.0', active: true },
  { proxmoxId: 1006, templateName: 'CRM', version: '1.1', active: true },
  { proxmoxId: 1007, templateName: 'Facturare', version: '1.0', active: true },
  { proxmoxId: 1008, templateName: 'Facturare', version: '1.1', active: true }
];

// Datele utilizatorului
const adminUser = {
  username: 'admin',
  password: '$2a$10$yFhaiIs15PpIPC7CJyLPF.ILUaVjx2CH1DAfQPgxzKHT5/0n8mrGe', // Hash-ul pentru parola 'demo'
  email: 'admin@demo.com',
  billing: {
    firstName: 'Admin',
    lastName: 'User',
    address: '123 Admin St.',
    city: 'Admin City',
    state: 'Admin State',
    zip: '12345',
    country: 'Admin Country',
    phone: '1234567890',
    currency: 'RON'
  }
};

mongoose.connection.once('open', async () => {
  try {
    // Șterge toate documentele existente în colecția IPAddress
    await IPAddress.deleteMany({});
    console.log('Colecția IPAddress a fost ștearsă cu succes.');

    // Inserarea noilor adrese IP
    await IPAddress.insertMany(ipAddresses);
    console.log('Adrese IP inserate cu succes');

    // Șterge toate documentele existente în colecția Template
    await Template.deleteMany({});
    console.log('Colecția Template a fost ștearsă cu succes.');

    // Inserarea noilor template-uri
    await Template.insertMany(templates);
    console.log('Template-uri inserate cu succes');

    // Șterge toate documentele existente în colecția VM
    await VM.deleteMany({});
    console.log('Colecția VM a fost ștearsă cu succes.');

    // Șterge toate documentele existente în colecția User
    //await User.deleteMany({});
    //console.log('Colecția User a fost ștearsă cu succes.');

    // Inserarea utilizatorului admin
    //await User.create(adminUser);
    //console.log('Utilizatorul admin a fost inserat cu succes.');
  } catch (err) {
    console.error('Eroare la manipularea colecțiilor:', err);
  } finally {
    // Închide conexiunea la baza de date
    mongoose.connection.close();
  }
});