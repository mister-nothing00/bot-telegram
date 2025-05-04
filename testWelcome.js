const telegramService = require('./src/services/telegram');
const welcomeService = require('./src/services/welcomeService');
const config = require('./src/config');
const logger = require('./src/utils/logger');
require('dotenv').config();

async function testWelcomeMessage() {
  try {
    console.log('Inizializzazione servizi...');
    
    // Inizializza Telegram
    await telegramService.initialize();
    console.log('Telegram inizializzato');
    
    // Inizializza il servizio di benvenuto
    await welcomeService.initialize();
    console.log('Servizio di benvenuto inizializzato');
    
    // Ottieni il tuo ID utente (o specifica un ID utente esistente)
    const userClient = telegramService.getUserClient();
    const me = await userClient.getMe();
    console.log(`Utente trovato: ${me.firstName} (ID: ${me.id})`);
    
    // Simula l'invio di un messaggio di benvenuto al tuo utente
    console.log('Invio messaggio di benvenuto di test...');
    await welcomeService.handleNewMember(me);
    
    console.log('Test completato. Controlla il topic Welcome per verificare il messaggio.');
  } catch (error) {
    console.error('Errore durante il test:', error);
  } finally {
    // Termina lo script
    process.exit(0);
  }
}

testWelcomeMessage();