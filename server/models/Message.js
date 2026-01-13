const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['image', 'video', 'audio', 'file'],
    required: true
  },
  url: {
    type: String,
    required: true
  },
  filename: String,
  size: Number,
  mimeType: String
});

const reactionSchema = new mongoose.Schema({
  emoji: {
    type: String,
    required: true
  },
  users: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
});

const messageSchema = new mongoose.Schema({
  channel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Channel',
    required: true,
    index: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    maxlength: 4000,
    default: ''
  },
  type: {
    type: String,
    enum: ['text', 'system', 'bot', 'youtube'],
    default: 'text'
  },
  attachments: [attachmentSchema],
  reactions: [reactionSchema],
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  edited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date,
    default: null
  },
  pinned: {
    type: Boolean,
    default: false
  },
  deleted: {
    type: Boolean,
    default: false
  },
  // For YouTube bot messages
  youtubeData: {
    videoId: String,
    title: String,
    thumbnail: String,
    duration: String
  }
}, {
  timestamps: true
});

// Index for faster queries
messageSchema.index({ channel: 1, createdAt: -1 });
messageSchema.index({ author: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
