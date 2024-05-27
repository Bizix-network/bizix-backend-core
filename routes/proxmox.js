const express = require('express');
const passport = require('passport');
const axios = require('axios');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const VM = require('../models/VM');
const IPAddress = require('../models/IPAddress');
const Template = require('../models/Template');
const configureNginx = require('../utils/configureNginx');

// Configurare Proxmox API Client
const proxmoxInstance = axios.create({
  baseURL: `https://${process.env.PROXMOX_HOST}:8006/api2/json`,
  headers: {
    'Authorization': `PVEAPIToken=${process.env.PROXMOX_USER}!${process.env.PROXMOX_TOKEN_ID}=${process.env.PROXMOX_API_TOKEN}`
  },
  httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }) // Dacă folosești un certificat auto-semnat
});

// Funcție pentru a verifica statusul unei sarcini
const checkTaskStatus = async (node, taskid) => {
  try {
    const response = await proxmoxInstance.get(`/nodes/${node}/tasks/${taskid}/status`);
    return response.data.data;
  } catch (error) {
    console.error('Error checking task status:', error.message);
    throw error;
  }
};

// Funcție pentru a aștepta finalizarea unei sarcini
const waitForTaskCompletion = async (node, taskid) => {
  while (true) {
    const status = await checkTaskStatus(node, taskid);
    if (status.status === 'stopped') {
      if (status.exitstatus === 'OK') {
        console.log('Task completed successfully.');
        return;
      } else {
        throw new Error(`Task failed with exit status: ${status.exitstatus}`);
      }
    }
    await new Promise(resolve => setTimeout(resolve, 5000)); // Așteaptă 5 secunde înainte de a verifica din nou
  }
};

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

// Funcție pentru a prelua următorul `vmid` disponibil
const getNextVmid = async () => {
  try {
    const response = await proxmoxInstance.get('/cluster/resources', {
      params: { type: 'vm' }
    });

    const vms = response.data.data;
    const vmIds = vms.map(vm => parseInt(vm.vmid, 10)).filter(id => id >= 1000); // Filtrare pentru ID-uri de forma 1xxx
    const maxVmid = Math.max(...vmIds, 999); // Începem de la 999 dacă nu există VM-uri

    return maxVmid + 1;
  } catch (error) {
    console.error('Error fetching next VMID:', error.message);
    throw error;
  }
};

// Funcție pentru a șterge VM-ul în caz de eroare
const deleteVM = async (node, vmid) => {
  try {
    console.log(`Shutting down VM ${vmid} on node ${node}...`);
    await proxmoxInstance.post(`/nodes/${node}/qemu/${vmid}/status/stop`);
    console.log(`VM ${vmid} shut down successfully.`);

    console.log(`Deleting VM ${vmid} on node ${node}...`);
    await proxmoxInstance.delete(`/nodes/${node}/qemu/${vmid}`);
    console.log(`VM ${vmid} deleted successfully.`);
  } catch (error) {
    console.error(`Error deleting VM ${vmid} on node ${node}:`, error.message);
    if (error.response) {
      console.error('Full error response:', error.response.data);
    }
    throw error;
  }
};

// Funcție pentru rollback în cazul în care ștergerea VM-ului eșuează
const rollbackDeleteVM = async (node, vmid, attempts = 3) => {
  while (attempts > 0) {
    try {
      console.log(`Attempting to delete VM ${vmid} on node ${node}. Attempts remaining: ${attempts}`);
      await deleteVM(node, vmid);
      console.log(`VM ${vmid} deleted successfully on attempt ${4 - attempts}.`);
      return;
    } catch (error) {
      console.error(`Error deleting VM ${vmid} on node ${node}. Attempts remaining: ${attempts - 1}`, error.message);
      attempts -= 1;
      if (attempts === 0) {
        console.error(`Failed to delete VM ${vmid} after several attempts. Manual intervention required.`);
        // Aici poți adăuga logica pentru a trimite o alertă administratorilor
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 5000)); // Așteaptă 5 secunde înainte de a încerca din nou
    }
  }
};

