const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');
const Order = require('../models/Order');

// Endpoint pentru webhook EuPlătesc
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    console.log('Webhook received:', req.body);

    const { amount, curr, invoice_id, merch_id, action, fp_hash, ...rest } = req.body;

    // Reconstrucția datelor pentru verificarea hash-ului
    let hmac = '';
    const data = { amount, curr, invoice_id, merch_id, ...rest };
    const datakeys = Object.keys(data).filter(key => key !== 'fp_hash');

    datakeys.forEach(key => {
      hmac += data[key].length + data[key];
    });

    const binKey = Buffer.from(process.env.EUPLATESC_SECRET_KEY, "hex");
    const hmacx = crypto.createHmac("md5", binKey).update(hmac, 'utf8').digest('hex');

    console.log('Calculated fp_hash:', hmacx);
    console.log('Received fp_hash:', fp_hash);

    if (fp_hash !== hmacx) {
      console.error('Invalid hash');
      return res.status(400).send('Invalid hash');
    }

    console.log('Hash verified successfully');

    if (action === '0') { // Tranzacție aprobată
      console.log('Transaction approved');

      const order = await Order.findById(invoice_id);
      if (!order) {
        console.error('Order not found:', invoice_id);
        throw new Error('Order not found');
      }

      console.log('Order found:', order);

      // Apelează endpoint-ul /create-vm pentru a crea VM-ul
      const vmData = {
        userId: order.userId,
        node: order.node,
        vmName: order.vmName,
        vmVersion: order.vmVersion,
        companyName: order.billingDetails.company,
        expiresAt: new Date(new Date().setFullYear(new Date().getFullYear() + 1)), // Setează data de expirare la un an de acum
        templateId: order.templateId
      };

      console.log('Sending request to create VM with data:', vmData);

      const response = await axios.post('http://localhost:3000/api/proxmox/create-vm', vmData, {
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
      console.log('Payment not approved. Action:', action);
      throw new Error('Payment not approved');
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