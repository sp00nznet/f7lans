const {
  FederationServer,
  FederatedChannel,
  FederationRequest,
  FederatedMessage
} = require('../models/Federation');
const Channel = require('../models/Channel');
const Message = require('../models/Message');
const User = require('../models/User');
const {
  federationConfig,
  getServerId,
  getWsUrl,
  generateSharedSecret,
  createAuthHeader,
  verifyAuthHeader,
  generateFederatedChannelId,
  generateFederatedMessageId,
  analyzeChannelConflicts,
  suggestConflictResolution
} = require('../config/federation');
const crypto = require('crypto');

// Store for active WebSocket connections to federated servers
const federatedConnections = new Map();

// Store for pending operations
const pendingOperations = new Map();

class FederationService {
  constructor(io) {
    this.io = io;
    this.serverId = null;
    this.serverUrl = federationConfig.serverUrl;
    this.wsUrl = getWsUrl();
    this.heartbeatIntervals = new Map();
  }

  // Initialize federation service
  async initialize() {
    this.serverId = await getServerId();
    console.log(`Federation Service initialized for server: ${this.serverId}`);

    // Reconnect to known federated servers
    await this.reconnectToFederatedServers();

    // Start heartbeat checks
    this.startHeartbeatMonitor();

    return this;
  }

  // Get this server's info for federation
  async getServerInfo() {
    const [userCount, channelCount, messageCount] = await Promise.all([
      User.countDocuments(),
      Channel.countDocuments(),
      Message.countDocuments()
    ]);

    return {
      serverId: this.serverId,
      name: federationConfig.serverName,
      url: this.serverUrl,
      wsUrl: this.wsUrl,
      stats: {
        userCount,
        channelCount,
        messageCount
      },
      version: '1.0.0',
      federationEnabled: federationConfig.enabled
    };
  }

  // Get all channels for federation sync
  async getChannelsForSync() {
    const channels = await Channel.find({ isPrivate: false })
      .select('name type category description')
      .lean();

    return channels.map(ch => ({
      _id: ch._id.toString(),
      name: ch.name,
      type: ch.type,
      category: ch.category,
      description: ch.description
    }));
  }

  // ==================== Federation Requests ====================

  // Create a federation request to another server
  async createFederationRequest(targetUrl) {
    if (!federationConfig.enabled) {
      throw new Error('Federation is disabled on this server');
    }

    // Get target server info
    const targetInfo = await this.fetchServerInfo(targetUrl);

    if (!targetInfo.federationEnabled) {
      throw new Error('Target server does not have federation enabled');
    }

    // Check if already federated
    const existing = await FederationServer.findOne({
      serverId: targetInfo.serverId,
      status: 'active'
    });

    if (existing) {
      throw new Error('Already federated with this server');
    }

    // Check for pending request
    const pendingRequest = await FederationRequest.findOne({
      'fromServer.serverId': this.serverId,
      'toServerId': targetInfo.serverId,
      status: 'pending'
    });

    if (pendingRequest) {
      throw new Error('Federation request already pending');
    }

    // Analyze channel conflicts
    const localChannels = await this.getChannelsForSync();
    const remoteChannels = targetInfo.channels || [];

    const conflicts = analyzeChannelConflicts(localChannels, remoteChannels);

    // Get local stats
    const localInfo = await this.getServerInfo();

    // Resolve conflicts based on server sizes
    const resolvedConflicts = conflicts.map(conflict =>
      suggestConflictResolution(conflict, localInfo.stats, targetInfo.stats)
    );

    // Generate shared secret
    const sharedSecret = generateSharedSecret();

    // Create the request
    const request = {
      requestId: crypto.randomBytes(16).toString('hex'),
      fromServer: {
        serverId: this.serverId,
        name: federationConfig.serverName,
        url: this.serverUrl,
        wsUrl: this.wsUrl
      },
      toServerId: targetInfo.serverId,
      proposedSecret: sharedSecret, // In production, encrypt this
      conflictAnalysis: {
        hasConflicts: resolvedConflicts.length > 0,
        conflicts: resolvedConflicts
      },
      requesterStats: localInfo.stats
    };

    // Send request to target server
    const response = await this.sendFederationRequest(targetUrl, request);

    // Store locally if pending
    if (response.status === 'pending') {
      // Store the secret locally for when they accept
      await FederationRequest.create({
        ...request,
        status: 'pending'
      });
    }

    return {
      requestId: request.requestId,
      status: response.status,
      message: response.message,
      conflicts: resolvedConflicts
    };
  }

