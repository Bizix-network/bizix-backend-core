const { ApiPromise, WsProvider } = require('@polkadot/api');
const Template = require('../models/Template');
const logger = require('../utils/logger.js');

class BlockchainListener {
  constructor() {
    this.api = null;
  }

  async connect() {
    const wsProvider = new WsProvider(process.env.SUBSTRATE_WS_URL);
    this.api = await ApiPromise.create({ provider: wsProvider });
    logger('Connected to Substrate node');
  }

  async subscribeToEvents() {
    if (!this.api) {
      throw new Error('API not initialized');
    }

    this.api.query.system.events(async (events) => {
      // Obținem numărul blocului curent
      const currentBlock = await this.api.derive.chain.bestNumber();
      
      events.forEach((record) => {
        const { event } = record;

        if (event.section === 'bizixCore' && event.method === 'ProposalApproved') {
          logger('ProposalApproved event detected');
          logger('Event data:', JSON.stringify(event.data.toJSON(), null, 2));
          // Transmitem nr blocului curent
          this.handleProposalApproved(event.data, currentBlock.toString());
        }
      });
    });

    logger('Subscribed to blockchain events');
  }

  async handleProposalApproved(eventData, blockNumber) {
    try {
      const data = eventData.toJSON();
      logger('Processing event data:', data);

      const [proposalId, accountId, ipfsAddress, name, version, templateId] = data;

      // Decodăm bytes în string
      const bytesToString = (hexString) => {
        if (typeof hexString !== 'string' || !hexString.startsWith('0x')) {
          return hexString;
        }
        try {
          const bytes = Buffer.from(hexString.slice(2), 'hex');
          return bytes.toString('utf8');
        } catch (error) {
          console.error('Error decoding hex string:', error);
          return hexString;
        }
      };

      const template = {
        proxmoxId: parseInt(templateId || 0),
        templateName: bytesToString(name),
        description: bytesToString(ipfsAddress),
        shortDescription: bytesToString(name),
        category: 'default',
        version: bytesToString(version),
        active: true,
        blockNumber: blockNumber
      };

      logger('Prepared template data:', template);

      const newTemplate = new Template(template);
      await newTemplate.save();

      logger(`Template saved successfully with ID: ${newTemplate._id}`);
    } catch (error) {
      console.error('Error processing ProposalApproved event:', error);
      //logger('Full event data:', eventData);
    }
  }
}

module.exports = BlockchainListener;