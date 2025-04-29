const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
  channelId: {
    type: String,
    required: true,
    unique: true
  },
  channelName: String,
  channelUsername: String,
  active: {
    type: Boolean,
    default: true
  },
  mediaTypes: {
    photos: { type: Boolean, default: true },
    videos: { type: Boolean, default: false },
    documents: { type: Boolean, default: false }
  },
  includeText: {
    type: Boolean,
    default: true
  },
  includePrice: {
    type: Boolean,
    default: true
  },
  priceRegex: {
    type: String,
    default: '€\\s*\\d+([.,]\\d{1,2})?|\\d+([.,]\\d{1,2})?\\s*€'
  },
  destinationTopic: {
    type: Number,
    default: null  // null significa che pubblica nel canale principale
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Channel', channelSchema);