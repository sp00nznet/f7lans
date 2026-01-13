const mongoose = require('mongoose');

// Character schema for players in the campaign
const characterSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  class: {
    type: String,
    enum: ['warrior', 'mage', 'rogue', 'cleric', 'ranger', 'bard'],
    required: true
  },
  race: {
    type: String,
    enum: ['human', 'elf', 'dwarf', 'halfling', 'orc', 'dragonborn'],
    default: 'human'
  },
  level: {
    type: Number,
    default: 1,
    min: 1,
    max: 20
  },
  experience: {
    type: Number,
    default: 0
  },
  stats: {
    strength: { type: Number, default: 10 },
    dexterity: { type: Number, default: 10 },
    constitution: { type: Number, default: 10 },
    intelligence: { type: Number, default: 10 },
    wisdom: { type: Number, default: 10 },
    charisma: { type: Number, default: 10 }
  },
  hp: {
    current: { type: Number, default: 10 },
    max: { type: Number, default: 10 }
  },
  inventory: [{
    name: String,
    quantity: { type: Number, default: 1 },
    type: { type: String, enum: ['weapon', 'armor', 'potion', 'misc'] }
  }],
  gold: {
    type: Number,
    default: 10
  },
  isAlive: {
    type: Boolean,
    default: true
  }
});

// Story event schema for tracking campaign history
const storyEventSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['narrative', 'combat', 'dialogue', 'exploration', 'loot', 'levelup', 'death'],
    required: true
  },
  text: {
    type: String,
    required: true
  },
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  actorName: String,
  rolls: [{
    type: String,
    value: Number,
    modifier: Number,
    total: Number,
    success: Boolean
  }],
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const campaignSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  channel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Channel',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['recruiting', 'active', 'paused', 'completed', 'abandoned'],
    default: 'recruiting'
  },
  type: {
    type: String,
    enum: ['solo', 'party'],
    default: 'party'
  },
  difficulty: {
    type: String,
    enum: ['easy', 'normal', 'hard', 'nightmare'],
    default: 'normal'
  },
  setting: {
    type: String,
    enum: ['fantasy', 'scifi', 'horror', 'modern', 'steampunk'],
    default: 'fantasy'
  },
  characters: [characterSchema],
  maxPlayers: {
    type: Number,
    default: 4,
    min: 1,
    max: 8
  },
  // Current adventure state
  currentScene: {
    title: String,
    description: String,
    type: { type: String, enum: ['exploration', 'combat', 'dialogue', 'puzzle', 'rest'] },
    options: [{
      id: String,
      text: String,
      requires: { stat: String, dc: Number } // Difficulty class for skill check
    }],
    enemies: [{
      name: String,
      hp: { current: Number, max: Number },
      attack: Number,
      defense: Number,
      damage: String // e.g., "1d6+2"
    }]
  },
  // Story history
  storyLog: [storyEventSchema],
  // Stats
  totalSessions: {
    type: Number,
    default: 0
  },
  totalCombats: {
    type: Number,
    default: 0
  },
  monstersSlain: {
    type: Number,
    default: 0
  },
  treasureFound: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for efficient queries
campaignSchema.index({ channel: 1 });
campaignSchema.index({ status: 1 });
campaignSchema.index({ 'characters.user': 1 });

// Static: Get active campaigns for a channel
campaignSchema.statics.getActiveCampaign = async function(channelId) {
  return this.findOne({
    channel: channelId,
    status: { $in: ['recruiting', 'active', 'paused'] }
  }).populate('characters.user', 'username displayName');
};

// Static: Get user's campaigns
campaignSchema.statics.getUserCampaigns = async function(userId) {
  return this.find({
    'characters.user': userId,
    status: { $in: ['recruiting', 'active', 'paused'] }
  }).populate('characters.user', 'username displayName');
};

// Method: Add story event
campaignSchema.methods.addStoryEvent = function(event) {
  this.storyLog.push(event);
  // Keep only last 100 events to prevent document bloat
  if (this.storyLog.length > 100) {
    this.storyLog = this.storyLog.slice(-100);
  }
};

// Method: Get character by user
campaignSchema.methods.getCharacter = function(userId) {
  return this.characters.find(c => c.user.toString() === userId.toString());
};

module.exports = mongoose.model('RPGCampaign', campaignSchema);
