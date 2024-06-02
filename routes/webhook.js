const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');
const mongoose = require('mongoose');
const Order = require('../models/Order');

// Endpoint pentru webhook EuPlătesc
router.post('/webhook', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    console.log('Webhook received:', req.body);

    const post_data = req.body;

    const data = {
      amount: post_data['amount'],
      curr: post_data['curr'],
      invoice_id: post_data['invoice_id'],
      ep_id: post_data['ep_id'],
      merch_id: post_data['merch_id'],
      action: post_data['action'],
      message: post_data['message'],
      approval: post_data['approval'],
      timestamp: post_data['timestamp'],
      nonce: post_data['nonce']
    };

    const datakeys = Object.keys(data);

    let hmac = '';
    for (let i = 0; i < datakeys.length; i++) {
      if (data[datakeys[i]].length === 0) {
        hmac += '-';
      } else {
        hmac += data[datakeys[i]].length + data[datakeys[i]];
      }
    }

    const binKey = Buffer.from(process.env.EUPLATESC_SECRET_KEY, "hex");
    const hmacx = crypto.createHmac("md5", binKey).update(hmac, 'utf8').digest('hex');

    console.log('Calculated fp_hash:', hmacx);
    console.log('Received fp_hash:', post_data['fp_hash']);

    if (post_data['fp_hash'] === hmacx.toUpperCase()) {
      if (post_data['action'] === "0") {
        // Tranzacție aprobată
        console.log('Transaction approved');
        
        const invoiceId = mongoose.Types.ObjectId.createFromHexString(post_data['invoice_id']);
        const order = await Order.findById(invoiceId);
        if (!order) {
          console.error('Order not found:', post_data['invoice_id']);
          throw new Error('Order not found');
        }

        console.log('Order found:', order);

        // Apelează endpoint-ul /create-vm pentru a crea VM-ul
        const vmData = {
          userId: order.userId,
          node: order.node,
          vmName: order.vmName,
          vmVersion: order.vmVersion,
          companyName: order.billingDetails.companyName,
          expiresAt: new Date(new Date().setFullYear(new Date().getFullYear() + 1)), // Setează data de expirare la un an de acum
          templateId: order.templateId
        };

        console.log('Sending request to create VM with data:', vmData);

        const response = await axios.post('https://api.bizix.ro/proxmox/create-vm', vmData, {
          headers: {
            'internal-api-key': process.env.INTERNAL_API_KEY // Trimite cheia API internă pentru a permite apelul fără autentificare JWT
          }
        });

        console.log('VM creation response:', response.data);

        // Actualizează statusul comenzii
        order.status = 'deployed';
        await order.save();

        console.log('Order status updated to deployed');

        res.status(200).send('OK');
      } else {
        // Tranzacție eșuată
        console.log('Payment not approved. Action:', post_data['action']);
        throw new Error('Payment not approved');
      }
    } else {
      // Hash invalid
      console.error('Invalid hash');
      return res.status(400).send('Invalid hash');
    }
  } catch (error) {
    console.error('Error processing webhook:', error.message);

    if (req.body.invoice_id) {
      const order = await Order.findById(req.body.invoice_id);
      if (order) {
        order.status = 'failed';
        await order.save();
        console.error('Order status updated to failed');
      }
    }

    res.status(500).json({ error: error.message });
  }
});

module.exports = router;