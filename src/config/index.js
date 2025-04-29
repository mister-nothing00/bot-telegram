require('dotenv').config();

module.exports = {
  telegram: {
    apiId: parseInt(process.env.TELEGRAM_API_ID),
    apiHash: process.env.TELEGRAM_API_HASH,
    stringSession: process.env.TELEGRAM_STRING_SESSION,
    botToken: process.env.BOT_TOKEN,
    destinationChannelId: process.env.DESTINATION_CHANNEL_ID
  },
  mongodb: {
    uri: process.env.MONGODB_URI
  },
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development'
  },
  adminIds: process.env.ADMIN_IDS.split(',').map(id => parseInt(id))
};