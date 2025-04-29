// generateSession.js
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');
const dotenv = require('dotenv');
dotenv.config();

const apiId = process.env.TELEGRAM_API_ID; // Il tuo API ID
const apiHash = process.env.TELEGRAM_API_HASH; // Il tuo API Hash

(async () => {
  console.log('Generazione String Session per Telegram...');
  
  const stringSession = new StringSession(''); // Lascialo vuoto per generare una nuova sessione
  
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text('Inserisci il tuo numero di telefono: '),
    password: async () => await input.text('Inserisci la password (se hai 2FA): '),
    phoneCode: async () => await input.text('Inserisci il codice ricevuto: '),
    onError: (err) => console.log(err),
  });

  console.log('Autenticazione completata!');
  console.log('La tua String Session:');
  console.log(client.session.save());
  
  console.log('\nCopia questa stringa e inseriscila nel file .env come TELEGRAM_STRING_SESSION');
  
  process.exit(0);
})();