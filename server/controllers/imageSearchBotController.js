// Image Search Bot Controller
// Handles API requests for the image search bot

let imageSearchBotService = null;

// Initialize with the service instance
const initialize = (service) => {
  imageSearchBotService = service;
};

// Get bot status
const getStatus = async (req, res) => {
  try {
    if (!imageSearchBotService) {
      return res.status(503).json({ error: 'Image search bot service not available' });
    }

    res.json(imageSearchBotService.getStatus());
  } catch (error) {
    console.error('Get image search bot status error:', error);
    res.status(500).json({ error: 'Failed to get bot status' });
  }
};

// Enable/disable bot
const setEnabled = async (req, res) => {
  try {
    if (!imageSearchBotService) {
      return res.status(503).json({ error: 'Image search bot service not available' });
    }

    const { enabled } = req.body;
    const newState = imageSearchBotService.setEnabled(!!enabled);

    res.json({
      enabled: newState,
      message: newState ? 'Image search bot enabled' : 'Image search bot disabled'
    });
  } catch (error) {
    console.error('Set image search bot enabled error:', error);
    res.status(500).json({ error: 'Failed to update bot status' });
  }
};

// Configure API credentials
const configure = async (req, res) => {
  try {
    if (!imageSearchBotService) {
      return res.status(503).json({ error: 'Image search bot service not available' });
    }

    const { apiKey, searchEngineId } = req.body;

    if (!apiKey || !searchEngineId) {
      return res.status(400).json({
        error: 'Google API Key and Custom Search Engine ID are required'
      });
    }

    imageSearchBotService.configure(apiKey, searchEngineId);

    res.json({
      message: 'Image search bot configured',
      configured: true
    });
  } catch (error) {
    console.error('Configure image search error:', error);
    res.status(500).json({ error: 'Failed to configure image search bot' });
  }
};

// Set safe search level
const setSafeSearch = async (req, res) => {
  try {
    if (!imageSearchBotService) {
      return res.status(503).json({ error: 'Image search bot service not available' });
    }

    const { level } = req.body;

    if (!level) {
      return res.status(400).json({ error: 'Safe search level is required (active, medium, or off)' });
    }

    try {
      const newLevel = imageSearchBotService.setSafeSearch(level);
      res.json({
        message: `Safe search set to: ${newLevel}`,
        safeSearch: newLevel
      });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  } catch (error) {
    console.error('Set safe search error:', error);
    res.status(500).json({ error: 'Failed to set safe search level' });
  }
};

// Search for images
const search = async (req, res) => {
  try {
    if (!imageSearchBotService) {
      return res.status(503).json({ error: 'Image search bot service not available' });
    }

    if (!imageSearchBotService.isEnabled()) {
      return res.status(400).json({ error: 'Image search bot is not enabled' });
    }

    if (!imageSearchBotService.isConfigured()) {
      return res.status(400).json({ error: 'Image search bot not configured' });
    }

    const { query, channelId } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    if (!channelId) {
      return res.status(400).json({ error: 'Channel ID is required' });
    }

    const result = await imageSearchBotService.search(
      channelId,
      query,
      req.user.username
    );

    res.json(result);
  } catch (error) {
    console.error('Image search error:', error);
    res.status(500).json({ error: error.message || 'Failed to search for images' });
  }
};

// Get next image
const next = async (req, res) => {
  try {
    if (!imageSearchBotService) {
      return res.status(503).json({ error: 'Image search bot service not available' });
    }

    const { channelId } = req.body;

    if (!channelId) {
      return res.status(400).json({ error: 'Channel ID is required' });
    }

    const result = await imageSearchBotService.next(channelId, req.user.username);
    res.json(result);
  } catch (error) {
    console.error('Image next error:', error);
    res.status(500).json({ error: error.message || 'Failed to get next image' });
  }
};

// Get random image
const random = async (req, res) => {
  try {
    if (!imageSearchBotService) {
      return res.status(503).json({ error: 'Image search bot service not available' });
    }

    const { channelId } = req.body;

    if (!channelId) {
      return res.status(400).json({ error: 'Channel ID is required' });
    }

    const result = await imageSearchBotService.random(channelId, req.user.username);
    res.json(result);
  } catch (error) {
    console.error('Image random error:', error);
    res.status(500).json({ error: error.message || 'Failed to get random image' });
  }
};

// Direct search (returns results without posting to channel)
const searchDirect = async (req, res) => {
  try {
    if (!imageSearchBotService) {
      return res.status(503).json({ error: 'Image search bot service not available' });
    }

    if (!imageSearchBotService.isConfigured()) {
      return res.status(400).json({ error: 'Image search bot not configured' });
    }

    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const results = await imageSearchBotService.searchImages(query);
    res.json({ results });
  } catch (error) {
    console.error('Direct image search error:', error);
    res.status(500).json({ error: error.message || 'Failed to search for images' });
  }
};

module.exports = {
  initialize,
  getStatus,
  setEnabled,
  configure,
  setSafeSearch,
  search,
  next,
  random,
  searchDirect
};
