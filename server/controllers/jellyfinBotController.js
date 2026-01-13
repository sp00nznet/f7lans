/**
 * Jellyfin Bot Controller
 */

let jellyfinBotService = null;

const initialize = (service) => {
  jellyfinBotService = service;
};

const getStatus = async (req, res) => {
  try {
    if (!jellyfinBotService) {
      return res.status(503).json({ error: 'Jellyfin bot service not initialized' });
    }
    res.json(jellyfinBotService.getStatus());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const setEnabled = async (req, res) => {
  try {
    if (!jellyfinBotService) {
      return res.status(503).json({ error: 'Jellyfin bot service not initialized' });
    }
    const { enabled } = req.body;
    const result = jellyfinBotService.setEnabled(enabled);
    res.json({ message: enabled ? 'Jellyfin bot enabled' : 'Jellyfin bot disabled', ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const connect = async (req, res) => {
  try {
    if (!jellyfinBotService) {
      return res.status(503).json({ error: 'Jellyfin bot service not initialized' });
    }
    const { serverUrl, apiKey } = req.body;
    if (!serverUrl || !apiKey) {
      return res.status(400).json({ error: 'Server URL and API key are required' });
    }
    const result = await jellyfinBotService.connect(serverUrl, apiKey);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const disconnect = async (req, res) => {
  try {
    if (!jellyfinBotService) {
      return res.status(503).json({ error: 'Jellyfin bot service not initialized' });
    }
    const result = jellyfinBotService.disconnect();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const search = async (req, res) => {
  try {
    if (!jellyfinBotService) {
      return res.status(503).json({ error: 'Jellyfin bot service not initialized' });
    }
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    const results = await jellyfinBotService.search(query);
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const play = async (req, res) => {
  try {
    if (!jellyfinBotService) {
      return res.status(503).json({ error: 'Jellyfin bot service not initialized' });
    }
    const { channelId, itemId } = req.body;
    if (!channelId || !itemId) {
      return res.status(400).json({ error: 'Channel ID and item ID are required' });
    }
    const result = await jellyfinBotService.play(channelId, itemId, req.user?.username || 'Admin');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const stop = async (req, res) => {
  try {
    if (!jellyfinBotService) {
      return res.status(503).json({ error: 'Jellyfin bot service not initialized' });
    }
    const { channelId } = req.body;
    const result = jellyfinBotService.stop(channelId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { initialize, getStatus, setEnabled, connect, disconnect, search, play, stop };
