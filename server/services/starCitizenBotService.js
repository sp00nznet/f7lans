// Star Citizen Bot Service
// Monitors players playing Star Citizen and offers contextual help

const https = require('https');

class StarCitizenBotService {
  constructor() {
    this.enabled = false;
    this.monitoredChannels = new Map(); // channelId -> { users, lastTip, tipsEnabled }
    this.userGameStates = new Map(); // oderId -> { location, activity, ship, lastUpdate }
    this.messageCallback = null;

    // Star Citizen tips organized by category
    this.tips = {
      general: [
        "Use F1 to open your mobiGlas for missions, contracts, and ship management.",
        "Press F2 to access the Starmap for navigation between planets and moons.",
        "Hold F to interact with objects, doors, and ship components.",
        "Use Inner Thought (hold F) + left-click to interact with specific options.",
        "Remember to claim your ship at ASOP terminals if it's destroyed or stored.",
        "Store your ship at hangars to persist inventory between sessions."
      ],
      combat: [
        "Lock targets with T and cycle targets with 1/2/3 keys.",
        "Use G to toggle gimbals on/off for weapons.",
        "Press H to match target velocity - useful for dogfighting.",
        "Missiles are launched with middle mouse button after locking with T.",
        "Use countermeasures (X) to avoid incoming missiles.",
        "Keep an eye on your power triangle - use arrow keys to adjust."
      ],
      mining: [
        "Green zone on the mining laser is the optimal fracture range.",
        "Use the Instability Dampener to reduce rock volatility.",
        "Surge modules can help break difficult rocks faster.",
        "Watch for valuable Quantainium - but extract carefully, it's volatile!",
        "Sell refined materials at trading consoles in major stations.",
        "FPS mining with the Multi-Tool is great for Hadanite on moons."
      ],
      trading: [
        "Check commodity prices at different locations for best profits.",
        "Use third-party tools to track commodity prices in real-time.",
        "Larger cargo ships mean bigger profits but also bigger risks.",
        "Watch out for pirates in popular trade routes.",
        "Some commodities are illegal - scan before buying!",
        "Refineries can process raw ore into more valuable materials."
      ],
      exploration: [
        "Use quantum markers to save interesting locations.",
        "Caves can contain valuable FPS mineable materials.",
        "Derelicts often have valuable loot - bring a flashlight!",
        "Check mobiGlas journal for exploration logs and discoveries.",
        "Use the scanning mode (Tab) to detect ships and objects.",
        "Always bring a medpen and extra oxygen for EVA exploration."
      ],
      newPlayer: [
        "Start with simple delivery missions to learn the basics.",
        "Bunker missions are good for combat practice and early money.",
        "Rent ships before buying to test what you like.",
        "Join an organization for help and group gameplay.",
        "Use /global or /proximity chat to ask for help.",
        "Insurance claims are free for most situations - don't worry about losing ships."
      ],
      ships: [
        "Use the Systems screen in mobiGlas to manage ship components.",
        "Power up your ship: press R for flight-ready mode.",
        "Quantum travel requires a charged drive and clear path.",
        "VTOL mode (J) helps with atmospheric flight on planets.",
        "Speed limiter (mouse wheel) controls your max velocity.",
        "Use decoupled mode (V) for advanced maneuvering."
      ]
    };

    // Location-based tips
    this.locationTips = {
      'crusader': "Crusader has some of the best refueling stations at Orison platforms.",
      'hurston': "Watch out for Hurston Security - they're aggressive about contraband.",
      'arccorp': "Area 18 has some of the best ship customization options.",
      'microtech': "New Babbage has a hospital - great for respawning closer to missions.",
      'pyro': "Pyro system is lawless - expect PvP and bring friends!",
      'stanton': "Stanton is the starter system - lots of missions for new players."
    };
  }

  // Set callback for posting messages to channels
  setMessageCallback(callback) {
    this.messageCallback = callback;
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    return this.enabled;
  }

  isEnabled() {
    return this.enabled;
  }

  getStatus() {
    return {
      enabled: this.enabled,
      monitoredChannels: this.monitoredChannels.size,
      trackedPlayers: this.userGameStates.size
    };
  }

  // Start monitoring a channel
  startMonitoring(channelId, options = {}) {
    this.monitoredChannels.set(channelId, {
      users: new Set(),
      lastTip: null,
      tipsEnabled: options.tipsEnabled !== false,
      tipInterval: options.tipInterval || 300000, // 5 minutes default
      lastTipTime: 0
    });

    return { channelId, monitoring: true };
  }

  // Stop monitoring a channel
  stopMonitoring(channelId) {
    this.monitoredChannels.delete(channelId);
    return { channelId, monitoring: false };
  }

  // Track user starting Star Citizen
  trackUserActivity(userId, username, activity) {
    if (!activity || activity.name !== 'Star Citizen') {
      // User stopped playing
      this.userGameStates.delete(userId);
      return null;
    }

    const currentState = this.userGameStates.get(userId) || {};
    const newState = {
      username,
      activity: activity.details || 'Playing',
      startedAt: currentState.startedAt || new Date(),
      lastUpdate: new Date()
    };

    this.userGameStates.set(userId, newState);

    // Check if we should send a tip
    this.checkAndSendTips();

    return newState;
  }

