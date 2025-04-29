// mediaProcessor.js ottimizzato
const logger = require('../utils/logger');
const contentCleaner = require('./contentCleaner');

class MediaProcessor {
  constructor(telegramService) {
    this.telegramService = telegramService;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
  }

  async processMessage(message, channelConfig) {
    try {
      const processedContent = {
        text: '',
        price: null,
        groupedId: message.groupedId
      };

      if (message.message && channelConfig.includeText) {
        processedContent.text = contentCleaner.removeLinks(message.message);
        
        if (channelConfig.includePrice) {
          const extractedPrice = contentCleaner.extractPrice(message.message, channelConfig.priceRegex);
          if (extractedPrice) {
            processedContent.price = contentCleaner.applyMarkup(extractedPrice, 17);
          }
        }
      }

      return processedContent;
    } catch (error) {
      logger.error('Errore processamento messaggio:', error);
      return null;
    }
  }

  async publishToDestination(processedContent, channelConfig, originalMessage) {
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const bot = this.telegramService.getBot();
        const userClient = this.telegramService.getUserClient();
        const destinationChannelId = require('../config').telegram.destinationChannelId;
        
        // Prepara il caption
        let caption = this.prepareCaption(processedContent);
        
        if (originalMessage.media) {
          // Forward media con retry
          const forwarded = await this.forwardWithRetry(
            userClient,
            destinationChannelId,
            originalMessage
          );
          
          if (channelConfig.destinationTopic && forwarded[0]) {
            await this.sendToTopicWithFallback(
              bot,
              destinationChannelId,
              caption,
              channelConfig.destinationTopic,
              forwarded[0].id
            );
          }
        } else {
          // Invia messaggio di testo
          await this.sendToTopicWithFallback(
            bot,
            destinationChannelId,
            caption,
            channelConfig.destinationTopic
          );
        }
        
        return true;
      } catch (error) {
        logger.warn(`Tentativo ${attempt}/${this.retryAttempts} fallito:`, error);
        if (attempt < this.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
        }
      }
    }
    
    logger.error('Tutti i tentativi di pubblicazione falliti');
    return false;
  }

  prepareCaption(processedContent) {
    let caption = processedContent.text;
    
    if (processedContent.price) {
      caption = caption.replace(/Price:\s*.*?(?=\n|$)/i, '').trim();
      caption += `\n\n💰 Prezzo: ${processedContent.price.final} ${processedContent.price.currency}`;
      caption += `\n📈 (+${((processedContent.price.markup / processedContent.price.original) * 100).toFixed(0)}% markup)`;
    }
    
    return caption;
  }

  async forwardWithRetry(userClient, destinationChannelId, originalMessage) {
    return await userClient.forwardMessages(
      destinationChannelId,
      {
        messages: [originalMessage.id],
        fromPeer: originalMessage.peerId,
        dropAuthor: true
      }
    );
  }

  async sendToTopicWithFallback(bot, channelId, message, topicId, replyTo = null) {
    try {
      const messageOptions = {};
      
      if (topicId) {
        messageOptions.message_thread_id = topicId;
      }
      
      if (replyTo) {
        messageOptions.reply_to_message_id = replyTo;
      }
      
      await bot.api.sendMessage(channelId, message, messageOptions);
    } catch (error) {
      logger.warn('Fallback al canale principale');
      await bot.api.sendMessage(channelId, message);
    }
  }
}

module.exports = MediaProcessor;



