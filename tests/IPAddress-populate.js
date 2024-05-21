const mongoose = require('mongoose');
const IPAddress = require('../models/IPAddress');

mongoose.connect('mongodb://bizixdb:asdadasdadadssad@127.0.0.1:27017/bizix1');

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

mongoose.connection.once('open', async () => {
  try {
    // Șterge toate documentele existente în colecția IPAddress
    await IPAddress.deleteMany({});
    console.log('Colecția IPAddress a fost ștearsă cu succes.');

    // Inserarea noilor adrese IP
    await IPAddress.insertMany(ipAddresses);
    console.log('Adrese IP inserate cu succes');
  } catch (err) {
    console.error('Eroare la manipularea colecției IPAddress:', err);
  } finally {
    // Închide conexiunea la baza de date
    mongoose.connection.close();
  }
});