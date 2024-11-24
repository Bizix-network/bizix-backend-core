const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const Order = require('../models/Order');
const mongoose = require('mongoose');
const passport = require('passport');
const logger = require('../utils/logger.js');

router.post('/create-order', passport.authenticate('jwt', { session: false }), async (req, res) => {
  const { templateId, billingDetails, amount, currency, node, vmName, vmVersion } = req.body;
  
  const templateIdObject = mongoose.Types.ObjectId.createFromHexString(templateId);
  const userId = req.user._id;

  logger('Received order creation request with data:', req.body);

  const orderId = new mongoose.Types.ObjectId(); // Generează un ID unic pentru comandă

  // Verificăm dacă plata poate fi bypassed
  if (process.env.BYPASS_PAYMENT === 'true') {
    logger('Bypassing payment processing');
    
    const newOrder = new Order({
      _id: orderId,
      userId,
      templateId: templateIdObject,
      amount,
      currency,
      billingDetails,
      status: 'deployed', // Setăm direct statusul ca deployed
      node,
      vmName,
      vmVersion,
      orderDesc: `Bypassed Order for Template ${templateId}`,
      merchId: 'BYPASS',
      timestamp: new Date().toISOString(),
      nonce: crypto.randomBytes(16).toString('hex'),
      fpHash: crypto.randomBytes(32).toString('hex')
    });

    try {
      const savedOrder = await newOrder.save();
      logger('Order saved successfully:', savedOrder);

      // Apelăm direct create-vm
      const vmData = {
        userId,
        node,
        vmName,
        vmVersion,
        companyName: billingDetails.companyName,
        expiresAt: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
        templateId: templateIdObject
      };

      const response = await axios.post('https://api.bizix.ro/proxmox/create-vm', vmData, {
        headers: {
          'internal-api-key': process.env.INTERNAL_API_KEY
        }
      });

      logger('VM creation response:', response.data);

      return res.json({ 
        url: 'bypass', // Un indicator că plata a fost bypassed
        message: 'Order created and VM deployed successfully', 
        orderId 
      });
    } catch (error) {
      console.error('Error processing bypassed order:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  const data = {
    amount: amount.toFixed(2),
    curr: currency,
    invoice_id: orderId.toString(),
    order_desc: `Order for template ${templateId}`,
    merch_id: process.env.EUPLATESC_MERCHANT_ID,
    timestamp: new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14),
    nonce: crypto.randomBytes(16).toString('hex'),
  };

  const datakeys = Object.keys(data);
  let hmac = '';

  logger('Generating HMAC for data:', data);

  datakeys.forEach(key => {
    hmac += data[key].length + data[key];
  });

  const binKey = Buffer.from(process.env.EUPLATESC_SECRET_KEY, "hex");
  const hmacx = crypto.createHmac("md5", binKey).update(hmac, 'utf8').digest('hex');
  data.fp_hash = hmacx;

  logger('Generated fp_hash:', hmacx);

  const newOrder = new Order({
    _id: orderId, // Folosește ID-ul generat pentru _id
    userId,
    templateId: templateIdObject,
    amount,
    currency,
    billingDetails,
    orderDesc: data.order_desc,
    merchId: data.merch_id,
    timestamp: data.timestamp,
    nonce: data.nonce,
    fpHash: data.fp_hash,
    node,
    vmName,
    vmVersion
  });

  try {
    logger('Saving new order to database:', newOrder);
    const savedOrder = await newOrder.save();

    logger('Order saved successfully:', savedOrder);

    const esc = encodeURIComponent;
    const query = Object.keys(data).map(k => esc(k) + '=' + esc(data[k])).join('&');
    const redirectURL = `https://secure.euplatesc.ro/tdsprocess/tranzactd.php?${query}`;

    logger('Generated redirect URL for payment:', redirectURL);

    res.json({ url: redirectURL });
  } catch (error) {
    console.error('Error saving order to database:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;