// Endpoint pentru crearea unei VM pe baza unui template
router.post('/create-vm', passport.authenticate('jwt', { session: false }), async (req, res) => {
  const { node, vmName, vmVersion, companyName, expiresAt } = req.body;
  const userId = req.user._id;

  // Verificarea câmpurilor necesare
  if (!node || !vmName || !vmVersion || !companyName || !expiresAt) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  let ipAddressDoc = null;
  try {
    console.log('Received request to create VM with the following parameters:', req.body);

    // Verificarea existenței template-ului specificat
    const template = await Template.findOne({ templateName: vmName, version: vmVersion, active: true });
    if (!template) {
      return res.status(400).json({ error: 'Template not found or inactive' });
    }

    const { proxmoxId } = template;
    console.log('Found template with Proxmox ID:', proxmoxId);

    // Generarea următorului `vmid` disponibil
    const vmid = await getNextVmid();
    console.log('Generated VMID:', vmid);

    // Alocarea unei adrese IP disponibile
    ipAddressDoc = await IPAddress.findOneAndUpdate(
      { allocatedTo: null },
      { $set: { allocatedTo: userId, allocatedAt: new Date() } },
      { new: true }
    );

    if (!ipAddressDoc) {
      throw new Error('No available IP addresses');
    }

    const { ipAddress, gateway } = ipAddressDoc;
    console.log('Allocated IP address:', ipAddress, 'with gateway:', gateway);

    // Clonarea template-ului
    const completeVmName = `${vmName}-v${vmVersion}-${proxmoxId}`;
    console.log('Cloning template to create new VM...');
    const cloneResponse = await proxmoxInstance.post(`/nodes/${node}/qemu/${proxmoxId}/clone`, {
      newid: vmid,
      name: completeVmName,
      target: node,
      full: 1,
      format: 'qcow2'
    });

    const task = cloneResponse.data.data;
    console.log('VM cloning task started:', task);

    // Așteaptă finalizarea sarcinii de clonare
    console.log('Waiting for VM cloning task to complete...');
    await waitForTaskCompletion(node, task);

    // Configurarea adresei IP folosind Cloud-Init
    console.log('Configuring VM IP address with Cloud-Init...');
    const configResponse = await proxmoxInstance.put(`/nodes/${node}/qemu/${vmid}/config`, {
      'ipconfig0': `ip=${ipAddress}/24,gw=${gateway}`, // Utilizează gateway-ul alocat din baza de date
      'name': `${completeVmName}`,
      'nameserver': '8.8.8.8'
    });

    console.log('VM IP address configured:', configResponse.data);

    // Verificarea configurării IP
    const vmConfig = await checkVMIPConfig(node, vmid);
    console.log('Verified VM IP Configuration:', vmConfig);

    // Pornirea VM-ului
    console.log('Starting the VM...');
    const startResponse = await proxmoxInstance.post(`/nodes/${node}/qemu/${vmid}/status/start`);
    console.log('VM started:', startResponse.data);

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

    // Configurarea Nginx pentru subdomeniu
    const nginxConfigResult = await configureNginx(companyName, ipAddress);
    if (!nginxConfigResult) {
          throw new Error('Failed to configure Nginx for the new VM');
        }
    
    res.json({ message: 'VM created and Nginx configured successfully', task });
   
  } catch (error) {
    console.error('Error during VM creation process:', error.message);

    if (ipAddressDoc) {
      // Eliberează adresa IP dacă a fost alocată, dar VM-ul nu a fost creat sau pornit cu succes
      await IPAddress.findOneAndUpdate(
        { _id: ipAddressDoc._id },
        { $set: { allocatedTo: null, allocatedAt: null } }
      );
      console.log('IP address deallocated due to error.');
    }

    if (vmid !== null) {
      // Șterge VM-ul dacă a fost creat
      await rollbackDeleteVM(node, vmid);
      console.log(`VM ${vmid} deletion process initiated due to error.`);
    }

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