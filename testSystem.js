const mongoose = require('mongoose');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { Bot } = require('grammy');
require('dotenv').config();

async function testSystem() {
  console.log('🔍 Test completo del sistema\n');
  
  // Test 1: Database
  console.log('Test 1: Connessione MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  const Channel = require('./src/models/Channel');
  const channels = await Channel.find();
  console.log(`✅ MongoDB connesso. Trovati ${channels.length} canali:`);
  channels.forEach(ch => {
    console.log(`   - ${ch.channelName} (${ch.channelId})`);
  });
  
  // Test 2: Telegram Client
  console.log('\nTest 2: Connessione Telegram...');
  const stringSession = new StringSession(process.env.TELEGRAM_STRING_SESSION);
  const client = new TelegramClient(stringSession, 
    parseInt(process.env.TELEGRAM_API_ID), 
    process.env.TELEGRAM_API_HASH, 
    { connectionRetries: 5 }
  );
  await client.connect();
  console.log('✅ Client Telegram connesso');
  
  // Test 3: Bot
  console.log('\nTest 3: Connessione Bot...');
  const bot = new Bot(process.env.BOT_TOKEN);
  const me = await bot.api.getMe();
  console.log(`✅ Bot connesso: @${me.username}`);
  
  // Test 4: Permessi canale
  console.log('\nTest 4: Verifica permessi nel canale di destinazione...');
  try {
    const chat = await bot.api.getChat('-1002562147025');
    console.log(`✅ Canale trovato: ${chat.title}`);
    
    const botMember = await bot.api.getChatMember('-1002562147025', me.id);
    console.log(`✅ Bot status: ${botMember.status}`);
    if (botMember.status === 'administrator') {
      console.log('✅ Bot è amministratore');
    } else {
      console.log('❌ Bot NON è amministratore');
    }
  } catch (error) {
    console.log('❌ Errore verifica permessi:', error.message);
  }
  
  // Test 5: Test invio nel topic
  console.log('\nTest 5: Test invio messaggio nel topic Articoli...');
  try {
    await bot.api.sendMessage('-1002562147025', 'Test automatico dal sistema', {
      message_thread_id: 30
    });
    console.log('✅ Messaggio di test inviato');
  } catch (error) {
    console.log('❌ Errore invio test:', error.message);
  }
  
  await client.disconnect();
  await mongoose.disconnect();
  console.log('\n✨ Test completato');
}

testSystem();