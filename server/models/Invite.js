const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const inviteSchema = new mongoose.Schema({
  code: {
    type: String,
    unique: true,
    default: () => uuidv4().substring(0, 8).toUpperCase()
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  used: {
    type: Boolean,
    default: false
  },
  usedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  usedAt: {
    type: Date,
    default: null
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  },
  maxUses: {
    type: Number,
    default: 1
  },
  uses: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Check if invite is valid
inviteSchema.methods.isValid = function() {
  if (this.used && this.uses >= this.maxUses) return false;
  if (new Date() > this.expiresAt) return false;
  return true;
};

module.exports = mongoose.model('Invite', inviteSchema);
