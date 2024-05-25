const axios = require('axios');

const configureNginx = async (companyName, vmIp) => {
  const nginxServerUrl = `http://10.2.3.2:3000/configure-nginx`; // Adresa IP a serverului bizix-bridge-backend

  try {
    const response = await axios.post(nginxServerUrl, {
      companyName,
      vmIp
    }, {
      headers: {
        'x-api-key': process.env.API_TOKEN // Token-ul API, dacă este necesar
      }
    });

    if (response.status === 200) {
      console.log('Nginx a fost configurat și repornit cu succes.');
      return true;
    } else {
      console.error('Eroare la configurarea Nginx:', response.data);
      return false;
    }
  } catch (error) {
    console.error('Eroare la configurarea Nginx:', error.message);
    return false;
  }
};

module.exports = configureNginx;