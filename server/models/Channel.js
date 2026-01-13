const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  type: {
    type: String,
    enum: ['text', 'voice', 'video', 'announcement'],
    default: 'text'
  },
  category: {
    type: String,
    default: 'General'
  },
  description: {
    type: String,
    maxlength: 1024,
    default: ''
  },
  position: {
    type: Number,
    default: 0
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  allowedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  allowedRoles: [{
    type: String
  }],
  currentUsers: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    joinedAt: { type: Date, default: Date.now },
    isMuted: { type: Boolean, default: false },
    isDeafened: { type: Boolean, default: false },
    isStreaming: { type: Boolean, default: false },
    isCameraOn: { type: Boolean, default: false }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  // Per-channel bot settings
  bots: {
    youtube: { enabled: { type: Boolean, default: true } },
    plex: { enabled: { type: Boolean, default: true } },
    emby: { enabled: { type: Boolean, default: true } },
    jellyfin: { enabled: { type: Boolean, default: true } },
    iptv: { enabled: { type: Boolean, default: true } },
    spotify: { enabled: { type: Boolean, default: true } },
    chrome: { enabled: { type: Boolean, default: true } },
    activityStats: { enabled: { type: Boolean, default: true } },
    rpg: { enabled: { type: Boolean, default: true } },
    twitch: { enabled: { type: Boolean, default: true } },
    imageSearch: { enabled: { type: Boolean, default: true } },
    starCitizen: { enabled: { type: Boolean, default: true } }
  }
}, {
  timestamps: true
});

// Get user count in voice channel
channelSchema.methods.getUserCount = function() {
  return this.currentUsers.length;
};

// Check if a bot is enabled for this channel
channelSchema.methods.isBotEnabled = function(botName) {
  if (!this.bots || !this.bots[botName]) {
    return true; // Default to enabled if not set
  }
  return this.bots[botName].enabled !== false;
};

// Get all bot settings for this channel
channelSchema.methods.getBotSettings = function() {
  const defaultBots = ['youtube', 'plex', 'emby', 'jellyfin', 'iptv', 'spotify', 'chrome', 'activityStats', 'rpg', 'twitch', 'imageSearch', 'starCitizen'];
  const settings = {};

  for (const bot of defaultBots) {
    settings[bot] = {
      enabled: this.bots?.[bot]?.enabled !== false
    };
  }

  return settings;
};

module.exports = mongoose.model('Channel', channelSchema);
