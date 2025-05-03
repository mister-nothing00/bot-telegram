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
    
    // Cache per i gruppi di media
    // Struttura: Map<groupId, { media: [], text: '', timestamp: Date, ... }>
    const mediaGroups = new Map();
    
    // Cleanup periodico dei gruppi di media non completati
    setInterval(() => {
      const now = Date.now();
      for (const [groupId, group] of mediaGroups.entries()) {
        // Rimuovi gruppi più vecchi di 5 minuti
        if (now - group.timestamp > 300000) {
          logger.warn(`Gruppo media ${groupId} scaduto dopo 5 minuti - rimosso`);
          mediaGroups.delete(groupId);
        }
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
function handleGroupedMessage(mediaGroups, processedContent, channelConfig, message, mediaProcessor, channelController) {
  const groupId = processedContent.groupedId;
  const channelId = `-100${message.peerId.channelId}`;
  
  // Se il gruppo non esiste ancora, crealo
  if (!mediaGroups.has(groupId)) {
    mediaGroups.set(groupId, {
      media: [],
      text: processedContent.text,
      price: processedContent.price,
      channelConfig: channelConfig,
      originalMessages: [],
      timestamp: Date.now(),
    });
  }
  
  // Aggiungi il messaggio corrente al gruppo
  const group = mediaGroups.get(groupId);
  if (processedContent.media && processedContent.media.length > 0) {
    group.media.push(...processedContent.media);
  }
  
  // Se c'è un testo migliore, usalo
  if (processedContent.text && (!group.text || processedContent.text.length > group.text.length)) {
    group.text = processedContent.text;
  }
  
  // Conserva il messaggio originale
  group.originalMessages.push(message);
  
  // Marca il messaggio come processato
  channelController.markMessageAsProcessed(message.id, channelId);
  
  // Attendi un breve periodo per raccogliere tutti i media
  setTimeout(async () => {
    // Verifica se il gruppo esiste ancora e non è già stato pubblicato
    if (mediaGroups.has(groupId)) {
      const groupData = mediaGroups.get(groupId);
      
      // Pubblica solo se ci sono media o testo
      if (groupData.media.length > 0 || groupData.text) {
        logger.info(`Pubblicazione gruppo media ${groupId} (${groupData.media.length} media)`);
        
        // Pubblica il gruppo come un unico post
        const published = await mediaProcessor.publishMediaGroup(
          groupData,
          channelConfig
        );
        
        if (published) {
          logger.info(`Gruppo di messaggi ${groupId} pubblicato con successo`);
        } else {
          logger.error(`Errore nella pubblicazione del gruppo ${groupId}`);
        }
      }
      
      // Rimuovi il gruppo dalla cache
      mediaGroups.delete(groupId);
    }
  }, 2000); // Attendi 2 secondi per raccogliere tutto il gruppo
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
