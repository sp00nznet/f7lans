const mongoose = require('mongoose');
const crypto = require('crypto');

// Federation Server Schema - represents a connected server in the federation
const federationServerSchema = new mongoose.Schema({
  // Unique server identifier (generated on first run)
  serverId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // Human-readable server name
  name: {
    type: String,
    required: true,
    maxlength: 64
  },
  // Server URL for API calls
  url: {
    type: String,
    required: true
  },
  // WebSocket URL for real-time communication
  wsUrl: {
    type: String,
    required: true
  },
  // Shared secret for server-to-server authentication
  sharedSecret: {
    type: String,
    required: true
  },
  // Public key for message signing (optional additional security)
  publicKey: {
    type: String,
    default: null
  },
  // Federation status
  status: {
    type: String,
    enum: ['pending', 'active', 'suspended', 'disconnected'],
    default: 'pending'
  },
  // Server statistics
  stats: {
    userCount: { type: Number, default: 0 },
    channelCount: { type: Number, default: 0 },
    messageCount: { type: Number, default: 0 },
    lastSeen: { type: Date, default: Date.now }
  },
  // Trust level (affects what data is shared)
  trustLevel: {
    type: String,
    enum: ['full', 'limited', 'minimal'],
    default: 'limited'
  },
  // Whether this server initiated the federation request
  isInitiator: {
    type: Boolean,
    default: false
  },
  // Federation settings
  settings: {
    syncChannels: { type: Boolean, default: true },
    syncUsers: { type: Boolean, default: true },
    syncMessages: { type: Boolean, default: true },
    allowCrossServerDM: { type: Boolean, default: true }
  },
  // Channel mappings (local channel ID -> federated channel ID)
  channelMappings: [{
    localChannelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel' },
    federatedChannelId: String,
    remoteChannelId: String,
    syncEnabled: { type: Boolean, default: true }
  }],
  // Connection metadata
  connectedAt: {
    type: Date,
    default: null
  },
  lastHeartbeat: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Generate server-to-server auth token
federationServerSchema.methods.generateAuthToken = function() {
  const timestamp = Date.now();
  const payload = `${this.serverId}:${timestamp}`;
  const signature = crypto
    .createHmac('sha256', this.sharedSecret)
    .update(payload)
    .digest('hex');
  return `${payload}:${signature}`;
};

// Verify incoming auth token
federationServerSchema.methods.verifyAuthToken = function(token) {
  try {
    const [serverId, timestamp, signature] = token.split(':');

    // Check if token is not too old (5 minute window)
    const tokenAge = Date.now() - parseInt(timestamp);
    if (tokenAge > 5 * 60 * 1000) return false;

    // Verify signature
    const payload = `${serverId}:${timestamp}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.sharedSecret)
      .update(payload)
      .digest('hex');

    return signature === expectedSignature && serverId === this.serverId;
  } catch (error) {
    return false;
  }
};

// Federated Channel Schema - channels that exist across federation
const federatedChannelSchema = new mongoose.Schema({
  // Unique federated channel ID (shared across all servers)
  federatedId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // Original channel name
  name: {
    type: String,
    required: true
  },
  // Channel type
  type: {
    type: String,
    enum: ['text', 'voice', 'video', 'announcement'],
    default: 'text'
  },
  // Category
  category: {
    type: String,
    default: 'Federated'
  },
  // Description
  description: {
    type: String,
    maxlength: 1024,
    default: ''
  },
  // Origin server (who created this channel)
  originServer: {
    type: String,
    required: true
  },
  // Servers that have this channel
  servers: [{
    serverId: String,
    localChannelId: String,
    localName: String, // May differ due to conflict resolution
    syncEnabled: { type: Boolean, default: true }
  }],
  // Channel settings
  settings: {
    isGlobal: { type: Boolean, default: false }, // Available to all federated servers
    requiresApproval: { type: Boolean, default: false }
  }
}, {
  timestamps: true
});

// Federation Request Schema - pending federation requests
const federationRequestSchema = new mongoose.Schema({
  // Request ID
  requestId: {
    type: String,
    required: true,
    unique: true,
    default: () => crypto.randomBytes(16).toString('hex')
  },
  // Requesting server info
  fromServer: {
    serverId: String,
    name: String,
    url: String,
    wsUrl: String
  },
  // Target server (this server's ID)
  toServerId: {
    type: String,
    required: true
  },
  // Request status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'expired'],
    default: 'pending'
  },
  // Proposed shared secret (encrypted)
  proposedSecret: {
    type: String,
    required: true
  },
  // Channel conflict analysis
  conflictAnalysis: {
    hasConflicts: { type: Boolean, default: false },
    conflicts: [{
      localChannel: String,
      remoteChannel: String,
      suggestedResolution: String,
      resolvedName: String
    }]
  },
  // Server stats from requester
  requesterStats: {
    userCount: Number,
    channelCount: Number,
    createdAt: Date
  },
  // Expiration
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  },
  // Who reviewed (if approved/rejected)
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  reviewNotes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Federated Message Schema - for message relay tracking
const federatedMessageSchema = new mongoose.Schema({
  // Unique federated message ID
  federatedId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // Origin server
  originServer: {
    type: String,
    required: true
  },
  // Original message ID on origin server
  originalMessageId: {
    type: String,
    required: true
  },
  // Federated channel ID
  federatedChannelId: {
    type: String,
    required: true,
    index: true
  },
  // Author info (from origin server)
  author: {
    oderId: String,
    odername: String,
    displayName: String,
    avatar: String,
    serverName: String
  },
  // Message content
  content: {
    type: String,
    maxlength: 4000
  },
  // Attachments
  attachments: [{
    type: String,
    url: String,
    filename: String
  }],
  // Delivery status per server
  deliveryStatus: [{
    serverId: String,
    delivered: { type: Boolean, default: false },
    deliveredAt: Date,
    localMessageId: String
  }],
  // Timestamps
  originalCreatedAt: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

// Indexes
federatedMessageSchema.index({ federatedChannelId: 1, originalCreatedAt: -1 });
federatedMessageSchema.index({ originServer: 1, originalMessageId: 1 });

const FederationServer = mongoose.model('FederationServer', federationServerSchema);
const FederatedChannel = mongoose.model('FederatedChannel', federatedChannelSchema);
const FederationRequest = mongoose.model('FederationRequest', federationRequestSchema);
const FederatedMessage = mongoose.model('FederatedMessage', federatedMessageSchema);

module.exports = {
  FederationServer,
  FederatedChannel,
  FederationRequest,
  FederatedMessage
};
