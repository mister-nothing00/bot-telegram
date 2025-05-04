/**
 * Script per creare il file di configurazione del messaggio di benvenuto
 * Crea il file src/config/welcomeMessage.js con il messaggio di default
 */
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function createWelcomeMessageConfig() {
  try {
    console.log('🔧 Creazione file di configurazione messaggio di benvenuto...');
    
    // Definisci il messaggio di benvenuto predefinito
    const defaultWelcomeMessage = `Ciao {name}! 👋

Benvenuto nel nostro canale! Siamo felici di averti qui.

Ecco alcune informazioni utili:

📋 **Regole**: Nel topic "Rules" trovi tutte le regole del nostro canale. Ti preghiamo di leggerle.

🛒 **Come acquistare**: Nel topic "How to buy" trovi tutte le informazioni su come acquistare.

💬 **Community**: Nel topic "Community" puoi discutere con altri membri.

📝 **Feedback/Report**: Se hai riscontrato problemi o vuoi lasciare un feedback, usa il topic dedicato.

🔍 **Articoli**: Nel topic "Articoli" pubblichiamo i nuovi prodotti.

❓ **Altro**: Per qualsiasi altra domanda, usa il topic "Other".

Grazie e buona permanenza! 🎉`;

    // Crea il contenuto del file di configurazione
    const configContent = `/**
 * Configurazione del messaggio di benvenuto
 * Questo file è generato automaticamente ma può essere modificato manualmente
 */
module.exports = {
  // ID del topic Welcome nel canale
  welcomeTopicId: 0, // Impostalo al corretto ID del topic usando setWelcomeTopic.js

  // Testo del messaggio di benvenuto (può contenere placeholder)
  welcomeMessage: \`${defaultWelcomeMessage}\`
};`;

    // Assicurati che la directory esista
    const configDir = path.join(__dirname, 'src', 'config');
    try {
      await fs.mkdir(configDir, { recursive: true });
      console.log(`📁 Directory confermata: ${configDir}`);
    } catch (err) {
      // Ignora errore se la directory esiste già
      if (err.code !== 'EEXIST') {
        throw err;
      }
    }

    // Scrivi il file di configurazione
    const configPath = path.join(configDir, 'welcomeMessage.js');
    await fs.writeFile(configPath, configContent, 'utf8');
    
    console.log(`✅ File di configurazione creato con successo: ${configPath}`);
    console.log('\n🔍 Prossimi passi:');
    console.log('1. Imposta l\'ID del topic Welcome con: node setWelcomeTopic.js');
    console.log('2. Avvia il bot per attivare la funzionalità');
  } catch (error) {
    console.error('❌ Errore:', error);
    process.exit(1);
  }
}

// Esegui la funzione principale
createWelcomeMessageConfig();