  // Handle incoming federation request
  async handleFederationRequest(request) {
    if (!federationConfig.enabled) {
      return { status: 'rejected', message: 'Federation is disabled' };
    }

    // Check max servers
    const currentCount = await FederationServer.countDocuments({ status: 'active' });
    if (currentCount >= federationConfig.maxFederatedServers) {
      return { status: 'rejected', message: 'Maximum federated servers reached' };
    }

    // Check if already federated
    const existing = await FederationServer.findOne({
      serverId: request.fromServer.serverId,
      status: 'active'
    });

    if (existing) {
      return { status: 'rejected', message: 'Already federated' };
    }

    // Analyze conflicts from our perspective
    const localChannels = await this.getChannelsForSync();
    const remoteChannels = request.fromServer.channels || [];

    const conflicts = analyzeChannelConflicts(localChannels, remoteChannels);
    const localInfo = await this.getServerInfo();

    const resolvedConflicts = conflicts.map(conflict =>
      suggestConflictResolution(conflict, localInfo.stats, request.requesterStats)
    );

    // Store the request
    const federationRequest = await FederationRequest.create({
      requestId: request.requestId,
      fromServer: request.fromServer,
      toServerId: this.serverId,
      proposedSecret: request.proposedSecret,
      conflictAnalysis: {
        hasConflicts: resolvedConflicts.length > 0,
        conflicts: resolvedConflicts
      },
      requesterStats: request.requesterStats,
      status: 'pending'
    });

    // Auto-accept if enabled and no conflicts
    if (federationConfig.autoAcceptKnown && !resolvedConflicts.length) {
      return await this.approveFederationRequest(federationRequest._id, null);
    }

    return {
      status: 'pending',
      requestId: request.requestId,
      message: 'Federation request received and pending approval',
      conflicts: resolvedConflicts
    };
  }

  // Approve federation request
  async approveFederationRequest(requestId, reviewerId, conflictResolutions = {}) {
    const request = await FederationRequest.findById(requestId);

    if (!request || request.status !== 'pending') {
      throw new Error('Invalid or already processed request');
    }

    // Apply conflict resolutions
    const finalConflicts = request.conflictAnalysis.conflicts.map(conflict => {
      if (conflictResolutions[conflict.localChannel]) {
        return {
          ...conflict,
          resolvedName: conflictResolutions[conflict.localChannel]
        };
      }
      return conflict;
    });

    // Create the federation server entry
    const federatedServer = await FederationServer.create({
      serverId: request.fromServer.serverId,
      name: request.fromServer.name,
      url: request.fromServer.url,
      wsUrl: request.fromServer.wsUrl,
      sharedSecret: request.proposedSecret,
      status: 'active',
      isInitiator: false,
      stats: request.requesterStats,
      connectedAt: new Date()
    });

    // Update request status
    request.status = 'approved';
    request.reviewedBy = reviewerId;
    request.reviewedAt = new Date();
    request.conflictAnalysis.conflicts = finalConflicts;
    await request.save();

    // Rename conflicting channels if needed
    for (const conflict of finalConflicts) {
      if (conflict.suggestedResolution === 'rename_local' && conflict.resolvedName) {
        await Channel.findByIdAndUpdate(conflict.localChannelId, {
          name: conflict.resolvedName
        });
      }
    }

    // Notify the requesting server
    await this.notifyFederationApproved(request.fromServer.url, {
      requestId: request.requestId,
      serverId: this.serverId,
      name: federationConfig.serverName,
      url: this.serverUrl,
      wsUrl: this.wsUrl,
      sharedSecret: request.proposedSecret,
      conflictResolutions: finalConflicts
    });

    // Connect to the federated server
    await this.connectToFederatedServer(federatedServer);

    // Sync channels
    await this.syncChannelsWithServer(federatedServer);

    return {
      status: 'approved',
      federatedServer: {
        serverId: federatedServer.serverId,
        name: federatedServer.name
      }
    };
  }

