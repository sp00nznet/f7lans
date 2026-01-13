// Activity Stats Bot Controller
// Handles admin API requests for the activity stats bot

let activityStatsBotService = null;

// Initialize with the service instance
const initialize = (service) => {
  activityStatsBotService = service;
};

// Get bot status
const getStatus = async (req, res) => {
  try {
    if (!activityStatsBotService) {
      return res.status(503).json({ error: 'Activity stats bot service not available' });
    }

    res.json(activityStatsBotService.getStatus());
  } catch (error) {
    console.error('Get activity stats bot status error:', error);
    res.status(500).json({ error: 'Failed to get bot status' });
  }
};

// Enable/disable bot
const setEnabled = async (req, res) => {
  try {
    if (!activityStatsBotService) {
      return res.status(503).json({ error: 'Activity stats bot service not available' });
    }

    const { enabled } = req.body;
    const newState = activityStatsBotService.setEnabled(!!enabled);

    res.json({
      enabled: newState,
      message: newState ? 'Activity stats bot enabled' : 'Activity stats bot disabled'
    });
  } catch (error) {
    console.error('Set activity stats bot enabled error:', error);
    res.status(500).json({ error: 'Failed to update bot status' });
  }
};

// Start stats in a channel
const startStats = async (req, res) => {
  try {
    if (!activityStatsBotService) {
      return res.status(503).json({ error: 'Activity stats bot service not available' });
    }

    if (!activityStatsBotService.isEnabled()) {
      return res.status(400).json({ error: 'Activity stats bot is not enabled' });
    }

    const { channelId } = req.body;

    if (!channelId) {
      return res.status(400).json({ error: 'Channel ID is required' });
    }

    activityStatsBotService.startStats(channelId);

    res.json({
      message: 'Activity stats started in channel',
      channelId
    });
  } catch (error) {
    console.error('Start activity stats error:', error);
    res.status(500).json({ error: error.message || 'Failed to start activity stats' });
  }
};

// Stop stats in a channel
const stopStats = async (req, res) => {
  try {
    if (!activityStatsBotService) {
      return res.status(503).json({ error: 'Activity stats bot service not available' });
    }

    const { channelId } = req.body;

    if (channelId) {
      activityStatsBotService.stopStats(channelId);
    } else {
      activityStatsBotService.stopAll();
    }

    res.json({ message: 'Activity stats stopped' });
  } catch (error) {
    console.error('Stop activity stats error:', error);
    res.status(500).json({ error: 'Failed to stop activity stats' });
  }
};

// Get current stats
const getStats = async (req, res) => {
  try {
    if (!activityStatsBotService) {
      return res.status(503).json({ error: 'Activity stats bot service not available' });
    }

    const stats = await activityStatsBotService.getFormattedStats();
    res.json(stats);
  } catch (error) {
    console.error('Get activity stats error:', error);
    res.status(500).json({ error: 'Failed to get activity stats' });
  }
};

// Get leaderboard
const getLeaderboard = async (req, res) => {
  try {
    if (!activityStatsBotService) {
      return res.status(503).json({ error: 'Activity stats bot service not available' });
    }

    const days = parseInt(req.query.days) || 30;
    const limit = parseInt(req.query.limit) || 10;

    const leaderboard = await activityStatsBotService.getLeaderboard(days, limit);
    res.json({ leaderboard });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
};

// Get game-specific stats
const getGameStats = async (req, res) => {
  try {
    if (!activityStatsBotService) {
      return res.status(503).json({ error: 'Activity stats bot service not available' });
    }

    const { gameName } = req.params;
    const days = parseInt(req.query.days) || 30;

    if (!gameName) {
      return res.status(400).json({ error: 'Game name is required' });
    }

    const stats = await activityStatsBotService.getGameStats(gameName, days);
    res.json(stats);
  } catch (error) {
    console.error('Get game stats error:', error);
    res.status(500).json({ error: 'Failed to get game stats' });
  }
};

module.exports = {
  initialize,
  getStatus,
  setEnabled,
  startStats,
  stopStats,
  getStats,
  getLeaderboard,
  getGameStats
};
