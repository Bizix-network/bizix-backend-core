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
const configureCloudflareDNS = require('../utils/configureCloudflareDNS');
const { deleteVM, rollbackDeleteVM } = require('../utils/deleteVM');
const logger = require('../utils/logger.js');

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
        logger('Task completed successfully.');
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
    logger('VM IP Configuration:', config);
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

// Funcție pentru a genera `publicURL`
const generatePublicURL = (username, vmid) => {
  return `http://${username}.bizix.ro/${vmid}`;
};

// Middleware pentru a permite apeluri interne fără autentificare - AUTENTIFICAREA CU JWT LA ACEST CALL VA FI DEZACTIVATA IN PRODUCTIE
const internalRequestMiddleware = (req, res, next) => {
  const internalApiKey = req.headers['internal-api-key'];
  const allowedIps = ['127.0.0.1', '::1', '45.88.189.188', '79.119.240.46']; // aici IP-urile permise

  const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  
  logger('Received internal request with IP:', clientIp);
  logger('Received internal API key:', internalApiKey); 

  if (allowedIps.includes(clientIp) && internalApiKey === process.env.INTERNAL_API_KEY) {
    logger(`Internal request from IP: ${clientIp}`);
    return next(); // Permite apelurile interne fără autentificare JWT
  }

  console.warn(`Unauthorized attempt from IP: ${clientIp}`);
  return passport.authenticate('jwt', { session: false })(req, res, next);
};

// Endpoint pentru crearea unei VM pe baza unui template
// vechea forma de declarare doar cu JWT : router.post('/create-vm', passport.authenticate('jwt', { session: false }), async (req, res) => {
  router.post('/create-vm', internalRequestMiddleware, async (req, res) => {
  const { node, vmName, vmVersion, companyName, expiresAt, userId } = req.body;
  //const userId = req.user._id; 
  //cand EuPlatesc apeleaza webhook-ul si atunci nu se mai face autentificarea JWT, 
  //apelul /create-vm nu va mai avea req.user populat corect asa ca folosim:
  const effectiveUserId = req.user ? req.user._id : userId;
  
  // Verificarea câmpurilor necesare
  if (!node || !vmName || !vmVersion || !companyName || !expiresAt) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  let ipAddressDoc = null;
  let vmid = null;
  try {
    logger('Received request to create VM with the following parameters:', req.body);

    // Verificarea existenței template-ului specificat
    const template = await Template.findOne({ templateName: vmName, version: vmVersion, active: true });
    if (!template) {
      return res.status(400).json({ error: 'Template not found or inactive' });
    }

    const { proxmoxId } = template;
    logger('Found template with Proxmox ID:', proxmoxId);

    // Generarea următorului `vmid` disponibil
    vmid = await getNextVmid();
    
    logger('Generated VMID:', vmid);

    // Alocarea unei adrese IP disponibile
    ipAddressDoc = await IPAddress.findOneAndUpdate(
      { allocatedTo: null },
      { $set: { allocatedTo: effectiveUserId, allocatedAt: new Date() } },
      { new: true }
    );

    if (!ipAddressDoc) {
      throw new Error('No available IP addresses');
    }

    const { ipAddress, gateway } = ipAddressDoc;
    logger('Allocated IP address:', ipAddress, 'with gateway:', gateway);

    // Clonarea template-ului
    const completeVmName = `${vmName}-v${vmVersion}-${proxmoxId}`;
    logger('Cloning template to create new VM...');
    const cloneResponse = await proxmoxInstance.post(`/nodes/${node}/qemu/${proxmoxId}/clone`, {
      newid: vmid,
      name: completeVmName,
      target: node,
      full: 1,
      format: 'qcow2'
    });

    const task = cloneResponse.data.data;
    logger('VM cloning task started:', task);

    logger(`VM ${vmid} cloned successfully.`);

    // Așteaptă finalizarea sarcinii de clonare
    logger('Waiting for VM cloning task to complete...');
    await waitForTaskCompletion(node, task);

    // Configurarea adresei IP folosind Cloud-Init
    logger('Configuring VM IP address with Cloud-Init...');
    const configResponse = await proxmoxInstance.put(`/nodes/${node}/qemu/${vmid}/config`, {
      'ipconfig0': `ip=${ipAddress}/24,gw=${gateway}`, // Utilizează gateway-ul alocat din baza de date
      'name': `${completeVmName}`,
      'nameserver': '8.8.8.8'
    });

    logger('VM IP address configured:', configResponse.data);

    // Verificarea configurării IP
    const vmConfig = await checkVMIPConfig(node, vmid);
    logger('Verified VM IP Configuration:', vmConfig);

    // Pornirea VM-ului
    logger('Starting the VM...');
    const startResponse = await proxmoxInstance.post(`/nodes/${node}/qemu/${vmid}/status/start`);
    logger('VM started:', startResponse.data);

    // Generarea `publicURL`
    const publicURL = generatePublicURL(companyName, vmid);
    logger(`publicURL: ${publicURL}`);
    
    // Salvarea informațiilor VM în baza de date
    const newVM = new VM({
      vmid,
      userId: effectiveUserId,
      name: vmName,
      node,
      companyName,
      expiresAt,
      publicURL,
      templateId: template._id,
      status: 'created'
    });

    await newVM.save();
    logger('VM details saved to database');
    logger(`current VM ID ${vmid}`);

    // Adăugarea scriptului de inițializare
    const initScript = `
      #!/bin/bash
      echo "Initializare VM"
      # Adăugare nume companie în baza de date
      mysql -u root -p'password' -e "USE erp_db; INSERT INTO companies (name) VALUES ('${companyName}');"
    `;

    const scriptPath = path.join(__dirname, 'init.sh');
    fs.writeFileSync(scriptPath, initScript);
    logger('Initialization script created:', scriptPath);

    // Transferul și rularea scriptului de inițializare poate varia în funcție de setup
    // Aici ar trebui să folosești mecanisme de transfer și execuție remote, cum ar fi SSH
    logger('Initialization script will be transferred and executed on the VM.');

    // Configurarea Nginx pentru subdomeniu
    const nginxConfigResult = await configureNginx(companyName, ipAddress, vmid);
    if (!nginxConfigResult) {
          throw new Error('Failed to configure Nginx for the new VM');
        }
    
    // Configurarea DNS pentru subdomeniu în Cloudflare
    const cloudflareZoneId = process.env.CLOUDFLARE_ZONE_ID; // Adaugă Zone ID 
    const bridgeipAddress=process.env.BRIDGE_IP_ADDRESS;
    const dnsConfigResult = await configureCloudflareDNS(cloudflareZoneId, `${companyName}.bizix.ro`, bridgeipAddress);
    if (!dnsConfigResult) {
      throw new Error('Failed to configure DNS for the new VM');
    }
    logger(`current VM ID ${vmid}`);
    res.json({ message: 'VM created, Nginx and DNS configured successfully', task });
   
  } catch (error) {
    console.error('Error during VM creation process:', error.message);

    if (ipAddressDoc) {
      // Eliberează adresa IP dacă a fost alocată, dar VM-ul nu a fost creat sau pornit cu succes
      await IPAddress.findOneAndUpdate(
        { _id: ipAddressDoc._id },
        { $set: { allocatedTo: null, allocatedAt: null } }
      );
      logger('IP address deallocated due to error.');
    }
    logger(`current VM ID ${vmid}`);
    if (vmid !== null) {
      // Șterge VM-ul dacă a fost creat
      await rollbackDeleteVM(node, vmid);
      logger(`VM ${vmid} deletion process initiated due to error.`);
    } else {
      logger('No VM created, no deletion necessary.');
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