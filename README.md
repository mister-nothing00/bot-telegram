# Monitor Bot Telegram

Un bot Telegram avanzato per monitorare canali selezionati e ripubblicare automaticamente i contenuti in un canale di destinazione, rimuovendo link, riferimenti esterni e altre informazioni non desiderate.

## 📋 Funzionalità principali

- **Monitoraggio automatico** di canali Telegram configurati
- **Ripubblicazione unificata** di immagini e testo nello stesso topic
- **Pulizia dei contenuti**: rimozione automatica di link, riferimenti esterni e informazioni non richieste
- **Estrazione e markup dei prezzi**: identifica automaticamente i prezzi e applica markup personalizzabili
- **Supporto per album**: gestione corretta di gruppi di media (album di foto)
- **Configurazione flessibile**: impostazioni personalizzabili per ogni canale monitorato
- **Persistenza**: salvataggio di configurazioni e messaggi processati su MongoDB
- **API REST**: gestione completa dei canali tramite API

## 🛠️ Requisiti

- Node.js (v14.0+)
- MongoDB
- Account Telegram
- API Telegram (api_id e api_hash da https://my.telegram.org)
- Bot Telegram (token da [@BotFather](https://t.me/BotFather))

## 📱 Risoluzione dei problemi principali

Questo bot è stato specificamente progettato per risolvere i seguenti problemi:

1. **Pubblicazione unificata**: le immagini e il testo vengono pubblicati insieme nello stesso topic, non separati
2. **Rimozione completa dei link**: tutti i tipi di link e riferimenti esterni vengono rimossi, indipendentemente dal formato
3. **Standardizzazione del formato**: tutti i messaggi vengono pubblicati con un formato coerente
4. **Gestione degli album**: le gallerie di immagini vengono gestite correttamente come un unico post

## ⚙️ Configurazione iniziale

### 1. Clona il repository
```bash
git clone https://github.com/tuousername/monitor-bot.git
cd monitor-bot
```

### 2. Installa le dipendenze
```bash
npm install
```

### 3. Crea un file `.env` nella radice del progetto
```
# Credenziali Telegram
TELEGRAM_API_ID=tuo_api_id
TELEGRAM_API_HASH=tuo_api_hash
TELEGRAM_STRING_SESSION=               # Verrà generato automaticamente
BOT_TOKEN=token_del_tuo_bot

# Canale di destinazione (con il segno meno)
DESTINATION_CHANNEL_ID=-1002562147025

# MongoDB
MONGODB_URI=mongodb://localhost:27017/monitor-bot

# Amministratori (ID separati da virgola)
ADMIN_IDS=123456789,987654321

# Ambiente (development o production)
NODE_ENV=development
PORT=3000
```

### 4. Genera una string session Telegram
```bash
npm run session
```
Segui le istruzioni a schermo e inserisci il risultato nel file `.env` come `TELEGRAM_STRING_SESSION`

### 5. Configura i canali da monitorare
Modifica il file `monitored-channels.json` per aggiungere i canali che vuoi monitorare:

```json
{
  "destinationTopicName": "Articoli",
  "destinationTopicId": 30,
  "channels": [
    {
      "id": "-1002371801983",
      "name": "China2UFind (C2ufashion)",
      "description": "Prodotti moda e abbigliamento",
      "active": true,
      "category": "fashion",
      "mediaTypes": {
        "photos": true,
        "videos": false,
        "documents": false
      },
      "includeText": true,
      "includePrice": true,
      "priceRegex": "€\\s*\\d+([.,]\\d{1,2})?|\\d+([.,]\\d{1,2})?\\s*€"
    },
    // Altri canali...
  ]
}
```

### 6. Importa i canali nel database
```bash
npm run import
```

## 🚀 Utilizzo

### Avvio del bot
```bash
# Avvio normale
npm start

# Avvio in modalità sviluppo (con riavvio automatico)
npm run dev
```

### Test del sistema
```bash
# Test connessione ai canali
npm run test-channel

# Test completo del sistema
npm run test-system
```

## 📄 Dettagli dei file

| File | Descrizione |
|------|-------------|
| `src/index.js` | Punto di ingresso principale dell'applicazione |
| `src/config/index.js` | Configurazione generale dell'applicazione |
| `src/config/database.js` | Configurazione della connessione MongoDB |
| `src/controllers/channelController.js` | Gestione dei canali monitorati |
| `src/models/Channel.js` | Schema MongoDB per i canali |
| `src/models/ProcessedMessage.js` | Schema MongoDB per i messaggi processati |
| `src/services/contentCleaner.js` | Servizio per pulizia e formattazione dei testi |
| `src/services/mediaProcessor.js` | Servizio per elaborazione e pubblicazione dei media |
| `src/services/telegram.js` | Servizio per connessione a Telegram |
| `src/utils/helper.js` | Funzioni di utilità varie |
| `src/utils/logger.js` | Sistema di logging |
| `generateSession.js` | Script per generare la Telegram string session |
| `importMonitoredChannels.js` | Script per importare i canali da monitorare |
| `testChannel.js` | Script per testare la connessione ai canali |
| `testSystem.js` | Script per testare l'intero sistema |

## 🔄 Flusso di lavoro

1. **Monitoraggio**: Il bot monitora tutti i canali configurati
2. **Ricezione messaggi**: Quando arriva un nuovo messaggio in un canale monitorato, viene elaborato
3. **Elaborazione**: Il testo viene pulito (rimozione link), i prezzi vengono estratti e viene applicato il markup
4. **Pubblicazione**: Le immagini e il testo vengono pubblicati insieme nello stesso topic del canale di destinazione

## 🔌 API REST

Il bot espone un'API REST per la gestione dei canali:

- `GET /api/channels` - Ottiene la lista di tutti i canali
- `POST /api/channels` - Aggiunge un nuovo canale
- `PUT /api/channels/:channelId` - Aggiorna un canale esistente
- `DELETE /api/channels/:channelId` - Rimuove un canale

## ⚠️ Risoluzione problemi

### Il bot non invia messaggi nel topic corretto
1. Verifica che il bot sia amministratore nel canale di destinazione
2. Controlla che l'ID del topic sia corretto in `monitored-channels.json`
3. Assicurati che il topic esista nel canale di destinazione

### I link non vengono rimossi correttamente
1. Aggiorna il file `src/services/contentCleaner.js` aggiungendo i pattern specifici
2. Riavvia il bot

### Le immagini e il testo vengono separati
1. Questo problema è stato risolto nella nuova versione del bot
2. Verifica di utilizzare la versione più recente di `mediaProcessor.js`

### Errori di connessione a Telegram
1. Verifica `api_id`, `api_hash` e `bot_token` nel file `.env`
2. Rigenera la string session con `npm run session`

## 📝 Aggiunta di nuovi canali

Per aggiungere un nuovo canale da monitorare:

1. Aggiungi il canale al file `monitored-channels.json`
2. Esegui `npm run import` per importare il canale nel database
3. Riavvia il bot con `npm start`

In alternativa, puoi usare l'API REST:

```bash
curl -X POST http://localhost:3000/api/channels \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": "-100xxxxxxxxx",
    "channelName": "Nome del canale",
    "options": {
      "active": true,
      "mediaTypes": {
        "photos": true,
        "videos": false,
        "documents": false
      },
      "includeText": true,
      "includePrice": true,
      "destinationTopic": 30
    }
  }'
```

## 🔒 Sicurezza

- La string session Telegram contiene informazioni di autenticazione, mantienila privata
- Non condividere il file `.env` con nessuno
- Limita l'accesso all'API REST solo agli amministratori