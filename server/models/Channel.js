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
  }
}, {
  timestamps: true
});

// Get user count in voice channel
channelSchema.methods.getUserCount = function() {
  return this.currentUsers.length;
};

module.exports = mongoose.model('Channel', channelSchema);
