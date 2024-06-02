const axios = require('axios');
const logger = require('./logger.js');

const configureDNS = async (domain, subdomain, ipAddress) => {
  const cpanelUrl = `https://${process.env.CPANEL_HOST}:2083/json-api/cpanel`;
  const token = process.env.CPANEL_API_TOKEN;

  logger('Trying to connect to cPanel API on host :', cpanelUrl);
  try {
    const response = await axios.get(cpanelUrl, {
      params: {
        module: 'ZoneEdit',
        function: 'add_zone_record',
        domain,
        name: `${subdomain}.${domain}.`,
        type: 'A',
        address: ipAddress
      },
      headers: {
        'Authorization': `cpanel ${process.env.CPANEL_USER}:${token}`
      }
    });

    if (response.data.status === 1) {
      logger('DNS record created successfully.');
      return true;
    } else {
      console.error('Failed to create DNS record:', response.data.errors);
      return false;
    }
  } catch (error) {
    console.error('Error creating DNS record:', error.message);
    return false;
  }
};

module.exports = configureDNS;