const mongoose = require('mongoose');
const config = require('./index');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    await mongoose.connect(config.mongodb.uri);
    logger.info('MongoDB connesso');
  } catch (error) {
    logger.error('Errore connessione MongoDB:', error);
    process.exit(1);
  }
};

module.exports = connectDB;