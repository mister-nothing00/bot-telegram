const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { Bot } = require('grammy');
require('dotenv').config();

async function testChannel() {
  // Test 1: Connessione
  console.log('Test 1: Verifica connessione...');
  const stringSession = new StringSession(process.env.TELEGRAM_STRING_SESSION);
  const client = new TelegramClient(stringSession, 
    parseInt(process.env.TELEGRAM_API_ID), 
    process.env.TELEGRAM_API_HASH, 
    { connectionRetries: 5 }
  );
  
  await client.connect();
  console.log('✅ Connesso a Telegram come utente');

  // Test 2: Verifica accesso al canale
  console.log('\nTest 2: Verifica accesso al canale di destinazione...');
  try {
    const channel = await client.getEntity('-1002562147025');
    console.log(`✅ Canale trovato: ${channel.title}`);
  } catch (error) {
    console.log('❌ Errore accesso canale:', error.message);
  }

  // Test 3: Verifica bot
  console.log('\nTest 3: Verifica bot...');
  const bot = new Bot(process.env.BOT_TOKEN);
  try {
    const me = await bot.api.getMe();
    console.log(`✅ Bot funzionante: @${me.username}`);
  } catch (error) {
    console.log('❌ Errore bot:', error.message);
  }

  // Test 4: Test invio messaggio
  console.log('\nTest 4: Test invio messaggio nel topic Articoli...');
  try {
    await bot.api.sendMessage('-1002562147025', 'Test dal bot', {
      message_thread_id: 30
    });
    console.log('✅ Messaggio inviato con successo');
  } catch (error) {
    console.log('❌ Errore invio messaggio:', error.message);
  }

  // Test 5: Verifica canali monitorati
  console.log('\nTest 5: Verifica ultimo messaggio da un canale monitorato...');
  try {
    const channelToCheck = '-1002371801983'; // China2UFind
    const messages = await client.getMessages(channelToCheck, { limit: 1 });
    if (messages.length > 0) {
      console.log(`✅ Ultimo messaggio dal canale: ${messages[0].message.substring(0, 50)}...`);
    }
  } catch (error) {
    console.log('❌ Errore lettura canale:', error.message);
  }

  await client.disconnect();
}

testChannel();