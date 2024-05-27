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