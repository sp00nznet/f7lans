// RPG Bot Controller
// Handles API requests for the tabletop RPG bot

let rpgBotService = null;

// Initialize with the service instance
const initialize = (service) => {
  rpgBotService = service;
};

// Get bot status
const getStatus = async (req, res) => {
  try {
    if (!rpgBotService) {
      return res.status(503).json({ error: 'RPG bot service not available' });
    }

    const channelId = req.query.channelId;
    const status = channelId
      ? await rpgBotService.getStatus(channelId)
      : { enabled: rpgBotService.isEnabled() };

    res.json(status);
  } catch (error) {
    console.error('Get RPG bot status error:', error);
    res.status(500).json({ error: 'Failed to get bot status' });
  }
};

// Enable/disable bot
const setEnabled = async (req, res) => {
  try {
    if (!rpgBotService) {
      return res.status(503).json({ error: 'RPG bot service not available' });
    }

    const { enabled } = req.body;
    const newState = rpgBotService.setEnabled(!!enabled);

    res.json({
      enabled: newState,
      message: newState ? 'RPG bot enabled' : 'RPG bot disabled'
    });
  } catch (error) {
    console.error('Set RPG bot enabled error:', error);
    res.status(500).json({ error: 'Failed to update bot status' });
  }
};

// Create campaign
const createCampaign = async (req, res) => {
  try {
    if (!rpgBotService) {
      return res.status(503).json({ error: 'RPG bot service not available' });
    }

    if (!rpgBotService.isEnabled()) {
      return res.status(400).json({ error: 'RPG bot is not enabled' });
    }

    const { channelId, name, description, type, difficulty, setting, maxPlayers } = req.body;

    if (!channelId) {
      return res.status(400).json({ error: 'Channel ID is required' });
    }

    const campaign = await rpgBotService.createCampaign(channelId, req.user._id, {
      name,
      description,
      type,
      difficulty,
      setting,
      maxPlayers
    });

    res.json({
      message: 'Campaign created',
      campaign: rpgBotService.formatCampaign(campaign)
    });
  } catch (error) {
    console.error('Create campaign error:', error);
    res.status(500).json({ error: error.message || 'Failed to create campaign' });
  }
};

// Join campaign
const joinCampaign = async (req, res) => {
  try {
    if (!rpgBotService) {
      return res.status(503).json({ error: 'RPG bot service not available' });
    }

    if (!rpgBotService.isEnabled()) {
      return res.status(400).json({ error: 'RPG bot is not enabled' });
    }

    const { channelId, name, characterClass, race } = req.body;

    if (!channelId) {
      return res.status(400).json({ error: 'Channel ID is required' });
    }

    const character = await rpgBotService.joinCampaign(channelId, req.user._id, {
      name,
      class: characterClass,
      race
    });

    res.json({
      message: 'Joined campaign',
      character
    });
  } catch (error) {
    console.error('Join campaign error:', error);
    res.status(500).json({ error: error.message || 'Failed to join campaign' });
  }
};

// Start adventure
const startAdventure = async (req, res) => {
  try {
    if (!rpgBotService) {
      return res.status(503).json({ error: 'RPG bot service not available' });
    }

    const { channelId } = req.body;

    if (!channelId) {
      return res.status(400).json({ error: 'Channel ID is required' });
    }

    const campaign = await rpgBotService.startAdventure(channelId);

    res.json({
      message: 'Adventure started',
      campaign: rpgBotService.formatCampaign(campaign)
    });
  } catch (error) {
    console.error('Start adventure error:', error);
    res.status(500).json({ error: error.message || 'Failed to start adventure' });
  }
};

// Take action
const takeAction = async (req, res) => {
  try {
    if (!rpgBotService) {
      return res.status(503).json({ error: 'RPG bot service not available' });
    }

    const { channelId, actionId } = req.body;

    if (!channelId || !actionId) {
      return res.status(400).json({ error: 'Channel ID and action ID are required' });
    }

    const result = await rpgBotService.takeAction(channelId, req.user._id, actionId);

    res.json(result);
  } catch (error) {
    console.error('Take action error:', error);
    res.status(500).json({ error: error.message || 'Failed to perform action' });
  }
};

// Get campaign details
const getCampaign = async (req, res) => {
  try {
    if (!rpgBotService) {
      return res.status(503).json({ error: 'RPG bot service not available' });
    }

    const { channelId } = req.params;

    const campaign = await rpgBotService.getCampaign(channelId);

    res.json(rpgBotService.formatCampaign(campaign));
  } catch (error) {
    console.error('Get campaign error:', error);
    res.status(500).json({ error: error.message || 'Failed to get campaign' });
  }
};

// End campaign
const endCampaign = async (req, res) => {
  try {
    if (!rpgBotService) {
      return res.status(503).json({ error: 'RPG bot service not available' });
    }

    const { channelId } = req.body;

    if (!channelId) {
      return res.status(400).json({ error: 'Channel ID is required' });
    }

    const campaign = await rpgBotService.endCampaign(channelId, req.user._id);

    res.json({
      message: 'Campaign ended',
      campaign: rpgBotService.formatCampaign(campaign)
    });
  } catch (error) {
    console.error('End campaign error:', error);
    res.status(500).json({ error: error.message || 'Failed to end campaign' });
  }
};

// Roll dice (utility endpoint)
const rollDice = async (req, res) => {
  try {
    if (!rpgBotService) {
      return res.status(503).json({ error: 'RPG bot service not available' });
    }

    const { notation } = req.body;

    if (!notation) {
      return res.status(400).json({ error: 'Dice notation is required (e.g., 1d20, 2d6+3)' });
    }

    const result = rpgBotService.rollDice(notation);

    res.json(result);
  } catch (error) {
    console.error('Roll dice error:', error);
    res.status(500).json({ error: 'Failed to roll dice' });
  }
};

module.exports = {
  initialize,
  getStatus,
  setEnabled,
  createCampaign,
  joinCampaign,
  startAdventure,
  takeAction,
  getCampaign,
  endCampaign,
  rollDice
};
