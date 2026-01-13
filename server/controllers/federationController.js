const { getFederationService } = require('../services/federationService');
const {
  FederationServer,
  FederatedChannel,
  FederationRequest
} = require('../models/Federation');
const {
  federationConfig,
  getServerId,
  verifyAuthHeader
} = require('../config/federation');
const Channel = require('../models/Channel');

// Get federation service instance
const getService = (req) => {
  return getFederationService(req.app.get('io'));
};

// Get this server's federation info (public endpoint for federation discovery)
const getServerInfo = async (req, res) => {
  try {
    const service = getService(req);
    const info = await service.getServerInfo();

    // Include channels for federation analysis
    const channels = await service.getChannelsForSync();

    res.json({
      ...info,
      channels
    });
  } catch (error) {
    console.error('Get server info error:', error);
    res.status(500).json({ error: 'Failed to get server info' });
  }
};

// Get federation status (authenticated admin endpoint)
const getFederationStatus = async (req, res) => {
  try {
    const service = getService(req);
    const status = await service.getFederationStatus();

    res.json(status);
  } catch (error) {
    console.error('Get federation status error:', error);
    res.status(500).json({ error: 'Failed to get federation status' });
  }
};

// Get list of federated servers
const getFederatedServers = async (req, res) => {
  try {
    const servers = await FederationServer.find()
      .select('-sharedSecret')
      .sort({ connectedAt: -1 });

    res.json({ servers });
  } catch (error) {
    console.error('Get federated servers error:', error);
    res.status(500).json({ error: 'Failed to get federated servers' });
  }
};

// Get pending federation requests
const getPendingRequests = async (req, res) => {
  try {
    const requests = await FederationRequest.find({ status: 'pending' })
      .populate('reviewedBy', 'username displayName')
      .sort({ createdAt: -1 });

    res.json({ requests });
  } catch (error) {
    console.error('Get pending requests error:', error);
    res.status(500).json({ error: 'Failed to get pending requests' });
  }
};

// Initiate federation with another server
const initiateFederation = async (req, res) => {
  try {
    const { targetUrl } = req.body;

    if (!targetUrl) {
      return res.status(400).json({ error: 'Target server URL is required' });
    }

    // Validate URL format
    try {
      new URL(targetUrl);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const service = getService(req);
    const result = await service.createFederationRequest(targetUrl);

    res.json(result);
  } catch (error) {
    console.error('Initiate federation error:', error);
    res.status(500).json({ error: error.message || 'Failed to initiate federation' });
  }
};

// Handle incoming federation request (from another server)
const handleFederationRequest = async (req, res) => {
  try {
    const request = req.body;

    if (!request.fromServer || !request.requestId) {
      return res.status(400).json({ error: 'Invalid federation request' });
    }

    const service = getService(req);
    const result = await service.handleFederationRequest(request);

    res.json(result);
  } catch (error) {
    console.error('Handle federation request error:', error);
    res.status(500).json({ error: error.message || 'Failed to handle federation request' });
  }
};

// Approve federation request
const approveFederationRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { conflictResolutions } = req.body;

    const service = getService(req);
    const result = await service.approveFederationRequest(
      requestId,
      req.user._id,
      conflictResolutions || {}
    );

    res.json(result);
  } catch (error) {
    console.error('Approve federation error:', error);
    res.status(500).json({ error: error.message || 'Failed to approve federation' });
  }
};

// Reject federation request
const rejectFederationRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;

    const service = getService(req);
    const result = await service.rejectFederationRequest(
      requestId,
      req.user._id,
      reason || ''
    );

    res.json(result);
  } catch (error) {
    console.error('Reject federation error:', error);
    res.status(500).json({ error: error.message || 'Failed to reject federation' });
  }
};

