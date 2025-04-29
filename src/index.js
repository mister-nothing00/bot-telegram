const express = require("express");
const { NewMessage } = require("telegram/events");
const config = require("./config");
const connectDB = require("./config/database");
const telegramService = require("./services/telegram");
const MediaProcessor = require("./services/mediaProcessor");
const channelController = require("./controllers/channelController");
const logger = require("./utils/logger");

// Abilita debug logging
logger.level = "debug";

const app = express();
app.use(express.json());

async function main() {
  try {
    // Connetti al database
    await connectDB();

    // Inizializza Telegram
    const telegramInitialized = await telegramService.initialize();

    if (!telegramInitialized) {
      throw new Error("Impossibile inizializzare Telegram");
    }

    const userClient = telegramService.getUserClient();
    if (!userClient) {
      throw new Error("User client non disponibile");
    }

    const mediaProcessor = new MediaProcessor(telegramService);

    // Verifica permessi bot nel canale di destinazione
    (async () => {
      try {
        const bot = telegramService.getBot();
        await bot.init();
        const chat = await bot.api.getChat("-1002562147025");
        console.log(`✅ Bot ha accesso al canale: ${chat.title}`);

        const botMember = await bot.api.getChatMember(
          "-1002562147025",
          bot.botInfo.id
        );
        console.log(`✅ Bot status: ${botMember.status}`);
      } catch (error) {
        console.error("❌ Errore verifica permessi bot:", error);
      }
    })();

    // Cache per gruppi di media
    const mediaGroups = new Map();

    // Debug handler per tutti gli eventi
    userClient.addEventHandler(async (event) => {
      console.log("🌟 Evento ricevuto");
    });

    // Monitora i messaggi dai canali
    userClient.addEventHandler(async (event) => {
      try {
        const message = event.message;

        console.log("🔍 Elaborazione evento..."); // Debug

        if (!message) {
          logger.debug("Evento senza messaggio");
          return;
        }

        if (!message.peerId) {
          logger.debug("Messaggio senza peerId");
          return;
        }

        const channelId = message.peerId.channelId
          ? `-100${message.peerId.channelId}`
          : null;

        if (!channelId) {
          logger.debug("Messaggio non da un canale");
          return;
        }

        logger.info(`🆕 Nuovo messaggio dal canale: ${channelId}`);
        console.log(`📝 Contenuto: ${message.message?.substring(0, 50)}...`);

        // Verifica se il canale è monitorato
        const channelConfig = await channelController.getChannelConfig(
          channelId
        );

        if (!channelConfig) {
          logger.debug(`❌ Canale ${channelId} non trovato nel database`);
          const channels = await channelController.getActiveChannels();
          console.log(
            "Canali monitorati:",
            channels.map((c) => c.channelId)
          );
          return;
        }

        if (!channelConfig.active) {
          logger.debug(`⏸️ Canale ${channelId} non attivo`);
          return;
        }

        logger.info(
          `✅ Canale ${channelConfig.channelName} è monitorato - processamento messaggio`
        );

        // Verifica se il messaggio è già stato processato
        const isProcessed = await channelController.isMessageProcessed(
          message.id,
          channelId
        );
        if (isProcessed) {
          logger.debug(`♻️ Messaggio ${message.id} già processato`);
          return;
        }

        // Processa il messaggio
        const processedContent = await mediaProcessor.processMessage(
          message,
          channelConfig
        );
        if (!processedContent) {
          logger.warn(`⚠️ Impossibile processare il messaggio ${message.id}`);
          return;
        }

        logger.info(`📤 Tentativo di pubblicazione nel topic Articoli`);
        console.log(
          "Contenuto processato:",
          JSON.stringify(processedContent, null, 2)
        );

        // Gestisci gruppi di media
        if (processedContent.groupedId) {
          if (!mediaGroups.has(processedContent.groupedId)) {
            mediaGroups.set(processedContent.groupedId, {
              media: [],
              text: processedContent.text,
              price: processedContent.price,
              channelConfig: channelConfig,
              originalMessage: message,
              timestamp: Date.now(),
            });
          }

          const group = mediaGroups.get(processedContent.groupedId);
          group.media.push(...(processedContent.media || []));

          // Attendi per raccogliere tutti i media del gruppo
          setTimeout(async () => {
            if (mediaGroups.has(processedContent.groupedId)) {
              const groupData = mediaGroups.get(processedContent.groupedId);
              const published = await mediaProcessor.publishToDestination(
                groupData,
                channelConfig,
                groupData.originalMessage
              );
              if (published) {
                logger.info(
                  `✅ Gruppo di messaggi pubblicato dal canale ${channelId}`
                );
              }
              mediaGroups.delete(processedContent.groupedId);
            }
          }, 2000);

          await channelController.markMessageAsProcessed(message.id, channelId);
        } else {
          // Pubblica singolo messaggio
          const published = await mediaProcessor.publishToDestination(
            processedContent,
            channelConfig,
            message
          );
          if (published) {
            await channelController.markMessageAsProcessed(
              message.id,
              channelId
            );
            logger.info(
              `✅ Messaggio processato e pubblicato dal canale ${channelId}`
            );
          }
        }
      } catch (error) {
        logger.error(`❌ Errore nell'handler: ${error.message}`, error);
        console.error('Stack trace completo:', error);
      }
    }, new NewMessage({}));

    // API Routes
    app.post("/api/channels", async (req, res) => {
      try {
        const { channelId, channelName, options } = req.body;
        const channel = await channelController.addChannel(
          channelId,
          channelName,
          options
        );
        res.json({ success: true, channel });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    app.get("/api/channels", async (req, res) => {
      try {
        const channels = await channelController.getActiveChannels();
        res.json({ success: true, channels });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    app.delete("/api/channels/:channelId", async (req, res) => {
      try {
        const result = await channelController.removeChannel(
          req.params.channelId
        );
        res.json({ success: true, result });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Avvia il server
    app.listen(config.server.port, () => {
      logger.info(`Server in ascolto sulla porta ${config.server.port}`);
    });
  } catch (error) {
    logger.error("Errore di avvio:", error);
    process.exit(1);
  }
}

main();
