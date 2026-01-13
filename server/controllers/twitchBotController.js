// Twitch Bot Controller
// Handles admin API requests for the Twitch bot

let twitchBotService = null;

// Initialize with the service instance
const initialize = (service) => {
  twitchBotService = service;
};

// Get bot status
const getStatus = async (req, res) => {
  try {
    if (!twitchBotService) {
      return res.status(503).json({ error: 'Twitch bot service not available' });
    }

    res.json(twitchBotService.getStatus());
  } catch (error) {
    console.error('Get Twitch bot status error:', error);
    res.status(500).json({ error: 'Failed to get bot status' });
  }
};

// Enable/disable bot
const setEnabled = async (req, res) => {
  try {
    if (!twitchBotService) {
      return res.status(503).json({ error: 'Twitch bot service not available' });
    }

    const { enabled } = req.body;
    const newState = twitchBotService.setEnabled(!!enabled);

    res.json({
      enabled: newState,
      message: newState ? 'Twitch bot enabled' : 'Twitch bot disabled'
    });
  } catch (error) {
    console.error('Set Twitch bot enabled error:', error);
    res.status(500).json({ error: 'Failed to update bot status' });
  }
};

// Configure API credentials
const configure = async (req, res) => {
  try {
    if (!twitchBotService) {
      return res.status(503).json({ error: 'Twitch bot service not available' });
    }

    const { clientId, clientSecret } = req.body;

    if (!clientId || !clientSecret) {
      return res.status(400).json({ error: 'Client ID and Client Secret are required' });
    }

    twitchBotService.configure(clientId, clientSecret);

    res.json({
      message: 'Twitch API credentials configured',
      configured: true
    });
  } catch (error) {
    console.error('Configure Twitch error:', error);
    res.status(500).json({ error: 'Failed to configure Twitch bot' });
  }
};

// Search streams
const searchStreams = async (req, res) => {
  try {
    if (!twitchBotService) {
      return res.status(503).json({ error: 'Twitch bot service not available' });
    }

    if (!twitchBotService.isConfigured()) {
      return res.status(400).json({ error: 'Twitch API credentials not configured' });
    }

    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const results = await twitchBotService.searchStreams(query);

    res.json({ results });
  } catch (error) {
    console.error('Search Twitch error:', error);
    res.status(500).json({ error: error.message || 'Failed to search Twitch' });
  }
};

// Get stream info
const getStreamInfo = async (req, res) => {
  try {
    if (!twitchBotService) {
      return res.status(503).json({ error: 'Twitch bot service not available' });
    }

    if (!twitchBotService.isConfigured()) {
      return res.status(400).json({ error: 'Twitch API credentials not configured' });
    }

    const { username } = req.params;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const info = await twitchBotService.getStreamInfo(username);

    res.json(info);
  } catch (error) {
    console.error('Get stream info error:', error);
    res.status(500).json({ error: error.message || 'Failed to get stream info' });
  }
};

// Start watching a stream
const play = async (req, res) => {
  try {
    if (!twitchBotService) {
      return res.status(503).json({ error: 'Twitch bot service not available' });
    }

    if (!twitchBotService.isEnabled()) {
      return res.status(400).json({ error: 'Twitch bot is not enabled' });
    }

    const { channelId, username } = req.body;

    if (!channelId || !username) {
      return res.status(400).json({ error: 'Channel ID and username are required' });
    }

    const result = await twitchBotService.play(channelId, username, req.user.username);

    res.json({
      message: 'Now watching',
      ...result
    });
  } catch (error) {
    console.error('Twitch play error:', error);
    res.status(500).json({ error: error.message || 'Failed to start stream' });
  }
};

// Stop watching
const stop = async (req, res) => {
  try {
    if (!twitchBotService) {
      return res.status(503).json({ error: 'Twitch bot service not available' });
    }

    const { channelId } = req.body;

    if (channelId) {
      twitchBotService.stop(channelId);
    } else {
      twitchBotService.stopAll();
    }

    res.json({ message: 'Stream stopped' });
  } catch (error) {
    console.error('Twitch stop error:', error);
    res.status(500).json({ error: 'Failed to stop stream' });
  }
};

// Get embed URL
const getEmbedUrl = async (req, res) => {
  try {
    if (!twitchBotService) {
      return res.status(503).json({ error: 'Twitch bot service not available' });
    }

    const { username } = req.params;
    const { parent } = req.query;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const embedUrl = twitchBotService.getEmbedUrl(username, parent || 'localhost');
    const chatUrl = twitchBotService.getChatEmbedUrl(username, parent || 'localhost');

    res.json({
      embedUrl,
      chatUrl
    });
  } catch (error) {
    console.error('Get embed URL error:', error);
    res.status(500).json({ error: 'Failed to get embed URL' });
  }
};

// Get active stream for channel
const getActiveStream = async (req, res) => {
  try {
    if (!twitchBotService) {
      return res.status(503).json({ error: 'Twitch bot service not available' });
    }

    const { channelId } = req.params;
    const stream = twitchBotService.getActiveStream(channelId);

    res.json({ stream });
  } catch (error) {
    console.error('Get active stream error:', error);
    res.status(500).json({ error: 'Failed to get active stream' });
  }
};

module.exports = {
  initialize,
  getStatus,
  setEnabled,
  configure,
  searchStreams,
  getStreamInfo,
  play,
  stop,
  getEmbedUrl,
  getActiveStream
};
