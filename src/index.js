/**
 * Monitor Bot Telegram
 * 
 * Questo bot monitora canali Telegram selezionati e ripubblica i contenuti
 * in un canale di destinazione, rimuovendo link, riferimenti esterni e
 * applicando markup ai prezzi.
 */
const express = require("express");
const { NewMessage } = require("telegram/events");
const config = require("./config");
const connectDB = require("./config/database");
const telegramService = require("./services/telegram");
const MediaProcessor = require("./services/mediaProcessor");
const channelController = require("./controllers/channelController");
const logger = require("./utils/logger");

// Imposta il livello di logging in base all'ambiente
logger.level = config.server.env === "production" ? "info" : "debug";

// Inizializza l'app Express
const app = express();
app.use(express.json());

/**
 * Funzione principale che avvia il bot
 */
async function main() {
  try {
    logger.info("🚀 Avvio Monitor Bot Telegram");
    
    // Connessione al database MongoDB
    await connectDB();
    logger.info("📊 MongoDB connesso");
    
    // Inizializzazione del servizio Telegram
    const telegramInitialized = await telegramService.initialize();
    if (!telegramInitialized) {
      throw new Error("Impossibile inizializzare Telegram");
    }
    logger.info("🔌 Telegram inizializzato");
    
    const userClient = telegramService.getUserClient();
    if (!userClient) {
      throw new Error("User client non disponibile");
    }
    
    // Inizializzazione del processore di media
    const mediaProcessor = new MediaProcessor(telegramService);
    
    // Verifica permessi del bot nel canale di destinazione
    verifyBotPermissions();
    
    // Cache per i gruppi di media - usa Map<string, object> per i gruppi
    const mediaGroups = new Map();
    
    // Cleanup periodico dei gruppi di media non completati
    setInterval(() => {
      const now = Date.now();
      let groupsRemoved = 0;
      
      for (const [groupId, group] of mediaGroups.entries()) {
        // Rimuovi gruppi più vecchi di 5 minuti
        if (now - group.timestamp > 300000) {
          // Cancella eventuali timer in sospeso
          if (group.timerId) {
            clearTimeout(group.timerId);
          }
          
          mediaGroups.delete(groupId);
          groupsRemoved++;
        }
      }
      
      if (groupsRemoved > 0) {
        logger.warn(`⚠️ Rimossi ${groupsRemoved} gruppi scaduti dopo 5 minuti`);
      }
    }, 60000); // Controllo ogni minuto
    
    // Handler per i nuovi messaggi dai canali monitorati
    userClient.addEventHandler(async (event) => {
      try {
        const message = event.message;
        
        // Ignora eventi senza messaggio
        if (!message) {
          return;
        }
        
        // Verifica che sia un messaggio da un canale
        if (!message.peerId || !message.peerId.channelId) {
          return;
        }
        
        // Estrai l'ID del canale
        const channelId = `-100${message.peerId.channelId}`;
        
        logger.debug(`Messaggio ricevuto da: ${channelId}, ID: ${message.id}`);
        
        // Verifica se il canale è monitorato
        const channelConfig = await channelController.getChannelConfig(channelId);
        if (!channelConfig || !channelConfig.active) {
          return;
        }
        
        logger.info(`✅ Messaggio dal canale monitorato: ${channelConfig.channelName}`);
        
        // Verifica se il messaggio è già stato processato
        const isProcessed = await channelController.isMessageProcessed(message.id, channelId);
        if (isProcessed) {
          logger.debug(`Messaggio ${message.id} già processato`);
          return;
        }
        
        // Processa il messaggio
        const processedContent = await mediaProcessor.processMessage(message, channelConfig);
        if (!processedContent) {
          logger.warn(`Impossibile processare il messaggio ${message.id}`);
          return;
        }
        
        // Gestione messaggi raggruppati (album di foto)
        if (processedContent.groupedId) {
          handleGroupedMessage(mediaGroups, processedContent, channelConfig, message, mediaProcessor, channelController);
        } else {
          // Pubblica messaggio singolo
          const published = await mediaProcessor.publishToDestination(
            processedContent,
            channelConfig,
            message
          );
          
          if (published) {
            await channelController.markMessageAsProcessed(message.id, channelId);
            logger.info(`Messaggio ${message.id} pubblicato con successo`);
          } else {
            logger.error(`Errore nella pubblicazione del messaggio ${message.id}`);
          }
        }
      } catch (error) {
        logger.error(`Errore nell'handler di messaggi: ${error.message}`, error);
      }
    }, new NewMessage({}));
    
    // Configura le routes dell'API
    setupApiRoutes(app);
    
    // Avvia il server Express
    app.listen(config.server.port, () => {
      logger.info(`Server in ascolto sulla porta ${config.server.port}`);
    });
  } catch (error) {
    logger.error(`Errore di avvio: ${error.message}`, error);
    process.exit(1);
  }
}