// Handle approval notification from another server
const handleApprovalNotification = async (req, res) => {
  try {
    const data = req.body;

    // Find our pending request
    const request = await FederationRequest.findOne({
      requestId: data.requestId,
      status: 'pending'
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Create the federation server entry
    await FederationServer.create({
      serverId: data.serverId,
      name: data.name,
      url: data.url,
      wsUrl: data.wsUrl,
      sharedSecret: data.sharedSecret,
      status: 'active',
      isInitiator: true,
      connectedAt: new Date()
    });

    // Update request status
    request.status = 'approved';
    await request.save();

    // Apply conflict resolutions
    if (data.conflictResolutions) {
      for (const conflict of data.conflictResolutions) {
        if (conflict.suggestedResolution === 'rename_local' && conflict.resolvedName) {
          await Channel.findOneAndUpdate(
            { name: conflict.localChannel },
            { name: conflict.resolvedName }
          );
        }
      }
    }

    // Connect to the server
    const service = getService(req);
    const server = await FederationServer.findOne({ serverId: data.serverId });
    await service.connectToFederatedServer(server);
    await service.syncChannelsWithServer(server);

    res.json({ status: 'connected' });
  } catch (error) {
    console.error('Handle approval notification error:', error);
    res.status(500).json({ error: 'Failed to handle approval' });
  }
};

// Handle rejection notification from another server
const handleRejectionNotification = async (req, res) => {
  try {
    const { requestId, reason } = req.body;

    await FederationRequest.findOneAndUpdate(
      { requestId },
      { status: 'rejected', reviewNotes: reason }
    );

    res.json({ status: 'acknowledged' });
  } catch (error) {
    console.error('Handle rejection notification error:', error);
    res.status(500).json({ error: 'Failed to handle rejection' });
  }
};

// Disconnect from a federated server
const disconnectServer = async (req, res) => {
  try {
    const { serverId } = req.params;
    const { reason } = req.body;

    const service = getService(req);
    const result = await service.disconnectFromServer(serverId, reason);

    res.json(result);
  } catch (error) {
    console.error('Disconnect server error:', error);
    res.status(500).json({ error: error.message || 'Failed to disconnect' });
  }
};

// Remove federation completely
const removeFederation = async (req, res) => {
  try {
    const { serverId } = req.params;

    const service = getService(req);
    const result = await service.removeFederation(serverId);

    res.json(result);
  } catch (error) {
    console.error('Remove federation error:', error);
    res.status(500).json({ error: error.message || 'Failed to remove federation' });
  }
};

// Get federated channels
const getFederatedChannels = async (req, res) => {
  try {
    const channels = await FederatedChannel.find()
      .sort({ name: 1 });

    res.json({ channels });
  } catch (error) {
    console.error('Get federated channels error:', error);
    res.status(500).json({ error: 'Failed to get federated channels' });
  }
};

// Update federation settings for a server
const updateServerSettings = async (req, res) => {
  try {
    const { serverId } = req.params;
    const { settings, trustLevel } = req.body;

    const updates = {};
    if (settings) updates.settings = settings;
    if (trustLevel) updates.trustLevel = trustLevel;

    const server = await FederationServer.findOneAndUpdate(
      { serverId },
      { $set: updates },
      { new: true }
    ).select('-sharedSecret');

    if (!server) {
      return res.status(404).json({ error: 'Federated server not found' });
    }

    res.json({ server });
  } catch (error) {
    console.error('Update server settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
};

// Toggle channel federation sync
const toggleChannelSync = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { serverId, syncEnabled } = req.body;

    const channel = await FederatedChannel.findOneAndUpdate(
      {
        'servers.localChannelId': channelId,
        'servers.serverId': serverId
      },
      {
        $set: { 'servers.$.syncEnabled': syncEnabled }
      },
      { new: true }
    );

    if (!channel) {
      return res.status(404).json({ error: 'Federated channel not found' });
    }

    res.json({ channel });
  } catch (error) {
    console.error('Toggle channel sync error:', error);
    res.status(500).json({ error: 'Failed to toggle sync' });
  }
};

// Analyze potential conflicts before federation
const analyzeConflicts = async (req, res) => {
  try {
    const { targetUrl } = req.body;

    if (!targetUrl) {
      return res.status(400).json({ error: 'Target URL required' });
    }

    const service = getService(req);

    // Fetch remote server info
    const remoteInfo = await service.fetchServerInfo(targetUrl);

    // Get local channels
    const localChannels = await service.getChannelsForSync();
    const remoteChannels = remoteInfo.channels || [];

    // Analyze conflicts
    const { analyzeChannelConflicts, suggestConflictResolution } = require('../config/federation');
    const conflicts = analyzeChannelConflicts(localChannels, remoteChannels);

    // Get stats for resolution suggestions
    const localInfo = await service.getServerInfo();

    const resolvedConflicts = conflicts.map(conflict =>
      suggestConflictResolution(conflict, localInfo.stats, remoteInfo.stats)
    );

    res.json({
      targetServer: {
        serverId: remoteInfo.serverId,
        name: remoteInfo.name,
        stats: remoteInfo.stats
      },
      localServer: {
        serverId: localInfo.serverId,
        name: localInfo.name,
        stats: localInfo.stats
      },
      conflicts: resolvedConflicts,
      hasConflicts: resolvedConflicts.length > 0
    });
  } catch (error) {
    console.error('Analyze conflicts error:', error);
    res.status(500).json({ error: error.message || 'Failed to analyze conflicts' });
  }
};

module.exports = {
  getServerInfo,
  getFederationStatus,
  getFederatedServers,
  getPendingRequests,
  initiateFederation,
  handleFederationRequest,
  approveFederationRequest,
  rejectFederationRequest,
  handleApprovalNotification,
  handleRejectionNotification,
  disconnectServer,
  removeFederation,
  getFederatedChannels,
  updateServerSettings,
  toggleChannelSync,
  analyzeConflicts
};
