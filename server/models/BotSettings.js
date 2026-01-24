const mongoose = require('mongoose');

const botSettingsSchema = new mongoose.Schema({
  botType: {
    type: String,
    required: true,
    unique: true,
    enum: ['iptv', 'youtube', 'chrome', 'plex', 'emby', 'jellyfin', 'twitch', 'game-together']
  },
  enabled: {
    type: Boolean,
    default: false
  },
  config: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

botSettingsSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('BotSettings', botSettingsSchema);
