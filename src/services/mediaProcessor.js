/**
 * MediaProcessor - Versione con approccio API nativa
 */
const logger = require('../utils/logger');
const contentCleaner = require('./contentCleaner');
const config = require('../config');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class MediaProcessor {
  constructor(telegramService) {
    this.telegramService = telegramService;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
    this.destinationChannelId = config.telegram.destinationChannelId;
    this.botToken = config.telegram.botToken;
    
    // Crea directory temp se non esiste
    this.tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Processa un messaggio dal canale monitorato
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
   * Pubblica il contenuto nel canale di destinazione utilizzando direttamente l'API HTTP di Telegram
   */
  async publishToDestination(processedContent, channelConfig, originalMessage) {
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const userClient = this.telegramService.getUserClient();
        
        // Prepara il testo
        const caption = this.prepareCaption(processedContent, channelConfig);
        
        // Se non c'è media, invia solo testo
        if (!originalMessage.media) {
          await this.sendTextMessage(caption, channelConfig.destinationTopic);
          logger.info(`Messaggio di solo testo inviato nel topic ${channelConfig.destinationTopic}`);
          return true;
        }
        
        // Altrimenti, gestisci il media
        const mediaBuffer = await userClient.downloadMedia(originalMessage.media);
        if (!mediaBuffer || mediaBuffer.length === 0) {
          throw new Error('Download del media fallito');
        }
        
        // Salva in file temporaneo con estensione corretta
        const filePath = await this.saveTempMediaFile(mediaBuffer, originalMessage.media.className);
        
        // Invia usando API HTTP diretta
        if (originalMessage.media.className === 'MessageMediaPhoto') {
          await this.sendPhoto(filePath, caption, channelConfig.destinationTopic);
        } else if (originalMessage.media.className === 'MessageMediaDocument') {
          await this.sendDocument(filePath, caption, channelConfig.destinationTopic);
        } else if (originalMessage.media.className === 'MessageMediaVideo') {
          await this.sendVideo(filePath, caption, channelConfig.destinationTopic);
        }
        
        // Pulisci il file
        await this.cleanupTempFile(filePath);
        
        logger.info(`Media inviato con successo nel topic ${channelConfig.destinationTopic}`);
        return true;
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
   * Salva il buffer in un file temporaneo
   */
  async saveTempMediaFile(buffer, mediaType) {
    const randomFileName = crypto.randomBytes(16).toString('hex');
    let extension = '.bin';
    
    // Assegna estensione in base al tipo di media
    if (mediaType === 'MessageMediaPhoto') {
      extension = '.jpg';
    } else if (mediaType === 'MessageMediaVideo') {
      extension = '.mp4';
    } else if (mediaType === 'MessageMediaDocument') {
      extension = '.doc';
    }
    
    const filePath = path.join(this.tempDir, `${randomFileName}${extension}`);
    await fs.promises.writeFile(filePath, buffer);
    logger.debug(`File salvato con successo: ${filePath}`);
    return filePath;
  }
  
  /**
   * Elimina un file temporaneo
   */
  async cleanupTempFile(filePath) {
    try {
      await fs.promises.unlink(filePath);
      logger.debug(`File temporaneo rimosso: ${filePath}`);
    } catch (err) {
      logger.warn(`Errore pulizia file temporaneo: ${err.message}`);
    }
  }

  /**
   * Prepara la descrizione formattata del messaggio
   */
  prepareCaption(processedContent, channelConfig) {  // Aggiungi channelConfig come parametro
    let caption = processedContent.text || "";
  
    // Se il testo è vuoto dopo la pulizia, usa un messaggio generico
    if (!caption || caption.trim() === "") {
      caption = "Nuovo prodotto disponibile";
    }
  
    // Formatta il caption finale
    let finalCaption = "";
  
    // Aggiungi il titolo in grassetto con "Article:" davanti
    finalCaption = `🔎 Article: ${caption}`;
  
    // Aggiungi informazioni sul prezzo se presente, senza indicazione di markup
    if (processedContent.price) {
      // Aggiungi il prezzo formattato (senza indicazione del markup)
      finalCaption += `\n\n💰 Price: ${processedContent.price.final} ${processedContent.price.currency}`;
    }
    
    // Aggiungi il canale di provenienza se disponibile
    if (channelConfig && channelConfig.channelName) {
      finalCaption += `\n\n📱 Source: ${channelConfig.channelName}`;
    }
    
    return finalCaption;
  }
  

  /**
   * Invia un messaggio di testo
   */
  async sendTextMessage(text, topicId) {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    const data = {
      chat_id: this.destinationChannelId,
      message_thread_id: topicId,
      text: text,
      parse_mode: 'HTML'
    };
    
    const response = await axios.post(url, data);
    return response.data;
  }
  
  /**
   * Invia una foto
   */
  async sendPhoto(filePath, caption, topicId) {
    const url = `https://api.telegram.org/bot${this.botToken}/sendPhoto`;
    const formData = new FormData();
    
    formData.append('chat_id', this.destinationChannelId);
    formData.append('message_thread_id', topicId);
    formData.append('photo', fs.createReadStream(filePath));
    formData.append('caption', caption);
    
    const response = await axios.post(url, formData, {
      headers: formData.getHeaders()
    });
    
    return response.data;
  }
  
  /**
   * Invia un documento
   */
  async sendDocument(filePath, caption, topicId) {
    const url = `https://api.telegram.org/bot${this.botToken}/sendDocument`;
    const formData = new FormData();
    
    formData.append('chat_id', this.destinationChannelId);
    formData.append('message_thread_id', topicId);
    formData.append('document', fs.createReadStream(filePath));
    formData.append('caption', caption);
    
    const response = await axios.post(url, formData, {
      headers: formData.getHeaders()
    });
    
    return response.data;
  }
  
  /**
   * Invia un video
   */
  async sendVideo(filePath, caption, topicId) {
    const url = `https://api.telegram.org/bot${this.botToken}/sendVideo`;
    const formData = new FormData();
    
    formData.append('chat_id', this.destinationChannelId);
    formData.append('message_thread_id', topicId);
    formData.append('video', fs.createReadStream(filePath));
    formData.append('caption', caption);
    
    const response = await axios.post(url, formData, {
      headers: formData.getHeaders()
    });
    
    return response.data;
  }

  /**
   * Pubblica un gruppo di media
   */
  async publishMediaGroup(groupData, channelConfig) {
    try {
      const userClient = this.telegramService.getUserClient();
      
      // Prepara il testo
      const caption = this.prepareCaption({
        text: groupData.text,
        price: groupData.price
      }, channelConfig);
      
      // Se non ci sono messaggi, esci
      if (!groupData.originalMessages || groupData.originalMessages.length === 0) {
        logger.warn('Nessun messaggio originale trovato nel gruppo');
        return false;
      }
      
      // Invia il primo messaggio con il testo
      const firstMsg = groupData.originalMessages[0];
      if (firstMsg && firstMsg.media) {
        const mediaBuffer = await userClient.downloadMedia(firstMsg.media);
        if (!mediaBuffer || mediaBuffer.length === 0) {
          throw new Error('Download del primo media fallito');
        }
        
        const filePath = await this.saveTempMediaFile(mediaBuffer, firstMsg.media.className);
        
        // Invia il primo messaggio con tutto il testo
        const sentMessage = await this.sendPhoto(filePath, caption, channelConfig.destinationTopic);
        await this.cleanupTempFile(filePath);
        
        logger.info(`Prima immagine del gruppo inviata con successo`);
        
        // Invia le immagini rimanenti come risposta
        if (groupData.originalMessages.length > 1) {
          for (let i = 1; i < groupData.originalMessages.length; i++) {
            const msg = groupData.originalMessages[i];
            if (msg && msg.media) {
              try {
                const mediaBuffer = await userClient.downloadMedia(msg.media);
                if (!mediaBuffer || mediaBuffer.length === 0) continue;
                
                const filePath = await this.saveTempMediaFile(mediaBuffer, msg.media.className);
                
                // Invia senza caption (solo come immagine)
                const formData = new FormData();
                formData.append('chat_id', this.destinationChannelId);
                formData.append('message_thread_id', channelConfig.destinationTopic);
                formData.append('photo', fs.createReadStream(filePath));
                formData.append('reply_to_message_id', sentMessage.result.message_id);
                
                const url = `https://api.telegram.org/bot${this.botToken}/sendPhoto`;
                await axios.post(url, formData, {
                  headers: formData.getHeaders()
                });
                
                await this.cleanupTempFile(filePath);
                logger.info(`Immagine ${i+1} del gruppo inviata come risposta`);
              } catch (err) {
                logger.error(`Errore invio immagine ${i+1}: ${err.message}`);
                // Continua comunque con il prossimo
              }
            }
          }
        }
        
        return true;
      } else {
        // Non ci sono media, invia solo testo
        await this.sendTextMessage(caption, channelConfig.destinationTopic);
        logger.info(`Messaggio di gruppo (solo testo) inviato con successo`);
        return true;
      }
    } catch (error) {
      logger.error(`Errore nella pubblicazione del gruppo di media: ${error.message}`);
      return false;
    }
  }
}

module.exports = MediaProcessor;