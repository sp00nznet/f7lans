/**
 * Plex Bot Controller
 * API endpoints for controlling the Plex bot
 */

let plexBotService = null;

const initialize = (service) => {
  plexBotService = service;
};

// Get bot status
const getStatus = async (req, res) => {
  try {
    if (!plexBotService) {
      return res.status(503).json({ error: 'Plex bot service not initialized' });
    }

    const status = plexBotService.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Get Plex bot status error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Enable/disable bot
const setEnabled = async (req, res) => {
  try {
    if (!plexBotService) {
      return res.status(503).json({ error: 'Plex bot service not initialized' });
    }

    const { enabled } = req.body;
    const result = plexBotService.setEnabled(enabled);
    res.json({ message: enabled ? 'Plex bot enabled' : 'Plex bot disabled', ...result });
  } catch (error) {
    console.error('Set Plex bot enabled error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Connect to Plex server
const connect = async (req, res) => {
  try {
    if (!plexBotService) {
      return res.status(503).json({ error: 'Plex bot service not initialized' });
    }

    const { serverUrl, token } = req.body;

    if (!serverUrl || !token) {
      return res.status(400).json({ error: 'Server URL and token are required' });
    }

    const result = await plexBotService.connect(serverUrl, token);
    res.json(result);
  } catch (error) {
    console.error('Connect to Plex error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Disconnect from Plex
const disconnect = async (req, res) => {
  try {
    if (!plexBotService) {
      return res.status(503).json({ error: 'Plex bot service not initialized' });
    }

    const result = plexBotService.disconnect();
    res.json(result);
  } catch (error) {
    console.error('Disconnect from Plex error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Search Plex library
const search = async (req, res) => {
  try {
    if (!plexBotService) {
      return res.status(503).json({ error: 'Plex bot service not initialized' });
    }

    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const results = await plexBotService.search(query);
    res.json({ results });
  } catch (error) {
    console.error('Plex search error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Play media
const play = async (req, res) => {
  try {
    if (!plexBotService) {
      return res.status(503).json({ error: 'Plex bot service not initialized' });
    }

    const { channelId, ratingKey } = req.body;

    if (!channelId || !ratingKey) {
      return res.status(400).json({ error: 'Channel ID and rating key are required' });
    }

    const result = await plexBotService.play(
      channelId,
      ratingKey,
      req.user?.username || 'Admin'
    );
    res.json(result);
  } catch (error) {
    console.error('Plex play error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Stop playback
const stop = async (req, res) => {
  try {
    if (!plexBotService) {
      return res.status(503).json({ error: 'Plex bot service not initialized' });
    }

    const { channelId } = req.body;
    const result = plexBotService.stop(channelId);
    res.json(result);
  } catch (error) {
    console.error('Plex stop error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get thumbnail (proxy)
const getThumb = async (req, res) => {
  try {
    if (!plexBotService) {
      return res.status(503).json({ error: 'Plex bot service not initialized' });
    }

    const { key } = req.query;
    const thumbUrl = plexBotService.getThumbUrl(key);

    if (!thumbUrl) {
      return res.status(404).json({ error: 'Thumbnail not available' });
    }

    // Proxy the image
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(thumbUrl);

    if (!response.ok) {
      return res.status(404).json({ error: 'Thumbnail not found' });
    }

    res.set('Content-Type', response.headers.get('content-type'));
    response.body.pipe(res);
  } catch (error) {
    console.error('Get Plex thumb error:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  initialize,
  getStatus,
  setEnabled,
  connect,
  disconnect,
  search,
  play,
  stop,
  getThumb
};
