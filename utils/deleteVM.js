const axios = require('axios');
const VM = require('../models/VM');

// Configurare Proxmox API Client
const proxmoxInstance = axios.create({
  baseURL: `https://${process.env.PROXMOX_HOST}:8006/api2/json`,
  headers: {
    'Authorization': `PVEAPIToken=${process.env.PROXMOX_USER}!${process.env.PROXMOX_TOKEN_ID}=${process.env.PROXMOX_API_TOKEN}`
  },
  httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }) // Dacă folosești un certificat auto-semnat
});

// Funcție pentru a șterge VM-ul
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

      // Ștergerea înregistrării VM din baza de date MongoDB
      await VM.deleteOne({ vmid });
      console.log(`VM ${vmid} entry deleted from MongoDB.`);

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

module.exports = {
  deleteVM,
  rollbackDeleteVM
};