  // Get a random tip from a category
  getRandomTip(category = 'general') {
    const categoryTips = this.tips[category] || this.tips.general;
    return categoryTips[Math.floor(Math.random() * categoryTips.length)];
  }

  // Get tip for specific topic
  getTip(topic) {
    const topicLower = topic.toLowerCase();

    // Check for direct category match
    if (this.tips[topicLower]) {
      return {
        category: topicLower,
        tip: this.getRandomTip(topicLower)
      };
    }

    // Check for keywords
    if (topicLower.includes('mine') || topicLower.includes('mining')) {
      return { category: 'mining', tip: this.getRandomTip('mining') };
    }
    if (topicLower.includes('fight') || topicLower.includes('combat') || topicLower.includes('weapon')) {
      return { category: 'combat', tip: this.getRandomTip('combat') };
    }
    if (topicLower.includes('trade') || topicLower.includes('cargo') || topicLower.includes('money')) {
      return { category: 'trading', tip: this.getRandomTip('trading') };
    }
    if (topicLower.includes('explore') || topicLower.includes('cave') || topicLower.includes('wreck')) {
      return { category: 'exploration', tip: this.getRandomTip('exploration') };
    }
    if (topicLower.includes('new') || topicLower.includes('start') || topicLower.includes('beginner')) {
      return { category: 'newPlayer', tip: this.getRandomTip('newPlayer') };
    }
    if (topicLower.includes('ship') || topicLower.includes('fly') || topicLower.includes('quantum')) {
      return { category: 'ships', tip: this.getRandomTip('ships') };
    }

    // Default to general
    return { category: 'general', tip: this.getRandomTip('general') };
  }

  // Check if we should send tips to monitored channels
  checkAndSendTips() {
    if (!this.enabled || !this.messageCallback) return;

    const now = Date.now();

    for (const [channelId, channelState] of this.monitoredChannels) {
      if (!channelState.tipsEnabled) continue;

      // Check if enough time has passed since last tip
      if (now - channelState.lastTipTime < channelState.tipInterval) continue;

      // Check if there are active SC players
      const activePlayers = [...this.userGameStates.values()].filter(
        state => state.lastUpdate > new Date(now - 600000) // Active in last 10 minutes
      );

      if (activePlayers.length === 0) continue;

      // Send a random tip
      const tipData = this.getTip('general');
      channelState.lastTipTime = now;
      channelState.lastTip = tipData.tip;

      this.messageCallback(channelId, {
        type: 'bot',
        botName: 'StarCitizen',
        content: `💫 **Star Citizen Tip:** ${tipData.tip}`,
        category: tipData.category,
        playersActive: activePlayers.length
      });
    }
  }

  // Process chat commands
  async processCommand(channelId, command, args, username) {
    switch (command.toLowerCase()) {
      case '!sc':
      case '!starcitizen':
        if (!args || args.trim().length === 0) {
          return this.getTip('general');
        }
        return this.getTip(args.trim());

      case '!schelp':
        return {
          tip: "Star Citizen Bot Commands:\n" +
               "• !sc [topic] - Get a tip (topics: combat, mining, trading, exploration, ships, newPlayer)\n" +
               "• !scship <name> - Look up ship info\n" +
               "• !sclocation <place> - Get info about a location\n" +
               "• !scstatus - Check server status"
        };

      case '!sclocation':
        if (!args || args.trim().length === 0) {
          return { error: 'Usage: !sclocation <location name>' };
        }
        return this.getLocationInfo(args.trim());

      case '!scstatus':
        return await this.getServerStatus();

      default:
        return null;
    }
  }

  // Get location info
  getLocationInfo(location) {
    const locLower = location.toLowerCase();

    for (const [key, tip] of Object.entries(this.locationTips)) {
      if (locLower.includes(key) || key.includes(locLower)) {
        return {
          location: key,
          info: tip
        };
      }
    }

    return {
      location,
      info: "No specific tips for this location. Try checking the Starmap (F2) for more info!"
    };
  }

  // Check RSI server status (mock - would need real API)
  async getServerStatus() {
    // In a real implementation, this would check RSI's status API
    return {
      status: 'operational',
      message: "Star Citizen servers appear to be online. Check https://status.robertsspaceindustries.com for official status.",
      lastChecked: new Date().toISOString()
    };
  }

  // Get active players in monitored channels
  getActivePlayers(channelId) {
    const players = [];
    const tenMinutesAgo = new Date(Date.now() - 600000);

    for (const [userId, state] of this.userGameStates) {
      if (state.lastUpdate > tenMinutesAgo) {
        players.push({
          username: state.username,
          playingSince: state.startedAt,
          activity: state.activity
        });
      }
    }

    return players;
  }

  // Set tip interval for a channel
  setTipInterval(channelId, intervalMs) {
    const channelState = this.monitoredChannels.get(channelId);
    if (channelState) {
      channelState.tipInterval = Math.max(60000, intervalMs); // Min 1 minute
      return true;
    }
    return false;
  }

  // Enable/disable tips for a channel
  setTipsEnabled(channelId, enabled) {
    const channelState = this.monitoredChannels.get(channelId);
    if (channelState) {
      channelState.tipsEnabled = !!enabled;
      return true;
    }
    return false;
  }
}

// Singleton instance
const starCitizenBotService = new StarCitizenBotService();
module.exports = starCitizenBotService;
