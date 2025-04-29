/**
 * Channel Controller - Gestisce le operazioni sui canali monitorati
 * 
 * Questo controller è responsabile di:
 * 1. Aggiungere, aggiornare e rimuovere canali monitorati
 * 2. Tenere traccia dei messaggi già processati
 * 3. Recuperare configurazioni dei canali
 */
const Channel = require('../models/Channel');
const ProcessedMessage = require('../models/ProcessedMessage');
const logger = require('../utils/logger');

class ChannelController {
  /**
   * Aggiunge un nuovo canale al monitoraggio
   * @param {String} channelId - ID del canale
   * @param {String} channelName - Nome del canale
   * @param {Object} options - Opzioni aggiuntive
   * @returns {Object} Il canale creato
   */
  async addChannel(channelId, channelName, options = {}) {
    try {
      // Verifica se il canale esiste già
      const existingChannel = await Channel.findOne({ channelId });
      
      if (existingChannel) {
        // Aggiorna il canale esistente
        Object.assign(existingChannel, { channelName, ...options });
        await existingChannel.save();
        logger.info(`Canale aggiornato: ${channelName} (${channelId})`);
        return existingChannel;
      } else {
        // Crea un nuovo canale
        const channel = new Channel({
          channelId,
          channelName,
          ...options
        });
        
        await channel.save();
        logger.info(`Canale aggiunto: ${channelName} (${channelId})`);
        return channel;
      }
    } catch (error) {
      logger.error(`Errore aggiunta canale: ${error.message}`);
      throw error;
    }
  }

  /**
   * Aggiorna un canale esistente
   * @param {String} channelId - ID del canale da aggiornare
   * @param {Object} options - Opzioni da aggiornare
   * @returns {Object} Il canale aggiornato
   */
  async updateChannel(channelId, options = {}) {
    try {
      const channel = await Channel.findOne({ channelId });
      
      if (!channel) {
        throw new Error(`Canale ${channelId} non trovato`);
      }
      
      // Aggiorna i campi
      Object.keys(options).forEach(key => {
        channel[key] = options[key];
      });
      
      await channel.save();
      logger.info(`Canale ${channelId} aggiornato con successo`);
      return channel;
    } catch (error) {
      logger.error(`Errore aggiornamento canale: ${error.message}`);
      throw error;
    }
  }

  /**
   * Rimuove un canale dal monitoraggio
   * @param {String} channelId - ID del canale da rimuovere
   * @returns {Object} Risultato dell'operazione
   */
  async removeChannel(channelId) {
    try {
      const result = await Channel.findOneAndDelete({ channelId });
      if (result) {
        logger.info(`Canale rimosso: ${result.channelName} (${channelId})`);
      } else {
        logger.warn(`Canale ${channelId} non trovato per la rimozione`);
      }
      return result;
    } catch (error) {
      logger.error(`Errore rimozione canale: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ottiene la configurazione di un canale
   * @param {String} channelId - ID del canale
   * @returns {Object} Configurazione del canale o null
   */
  async getChannelConfig(channelId) {
    try {
      return await Channel.findOne({ channelId, active: true });
    } catch (error) {
      logger.error(`Errore recupero configurazione canale: ${error.message}`);
      return null;
    }
  }

  /**
   * Ottiene tutti i canali monitorati
   * @param {Boolean} onlyActive - Se true, restituisce solo i canali attivi
   * @returns {Array} Lista dei canali
   */
  async getAllChannels(onlyActive = false) {
    try {
      const query = onlyActive ? { active: true } : {};
      return await Channel.find(query).sort({ channelName: 1 });
    } catch (error) {
      logger.error(`Errore recupero canali: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verifica se un messaggio è già stato processato
   * @param {Number} messageId - ID del messaggio
   * @param {String} channelId - ID del canale
   * @returns {Boolean} True se il messaggio è già stato processato
   */
  async isMessageProcessed(messageId, channelId) {
    try {
      const exists = await ProcessedMessage.findOne({
        originalMessageId: messageId,
        sourceChannelId: channelId
      });
      return !!exists;
    } catch (error) {
      logger.error(`Errore verifica messaggio processato: ${error.message}`);
      return false;
    }
  }

  /**
   * Marca un messaggio come processato
   * @param {Number} messageId - ID del messaggio
   * @param {String} channelId - ID del canale
   */
  async markMessageAsProcessed(messageId, channelId) {
    try {
      const processedMessage = new ProcessedMessage({
        originalMessageId: messageId,
        sourceChannelId: channelId
      });
      await processedMessage.save();
      logger.debug(`Messaggio ${messageId} marcato come processato`);
    } catch (error) {
      // Ignora errori di duplicazione (race condition)
      if (error.code !== 11000) {
        logger.error(`Errore marcatura messaggio: ${error.message}`);
        throw error;
      }
    }
  }

  /**
   * Pulisce i messaggi processati più vecchi di X giorni
   * @param {Number} days - Numero di giorni dopo cui eliminare i messaggi
   * @returns {Object} Risultato dell'operazione
   */
  async cleanupProcessedMessages(days = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const result = await ProcessedMessage.deleteMany({
        processedAt: { $lt: cutoffDate }
      });
      
      logger.info(`Pulizia messaggi: ${result.deletedCount} messaggi rimossi`);
      return result;
    } catch (error) {
      logger.error(`Errore pulizia messaggi: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new ChannelController();