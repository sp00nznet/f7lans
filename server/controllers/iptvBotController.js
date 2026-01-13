/**
 * IPTV Bot Controller
 */

let iptvBotService = null;

const initialize = (service) => {
  iptvBotService = service;
};

const getStatus = async (req, res) => {
  try {
    if (!iptvBotService) {
      return res.status(503).json({ error: 'IPTV bot service not initialized' });
    }
    res.json(iptvBotService.getStatus());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const setEnabled = async (req, res) => {
  try {
    if (!iptvBotService) {
      return res.status(503).json({ error: 'IPTV bot service not initialized' });
    }
    const { enabled } = req.body;
    const result = iptvBotService.setEnabled(enabled);
    res.json({ message: enabled ? 'IPTV bot enabled' : 'IPTV bot disabled', ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const configure = async (req, res) => {
  try {
    if (!iptvBotService) {
      return res.status(503).json({ error: 'IPTV bot service not initialized' });
    }
    const { playlistUrl, epgUrl } = req.body;
    if (!playlistUrl) {
      return res.status(400).json({ error: 'Playlist URL is required' });
    }
    const result = await iptvBotService.configure(playlistUrl, epgUrl);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getChannels = async (req, res) => {
  try {
    if (!iptvBotService) {
      return res.status(503).json({ error: 'IPTV bot service not initialized' });
    }
    const { group } = req.query;
    const channels = iptvBotService.getChannels(group);
    res.json({ channels });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getGroups = async (req, res) => {
  try {
    if (!iptvBotService) {
      return res.status(503).json({ error: 'IPTV bot service not initialized' });
    }
    const groups = iptvBotService.getGroups();
    res.json({ groups });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getEPG = async (req, res) => {
  try {
    if (!iptvBotService) {
      return res.status(503).json({ error: 'IPTV bot service not initialized' });
    }
    const { channelId } = req.params;
    const { date } = req.query;
    const epg = iptvBotService.getChannelEPG(channelId, date ? new Date(date) : new Date());
    if (!epg) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    res.json(epg);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const play = async (req, res) => {
  try {
    if (!iptvBotService) {
      return res.status(503).json({ error: 'IPTV bot service not initialized' });
    }
    const { voiceChannelId, iptvChannelId } = req.body;
    if (!voiceChannelId || !iptvChannelId) {
      return res.status(400).json({ error: 'Voice channel ID and IPTV channel ID are required' });
    }
    const result = iptvBotService.play(voiceChannelId, iptvChannelId, req.user?.username || 'User');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const changeChannel = async (req, res) => {
  try {
    if (!iptvBotService) {
      return res.status(503).json({ error: 'IPTV bot service not initialized' });
    }
    const { voiceChannelId, iptvChannelId } = req.body;
    if (!voiceChannelId || !iptvChannelId) {
      return res.status(400).json({ error: 'Voice channel ID and IPTV channel ID are required' });
    }
    const result = iptvBotService.changeChannel(voiceChannelId, iptvChannelId, req.user?.username || 'User');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const stop = async (req, res) => {
  try {
    if (!iptvBotService) {
      return res.status(503).json({ error: 'IPTV bot service not initialized' });
    }
    const { voiceChannelId } = req.body;
    const result = iptvBotService.stop(voiceChannelId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const scheduleRecording = async (req, res) => {
  try {
    if (!iptvBotService) {
      return res.status(503).json({ error: 'IPTV bot service not initialized' });
    }
    const { iptvChannelId, programTitle, startTime, endTime, taggedUsers } = req.body;
    if (!iptvChannelId || !programTitle || !startTime || !endTime) {
      return res.status(400).json({ error: 'Channel, program title, start time, and end time are required' });
    }
    const result = iptvBotService.scheduleRecording(
      iptvChannelId, programTitle, startTime, endTime,
      req.user?.username || 'User', taggedUsers || []
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getRecordings = async (req, res) => {
  try {
    if (!iptvBotService) {
      return res.status(503).json({ error: 'IPTV bot service not initialized' });
    }
    const recordings = iptvBotService.getRecordings(req.user?.username);
    const scheduled = iptvBotService.getScheduledRecordings(req.user?.username);
    res.json({ recordings, scheduled });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const cancelRecording = async (req, res) => {
  try {
    if (!iptvBotService) {
      return res.status(503).json({ error: 'IPTV bot service not initialized' });
    }
    const { recordingId } = req.params;
    const result = iptvBotService.cancelRecording(recordingId, req.user?.username || 'User');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const tagUser = async (req, res) => {
  try {
    if (!iptvBotService) {
      return res.status(503).json({ error: 'IPTV bot service not initialized' });
    }
    const { recordingId } = req.params;
    const { targetUserId } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ error: 'Target user ID is required' });
    }
    const result = iptvBotService.tagUserOnRecording(recordingId, targetUserId, req.user?.username || 'User');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  initialize, getStatus, setEnabled, configure, getChannels, getGroups,
  getEPG, play, changeChannel, stop, scheduleRecording, getRecordings, cancelRecording, tagUser
};
