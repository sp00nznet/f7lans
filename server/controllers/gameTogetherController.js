/**
 * Game Together Controller
 * Handles HTTP API endpoints for Game Together controller emulation functionality
 */

let gameTogetherService = null;

const initialize = (service) => {
  gameTogetherService = service;
};

// Get status
const getStatus = async (req, res) => {
  try {
    const status = gameTogetherService.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Enable/disable service
const setEnabled = async (req, res) => {
  try {
    const { enabled } = req.body;
    const result = gameTogetherService.setEnabled(enabled);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Start a Game Together session
const startSession = async (req, res) => {
  try {
    const { channelId } = req.body;
    const userId = req.user._id.toString();
    const username = req.user.displayName || req.user.username;
    const result = await gameTogetherService.startSession(channelId, userId, username);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Stop a Game Together session
const stopSession = async (req, res) => {
  try {
    const { channelId } = req.body;
    const userId = req.user._id.toString();
    const result = await gameTogetherService.stopSession(channelId, userId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get session info
const getSession = async (req, res) => {
  try {
    const { channelId } = req.params;
    const session = gameTogetherService.getSession(channelId);
    if (!session) {
      return res.status(404).json({ error: 'No active session in this channel' });
    }
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Join as player
const joinAsPlayer = async (req, res) => {
  try {
    const { channelId } = req.body;
    const userId = req.user._id.toString();
    const username = req.user.displayName || req.user.username;
    const result = await gameTogetherService.joinPlayer(channelId, userId, username);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Leave as player
const leaveAsPlayer = async (req, res) => {
  try {
    const { channelId } = req.body;
    const userId = req.user._id.toString();
    const result = await gameTogetherService.leavePlayer(channelId, userId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Handle controller input
const handleInput = async (req, res) => {
  try {
    const { channelId, inputData } = req.body;
    const userId = req.user._id.toString();
    await gameTogetherService.handleInput(channelId, userId, inputData);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all active sessions
const getSessions = async (req, res) => {
  try {
    const sessions = gameTogetherService.getAllSessions();
    res.json({ sessions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  initialize,
  getStatus,
  setEnabled,
  startSession,
  stopSession,
  getSession,
  getSessions,
  joinAsPlayer,
  leaveAsPlayer,
  handleInput
};
