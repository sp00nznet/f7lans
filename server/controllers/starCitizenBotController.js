// Star Citizen Bot Controller
// Handles API requests for the Star Citizen helper bot

let starCitizenBotService = null;

// Initialize with the service instance
const initialize = (service) => {
  starCitizenBotService = service;
};

// Get bot status
const getStatus = async (req, res) => {
  try {
    if (!starCitizenBotService) {
      return res.status(503).json({ error: 'Star Citizen bot service not available' });
    }

    res.json(starCitizenBotService.getStatus());
  } catch (error) {
    console.error('Get Star Citizen bot status error:', error);
    res.status(500).json({ error: 'Failed to get bot status' });
  }
};

// Enable/disable bot
const setEnabled = async (req, res) => {
  try {
    if (!starCitizenBotService) {
      return res.status(503).json({ error: 'Star Citizen bot service not available' });
    }

    const { enabled } = req.body;
    const newState = starCitizenBotService.setEnabled(!!enabled);

    res.json({
      enabled: newState,
      message: newState ? 'Star Citizen bot enabled' : 'Star Citizen bot disabled'
    });
  } catch (error) {
    console.error('Set Star Citizen bot enabled error:', error);
    res.status(500).json({ error: 'Failed to update bot status' });
  }
};

// Start monitoring a channel
const startMonitoring = async (req, res) => {
  try {
    if (!starCitizenBotService) {
      return res.status(503).json({ error: 'Star Citizen bot service not available' });
    }

    if (!starCitizenBotService.isEnabled()) {
      return res.status(400).json({ error: 'Star Citizen bot is not enabled' });
    }

    const { channelId, tipsEnabled, tipInterval } = req.body;

    if (!channelId) {
      return res.status(400).json({ error: 'Channel ID is required' });
    }

    const result = starCitizenBotService.startMonitoring(channelId, {
      tipsEnabled,
      tipInterval
    });

    res.json({
      message: 'Now monitoring channel for Star Citizen players',
      ...result
    });
  } catch (error) {
    console.error('Start monitoring error:', error);
    res.status(500).json({ error: 'Failed to start monitoring' });
  }
};

// Stop monitoring a channel
const stopMonitoring = async (req, res) => {
  try {
    if (!starCitizenBotService) {
      return res.status(503).json({ error: 'Star Citizen bot service not available' });
    }

    const { channelId } = req.body;

    if (!channelId) {
      return res.status(400).json({ error: 'Channel ID is required' });
    }

    const result = starCitizenBotService.stopMonitoring(channelId);

    res.json({
      message: 'Stopped monitoring channel',
      ...result
    });
  } catch (error) {
    console.error('Stop monitoring error:', error);
    res.status(500).json({ error: 'Failed to stop monitoring' });
  }
};

// Get a tip
const getTip = async (req, res) => {
  try {
    if (!starCitizenBotService) {
      return res.status(503).json({ error: 'Star Citizen bot service not available' });
    }

    const { topic } = req.query;
    const result = starCitizenBotService.getTip(topic || 'general');

    res.json(result);
  } catch (error) {
    console.error('Get tip error:', error);
    res.status(500).json({ error: 'Failed to get tip' });
  }
};

// Post tip to channel
const postTip = async (req, res) => {
  try {
    if (!starCitizenBotService) {
      return res.status(503).json({ error: 'Star Citizen bot service not available' });
    }

    if (!starCitizenBotService.isEnabled()) {
      return res.status(400).json({ error: 'Star Citizen bot is not enabled' });
    }

    const { channelId, topic } = req.body;

    if (!channelId) {
      return res.status(400).json({ error: 'Channel ID is required' });
    }

    const tipData = starCitizenBotService.getTip(topic || 'general');

    // The message will be posted via the callback
    res.json({
      message: 'Tip posted to channel',
      ...tipData
    });
  } catch (error) {
    console.error('Post tip error:', error);
    res.status(500).json({ error: 'Failed to post tip' });
  }
};

// Get location info
const getLocationInfo = async (req, res) => {
  try {
    if (!starCitizenBotService) {
      return res.status(503).json({ error: 'Star Citizen bot service not available' });
    }

    const { location } = req.params;

    if (!location) {
      return res.status(400).json({ error: 'Location is required' });
    }

    const result = starCitizenBotService.getLocationInfo(location);

    res.json(result);
  } catch (error) {
    console.error('Get location info error:', error);
    res.status(500).json({ error: 'Failed to get location info' });
  }
};

// Get server status
const getServerStatus = async (req, res) => {
  try {
    if (!starCitizenBotService) {
      return res.status(503).json({ error: 'Star Citizen bot service not available' });
    }

    const result = await starCitizenBotService.getServerStatus();

    res.json(result);
  } catch (error) {
    console.error('Get server status error:', error);
    res.status(500).json({ error: 'Failed to get server status' });
  }
};

// Get active players
const getActivePlayers = async (req, res) => {
  try {
    if (!starCitizenBotService) {
      return res.status(503).json({ error: 'Star Citizen bot service not available' });
    }

    const { channelId } = req.params;
    const players = starCitizenBotService.getActivePlayers(channelId);

    res.json({ players, count: players.length });
  } catch (error) {
    console.error('Get active players error:', error);
    res.status(500).json({ error: 'Failed to get active players' });
  }
};

// Update channel settings
const updateChannelSettings = async (req, res) => {
  try {
    if (!starCitizenBotService) {
      return res.status(503).json({ error: 'Star Citizen bot service not available' });
    }

    const { channelId } = req.params;
    const { tipsEnabled, tipInterval } = req.body;

    let updated = false;

    if (tipsEnabled !== undefined) {
      updated = starCitizenBotService.setTipsEnabled(channelId, tipsEnabled) || updated;
    }

    if (tipInterval !== undefined) {
      updated = starCitizenBotService.setTipInterval(channelId, tipInterval) || updated;
    }

    if (!updated) {
      return res.status(404).json({ error: 'Channel not being monitored' });
    }

    res.json({ message: 'Channel settings updated' });
  } catch (error) {
    console.error('Update channel settings error:', error);
    res.status(500).json({ error: 'Failed to update channel settings' });
  }
};

// Track user activity (called when user starts/stops playing SC)
const trackActivity = async (req, res) => {
  try {
    if (!starCitizenBotService) {
      return res.status(503).json({ error: 'Star Citizen bot service not available' });
    }

    const { userId, username, activity } = req.body;

    const result = starCitizenBotService.trackUserActivity(userId, username, activity);

    res.json({
      tracked: !!result,
      state: result
    });
  } catch (error) {
    console.error('Track activity error:', error);
    res.status(500).json({ error: 'Failed to track activity' });
  }
};

module.exports = {
  initialize,
  getStatus,
  setEnabled,
  startMonitoring,
  stopMonitoring,
  getTip,
  postTip,
  getLocationInfo,
  getServerStatus,
  getActivePlayers,
  updateChannelSettings,
  trackActivity
};