  // Reject federation request
  async rejectFederationRequest(requestId, reviewerId, reason = '') {
    const request = await FederationRequest.findById(requestId);

    if (!request || request.status !== 'pending') {
      throw new Error('Invalid or already processed request');
    }

    request.status = 'rejected';
    request.reviewedBy = reviewerId;
    request.reviewedAt = new Date();
    request.reviewNotes = reason;
    await request.save();

    // Notify the requesting server
    await this.notifyFederationRejected(request.fromServer.url, {
      requestId: request.requestId,
      reason
    });

    return { status: 'rejected', reason };
  }

  // ==================== Server Communication ====================

  // Fetch server info from remote server
  async fetchServerInfo(targetUrl) {
    const fetch = (await import('node-fetch')).default;

    const response = await fetch(`${targetUrl}/api/federation/info`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Federation-Server': this.serverId
      },
      timeout: federationConfig.connectionTimeout
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch server info: ${response.statusText}`);
    }

    return await response.json();
  }

  // Send federation request to remote server
  async sendFederationRequest(targetUrl, request) {
    const fetch = (await import('node-fetch')).default;

    const response = await fetch(`${targetUrl}/api/federation/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Federation-Server': this.serverId
      },
      body: JSON.stringify(request),
      timeout: federationConfig.connectionTimeout
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Request failed: ${response.statusText}`);
    }

    return await response.json();
  }

  // Notify server of approval
  async notifyFederationApproved(targetUrl, data) {
    const fetch = (await import('node-fetch')).default;

    try {
      await fetch(`${targetUrl}/api/federation/approved`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Federation-Server': this.serverId
        },
        body: JSON.stringify(data),
        timeout: federationConfig.connectionTimeout
      });
    } catch (error) {
      console.error('Failed to notify approval:', error);
    }
  }

  // Notify server of rejection
  async notifyFederationRejected(targetUrl, data) {
    const fetch = (await import('node-fetch')).default;

    try {
      await fetch(`${targetUrl}/api/federation/rejected`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Federation-Server': this.serverId
        },
        body: JSON.stringify(data),
        timeout: federationConfig.connectionTimeout
      });
    } catch (error) {
      console.error('Failed to notify rejection:', error);
    }
  }

  // ==================== WebSocket Connections ====================

  // Connect to a federated server via WebSocket
  async connectToFederatedServer(federatedServer) {
    const { Server: SocketIOClient } = await import('socket.io-client');

    const socket = new SocketIOClient(federatedServer.wsUrl, {
      auth: {
        type: 'federation',
        serverId: this.serverId,
        token: createAuthHeader(this.serverId, federatedServer.sharedSecret)
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: federationConfig.connectionTimeout
    });

    socket.on('connect', () => {
      console.log(`Connected to federated server: ${federatedServer.name}`);
      federatedServer.status = 'active';
      federatedServer.lastHeartbeat = new Date();
      federatedServer.save();
    });

    socket.on('disconnect', () => {
      console.log(`Disconnected from federated server: ${federatedServer.name}`);
      federatedServer.status = 'disconnected';
      federatedServer.save();
    });

    // Handle federated messages
    socket.on('federation:message', async (data) => {
      await this.handleFederatedMessage(federatedServer.serverId, data);
    });

    // Handle channel updates
    socket.on('federation:channel:update', async (data) => {
      await this.handleChannelUpdate(federatedServer.serverId, data);
    });

    // Handle user status updates
    socket.on('federation:user:status', async (data) => {
      await this.handleUserStatusUpdate(federatedServer.serverId, data);
    });

    // Store connection
    federatedConnections.set(federatedServer.serverId, socket);

    // Start heartbeat
    this.startHeartbeat(federatedServer);
  }

  // Reconnect to all known federated servers
  async reconnectToFederatedServers() {
    const servers = await FederationServer.find({ status: { $in: ['active', 'disconnected'] } });

    for (const server of servers) {
      try {
        await this.connectToFederatedServer(server);
      } catch (error) {
        console.error(`Failed to reconnect to ${server.name}:`, error.message);
      }
    }
  }

  // ==================== Heartbeat ====================

  // Start heartbeat for a server
  startHeartbeat(federatedServer) {
    const intervalId = setInterval(async () => {
      const socket = federatedConnections.get(federatedServer.serverId);

      if (socket && socket.connected) {
        socket.emit('federation:heartbeat', {
          serverId: this.serverId,
          timestamp: Date.now()
        });

        federatedServer.lastHeartbeat = new Date();
        await federatedServer.save();
      }
    }, federationConfig.heartbeatInterval);

    this.heartbeatIntervals.set(federatedServer.serverId, intervalId);
  }

  // Monitor heartbeats
  startHeartbeatMonitor() {
    setInterval(async () => {
      const servers = await FederationServer.find({ status: 'active' });

      for (const server of servers) {
        const timeSinceHeartbeat = Date.now() - (server.lastHeartbeat?.getTime() || 0);

        if (timeSinceHeartbeat > federationConfig.heartbeatInterval * 3) {
          console.log(`Server ${server.name} appears offline`);
          server.status = 'disconnected';
          await server.save();

          // Try to reconnect
          this.connectToFederatedServer(server).catch(() => {});
        }
      }
    }, federationConfig.heartbeatInterval);
  }

  // ==================== Channel Synchronization ====================

  // Sync channels with a federated server
  async syncChannelsWithServer(federatedServer) {
    const localChannels = await this.getChannelsForSync();

    // Create federated channel entries for local channels
    for (const channel of localChannels) {
      let federatedChannel = await FederatedChannel.findOne({
        originServer: this.serverId,
        'servers.localChannelId': channel._id
      });

      if (!federatedChannel) {
        const federatedId = generateFederatedChannelId(this.serverId, channel.name);

        federatedChannel = await FederatedChannel.create({
          federatedId,
          name: channel.name,
          type: channel.type,
          category: channel.category,
          description: channel.description,
          originServer: this.serverId,
          servers: [{
            serverId: this.serverId,
            localChannelId: channel._id,
            localName: channel.name,
            syncEnabled: true
          }]
        });
      }

      // Add the federated server to this channel
      if (!federatedChannel.servers.find(s => s.serverId === federatedServer.serverId)) {
        federatedChannel.servers.push({
          serverId: federatedServer.serverId,
          localChannelId: null, // Will be set when they sync
          localName: channel.name,
          syncEnabled: true
        });
        await federatedChannel.save();
      }
    }

    // Notify the federated server about channels
    const socket = federatedConnections.get(federatedServer.serverId);
    if (socket && socket.connected) {
      const federatedChannels = await FederatedChannel.find({
        $or: [
          { originServer: this.serverId },
          { 'servers.serverId': this.serverId }
        ]
      });

      socket.emit('federation:channels:sync', {
        serverId: this.serverId,
        channels: federatedChannels
      });
    }
  }

  // Handle channel sync from federated server
  async handleChannelSync(fromServerId, channels) {
    for (const channel of channels) {
      let federatedChannel = await FederatedChannel.findOne({
        federatedId: channel.federatedId
      });

      if (!federatedChannel) {
        // Create local channel for this federated channel
        const localChannel = await Channel.create({
          name: channel.name,
          type: channel.type,
          category: 'Federated',
          description: `${channel.description} (from ${channel.originServer})`,
          isFederated: true,
          federatedId: channel.federatedId
        });

        // Update the federated channel with our local ID
        federatedChannel = await FederatedChannel.findOneAndUpdate(
          { federatedId: channel.federatedId },
          {
            $setOnInsert: {
              federatedId: channel.federatedId,
              name: channel.name,
              type: channel.type,
              category: channel.category,
              description: channel.description,
              originServer: channel.originServer
            },
            $push: {
              servers: {
                serverId: this.serverId,
                localChannelId: localChannel._id.toString(),
                localName: channel.name,
                syncEnabled: true
              }
            }
          },
          { upsert: true, new: true }
        );
      }
    }

    return { synced: channels.length };
  }

  // ==================== Message Relay ====================

  // Relay a message to federated servers
  async relayMessageToFederation(message, channel) {
    // Check if channel is federated
    const federatedChannel = await FederatedChannel.findOne({
      'servers.localChannelId': channel._id.toString()
    });

    if (!federatedChannel) {
      return; // Not a federated channel
    }

    // Create federated message
    const federatedId = generateFederatedMessageId(this.serverId, message._id.toString());

    const federatedMessage = await FederatedMessage.create({
      federatedId,
      originServer: this.serverId,
      originalMessageId: message._id.toString(),
      federatedChannelId: federatedChannel.federatedId,
      author: {
        oderId: message.author._id?.toString() || message.author,
        username: message.author.username,
        displayName: message.author.displayName || message.author.username,
        avatar: message.author.avatar,
        serverName: federationConfig.serverName
      },
      content: message.content,
      attachments: message.attachments,
      originalCreatedAt: message.createdAt
    });

    // Relay to all federated servers that have this channel
    for (const server of federatedChannel.servers) {
      if (server.serverId === this.serverId || !server.syncEnabled) {
        continue;
      }

      const socket = federatedConnections.get(server.serverId);
      if (socket && socket.connected) {
        socket.emit('federation:message', {
          federatedMessage: federatedMessage.toObject(),
          targetChannelId: server.localChannelId
        });

        // Update delivery status
        federatedMessage.deliveryStatus.push({
          serverId: server.serverId,
          delivered: true,
          deliveredAt: new Date()
        });
      }
    }

    await federatedMessage.save();
  }

  // Handle incoming federated message
  async handleFederatedMessage(fromServerId, data) {
    const { federatedMessage, targetChannelId } = data;

    // Check if we already have this message
    const existing = await FederatedMessage.findOne({
      federatedId: federatedMessage.federatedId
    });

    if (existing) {
      return; // Already processed
    }

    // Find the local channel
    const localChannel = await Channel.findById(targetChannelId);
    if (!localChannel) {
      console.error(`Local channel not found for federated message: ${targetChannelId}`);
      return;
    }

    // Create local message
    const localMessage = await Message.create({
      channel: localChannel._id,
      author: null, // Will use federatedAuthor
      content: federatedMessage.content,
      type: 'federated',
      attachments: federatedMessage.attachments,
      federatedData: {
        federatedId: federatedMessage.federatedId,
        originServer: federatedMessage.originServer,
        author: federatedMessage.author
      }
    });

    // Store federated message record
    await FederatedMessage.create({
      ...federatedMessage,
      deliveryStatus: [{
        serverId: this.serverId,
        delivered: true,
        deliveredAt: new Date(),
        localMessageId: localMessage._id.toString()
      }]
    });

    // Emit to local clients
    this.io.to(`channel:${localChannel._id}`).emit('message:new', {
      ...localMessage.toObject(),
      author: {
        _id: 'federated',
        username: federatedMessage.author.username,
        displayName: `${federatedMessage.author.displayName} (${federatedMessage.author.serverName})`,
        avatar: federatedMessage.author.avatar,
        isFederated: true
      }
    });
  }

  // ==================== User Status ====================

  // Broadcast user status to federation
  async broadcastUserStatus(user, status) {
    const servers = await FederationServer.find({ status: 'active' });

    for (const server of servers) {
      if (!server.settings.syncUsers) continue;

      const socket = federatedConnections.get(server.serverId);
      if (socket && socket.connected) {
        socket.emit('federation:user:status', {
          serverId: this.serverId,
          user: {
            id: user._id.toString(),
            username: user.username,
            displayName: user.displayName || user.username,
            avatar: user.avatar,
            status
          }
        });
      }
    }
  }

  // Handle user status from federated server
  async handleUserStatusUpdate(fromServerId, data) {
    // Broadcast to local clients interested in federated users
    this.io.emit('federation:user:status', {
      serverId: fromServerId,
      user: data.user
    });
  }

  // ==================== Utilities ====================

  // Get federation status
  async getFederationStatus() {
    const servers = await FederationServer.find().select('-sharedSecret');
    const pendingRequests = await FederationRequest.find({ status: 'pending' })
      .populate('reviewedBy', 'username displayName');

    return {
      enabled: federationConfig.enabled,
      serverId: this.serverId,
      serverName: federationConfig.serverName,
      serverUrl: this.serverUrl,
      wsUrl: this.wsUrl,
      connectedServers: servers.filter(s => s.status === 'active').length,
      totalServers: servers.length,
      servers,
      pendingRequests
    };
  }

  // Disconnect from federated server
  async disconnectFromServer(serverId, reason = 'Manual disconnection') {
    const server = await FederationServer.findOne({ serverId });
    if (!server) {
      throw new Error('Federated server not found');
    }

    // Close WebSocket connection
    const socket = federatedConnections.get(serverId);
    if (socket) {
      socket.emit('federation:disconnect', { reason });
      socket.disconnect();
      federatedConnections.delete(serverId);
    }

    // Clear heartbeat
    const heartbeatId = this.heartbeatIntervals.get(serverId);
    if (heartbeatId) {
      clearInterval(heartbeatId);
      this.heartbeatIntervals.delete(serverId);
    }

    // Update status
    server.status = 'disconnected';
    await server.save();

    return { disconnected: true, serverId };
  }

  // Remove federation completely
  async removeFederation(serverId) {
    await this.disconnectFromServer(serverId);

    // Remove server record
    await FederationServer.deleteOne({ serverId });

    // Remove channel mappings
    await FederatedChannel.updateMany(
      {},
      { $pull: { servers: { serverId } } }
    );

    // Clean up orphaned federated channels
    await FederatedChannel.deleteMany({
      servers: { $size: 0 }
    });

    return { removed: true, serverId };
  }

  // Shutdown federation service
  async shutdown() {
    console.log('Shutting down federation service...');

    // Clear all heartbeat intervals
    for (const [serverId, intervalId] of this.heartbeatIntervals) {
      clearInterval(intervalId);
    }
    this.heartbeatIntervals.clear();

    // Disconnect from all federated servers
    for (const [serverId, socket] of federatedConnections) {
      if (socket) {
        socket.emit('federation:disconnect', { reason: 'Server shutdown' });
        socket.disconnect();
      }
    }
    federatedConnections.clear();

    console.log('Federation service shut down complete');
  }
}

// Singleton instance
let federationServiceInstance = null;

function getFederationService(io) {
  if (!federationServiceInstance && io) {
    federationServiceInstance = new FederationService(io);
  }
  return federationServiceInstance;
}

module.exports = { FederationService, getFederationService };
