/**
 * Emulator Bot Controller
 * Handles HTTP API endpoints for emulator multiplayer functionality
 */

let emulatorBotService = null;

const initialize = (service) => {
  emulatorBotService = service;
};

// Get status
const getStatus = async (req, res) => {
  try {
    const status = emulatorBotService.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Enable/disable bot
const setEnabled = async (req, res) => {
  try {
    const { enabled } = req.body;
    const result = emulatorBotService.setEnabled(enabled);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Configure emulator paths and settings
const configure = async (req, res) => {
  try {
    const result = emulatorBotService.configure(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get list of supported emulators
const getSupportedEmulators = async (req, res) => {
  try {
    const emulators = emulatorBotService.getSupportedEmulators();
    res.json({ emulators });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Check emulator availability
const checkEmulator = async (req, res) => {
  try {
    const { emulatorType } = req.params;
    const result = await emulatorBotService.checkEmulatorAvailability(emulatorType);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get available games for an emulator
const getGames = async (req, res) => {
  try {
    const { emulatorType } = req.params;
    const games = await emulatorBotService.getAvailableGames(emulatorType);
    res.json({ games });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Start an emulator session
const startSession = async (req, res) => {
  try {
    const { channelId, emulatorType, gamePath } = req.body;
    const userId = req.user._id.toString();
    const result = await emulatorBotService.startSession(channelId, emulatorType, gamePath, userId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Stop an emulator session
const stopSession = async (req, res) => {
  try {
    const { channelId } = req.body;
    const result = await emulatorBotService.stopSession(channelId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get session info
const getSession = async (req, res) => {
  try {
    const { channelId } = req.params;
    const session = emulatorBotService.getSession(channelId);
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
    const { channelId, slot } = req.body;
    const userId = req.user._id.toString();
    const result = emulatorBotService.joinAsPlayer(channelId, userId, slot !== undefined ? slot : null);
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
    const result = emulatorBotService.leaveAsPlayer(channelId, userId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Join as spectator
const joinAsSpectator = async (req, res) => {
  try {
    const { channelId } = req.body;
    const userId = req.user._id.toString();
    const result = emulatorBotService.joinAsSpectator(channelId, userId);
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
    const result = emulatorBotService.handleInput(channelId, userId, inputData);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Load a different game
const loadGame = async (req, res) => {
  try {
    const { channelId, gamePath } = req.body;
    const userId = req.user._id.toString();
    const result = await emulatorBotService.loadGame(channelId, gamePath, userId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Save state
const saveState = async (req, res) => {
  try {
    const { channelId, slot } = req.body;
    const result = await emulatorBotService.saveState(channelId, slot || 0);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Load state
const loadState = async (req, res) => {
  try {
    const { channelId, slot } = req.body;
    const result = await emulatorBotService.loadState(channelId, slot || 0);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Toggle pause
const togglePause = async (req, res) => {
  try {
    const { channelId } = req.body;
    const result = emulatorBotService.togglePause(channelId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get controller mapping
const getControllerMapping = async (req, res) => {
  try {
    const { emulatorType } = req.query;
    const mapping = emulatorBotService.getControllerMapping(emulatorType || null);
    res.json(mapping);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  initialize,
  getStatus,
  setEnabled,
  configure,
  getSupportedEmulators,
  checkEmulator,
  getGames,
  startSession,
  stopSession,
  getSession,
  joinAsPlayer,
  leaveAsPlayer,
  joinAsSpectator,
  handleInput,
  loadGame,
  saveState,
  loadState,
  togglePause,
  getControllerMapping
};
