const Channel = require('../models/Channel');
const ProcessedMessage = require('../models/ProcessedMessage');
const logger = require('../utils/logger');

class ChannelController {
  async addChannel(channelId, channelName, options = {}) {
    try {
      const channel = new Channel({
        channelId,
        channelName,
        ...options
      });
      
      await channel.save();
      logger.info(`Canale aggiunto: ${channelName} (${channelId})`);
      return channel;
    } catch (error) {
      logger.error('Errore aggiunta canale:', error);
      throw error;
    }
  }

  async removeChannel(channelId) {
    try {
      const result = await Channel.findOneAndDelete({ channelId });
      if (result) {
        logger.info(`Canale rimosso: ${result.channelName} (${channelId})`);
      }
      return result;
    } catch (error) {
      logger.error('Errore rimozione canale:', error);
      throw error;
    }
  }

  async getChannelConfig(channelId) {
    try {
      return await Channel.findOne({ channelId: channelId, active: true });
    } catch (error) {
      logger.error('Errore nel recupero della configurazione del canale:', error);
      return null;
    }
  }

  async isMessageProcessed(messageId, channelId) {
    const exists = await ProcessedMessage.findOne({
      originalMessageId: messageId,
      sourceChannelId: channelId
    });
    return !!exists;
  }

  async markMessageAsProcessed(messageId, channelId) {
    const processedMessage = new ProcessedMessage({
      originalMessageId: messageId,
      sourceChannelId: channelId
    });
    await processedMessage.save();
  }
}

module.exports = new ChannelController();