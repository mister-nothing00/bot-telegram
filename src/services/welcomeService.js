/**
 * WelcomeService - Servizio per gestire i messaggi di benvenuto agli utenti
 * 
 * Responsabilità:
 * 1. Inviare messaggi di benvenuto personalizzati ai nuovi utenti
 * 2. Gestire le configurazioni del messaggio di benvenuto
 */
const telegramService = require('./telegram');
const config = require('../config');
const logger = require('../utils/logger');
let welcomeConfig;

// Cerca di caricare la configurazione del messaggio di benvenuto
try {
  welcomeConfig = require('../config/welcomeMessage');
} catch (error) {
  // Se non esiste, crea una configurazione predefinita
  welcomeConfig = {
    welcomeTopicId: 0,
    welcomeMessage: `Ciao {name}! 👋

Benvenuto nel nostro canale! Siamo felici di averti qui.

Ecco alcune informazioni utili:

📋 <b>**Regole**</b>: Nel topic "Rules" trovi tutte le regole del nostro canale. Ti preghiamo di leggerle.

🛒 <b>**Come acquistare**</b>: Nel topic "How to buy" trovi tutte le informazioni su come acquistare.

💬 <b>**Community**</b>: Nel topic "Community" puoi discutere con altri membri.

📝 <b>**Feedback/Report**</b>: Se hai riscontrato problemi o vuoi lasciare un feedback, usa il topic dedicato.

🔍 <b>**Articoli**</b>: Nel topic "Articoli" pubblichiamo i nuovi prodotti.

❓ <b>**Altro**</b>: Per qualsiasi altra domanda, usa il topic "Other".

Grazie e buona permanenza! 🎉`
  };
}

class WelcomeService {
  constructor() {
    this.welcomeTopicId = welcomeConfig.welcomeTopicId;
    this.welcomeMessage = welcomeConfig.welcomeMessage;
    this.destinationChannelId = config.telegram.destinationChannelId;
  }

  /**
   * Inizializza il servizio
   */
  async initialize() {
    try {
      logger.info('Servizio di benvenuto inizializzato');
      logger.info(`Topic Welcome configurato: ${this.welcomeTopicId}`);
      
      // Verifica se la configurazione è valida
      if (!this.welcomeTopicId || this.welcomeTopicId === 0) {
        logger.warn('ATTENZIONE: ID del topic Welcome non configurato. Utilizzare lo script setWelcomeTopic.js per configurarlo.');
      }
      
      return true;
    } catch (error) {
      logger.error(`Errore inizializzazione servizio benvenuto: ${error.message}`);
      return false;
    }
  }

  /**
   * Gestisce l'evento di iscrizione di un nuovo membro
   * @param {Object} newMember - Informazioni sul nuovo membro
   */
  async handleNewMember(newMember) {
    try {
      const name = newMember.firstName || newMember.username || 'nuovo utente';
      const userId = newMember.id;
      
      logger.info(`Nuovo membro rilevato: ${name} (${userId})`);
      
      // Personalizza il messaggio
      const personalizedMessage = this.personalizeMessage(this.welcomeMessage, newMember);
      
      // Invia il messaggio di benvenuto
      await this.sendWelcomeMessage(personalizedMessage, userId);
      
      logger.info(`Messaggio di benvenuto inviato all'utente ${name} (${userId})`);
    } catch (error) {
      logger.error(`Errore gestione nuovo membro: ${error.message}`);
    }
  }

  /**
   * Personalizza il messaggio di benvenuto
   * @param {String} message - Messaggio base
   * @param {Object} user - Dati dell'utente
   * @returns {String} Messaggio personalizzato
   */
  personalizeMessage(message, user) {
    const name = user.firstName || user.username || 'nuovo utente';
    
    // Sostituisci i placeholder nel messaggio
    return message
      .replace(/{name}/g, name)
      .replace(/{username}/g, user.username ? `@${user.username}` : name);
  }

  /**
   * Invia il messaggio di benvenuto
   * @param {String} message - Messaggio da inviare
   * @param {Number} userId - ID dell'utente per la menzione
   */
  async sendWelcomeMessage(message, userId) {
    try {
      const bot = telegramService.getBot();
      
      // Se non c'è un topic ID configurato, non possiamo inviare il messaggio
      if (!this.welcomeTopicId || this.welcomeTopicId === 0) {
        logger.error('Impossibile inviare messaggio di benvenuto: ID topic Welcome non configurato');
        return;
      }
      
      // Formatta il messaggio con menzione HTML e rimuovi gli asterischi (già utilizzati i tag HTML)
      const formattedMessage = `👋 <a href="tg://user?id=${userId}">Benvenuto!</a>\n\n${message.replace(/\*\*/g, '')}`;
      
      // Invia il messaggio nel topic Welcome usando HTML
      await bot.api.sendMessage(this.destinationChannelId, formattedMessage, {
        parse_mode: 'HTML',  // Usa HTML per la formattazione
        message_thread_id: this.welcomeTopicId
      });
      
      logger.info(`Messaggio di benvenuto inviato con successo al topic ${this.welcomeTopicId}`);
    } catch (error) {
      logger.error(`Errore invio messaggio benvenuto: ${error.message}`);
    }
  }
}

module.exports = new WelcomeService();