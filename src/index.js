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

/*

ultimo messsaggio di errore della console 

tarting `node src/index.js`
2025-04-29 17:10:45 [info]: 🚀 Avvio Monitor Bot Telegram 
2025-04-29 17:10:47 [info]: MongoDB connesso 
2025-04-29 17:10:47 [info]: 📊 MongoDB connesso
[2025-04-29T17:10:47.144] [INFO] - [Running gramJS version 2.26.21]
[2025-04-29T17:10:47.156] [INFO] - [Connecting to 149.154.167.91:80/TCPFull...]
[2025-04-29T17:10:47.237] [INFO] - [Connection to 149.154.167.91:80/TCPFull complete!]
[2025-04-29T17:10:47.238] [INFO] - [Using LAYER 198 for initial connect]
2025-04-29 17:10:47 [info]: User client connesso con sessione esistente 
2025-04-29 17:10:48 [info]: Bot inizializzato 
2025-04-29 17:10:48 [info]: 🔌 Telegram inizializzato
2025-04-29 17:10:48 [info]: Server in ascolto sulla porta 3000
2025-04-29 17:10:48 [info]: Bot ha accesso al canale: LAFENICE RESELLING 
2025-04-29 17:10:48 [info]: Bot status nel canale: administrator 
2025-04-29 17:12:24 [debug]: Messaggio ricevuto da: -1002562147025, ID: 114 
2025-04-29 17:12:35 [debug]: Messaggio ricevuto da: -1001709917801, ID: 101077 
2025-04-29 17:12:35 [debug]: Messaggio ricevuto da: -1001709917801, ID: 101078
2025-04-29 17:12:35 [debug]: Messaggio ricevuto da: -1001709917801, ID: 101076
2025-04-29 17:12:35 [debug]: Messaggio ricevuto da: -1001709917801, ID: 101075 
2025-04-29 17:12:35 [info]: ✅ Messaggio dal canale monitorato: Pandabuy-HOOBUY-ALLCHINABUY-CNFANSBUY FIND ACBUY 
2025-04-29 17:12:35 [info]: ✅ Messaggio dal canale monitorato: Pandabuy-HOOBUY-ALLCHINABUY-CNFANSBUY FIND ACBUY
2025-04-29 17:12:36 [debug]: Processamento messaggio ID: 101077 
2025-04-29 17:12:36 [debug]: Media trovato di tipo: MessageMediaPhoto
2025-04-29 17:12:36 [debug]: Processamento messaggio ID: 101078 
2025-04-29 17:12:36 [debug]: Media trovato di tipo: MessageMediaPhoto
2025-04-29 17:12:36 [debug]: Messaggio 101077 marcato come processato 
2025-04-29 17:12:36 [debug]: Messaggio 101078 marcato come processato
2025-04-29 17:12:36 [info]: ✅ Messaggio dal canale monitorato: Pandabuy-HOOBUY-ALLCHINABUY-CNFANSBUY FIND ACBUY 
2025-04-29 17:12:36 [info]: ✅ Messaggio dal canale monitorato: Pandabuy-HOOBUY-ALLCHINABUY-CNFANSBUY FIND ACBUY 
2025-04-29 17:12:36 [debug]: Processamento messaggio ID: 101076
2025-04-29 17:12:36 [debug]: Media trovato di tipo: MessageMediaPhoto
2025-04-29 17:12:37 [debug]: Processamento messaggio ID: 101075 
2025-04-29 17:12:37 [debug]: Prezzo estratto: {"original":15.11,"markup":2.5687,"final":17.68,"currency":"$"}
2025-04-29 17:12:37 [debug]: Media trovato di tipo: MessageMediaPhoto
2025-04-29 17:12:37 [debug]: Messaggio 101076 marcato come processato 
2025-04-29 17:12:37 [debug]: Messaggio 101075 marcato come processato 
2025-04-29 17:12:38 [info]: Pubblicazione gruppo media 13967516440485801 (1 media) 
2025-04-29 17:12:38 [debug]: Preparazione gruppo media: 1 messaggi
2025-04-29 17:12:38 [debug]: Tentativo download media di tipo: MessageMediaPhoto
[2025-04-29T17:12:38.108] [INFO] - [Starting direct file download in chunks of 131072 at 0, stride 131072]
2025-04-29 17:12:38 [info]: Pubblicazione gruppo media 13967516440485801 (1 media) 
2025-04-29 17:12:38 [debug]: Preparazione gruppo media: 1 messaggi
2025-04-29 17:12:38 [debug]: Tentativo download media di tipo: MessageMediaPhoto
[2025-04-29T17:12:38.126] [INFO] - [Starting direct file download in chunks of 131072 at 0, stride 131072]
[2025-04-29T17:12:38.230] [INFO] - [Connecting to 91.108.56.176:443/TCPFull...]
2025-04-29 17:12:39 [info]: Pubblicazione gruppo media 13967516440485801 (1 media) 
2025-04-29 17:12:39 [debug]: Preparazione gruppo media: 1 messaggi
2025-04-29 17:12:39 [debug]: Tentativo download media di tipo: MessageMediaPhoto
[2025-04-29T17:12:39.078] [INFO] - [Starting direct file download in chunks of 131072 at 0, stride 131072]
2025-04-29 17:12:39 [debug]: Messaggio ricevuto da: -1002562147025, ID: 115
2025-04-29 17:12:39 [info]: Pubblicazione gruppo media 13967516440485801 (1 media) 
2025-04-29 17:12:39 [debug]: Preparazione gruppo media: 1 messaggi
2025-04-29 17:12:39 [debug]: Tentativo download media di tipo: MessageMediaPhoto
[2025-04-29T17:12:39.198] [INFO] - [Starting direct file download in chunks of 131072 at 0, stride 131072]
[2025-04-29T17:12:40.821] [INFO] - [Connection to 91.108.56.176:443/TCPFull complete!]
[2025-04-29T17:12:40.822] [INFO] - [Exporting authorization for data center 91.108.56.176 with layer 198]
2025-04-29 17:12:53 [error]: Errore invio gruppo media: Call to 'sendMediaGroup' failed! (400: Bad Request: can't parse InputMedia: Field "media" must be of type String)
Error: TIMEOUT
    at D:\2K25\bot\node_modules\telegram\client\updates.js:250:85
    at async _updateLoop (D:\2K25\bot\node_modules\telegram\client\updates.js:191:17)
[2025-04-29T17:13:02.601] [INFO] - [Started reconnecting]
[2025-04-29T17:13:02.602] [WARN] - [[Reconnect] Closing current connection...]
[2025-04-29T17:13:02.604] [INFO] - [Disconnecting from 149.154.167.91:80/TCPFull...]
[2025-04-29T17:13:02.605] [WARN] - [Connection closed while receiving data]
Error: Not connected
    at ConnectionTCPFull.recv (D:\2K25\bot\node_modules\telegram\network\connection\Connection.js:71:15)
    at runNextTicks (node:internal/process/task_queues:60:5)
    at listOnTimeout (node:internal/timers:545:9)
    at process.processTimers (node:internal/timers:519:7)
    at async MTProtoSender._recvLoop (D:\2K25\bot\node_modules\telegram\network\MTProtoSender.js:373:24)
[2025-04-29T17:13:02.608] [INFO] - [Connecting to 149.154.167.91:80/TCPFull...]
[2025-04-29T17:13:02.610] [INFO] - [Started reconnecting]
[2025-04-29T17:13:02.610] [WARN] - [[Reconnect] Closing current connection...]
[2025-04-29T17:13:02.610] [INFO] - [Disconnecting from 91.108.56.176:443/TCPFull...]
[2025-04-29T17:13:02.613] [WARN] - [Connection closed while receiving data]
Error: Not connected
    at ConnectionTCPFull.recv (D:\2K25\bot\node_modules\telegram\network\connection\Connection.js:71:15)
    at async MTProtoSender._recvLoop (D:\2K25\bot\node_modules\telegram\network\MTProtoSender.js:373:24)
[2025-04-29T17:13:02.620] [INFO] - [Connecting to 91.108.56.176:443/TCPFull...]
[2025-04-29T17:13:02.622] [INFO] - [connection closed]
[2025-04-29T17:13:02.623] [INFO] - [connection closed]
[2025-04-29T17:13:06.661] [INFO] - [Connection to 149.154.167.91:80/TCPFull complete!]
[2025-04-29T17:13:06.662] [INFO] - [Handling reconnect!]
[2025-04-29T17:13:06.807] [INFO] - [Connection to 91.108.56.176:443/TCPFull complete!]
[2025-04-29T17:13:13.555] [WARN] - [Disconnecting...]
[2025-04-29T17:13:13.556] [INFO] - [Disconnecting from 91.108.56.176:443/TCPFull...]
[2025-04-29T17:13:13.557] [INFO] - [connection closed]
2025-04-29 17:13:15 [error]: Errore invio singolo: Call to 'sendPhoto' failed! (400: Bad Request: wrong remote file identifier specified: Wrong character in the string)
2025-04-29 17:13:15 [error]: Errore nella pubblicazione del gruppo 13967516440485801
2025-04-29 17:13:17 [error]: Errore invio gruppo media: Call to 'sendMediaGroup' failed! (400: Bad Request: can't parse InputMedia: Field "media" must be of type String)
2025-04-29 17:13:25 [error]: Errore invio singolo: Call to 'sendPhoto' failed! (400: Bad Request: wrong remote file identifier specified: Wrong string length)
2025-04-29 17:13:25 [error]: Errore nella pubblicazione del gruppo 13967516440485801
2025-04-29 17:13:26 [error]: Errore invio gruppo media: Call to 'sendMediaGroup' failed! (400: Bad Request: can't parse InputMedia: Field "media" must be of type String)
2025-04-29 17:13:36 [error]: Errore invio singolo: Call to 'sendPhoto' failed! (400: Bad Request: wrong remote file identifier specified: Wrong character in the string)
2025-04-29 17:13:36 [error]: Errore nella pubblicazione del gruppo 13967516440485801
2025-04-29 17:13:39 [error]: Errore invio gruppo media: Call to 'sendMediaGroup' failed! (400: Bad Request: can't parse InputMedia: Field "media" must be of type String)
2025-04-29 17:13:45 [error]: Errore invio singolo: Call to 'sendPhoto' failed! (400: Bad Request: wrong remote file identifier specified: Wrong string length)
2025-04-29 17:13:45 [error]: Errore nella pubblicazione del gruppo 13967516440485801


* */