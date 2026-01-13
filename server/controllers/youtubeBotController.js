// YouTube Bot Controller
// Handles admin API requests for the YouTube bot

let youtubeBotService = null;

// Initialize with the service instance
const initialize = (service) => {
  youtubeBotService = service;
};

// Get bot status
const getStatus = async (req, res) => {
  try {
    if (!youtubeBotService) {
      return res.status(503).json({ error: 'YouTube bot service not available' });
    }

    res.json({
      enabled: youtubeBotService.isEnabled(),
      activeStreams: youtubeBotService.getAllStreams()
    });
  } catch (error) {
    console.error('Get YouTube bot status error:', error);
    res.status(500).json({ error: 'Failed to get bot status' });
  }
};

// Enable/disable bot
const setEnabled = async (req, res) => {
  try {
    if (!youtubeBotService) {
      return res.status(503).json({ error: 'YouTube bot service not available' });
    }

    const { enabled } = req.body;
    const newState = youtubeBotService.setEnabled(!!enabled);

    res.json({
      enabled: newState,
      message: newState ? 'YouTube bot enabled' : 'YouTube bot disabled'
    });
  } catch (error) {
    console.error('Set YouTube bot enabled error:', error);
    res.status(500).json({ error: 'Failed to update bot status' });
  }
};

// Play a video
const play = async (req, res) => {
  try {
    if (!youtubeBotService) {
      return res.status(503).json({ error: 'YouTube bot service not available' });
    }

    if (!youtubeBotService.isEnabled()) {
      return res.status(400).json({ error: 'YouTube bot is not enabled' });
    }

    const { channelId, url } = req.body;

    if (!channelId || !url) {
      return res.status(400).json({ error: 'Channel ID and URL are required' });
    }

    const result = await youtubeBotService.play(channelId, url, req.user.username);

    res.json({
      message: 'Now playing',
      ...result
    });
  } catch (error) {
    console.error('YouTube play error:', error);
    res.status(500).json({ error: error.message || 'Failed to play video' });
  }
};

// Stop playback
const stop = async (req, res) => {
  try {
    if (!youtubeBotService) {
      return res.status(503).json({ error: 'YouTube bot service not available' });
    }

    const { channelId } = req.body;

    if (channelId) {
      youtubeBotService.stop(channelId);
    } else {
      youtubeBotService.stopAll();
    }

    res.json({ message: 'Playback stopped' });
  } catch (error) {
    console.error('YouTube stop error:', error);
    res.status(500).json({ error: 'Failed to stop playback' });
  }
};

// Get video info
const getVideoInfo = async (req, res) => {
  try {
    if (!youtubeBotService) {
      return res.status(503).json({ error: 'YouTube bot service not available' });
    }

    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const info = await youtubeBotService.getVideoInfo(url);

    res.json(info);
  } catch (error) {
    console.error('Get video info error:', error);
    res.status(500).json({ error: error.message || 'Failed to get video info' });
  }
};

// Get stream URL for a video
const getStreamUrl = async (req, res) => {
  try {
    if (!youtubeBotService) {
      return res.status(503).json({ error: 'YouTube bot service not available' });
    }

    if (!youtubeBotService.isEnabled()) {
      return res.status(400).json({ error: 'YouTube bot is not enabled' });
    }

    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const streamUrl = await youtubeBotService.getStreamUrl(url);

    res.json({ streamUrl });
  } catch (error) {
    console.error('Get stream URL error:', error);
    res.status(500).json({ error: error.message || 'Failed to get stream URL' });
  }
};

module.exports = {
  initialize,
  getStatus,
  setEnabled,
  play,
  stop,
  getVideoInfo,
  getStreamUrl
};