/**
 * Verifica i permessi del bot nel canale di destinazione
 */
async function verifyBotPermissions() {
  try {
    const bot = telegramService.getBot();
    await bot.init();
    
    const destChannelId = config.telegram.destinationChannelId;
    
    // Verificare se il bot ha accesso al canale
    const chat = await bot.api.getChat(destChannelId);
    logger.info(`Bot ha accesso al canale: ${chat.title}`);
    
    // Verificare i permessi del bot
    const botMember = await bot.api.getChatMember(destChannelId, bot.botInfo.id);
    logger.info(`Bot status nel canale: ${botMember.status}`);
    
    if (botMember.status !== 'administrator') {
      logger.warn(`Il bot non è amministratore nel canale di destinazione. Alcune funzionalità potrebbero non funzionare.`);
    }
  } catch (error) {
    logger.error(`Errore verifica permessi bot: ${error.message}`);
  }
}

/**
 * Gestisce i messaggi raggruppati (album di foto)
 */
/**
 * Gestisce i messaggi raggruppati (album di foto)
 */
/**
 * Gestisce i messaggi raggruppati (album di foto) con maggior debug e attesa
 */
/**
 * Gestisce i messaggi raggruppati (album di foto) - VERSIONE CORRETTA
 */
/**
 * Gestisce i messaggi raggruppati (album di foto) - SOLUZIONE ALTERNATIVA
 */
function handleGroupedMessage(mediaGroups, processedContent, channelConfig, message, mediaProcessor, channelController) {
  // Converti l'ID del gruppo in una stringa
  const groupIdStr = String(processedContent.groupedId);
  const channelId = `-100${message.peerId.channelId}`;
  
  logger.info(`⚠️ Ricevuto messaggio ${message.id} del gruppo ${groupIdStr}`);
  
  // Verifica se il gruppo esiste già usando una chiave stringa
  if (!mediaGroups.has(groupIdStr)) {
    logger.info(`⚠️ Creazione NUOVO gruppo ${groupIdStr}`);
    
    // Crea un nuovo gruppo
    mediaGroups.set(groupIdStr, {
      media: [],
      text: processedContent.text,
      price: processedContent.price,
      channelConfig: channelConfig,
      originalMessages: [],
      timestamp: Date.now(),
      processed: false,
      timerId: null, // ID del timer per poterlo cancellare
      messagesCount: 0
    });
    
    // Imposta un timer per elaborare il gruppo dopo X secondi
    const timeoutId = setTimeout(() => processGroup(groupIdStr, mediaGroups, mediaProcessor), 15000);
    mediaGroups.get(groupIdStr).timerId = timeoutId;
    
    logger.info(`⚠️ Timer impostato per gruppo ${groupIdStr} (15s)`);
  } else {
    logger.info(`⚠️ Aggiunta a gruppo ESISTENTE ${groupIdStr}`);
  }
  
  // Ottieni il gruppo esistente
  const group = mediaGroups.get(groupIdStr);
  
  // Aggiungi il media al gruppo
  if (processedContent.media && processedContent.media.length > 0) {
    group.media.push(...processedContent.media);
  }
  
  // Se c'è un testo migliore, usalo
  if (processedContent.text && (!group.text || processedContent.text.length > group.text.length)) {
    group.text = processedContent.text;
  }
  
  // Se c'è un prezzo e non c'era, aggiungilo
  if (processedContent.price && !group.price) {
    group.price = processedContent.price;
  }
  
  // Aggiungi il messaggio originale
  group.originalMessages.push(message);
  group.messagesCount++;
  
  // Aggiorna il gruppo nella mappa
  mediaGroups.set(groupIdStr, group);
  
  logger.info(`⚠️ Gruppo ${groupIdStr} ora ha ${group.messagesCount} messaggi`);
  
  // Marca il messaggio come processato
  channelController.markMessageAsProcessed(message.id, channelId);
}


