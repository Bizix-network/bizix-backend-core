const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const Order = require('../models/Order');
const mongoose = require('mongoose');

router.post('/create-order', async (req, res) => {
  const { userId, templateId, billingDetails, amount, currency, node, vmName, vmVersion } = req.body;

  console.log('Received order creation request with data:', req.body);

  const data = {
    amount: amount.toFixed(2),
    curr: currency,
    invoice_id: new mongoose.Types.ObjectId().toString(), // Generăm un ID pentru comandă
    order_desc: `Order for template ${templateId}`,
    merch_id: process.env.EUPLATESC_MERCHANT_ID,
    timestamp: new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14),
    nonce: crypto.randomBytes(16).toString('hex'),
  };

  const datakeys = Object.keys(data);
  let hmac = '';

  console.log('Generating HMAC for data:', data);

  datakeys.forEach(key => {
    hmac += data[key].length + data[key];
  });

  const binKey = Buffer.from(process.env.EUPLATESC_SECRET_KEY, "hex");
  const hmacx = crypto.createHmac("md5", binKey).update(hmac, 'utf8').digest('hex');
  data.fp_hash = hmacx;

  console.log('Generated fp_hash:', hmacx);

  const newOrder = new Order({
    userId,
    templateId,
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
    console.log('Saving new order to database:', newOrder);
    const savedOrder = await newOrder.save();

    console.log('Order saved successfully:', savedOrder);

    const esc = encodeURIComponent;
    const query = Object.keys(data).map(k => esc(k) + '=' + esc(data[k])).join('&');
    const redirectURL = `https://secure.euplatesc.ro/tdsprocess/tranzactd.php?${query}`;

    console.log('Generated redirect URL for payment:', redirectURL);

    res.json({ url: redirectURL });
  } catch (error) {
    console.error('Error saving order to database:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;