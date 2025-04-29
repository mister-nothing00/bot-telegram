const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { Api } = require('telegram/tl');
const config = require('../config');
const logger = require('../utils/logger');
const { Bot } = require('grammy');
const input = require('input');

class TelegramService {
  constructor() {
    this.userClient = null;
    this.bot = null;
  }

  async initialize() {
    try {
      // Inizializza User Client
      let stringSession;
      
      if (config.telegram.stringSession && config.telegram.stringSession !== 'your_string_session') {
        stringSession = new StringSession(config.telegram.stringSession);
      } else {
        stringSession = new StringSession('');
      }
      
      this.userClient = new TelegramClient(
        stringSession,
        config.telegram.apiId,
        config.telegram.apiHash,
        {
          connectionRetries: 5,
          useWSS: false // Aggiungi questa opzione
        }
      );

      await this.userClient.connect();
      logger.info("User client connesso con sessione esistente");

      // Inizializza Bot
      this.bot = new Bot(config.telegram.botToken);
      await this.bot.init(); // Inizializza il bot
      logger.info("Bot inizializzato");

      return true;
    } catch (error) {
      logger.error("Errore inizializzazione Telegram:", error);
      return false;
    }
  }

  getUserClient() {
    return this.userClient;
  }

  getBot() {
    return this.bot;
  }
}

module.exports = new TelegramService();