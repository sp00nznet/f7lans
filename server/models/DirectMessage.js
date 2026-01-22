const mongoose = require('mongoose');

const directMessageSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Encrypted content - server stores this but cannot decrypt it
  encryptedContent: {
    type: String,
    required: true
  },
  // Initialization vector for AES-GCM decryption
  iv: {
    type: String,
    required: true
  },
  // Encrypted symmetric key for recipient (encrypted with recipient's public key)
  encryptedKey: {
    type: String,
    required: true
  },
  attachments: [{
    type: {
      type: String,
      enum: ['image', 'video', 'audio', 'file']
    },
    url: String,
    filename: String,
    size: Number
  }],
  read: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  },
  deleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for faster queries
directMessageSchema.index({ participants: 1, createdAt: -1 });
directMessageSchema.index({ sender: 1, createdAt: -1 });

// Get conversation ID (sorted participant IDs)
directMessageSchema.statics.getConversationId = function(userId1, userId2) {
  const sorted = [userId1.toString(), userId2.toString()].sort();
  return sorted.join('_');
};

module.exports = mongoose.model('DirectMessage', directMessageSchema);
