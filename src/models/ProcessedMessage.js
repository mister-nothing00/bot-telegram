const mongoose = require('mongoose');

const processedMessageSchema = new mongoose.Schema({
  originalMessageId: {
    type: Number,
    required: true
  },
  sourceChannelId: {
    type: String,
    required: true
  },
  processedAt: {
    type: Date,
    default: Date.now
  }
});

processedMessageSchema.index({ originalMessageId: 1, sourceChannelId: 1 }, { unique: true });

module.exports = mongoose.model('ProcessedMessage', processedMessageSchema);