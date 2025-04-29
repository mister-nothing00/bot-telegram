// importMonitoredChannels.js
const mongoose = require('mongoose');
const Channel = require('./src/models/Channel');
const fs = require('fs').promises;
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { Api } = require('telegram/tl');
require('dotenv').config();

async function findTopicId(client, channelUsername, topicName) {
  try {
    const channel = await client.getEntity(channelUsername);
    const result = await client.invoke(
      new Api.channels.GetForumTopics({
        channel: channel,
        offsetDate: 0,
        offsetId: 0,
        offsetTopic: 0,
        limit: 100,
      })
    );
    
    const topic = result.topics.find(t => t.title.toLowerCase() === topicName.toLowerCase());
    return topic ? topic.id : null;
  } catch (error) {
    console.error('Errore nella ricerca del topic:', error);
    return null;
  }
}

async function importMonitoredChannels() {
  try {
    // Connetti a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connesso a MongoDB');

    // Leggi il file di configurazione
    const configData = await fs.readFile('./monitored-channels.json', 'utf8');
    const config = JSON.parse(configData);

    // Connetti a Telegram per trovare l'ID del topic "Articoli"
    const stringSession = new StringSession(process.env.TELEGRAM_STRING_SESSION);
    const client = new TelegramClient(stringSession, 
      parseInt(process.env.TELEGRAM_API_ID), 
      process.env.TELEGRAM_API_HASH, 
      { connectionRetries: 5 }
    );
    
    await client.connect();
    console.log('✅ Connesso a Telegram');

    // Trova l'ID del topic "Articoli"
    const topicId = await findTopicId(client, process.env.DESTINATION_CHANNEL_ID, config.destinationTopicName);
    
    if (topicId) {
      console.log(`✅ Trovato topic "${config.destinationTopicName}" con ID: ${topicId}`);
    } else {
      console.log(`❌ Topic "${config.destinationTopicName}" non trovato. Pubblicazione nel canale principale.`);
    }

    // Importa tutti i canali
    for (const channel of config.channels) {
      if (channel.active) {
        try {
          const existingChannel = await Channel.findOne({ channelId: channel.id });
          
          const channelData = {
            channelId: channel.id,
            channelName: channel.name,
            active: channel.active,
            mediaTypes: channel.mediaTypes,
            includeText: channel.includeText,
            includePrice: channel.includePrice,
            priceRegex: channel.priceRegex,
            destinationTopic: topicId // Usa l'ID del topic "Articoli"
          };
          
          if (existingChannel) {
            await Channel.updateOne({ channelId: channel.id }, channelData);
            console.log(`📝 Aggiornato canale: ${channel.name}`);
          } else {
            await Channel.create(channelData);
            console.log(`➕ Aggiunto nuovo canale: ${channel.name}`);
          }
        } catch (error) {
          console.error(`❌ Errore con il canale ${channel.name}:`, error.message);
        }
      }
    }

    // Mostra riepilogo
    console.log('\n📊 Riepilogo:');
    const activeChannels = await Channel.find({ active: true });
    console.log(`Canali attivi: ${activeChannels.length}`);
    activeChannels.forEach(channel => {
      console.log(`- ${channel.channelName} (${channel.channelId}) → Topic ID: ${channel.destinationTopic || 'principale'}`);
    });

  } catch (error) {
    console.error('❌ Errore durante l\'importazione:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnesso da MongoDB');
    process.exit(0);
  }
}

importMonitoredChannels();