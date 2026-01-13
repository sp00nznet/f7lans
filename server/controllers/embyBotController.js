/**
 * Emby Bot Controller
 */

let embyBotService = null;

const initialize = (service) => {
  embyBotService = service;
};

const getStatus = async (req, res) => {
  try {
    if (!embyBotService) {
      return res.status(503).json({ error: 'Emby bot service not initialized' });
    }
    res.json(embyBotService.getStatus());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const setEnabled = async (req, res) => {
  try {
    if (!embyBotService) {
      return res.status(503).json({ error: 'Emby bot service not initialized' });
    }
    const { enabled } = req.body;
    const result = embyBotService.setEnabled(enabled);
    res.json({ message: enabled ? 'Emby bot enabled' : 'Emby bot disabled', ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const connect = async (req, res) => {
  try {
    if (!embyBotService) {
      return res.status(503).json({ error: 'Emby bot service not initialized' });
    }
    const { serverUrl, apiKey } = req.body;
    if (!serverUrl || !apiKey) {
      return res.status(400).json({ error: 'Server URL and API key are required' });
    }
    const result = await embyBotService.connect(serverUrl, apiKey);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const disconnect = async (req, res) => {
  try {
    if (!embyBotService) {
      return res.status(503).json({ error: 'Emby bot service not initialized' });
    }
    const result = embyBotService.disconnect();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const search = async (req, res) => {
  try {
    if (!embyBotService) {
      return res.status(503).json({ error: 'Emby bot service not initialized' });
    }
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    const results = await embyBotService.search(query);
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const play = async (req, res) => {
  try {
    if (!embyBotService) {
      return res.status(503).json({ error: 'Emby bot service not initialized' });
    }
    const { channelId, itemId } = req.body;
    if (!channelId || !itemId) {
      return res.status(400).json({ error: 'Channel ID and item ID are required' });
    }
    const result = await embyBotService.play(channelId, itemId, req.user?.username || 'Admin');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const stop = async (req, res) => {
  try {
    if (!embyBotService) {
      return res.status(503).json({ error: 'Emby bot service not initialized' });
    }
    const { channelId } = req.body;
    const result = embyBotService.stop(channelId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { initialize, getStatus, setEnabled, connect, disconnect, search, play, stop };
