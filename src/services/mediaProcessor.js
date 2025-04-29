/**
 * MediaProcessor - Gestisce l'elaborazione e la pubblicazione dei messaggi
 * 
 * Questo servizio è responsabile di:
 * 1. Processare i messaggi dai canali monitorati
 * 2. Estrarre e pulire il testo/media
 * 3. Pubblicare il contenuto nel canale di destinazione
 * 4. Gestire gruppi di media
 */
const logger = require('../utils/logger');
const contentCleaner = require('./contentCleaner');
const config = require('../config');

class MediaProcessor {
  constructor(telegramService) {
    this.telegramService = telegramService;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
    this.destinationChannelId = config.telegram.destinationChannelId;
  }

  /**
   * Processa un messaggio dal canale monitorato
   * @param {Object} message - Messaggio Telegram originale
   * @param {Object} channelConfig - Configurazione del canale
   * @returns {Object} Contenuto processato
   */
  async processMessage(message, channelConfig) {
    try {
      logger.debug(`Processamento messaggio ID: ${message.id}`);
      
      const processedContent = {
        text: '',
        price: null,
        media: [],
        groupedId: message.groupedId
      };

      // Estrai il testo dal messaggio
      if (message.message && channelConfig.includeText) {
        // Pulisci il testo rimuovendo link e riferimenti esterni
        processedContent.text = contentCleaner.removeLinks(message.message);
        
        // Estrai il prezzo se configurato
        if (channelConfig.includePrice) {
          const extractedPrice = contentCleaner.extractPrice(message.message, channelConfig.priceRegex);
          if (extractedPrice) {
            processedContent.price = contentCleaner.applyMarkup(extractedPrice, 17);
            logger.debug(`Prezzo estratto: ${JSON.stringify(processedContent.price)}`);
          }
        }
      }

      // Estrai i media dal messaggio
      if (message.media) {
        processedContent.media.push(message.media);
        logger.debug(`Media trovato di tipo: ${message.media.className}`);
      }

      return processedContent;
    } catch (error) {
      logger.error(`Errore processamento messaggio: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Pubblica il contenuto nel canale di destinazione
   * @param {Object} processedContent - Contenuto processato
   * @param {Object} channelConfig - Configurazione del canale
   * @param {Object} originalMessage - Messaggio originale
   * @returns {Boolean} Successo della pubblicazione
   */
  async publishToDestination(processedContent, channelConfig, originalMessage) {
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const bot = this.telegramService.getBot();
        const userClient = this.telegramService.getUserClient();
        
        // Prepara la descrizione
        let caption = this.prepareCaption(processedContent);
        
        // SOLUZIONE COMPLETA:
        // Invece di inoltrare il media, lo scarichiamo e lo inviamo direttamente
        // con il bot nel topic corretto insieme alla descrizione
        if (originalMessage.media) {
          logger.info(`Invio media nel topic Articoli (${channelConfig.destinationTopic})`);
          
          // 1. Scarica il media
          const mediaBuffer = await userClient.downloadMedia(originalMessage.media);
          if (!mediaBuffer) {
            throw new Error('Download del media fallito');
          }
          
          // 2. Invia il media con la caption direttamente nel topic corretto
          let sentMessage;
          
          if (originalMessage.media.className === 'MessageMediaPhoto') {
            sentMessage = await bot.api.sendPhoto(this.destinationChannelId, mediaBuffer, {
              message_thread_id: channelConfig.destinationTopic,
              caption: caption
            });
          } else if (originalMessage.media.className === 'MessageMediaDocument') {
            sentMessage = await bot.api.sendDocument(this.destinationChannelId, mediaBuffer, {
              message_thread_id: channelConfig.destinationTopic,
              caption: caption
            });
          } else if (originalMessage.media.className === 'MessageMediaVideo') {
            sentMessage = await bot.api.sendVideo(this.destinationChannelId, mediaBuffer, {
              message_thread_id: channelConfig.destinationTopic,
              caption: caption
            });
          }
          
          if (sentMessage) {
            logger.info(`Media inviato con successo nel topic Articoli con ID: ${sentMessage.message_id}`);
            return true;
          }
        } else {
          // Messaggio solo testo
          await bot.api.sendMessage(this.destinationChannelId, caption, {
            message_thread_id: channelConfig.destinationTopic
          });
          logger.info(`Messaggio di solo testo inviato nel topic Articoli`);
          return true;
        }
      } catch (error) {
        logger.warn(`Tentativo ${attempt}/${this.retryAttempts} fallito: ${error.message}`);
        
        if (attempt < this.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
        }
      }
    }
    
    logger.error('Tutti i tentativi di pubblicazione falliti');
    return false;
  }

  /**
   * Prepara la descrizione formattata del messaggio
   * @param {Object} processedContent - Contenuto processato
   * @returns {String} Testo formattato
   */
  prepareCaption(processedContent) {
    let caption = processedContent.text || '';
    
    // Se il testo è vuoto dopo la pulizia, usiamo un valore predefinito
    if (!caption || caption.trim() === '') {
      caption = 'Nuovo prodotto disponibile';
    }
    
    // Aggiungi informazioni sul prezzo se presente
    if (processedContent.price) {
      // Rimuovi qualsiasi menzione esistente di prezzo
      caption = caption.replace(/Price:?\s*.*?(?=\n|$)/i, '').trim();
      caption = caption.replace(/Prezzo:?\s*.*?(?=\n|$)/i, '').trim();
      
      // Aggiungi il prezzo formattato
      caption += `\n\n💰 Prezzo: ${processedContent.price.final} ${processedContent.price.currency}`;
      
      // Aggiungi info sul markup
      const markupPercentage = ((processedContent.price.markup / processedContent.price.original) * 100).toFixed(0);
      caption += `\n📈 (+${markupPercentage}% markup)`;
    }
    
    return caption;
  }

  /**
   * Pubblica un gruppo di media come un unico post
   * @param {Object} groupData - Dati del gruppo di media
   * @param {Object} channelConfig - Configurazione del canale
   * @returns {Boolean} Successo della pubblicazione
   */
  async publishMediaGroup(groupData, channelConfig) {
    try {
      const bot = this.telegramService.getBot();
      const userClient = this.telegramService.getUserClient();
      
      // Se non ci sono media o originali, non possiamo procedere
      if (!groupData.originalMessages || groupData.originalMessages.length === 0) {
        logger.warn('Nessun messaggio originale trovato nel gruppo');
        return false;
      }

      // Prepara il testo
      const caption = this.prepareCaption({
        text: groupData.text,
        price: groupData.price
      });
      
      // Per album di foto: carichiamo tutte le foto e le inviamo come mediaGroup
      if (groupData.originalMessages.length > 1) {
        try {
          const mediaArray = [];
          
          // Prepara l'array di media
          for (let i = 0; i < groupData.originalMessages.length; i++) {
            const msg = groupData.originalMessages[i];
            if (msg.media) {
              const mediaBuffer = await userClient.downloadMedia(msg.media);
              
              // Il primo media avrà la caption
              if (i === 0) {
                mediaArray.push({
                  type: 'photo',
                  media: { source: mediaBuffer },
                  caption: caption
                });
              } else {
                mediaArray.push({
                  type: 'photo',
                  media: { source: mediaBuffer }
                });
              }
            }
          }
          
          // Invia il gruppo di media
          if (mediaArray.length > 0) {
            await bot.api.sendMediaGroup(this.destinationChannelId, mediaArray, {
              message_thread_id: channelConfig.destinationTopic
            });
            
            logger.info(`Gruppo di media inviato con successo nel topic Articoli`);
            return true;
          }
        } catch (groupError) {
          logger.error(`Errore nell'invio del gruppo di media: ${groupError.message}`);
          
          // Fallback: invia le immagini una per una
          logger.info(`Provando il fallback: invio singolo...`);
          const firstMsg = groupData.originalMessages[0];
          
          if (firstMsg && firstMsg.media) {
            const mediaBuffer = await userClient.downloadMedia(firstMsg.media);
            
            // Invia la prima immagine con la caption
            const sentMessage = await bot.api.sendPhoto(this.destinationChannelId, mediaBuffer, {
              message_thread_id: channelConfig.destinationTopic,
              caption: caption
            });
            
            // Invia le altre immagini come risposta
            for (let i = 1; i < groupData.originalMessages.length; i++) {
              const msg = groupData.originalMessages[i];
              if (msg.media) {
                const mediaBuffer = await userClient.downloadMedia(msg.media);
                await bot.api.sendPhoto(this.destinationChannelId, mediaBuffer, {
                  message_thread_id: channelConfig.destinationTopic,
                  reply_to_message_id: sentMessage.message_id
                });
              }
            }
            
            return true;
          }
        }
      } else {
        // Per messaggi singoli
        const msg = groupData.originalMessages[0];
        if (msg && msg.media) {
          const mediaBuffer = await userClient.downloadMedia(msg.media);
          
          // Invia il media con la caption
          await bot.api.sendPhoto(this.destinationChannelId, mediaBuffer, {
            message_thread_id: channelConfig.destinationTopic,
            caption: caption
          });
          
          logger.info(`Media singolo inviato con successo nel topic Articoli`);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      logger.error(`Errore nella pubblicazione del gruppo di media: ${error.message}`);
      return false;
    }
  }
}

module.exports = MediaProcessor;