/**
 * Script per impostare l'ID del topic Welcome nel file di configurazione
 * Modifica il file src/config/welcomeMessage.js
 */
require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');

async function setWelcomeTopic() {
  try {
    console.log('🔧 Configurazione ID del topic Welcome\n');
    
    // Chiedi all'utente l'ID del topic Welcome
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const topicIdInput = await new Promise(resolve => {
      rl.question('Inserisci l\'ID del topic Welcome: ', answer => {
        resolve(answer);
      });
    });
    
    // Controlla che sia un numero
    const topicId = parseInt(topicIdInput);
    if (isNaN(topicId)) {
      console.error('❌ Errore: L\'ID del topic deve essere un numero');
      rl.close();
      process.exit(1);
    }
    
    rl.close();
    
    console.log(`\n🔍 Configurazione dell'ID del topic Welcome a: ${topicId}`);
    
    // Percorso del file di configurazione
    const configPath = path.join(__dirname, 'src', 'config', 'welcomeMessage.js');
    
    // Verifica se il file esiste
    try {
      await fs.access(configPath);
    } catch (error) {
      console.error(`❌ Errore: Il file di configurazione non esiste in ${configPath}`);
      console.log('Esegui prima il comando: node createWelcomeMessageConfig.js');
      process.exit(1);
    }
    
    // Leggi il file di configurazione esistente
    let configContent = await fs.readFile(configPath, 'utf8');
    
    // Sostituisci la riga con welcomeTopicId
    configContent = configContent.replace(
      /welcomeTopicId:.*?,/,
      `welcomeTopicId: ${topicId}, // Configurato il ${new Date().toISOString().split('T')[0]}`
    );
    
    // Salva il file aggiornato
    await fs.writeFile(configPath, configContent, 'utf8');
    
    console.log(`✅ ID del topic Welcome impostato a ${topicId} nel file di configurazione`);
    console.log('\n🔍 Prossimo passo:');
    console.log('- Riavvia il bot per applicare le modifiche');
  } catch (error) {
    console.error('❌ Errore:', error);
    process.exit(1);
  }
}

// Esegui la funzione principale
setWelcomeTopic();