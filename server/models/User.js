const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 32
  },
  displayName: {
    type: String,
    trim: true,
    maxlength: 32
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  avatar: {
    type: String,
    default: null
  },
  role: {
    type: String,
    enum: ['user', 'moderator', 'admin', 'superadmin'],
    default: 'user'
  },
  // Admin panel access - allows specific users to access admin features without full admin role
  adminPanelAccess: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['online', 'idle', 'dnd', 'offline'],
    default: 'offline'
  },
  customStatus: {
    type: String,
    maxlength: 128,
    default: ''
  },
  steamId: {
    type: String,
    default: null
  },
  steamVerified: {
    type: Boolean,
    default: false
  },
  // Social account links
  socialAccounts: {
    reddit: { username: String, verified: { type: Boolean, default: false } },
    twitter: { username: String, verified: { type: Boolean, default: false } },
    xbox: { gamertag: String, verified: { type: Boolean, default: false } },
    playstation: { username: String, verified: { type: Boolean, default: false } },
    blizzard: { battletag: String, verified: { type: Boolean, default: false } }
  },
  // Current activity (game, application, etc.)
  currentActivity: {
    type: { type: String, enum: ['game', 'application', 'streaming', 'listening', 'watching', 'custom'], default: null },
    name: { type: String, default: null },
    details: { type: String, default: null },
    startedAt: { type: Date, default: null },
    appId: { type: String, default: null }
  },
  // Two-factor authentication
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    default: null
  },
  twoFactorBackupCodes: [{
    code: String,
    used: { type: Boolean, default: false }
  }],
  // User preferences
  theme: {
    type: String,
    default: 'dark'
  },
  audioSettings: {
    inputVolume: { type: Number, default: 100, min: 0, max: 200 },
    outputVolume: { type: Number, default: 100, min: 0, max: 200 },
    inputDevice: { type: String, default: 'default' },
    outputDevice: { type: String, default: 'default' },
    voiceActivated: { type: Boolean, default: false },
    voiceActivationThreshold: { type: Number, default: 50 },
    pushToTalkKey: { type: String, default: 'space' },
    echoCancellation: { type: Boolean, default: true },
    noiseSuppression: { type: Boolean, default: true }
  },
  videoSettings: {
    defaultCamera: { type: String, default: 'default' },
    videoQuality: { type: String, enum: ['720p', '1080p', '1080p60'], default: '1080p' }
  },
  notificationSettings: {
    enableSounds: { type: Boolean, default: true },
    enableDesktop: { type: Boolean, default: true },
    enableDMs: { type: Boolean, default: true },
    enableMentions: { type: Boolean, default: true }
  },
  friends: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  friendRequests: [{
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  }],
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  lastSeen: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Get display name (falls back to username)
userSchema.methods.getDisplayName = function() {
  return this.displayName || this.username;
};

// Get public profile
userSchema.methods.toPublicProfile = function() {
  return {
    id: this._id,
    username: this.username,
    displayName: this.displayName || this.username,
    avatar: this.avatar,
    status: this.status,
    customStatus: this.customStatus,
    steamId: this.steamId,
    steamVerified: this.steamVerified,
    socialAccounts: this.socialAccounts,
    currentActivity: this.currentActivity,
    theme: this.theme,
    role: this.role,
    createdAt: this.createdAt
  };
};

module.exports = mongoose.model('User', userSchema);
