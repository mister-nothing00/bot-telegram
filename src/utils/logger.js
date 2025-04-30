const winston = require('winston');
const path = require('path');

// Crea directory per i log se non esiste
const logDir = path.join(process.cwd(), 'logs');

// Configurazione dei trasporti
const transports = [
  // Console
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.printf(info => {
        const { timestamp, level, message, ...metadata } = info;
        let msg = `${timestamp} [${level}]: ${message} `;
        
        // Aggiungi metadata se presente
        if (Object.keys(metadata).length > 0) {
          msg += JSON.stringify(metadata);
        }
        
        return msg;
      })
    ),
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
  }),
  
  // File log errori
  new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }),
  
  // File log combinato
  new winston.transports.File({
    filename: path.join(logDir, 'combined.log'),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    level: 'debug'
  })
];

// Crea il logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transports: transports,
  
  // Gestione eccezioni non catturate
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logDir, 'exceptions.log') 
    })
  ],
  
  // Rifiuti non gestiti
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logDir, 'rejections.log') 
    })
  ],
  
  // Opzioni aggiuntive
  exitOnError: false
});

// Se siamo in produzione, non logga anche sulla console
if (process.env.NODE_ENV === 'production') {
  logger.remove(logger.transports.find(t => t.name === 'console'));
}

module.exports = logger;