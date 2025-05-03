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
  prepareCaption(processedContent, channelConfig) {
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
    
    // Aggiungi il canale di provenienza come Source: X, dove X è l'indice del canale
    if (channelConfig && channelConfig.channelId) {
      // Ottieni tutti i canali monitorati
      const fs = require('fs');
      const path = require('path');
      const monitoredChannelsPath = path.join(process.cwd(), 'monitored-channels.json');
      
      try {
        const monitoredChannelsData = fs.readFileSync(monitoredChannelsPath, 'utf8');
        const monitoredChannels = JSON.parse(monitoredChannelsData);
        
        // Trova l'indice del canale corrente
        const channelIndex = monitoredChannels.channels.findIndex(
          channel => channel.id === channelConfig.channelId
        );
        
        if (channelIndex !== -1) {
          // Aggiungi Source: X, dove X è l'indice del canale (partendo da 1 per facilità d'uso)
          finalCaption += `\n\n📱 Source: ${channelIndex + 1}`;
        } else {
          // Fallback nel caso in cui il canale non fosse trovato nell'array
          finalCaption += `\n\n📱 Source: Unknown`;
        }
      } catch (error) {
        // In caso di errore, usa un formato generico
        finalCaption += `\n\n📱 Source: Unknown`;
        logger.error(`Errore nella lettura del file monitored-channels.json: ${error.message}`);
      }
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
   * Pubblica un gruppo di media usando sendMediaGroup per mantenere un album unificato
   */
  /**
 * Pubblica un gruppo di media usando sendMediaGroup per mantenere un album unificato
 */
 /**
 * Pubblica un gruppo di media come un album unificato
 */
/**
 * Pubblica un gruppo di media come un album unificato
 */
async publishMediaGroup(groupData, channelConfig) {
  try {
    const userClient = this.telegramService.getUserClient();
    
    // Debug dettagliato del gruppo
    logger.info(`⚠️ Inizio pubblicazione gruppo con ${groupData.originalMessages.length} messaggi`);
    
    // Prepara il testo
    const caption = this.prepareCaption({
      text: groupData.text,
      price: groupData.price
    }, channelConfig);
    
    // Se non ci sono messaggi, esci
    if (!groupData.originalMessages || groupData.originalMessages.length === 0) {
      logger.warn('⚠️ Nessun messaggio originale trovato nel gruppo');
      return false;
    }
    
    // Più di un messaggio nel gruppo = album vero
    const isRealAlbum = groupData.originalMessages.length > 1;
    logger.info(`⚠️ Tipo pubblicazione: ${isRealAlbum ? 'ALBUM MULTIPLO' : 'MESSAGGIO SINGOLO'}`);
    
    // Registra gli ID dei messaggi
    const messageIds = groupData.originalMessages.map(m => m.id).join(', ');
    logger.info(`⚠️ Messaggi nel gruppo: ${messageIds}`);
    
    // Scarica tutti i media in parallelo
    const mediaPromises = groupData.originalMessages.map(async (msg, index) => {
      if (!msg.media) {
        logger.warn(`⚠️ Messaggio ${msg.id} senza media`);
        return null;
      }
      
      try {
        // Scarica il media
        const mediaBuffer = await userClient.downloadMedia(msg.media);
        if (!mediaBuffer || mediaBuffer.length === 0) {
          logger.warn(`⚠️ Download media fallito per messaggio ${msg.id}`);
          return null;
        }
        
        // Salva il media in un file temporaneo
        const filePath = await this.saveTempMediaFile(mediaBuffer, msg.media.className);
        logger.info(`⚠️ Media ${index+1}/${groupData.originalMessages.length} salvato: ${filePath}`);
        
        // Determina il tipo di media
        let type = 'photo';
        if (msg.media.className === 'MessageMediaVideo') {
          type = 'video';
        } else if (msg.media.className === 'MessageMediaDocument') {
          type = 'document';
        }
        
        return {
          path: filePath,
          type: type,
          isFirst: index === 0 // Primo messaggio del gruppo
        };
      } catch (error) {
        logger.error(`⚠️ Errore download media ${msg.id}: ${error.message}`);
        return null;
      }
    });
    
    // Attendi il completamento di tutti i download
    const mediaResults = await Promise.all(mediaPromises);
    
    // Filtra i media nulli (falliti)
    const mediaFiles = mediaResults.filter(m => m !== null);
    
    logger.info(`⚠️ Media scaricati con successo: ${mediaFiles.length}/${groupData.originalMessages.length}`);
    
    // Se non ci sono media validi, esci
    if (mediaFiles.length === 0) {
      logger.warn('⚠️ Nessun media valido da inviare');
      return false;
    }
    
    // CASO SINGOLO MEDIA: invia come messaggio normale
    if (mediaFiles.length === 1) {
      logger.info('⚠️ Invio come messaggio singolo');
      const media = mediaFiles[0];
      
      if (media.type === 'photo') {
        await this.sendPhoto(media.path, caption, channelConfig.destinationTopic);
      } else if (media.type === 'video') {
        await this.sendVideo(media.path, caption, channelConfig.destinationTopic);
      } else {
        await this.sendDocument(media.path, caption, channelConfig.destinationTopic);
      }
      
      // Pulisci il file
      await this.cleanupTempFile(media.path);
      
      logger.info('⚠️ Messaggio singolo inviato con successo');
      return true;
    }
    
    // CASO ALBUM: usa sendMediaGroup per inviare come album
    if (isRealAlbum) {
      logger.info(`⚠️ Invio come album unificato (${mediaFiles.length} media)`);
      
      // Se ci sono più di 10 media, limitiamo a 10 (limite API Telegram)
      if (mediaFiles.length > 10) {
        logger.warn(`⚠️ Troppi media (${mediaFiles.length}), limitato a 10`);
        mediaFiles.splice(10); // Mantieni solo i primi 10
      }
      
      // Prepara l'array di input per sendMediaGroup
      const mediaInputs = mediaFiles.map((media, index) => {
        const mediaItem = {
          type: media.type,
          media: `attach://${path.basename(media.path)}`
        };
        
        // Aggiungi caption solo al primo elemento
        if (index === 0) {
          mediaItem.caption = caption;
          mediaItem.parse_mode = 'HTML';
        }
        
        return mediaItem;
      });
      
      logger.info(`⚠️ Invio album con ${mediaInputs.length} media`);
      
      try {
        // Prepara la form per l'invio
        const formData = new FormData();
        formData.append('chat_id', this.destinationChannelId);
        if (channelConfig.destinationTopic) {
          formData.append('message_thread_id', channelConfig.destinationTopic);
        }
        formData.append('media', JSON.stringify(mediaInputs));
        
        // Aggiungi tutti i file alla form
        for (const media of mediaFiles) {
          formData.append(path.basename(media.path), fs.createReadStream(media.path));
        }
        
        // Invia l'album
        const url = `https://api.telegram.org/bot${this.botToken}/sendMediaGroup`;
        const response = await axios.post(url, formData, {
          headers: formData.getHeaders(),
          maxBodyLength: Infinity,
          maxContentLength: Infinity
        });
        
        logger.info(`⚠️ Album inviato con successo: ${response.status}`);
        
        // Pulisci i file
        for (const media of mediaFiles) {
          await this.cleanupTempFile(media.path);
        }
        
        return true;
      } catch (error) {
        logger.error(`⚠️ Errore invio album: ${error.message}`);
        
        // FALLBACK: invio sequenziale come risposte
        logger.info('⚠️ Fallback: invio sequenziale come risposte');
        
        let firstMessageId = null;
        
        // Invia il primo media con caption
        const firstMedia = mediaFiles[0];
        try {
          let response;
          if (firstMedia.type === 'photo') {
            response = await this.sendPhoto(firstMedia.path, caption, channelConfig.destinationTopic);
          } else if (firstMedia.type === 'video') {
            response = await this.sendVideo(firstMedia.path, caption, channelConfig.destinationTopic);
          } else {
            response = await this.sendDocument(firstMedia.path, caption, channelConfig.destinationTopic);
          }
          
          await this.cleanupTempFile(firstMedia.path);
          
          // Ottieni l'ID del messaggio inviato
          if (response && response.result && response.result.message_id) {
            firstMessageId = response.result.message_id;
            logger.info(`⚠️ Primo media inviato con ID: ${firstMessageId}`);
          }
        } catch (err) {
          logger.error(`⚠️ Errore invio primo media: ${err.message}`);
          // Pulisci i file rimanenti e esci
          for (const media of mediaFiles) {
            await this.cleanupTempFile(media.path);
          }
          return false;
        }
        
        // Se non abbiamo l'ID del primo messaggio, pulisci e esci
        if (!firstMessageId) {
          logger.error('⚠️ Impossibile ottenere ID primo messaggio');
          // Pulisci i file rimanenti
          for (let i = 1; i < mediaFiles.length; i++) {
            await this.cleanupTempFile(mediaFiles[i].path);
          }
          return false;
        }
        
        // Invia i media rimanenti come risposte al primo
        for (let i = 1; i < mediaFiles.length; i++) {
          const media = mediaFiles[i];
          
          try {
            const formData = new FormData();
            formData.append('chat_id', this.destinationChannelId);
            if (channelConfig.destinationTopic) {
              formData.append('message_thread_id', channelConfig.destinationTopic);
            }
            formData.append('reply_to_message_id', firstMessageId);
            
            let url;
            if (media.type === 'photo') {
              url = `https://api.telegram.org/bot${this.botToken}/sendPhoto`;
              formData.append('photo', fs.createReadStream(media.path));
            } else if (media.type === 'video') {
              url = `https://api.telegram.org/bot${this.botToken}/sendVideo`;
              formData.append('video', fs.createReadStream(media.path));
            } else {
              url = `https://api.telegram.org/bot${this.botToken}/sendDocument`;
              formData.append('document', fs.createReadStream(media.path));
            }
            
            await axios.post(url, formData, {
              headers: formData.getHeaders()
            });
            
            logger.info(`⚠️ Media ${i+1} inviato come risposta`);
          } catch (err) {
            logger.error(`⚠️ Errore invio media ${i+1}: ${err.message}`);
          } finally {
            await this.cleanupTempFile(media.path);
          }
        }
        
        return true;
      }
    }
    
    return true;
  } catch (error) {
    logger.error(`⚠️ ERRORE CRITICO pubblicazione gruppo: ${error.message}`);
    return false;
  }
}

  async sendReplyMedia(message, replyToMessageId, channelConfig) {
    try {
      const userClient = this.telegramService.getUserClient();
      
      // Scarica il media
      const mediaBuffer = await userClient.downloadMedia(message.media);
      if (!mediaBuffer || mediaBuffer.length === 0) {
        logger.warn(`Download media fallito per messaggio ${message.id}`);
        return;
      }
      
      // Salva il media in un file temporaneo
      const filePath = await this.saveTempMediaFile(mediaBuffer, message.media.className);
      
      // Prepara la form
      const formData = new FormData();
      formData.append('chat_id', this.destinationChannelId);
      if (channelConfig.destinationTopic) {
        formData.append('message_thread_id', channelConfig.destinationTopic);
      }
      formData.append('reply_to_message_id', replyToMessageId);
      
      // Determina il tipo di media e invia
      let url;
      if (message.media.className === 'MessageMediaPhoto') {
        url = `https://api.telegram.org/bot${this.botToken}/sendPhoto`;
        formData.append('photo', fs.createReadStream(filePath));
      } else if (message.media.className === 'MessageMediaVideo') {
        url = `https://api.telegram.org/bot${this.botToken}/sendVideo`;
        formData.append('video', fs.createReadStream(filePath));
      } else {
        url = `https://api.telegram.org/bot${this.botToken}/sendDocument`;
        formData.append('document', fs.createReadStream(filePath));
      }
      
      // Invia il media
      await axios.post(url, formData, {
        headers: formData.getHeaders()
      });
      
      logger.info(`Media ${message.id} inviato come risposta a ${replyToMessageId}`);
      
      // Pulisci il file
      await this.cleanupTempFile(filePath);
    } catch (error) {
      logger.error(`Errore invio media ${message.id} come risposta: ${error.message}`);
    }
  }
  
}

module.exports = MediaProcessor;