/**
 * Funzione separata per elaborare il gruppo - chiamata dal timer
 */
async function processGroup(groupIdStr, mediaGroups, mediaProcessor) {
  // Verifica se il gruppo esiste ancora e non è già stato elaborato
  if (!mediaGroups.has(groupIdStr)) {
    logger.warn(`⚠️ Gruppo ${groupIdStr} non trovato per l'elaborazione`);
    return;
  }
  
  const group = mediaGroups.get(groupIdStr);
  
  // Se il gruppo è già stato elaborato, esci
  if (group.processed) {
    logger.warn(`⚠️ Gruppo ${groupIdStr} già elaborato, ignoro`);
    return;
  }
  
  // Marca il gruppo come elaborato
  group.processed = true;
  mediaGroups.set(groupIdStr, group);
  
  logger.info(`⚠️ ELABORAZIONE gruppo ${groupIdStr} con ${group.messagesCount} messaggi`);
  
  // Pubblica il gruppo
  if (group.originalMessages.length > 0) {
    logger.info(`⚠️ Pubblicazione gruppo ${groupIdStr}`);
    
    try {
      const published = await mediaProcessor.publishMediaGroup(group, group.channelConfig);
      
      if (published) {
        logger.info(`⚠️ Pubblicazione gruppo ${groupIdStr} RIUSCITA`);
      } else {
        logger.error(`⚠️ Pubblicazione gruppo ${groupIdStr} FALLITA`);
      }
    } catch (error) {
      logger.error(`⚠️ Errore elaborazione gruppo ${groupIdStr}: ${error.message}`);
    }
  } else {
    logger.warn(`⚠️ Gruppo ${groupIdStr} vuoto, nessun messaggio da pubblicare`);
  }
  
  // Rimuovi il gruppo dalla mappa
  mediaGroups.delete(groupIdStr);
  logger.info(`⚠️ Gruppo ${groupIdStr} rimosso dalla mappa`);
}

/**
 * Configura le route dell'API
 */
function setupApiRoutes(app) {
  // Ottieni tutti i canali
  app.get("/api/channels", async (req, res) => {
    try {
      const channels = await channelController.getAllChannels();
      res.json({ success: true, channels });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Aggiungi un nuovo canale
  app.post("/api/channels", async (req, res) => {
    try {
      const { channelId, channelName, options } = req.body;
      const channel = await channelController.addChannel(channelId, channelName, options);
      res.json({ success: true, channel });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Aggiorna un canale esistente
  app.put("/api/channels/:channelId", async (req, res) => {
    try {
      const { options } = req.body;
      const result = await channelController.updateChannel(req.params.channelId, options);
      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Rimuovi un canale
  app.delete("/api/channels/:channelId", async (req, res) => {
    try {
      const result = await channelController.removeChannel(req.params.channelId);
      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Dashboard semplice
  app.get("/", (req, res) => {
    res.send(`
      <html>
        <head><title>Monitor Bot Telegram</title></head>
        <body>
          <h1>Monitor Bot Telegram</h1>
          <p>Il bot è attivo e in esecuzione. Accedi all'API per gestire i canali.</p>
        </body>
      </html>
    `);
  });
}

// Avvia l'applicazione
main();
