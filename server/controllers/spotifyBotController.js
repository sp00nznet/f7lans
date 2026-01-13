/**
 * Spotify Bot Controller
 */

let spotifyBotService = null;

const initialize = (service) => {
  spotifyBotService = service;
};

const getStatus = async (req, res) => {
  try {
    if (!spotifyBotService) {
      return res.status(503).json({ error: 'Spotify bot service not initialized' });
    }
    res.json(spotifyBotService.getStatus());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const setEnabled = async (req, res) => {
  try {
    if (!spotifyBotService) {
      return res.status(503).json({ error: 'Spotify bot service not initialized' });
    }
    const { enabled } = req.body;
    const result = spotifyBotService.setEnabled(enabled);
    res.json({ message: enabled ? 'Spotify bot enabled' : 'Spotify bot disabled', ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const configure = async (req, res) => {
  try {
    if (!spotifyBotService) {
      return res.status(503).json({ error: 'Spotify bot service not initialized' });
    }
    const { clientId, clientSecret } = req.body;
    if (!clientId || !clientSecret) {
      return res.status(400).json({ error: 'Client ID and secret are required' });
    }
    const result = spotifyBotService.configure(clientId, clientSecret);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAuthUrl = async (req, res) => {
  try {
    if (!spotifyBotService) {
      return res.status(503).json({ error: 'Spotify bot service not initialized' });
    }
    const { redirectUri } = req.query;
    if (!redirectUri) {
      return res.status(400).json({ error: 'Redirect URI is required' });
    }
    const url = spotifyBotService.getAuthUrl(redirectUri);
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const callback = async (req, res) => {
  try {
    if (!spotifyBotService) {
      return res.status(503).json({ error: 'Spotify bot service not initialized' });
    }
    const { code, redirectUri } = req.body;
    if (!code || !redirectUri) {
      return res.status(400).json({ error: 'Code and redirect URI are required' });
    }
    const result = await spotifyBotService.exchangeCode(code, redirectUri);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const disconnect = async (req, res) => {
  try {
    if (!spotifyBotService) {
      return res.status(503).json({ error: 'Spotify bot service not initialized' });
    }
    const result = spotifyBotService.disconnect();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const search = async (req, res) => {
  try {
    if (!spotifyBotService) {
      return res.status(503).json({ error: 'Spotify bot service not initialized' });
    }
    const { query, types } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    const typeArray = types ? types.split(',') : ['track', 'album', 'playlist', 'artist'];
    const results = await spotifyBotService.search(query, typeArray);
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPlaylists = async (req, res) => {
  try {
    if (!spotifyBotService) {
      return res.status(503).json({ error: 'Spotify bot service not initialized' });
    }
    const playlists = await spotifyBotService.getUserPlaylists();
    res.json({ playlists });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPlaylistTracks = async (req, res) => {
  try {
    if (!spotifyBotService) {
      return res.status(503).json({ error: 'Spotify bot service not initialized' });
    }
    const { playlistId } = req.params;
    const tracks = await spotifyBotService.getPlaylistTracks(playlistId);
    res.json({ tracks });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const play = async (req, res) => {
  try {
    if (!spotifyBotService) {
      return res.status(503).json({ error: 'Spotify bot service not initialized' });
    }
    const { channelId, uri } = req.body;
    if (!channelId || !uri) {
      return res.status(400).json({ error: 'Channel ID and Spotify URI are required' });
    }
    const result = await spotifyBotService.play(channelId, uri, req.user?.username || 'User');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const addToQueue = async (req, res) => {
  try {
    if (!spotifyBotService) {
      return res.status(503).json({ error: 'Spotify bot service not initialized' });
    }
    const { channelId, uri } = req.body;
    if (!channelId || !uri) {
      return res.status(400).json({ error: 'Channel ID and Spotify URI are required' });
    }
    const result = await spotifyBotService.addToQueue(channelId, uri, req.user?.username || 'User');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const skip = async (req, res) => {
  try {
    if (!spotifyBotService) {
      return res.status(503).json({ error: 'Spotify bot service not initialized' });
    }
    const { channelId } = req.body;
    if (!channelId) {
      return res.status(400).json({ error: 'Channel ID is required' });
    }
    const result = spotifyBotService.skip(channelId, req.user?.username || 'User');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getQueue = async (req, res) => {
  try {
    if (!spotifyBotService) {
      return res.status(503).json({ error: 'Spotify bot service not initialized' });
    }
    const { channelId } = req.params;
    const queue = spotifyBotService.getQueue(channelId);
    res.json({ queue });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const stop = async (req, res) => {
  try {
    if (!spotifyBotService) {
      return res.status(503).json({ error: 'Spotify bot service not initialized' });
    }
    const { channelId } = req.body;
    const result = spotifyBotService.stop(channelId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  initialize, getStatus, setEnabled, configure, getAuthUrl, callback,
  disconnect, search, getPlaylists, getPlaylistTracks, play, addToQueue, skip, getQueue, stop
};
