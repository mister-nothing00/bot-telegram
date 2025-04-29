# Monitor Bot Telegram

Un bot Telegram per monitorare canali selezionati e ripubblicare automaticamente i contenuti in un canale di destinazione, rimuovendo link, riferimenti esterni e altre informazioni non desiderate.

## 📋 Caratteristiche principali

- **Monitoraggio automatico** di canali Telegram configurati
- **Ripubblicazione unificata** di immagini e testo in un singolo messaggio
- **Pulizia dei contenuti**: rimozione automatica di link, riferimenti esterni e informazioni non richieste
- **Estrazione e markup dei prezzi**: identifica e applica markup ai prezzi per dropshipping
- **Supporto per topic**: pubblicazione nei thread del forum del canale di destinazione
- **Configurazione flessibile**: impostazioni personalizzabili per ogni canale monitorato
- **Persistenza**: salvataggio di configurazioni e messaggi processati su MongoDB
- **Logging completo**: registrazione dettagliata di tutte le operazioni

## 🛠️ Requisiti

- Node.js (v14.0+)
- MongoDB
- Account Telegram
- API Telegram (api_id e api_hash da https://my.telegram.org)
- Bot Telegram (token da [@BotFather](https://t.me/BotFather))

## 📁 Struttura del progetto

```
monitor-bot/
├── logs/                # Directory per i file di log
├── src/                 # Codice sorgente
│   ├── config/          # Configurazione dell'applicazione
│   ├── controllers/     # Controller per la logica di business
│   ├── models/          # Modelli MongoDB
│   ├── services/        # Servizi applicativi
│   └── utils/           # Utilità varie
├── .env                 # Configurazioni ambientali
├── .gitignore           # File e cartelle da ignorare in git
├── index.js             # Punto di ingresso dell'applicazione
├── package.json         # Dipendenze e script
└── README.md            # Questo file
```

## ⚙️ Configurazione

1. Clona il repository
   ```bash
   git clone https://github.com/tuousername/monitor-bot.git
   cd monitor-bot
   ```

2. Installa le dipendenze
   ```bash
   npm install
   ```

3. Crea un file `.env` nella radice del progetto con le seguenti variabili:
   ```
   # Credenziali Telegram
   TELEGRAM_API_ID=tuo_api_id
   TELEGRAM_API_HASH=tuo_api_hash
   TELEGRAM_STRING_SESSION=               # Verrà generato automaticamente
   BOT_TOKEN=token_del_tuo_bot
   
   # Canale di destinazione
   DESTINATION_CHANNEL_ID=id_canale_destinazione
   
   # MongoDB
   MONGODB_URI=mongodb://localhost:27017/monitor-bot
   
   # Amministratori (ID separati da virgola)
   ADMIN_IDS=123456789,987654321
   ```

4. Genera una string session Telegram:
   ```bash
   node generateSession.js
   ```
   Segui le istruzioni a schermo e inserisci il risultato nel file `.env` come `TELEGRAM_STRING_SESSION`

5. Configura i canali da monitorare:
   ```bash
   node importMonitoredChannels.js
   ```

## 🚀 Utilizzo

### Avvio del bot
```bash
node index.js
```

### Comandi del bot
- `/help` - Mostra i comandi disponibili
- `/status` - Mostra lo stato del bot
- `/channels` - Elenca i canali monitorati

## 📄 File di configurazione dei canali

Il file `monitored-channels.json` definisce i canali da monitorare:

```json
{
  "destinationTopicName": "Articoli",
  "channels": [
    {
      "id": "-100xxxxxxxxx",
      "name": "Nome del canale",
      "description": "Descrizione opzionale",
      "active": true,
      "category": "categoria",
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

## 🧰 Strumenti di manutenzione

- `testChannel.js`: Verifica la corretta connessione ai canali
  ```bash
  node testChannel.js
  ```

- `testSystem.js`: Esegue un test completo del sistema
  ```bash
  node testSystem.js
  ```

## 💡 Componenti principali

### 1. Servizi

- **telegramService**: Gestisce connessioni e interazioni con Telegram
- **mediaProcessor**: Processa e pubblica contenuti multimediali
- **contentCleaner**: Pulisce e trasforma i contenuti testuali

### 2. Controller

- **channelController**: Gestisce operazioni sui canali e messaggi processati

### 3. Modelli

- **Channel**: Schema per i canali monitorati
- **ProcessedMessage**: Schema per i messaggi già elaborati

## ⚠️ Risoluzione problemi

1. **Il bot non si connette a Telegram**
   - Verifica `api_id`, `api_hash` e `bot_token` nel file `.env`
   - Assicurati di aver generato correttamente la string session

2. **I messaggi non vengono inoltrati**
   - Verifica che il bot sia amministratore nel canale di destinazione
   - Controlla che l'ID del canale di destinazione sia corretto
   - Verifica che il canale di origine sia configurato correttamente

3. **Errori nei topic**
   - Assicurati che il canale di destinazione sia un forum (super gruppo con topic)
   - Verifica che il topic "Articoli" esista nel canale di destinazione

4. **Errori di autenticazione**
   - La sessione potrebbe essere scaduta, rigenera la string session con `node generateSession.js`

## 📝 Note importanti

- Il bot richiede un account utente Telegram per monitorare i canali
- Il bot richiede un bot Telegram per pubblicare nel canale di destinazione
- Il bot deve essere amministratore nel canale di destinazione
- La string session Telegram contiene informazioni di autenticazione, mantienila privata
- Il bot monitora solo nuovi messaggi dopo l'avvio

## 📚 Dettagli tecnici

### Processamento dei messaggi

1. Il bot monitora i nuovi messaggi nei canali configurati
2. Per ogni nuovo messaggio:
   - Verifica se il canale è attivo e configurato
   - Controlla se il messaggio è già stato processato
   - Pulisce il testo e rimuove link/riferimenti esterni
   - Estrae e applica markup ai prezzi (se configurato)
   - Pubblica media e testo nel canale di destinazione
   - Segna il messaggio come processato

### Pubblicazione unificata

Il bot pubblica i media e il testo come un unico messaggio completo, evitando la separazione tra immagini e descrizione. Questo viene fatto attraverso:

1. Inoltro dei media dal canale di origine al canale di destinazione
2. Aggiunta della caption pulita come risposta al messaggio inoltrato
3. Uso del topic specifico "Articoli" per organizzare i contenuti

## 🤝 Supporto e contributi

Per problemi, suggerimenti o richieste di funzionalità, apri una issue sul repository.