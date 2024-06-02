const axios = require('axios');
const logger = require('./logger.js');

const configureCloudflareDNS = async (zoneId, subdomain, ipAddress) => {
  const cloudflareUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`;
  const token = process.env.CLOUDFLARE_API_TOKEN;

  try {
    const response = await axios.post(cloudflareUrl, {
      type: 'A',
      name: subdomain,
      content: ipAddress,
      ttl: 3600,
      proxied: false
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.success) {
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

module.exports = configureCloudflareDNS;