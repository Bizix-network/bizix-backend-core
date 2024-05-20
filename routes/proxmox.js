const express = require('express');
const passport = require('passport');
const axios = require('axios');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const VM = require('../models/VM');

// Configurare Proxmox API Client
const proxmoxInstance = axios.create({
  baseURL: `https://${process.env.PROXMOX_HOST}:8006/api2/json`,
  headers: {
    'Authorization': `PVEAPIToken=${process.env.PROXMOX_USER}!${process.env.PROXMOX_TOKEN_ID}=${process.env.PROXMOX_API_TOKEN}`
  },
  httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }) // Dacă folosești un certificat auto-semnat
});

// Endpoint pentru crearea unei VM pe baza unui template
router.post('/create-vm', passport.authenticate('jwt', { session: false }), async (req, res) => {
  const { vmid, node, storage, vmName, memory, cores, diskSize, companyName, expiresAt } = req.body;
  const userId = req.user._id;

  // Verificarea câmpurilor necesare
  if (!vmid || !node || !storage || !vmName || !memory || !cores || !diskSize || !companyName || !expiresAt) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    console.log('Received request to create VM with the following parameters:', req.body);

    // Crearea unei noi VM pe baza unui template
    console.log(`ID0: ${storage}:${vmid}/vm-${vmid}-disk-0,size=${diskSize}G,format=qcow2`);
    console.log('Sending request to create VM...');
    const response = await proxmoxInstance.post(`/nodes/${node}/qemu`, {
      vmid,
      name: vmName,
      memory,
      cores,
      ide0: `${storage}:${diskSize},format=qcow2`,
      net0: 'virtio,bridge=vmbr0',
      ostype: 'l26',
      template: 0
    });
  
    const task = response.data.data;
    console.log('VM creation task started:', task);

    // Salvarea informațiilor VM în baza de date
      
    const newVM = new VM({
      vmid,
      userId,
      name: vmName,
      node,
      storage,
      memory,
      cores,
      diskSize,
      companyName,
      expiresAt,
      status: 'created'
    });

    await newVM.save();
    console.log('VM details saved to database');

    // Adăugarea scriptului de inițializare
    const initScript = `
      #!/bin/bash
      echo "Initializare VM"
      # Adăugare nume companie în baza de date
      mysql -u root -p'password' -e "USE erp_db; INSERT INTO companies (name) VALUES ('${companyName}');"
    `;

    const scriptPath = path.join(__dirname, 'init.sh');
    fs.writeFileSync(scriptPath, initScript);
    console.log('Initialization script created:', scriptPath);

    // Transferul și rularea scriptului de inițializare poate varia în funcție de setup
    // Aici ar trebui să folosești mecanisme de transfer și execuție remote, cum ar fi SSH
    console.log('Initialization script will be transferred and executed on the VM.');

    res.json({ message: 'VM created successfully', task });
  } catch (error) {
    console.error('Error during VM creation process:', error.message);

    if (error.response) {
      console.error('Full error response:', error.response.data);
      console.error('Error status:', error.response.status);
      console.error('Error headers:', error.response.headers);
    } else if (error.request) {
      console.error('No response received:', error.request);
    } else {
      console.error('Error setting up request:', error.message);
    }
    
    res.status(500).json({ error: error.message, details: error.response ? error.response.data : null });
  }
});

module.exports = router;