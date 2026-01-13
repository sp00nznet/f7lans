/**
 * Chrome Bot Controller
 */

let chromeBotService = null;

const initialize = (service) => {
  chromeBotService = service;
};

const getStatus = async (req, res) => {
  try {
    if (!chromeBotService) {
      return res.status(503).json({ error: 'Chrome bot service not initialized' });
    }
    res.json(chromeBotService.getStatus());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const setEnabled = async (req, res) => {
  try {
    if (!chromeBotService) {
      return res.status(503).json({ error: 'Chrome bot service not initialized' });
    }
    const { enabled } = req.body;
    const result = chromeBotService.setEnabled(enabled);
    res.json({ message: enabled ? 'Chrome bot enabled' : 'Chrome bot disabled', ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const startSession = async (req, res) => {
  try {
    if (!chromeBotService) {
      return res.status(503).json({ error: 'Chrome bot service not initialized' });
    }
    const { channelId, url } = req.body;
    if (!channelId) {
      return res.status(400).json({ error: 'Channel ID is required' });
    }
    const result = chromeBotService.startSession(channelId, url || 'https://google.com', req.user?.username || 'Admin');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getSession = async (req, res) => {
  try {
    if (!chromeBotService) {
      return res.status(503).json({ error: 'Chrome bot service not initialized' });
    }
    const { channelId } = req.params;
    const session = chromeBotService.getSession(channelId);
    if (!session) {
      return res.status(404).json({ error: 'No session in this channel' });
    }
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const navigate = async (req, res) => {
  try {
    if (!chromeBotService) {
      return res.status(503).json({ error: 'Chrome bot service not initialized' });
    }
    const { channelId, url } = req.body;
    if (!channelId || !url) {
      return res.status(400).json({ error: 'Channel ID and URL are required' });
    }
    const result = chromeBotService.navigate(channelId, url, req.user?.username || 'User');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const goBack = async (req, res) => {
  try {
    if (!chromeBotService) {
      return res.status(503).json({ error: 'Chrome bot service not initialized' });
    }
    const { channelId } = req.body;
    if (!channelId) {
      return res.status(400).json({ error: 'Channel ID is required' });
    }
    const result = chromeBotService.goBack(channelId, req.user?.username || 'User');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const goForward = async (req, res) => {
  try {
    if (!chromeBotService) {
      return res.status(503).json({ error: 'Chrome bot service not initialized' });
    }
    const { channelId } = req.body;
    if (!channelId) {
      return res.status(400).json({ error: 'Channel ID is required' });
    }
    const result = chromeBotService.goForward(channelId, req.user?.username || 'User');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const refresh = async (req, res) => {
  try {
    if (!chromeBotService) {
      return res.status(503).json({ error: 'Chrome bot service not initialized' });
    }
    const { channelId } = req.body;
    if (!channelId) {
      return res.status(400).json({ error: 'Channel ID is required' });
    }
    const result = chromeBotService.refresh(channelId, req.user?.username || 'User');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const stopSession = async (req, res) => {
  try {
    if (!chromeBotService) {
      return res.status(503).json({ error: 'Chrome bot service not initialized' });
    }
    const { channelId } = req.body;
    const result = chromeBotService.stopSession(channelId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const joinSession = async (req, res) => {
  try {
    if (!chromeBotService) {
      return res.status(503).json({ error: 'Chrome bot service not initialized' });
    }
    const { channelId } = req.body;
    if (!channelId) {
      return res.status(400).json({ error: 'Channel ID is required' });
    }
    const result = chromeBotService.joinSession(channelId, req.user?.username || 'User');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const transferControl = async (req, res) => {
  try {
    if (!chromeBotService) {
      return res.status(503).json({ error: 'Chrome bot service not initialized' });
    }
    const { channelId, toUserId } = req.body;
    if (!channelId || !toUserId) {
      return res.status(400).json({ error: 'Channel ID and target user are required' });
    }
    const result = chromeBotService.transferControl(channelId, toUserId, req.user?.username || 'Admin');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  initialize, getStatus, setEnabled, startSession, getSession,
  navigate, goBack, goForward, refresh, stopSession, joinSession, transferControl
};
