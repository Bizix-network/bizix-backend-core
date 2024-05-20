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

// Funcție pentru a verifica configurarea IP a VM-ului
const checkVMIPConfig = async (node, vmid) => {
  try {
    const response = await proxmoxInstance.get(`/nodes/${node}/qemu/${vmid}/config`);
    const config = response.data.data;
    console.log('VM IP Configuration:', config);
    return config;
  } catch (error) {
    console.error('Error fetching VM IP configuration:', error.message);
    if (error.response) {
      console.error('Full error response:', error.response.data);
    }
  }
};

// Endpoint pentru crearea unei VM pe baza unui template
router.post('/create-vm', passport.authenticate('jwt', { session: false }), async (req, res) => {
  const { vmid, node, vmName, ipAddress, companyName, expiresAt } = req.body;
  const userId = req.user._id;

  // Verificarea câmpurilor necesare
  if (!vmid || !node || !vmName || !ipAddress || !companyName || !expiresAt) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    console.log('Received request to create VM with the following parameters:', req.body);

  // Clonarea template-ului
  console.log('Cloning template to create new VM...');
  const cloneResponse = await proxmoxInstance.post(`/nodes/${node}/qemu/1003/clone`, {
    newid: vmid,
    name: vmName,
    target: node,
    full: 1,
    format: 'qcow2'
  });
  
  const task = cloneResponse.data.data;
  console.log('VM cloning task started:', task);

   // Așteaptă finalizarea sarcinii de clonare (opțional)
   // console.log('Waiting for VM cloning task to complete...');
   // await new Promise(resolve => setTimeout(resolve, 10000)); // Așteaptă 10 secunde

    // Adăugarea unui drive CloudInit
    // console.log('Adding CloudInit drive...');
    //const cloudInitResponse = await proxmoxInstance.post(`/nodes/${node}/qemu/${vmid}/config`, {
    //    'ide2': 'local-lvm:cloudinit'
    // });
  
    // console.log('CloudInit drive added:', cloudInitResponse.data);

    // Configurarea adresei IP folosind cloud-init
    console.log('Configuring VM IP address...');
    const configResponse = await proxmoxInstance.post(`/nodes/${node}/qemu/${vmid}/config`, {
      'ipconfig0': `ip=${ipAddress},gw=10.2.3.1`, 
      'nameserver': '8.8.8.8'
    });

    console.log('VM IP address configured:', configResponse.data);

    // Verificarea configurării IP
    const vmConfig = await checkVMIPConfig(node, vmid);
    console.log('Verified VM IP Configuration:', vmConfig);

    // Salvarea informațiilor VM în baza de date
    const newVM = new VM({
      vmid,
      userId,
      name: vmName,
      node,
      storage: 0, // Storage-ul specificat la clonare, nu este necesar aici
      memory: 0, // Configurația hardware a template-ului
      cores: 0, // Configurația hardware a template-ului
      diskSize: 0, // Configurația hardware a template-ului
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