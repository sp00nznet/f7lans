/**
 * Game Together Service
 * Provides virtual controller emulation for remote multiplayer gaming
 * Players can join a host's game session and their controller inputs
 * are mapped to virtual Xbox controllers (Player 2, 3, 4, etc.) on the host's system
 */

const EventEmitter = require('events');
const { spawn } = require('child_process');
const os = require('os');

class GameTogetherService extends EventEmitter {
  constructor(io) {
    super();
    this.io = io;
    this.enabled = false;

    // Active sessions: { channelId: session }
    this.activeSessions = new Map();

    // Virtual controller backend based on platform
    this.platform = os.platform();
    this.virtualControllerBackend = null;

    this.initVirtualControllerBackend();
  }

  /**
   * Initialize the virtual controller backend based on the platform
   */
  initVirtualControllerBackend() {
    console.log(`[GameTogether] Initializing virtual controller backend for ${this.platform}`);

    switch (this.platform) {
      case 'win32':
        this.virtualControllerBackend = new WindowsViGEmBackend();
        break;
      case 'linux':
        this.virtualControllerBackend = new LinuxUInputBackend();
        break;
      case 'darwin':
        this.virtualControllerBackend = new MacOSFoohidBackend();
        break;
      default:
        console.warn(`[GameTogether] Unsupported platform: ${this.platform}`);
        this.virtualControllerBackend = new MockControllerBackend();
    }

    this.virtualControllerBackend.initialize();
  }

  /**
   * Enable or disable the Game Together service
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    console.log(`[GameTogether] Service ${enabled ? 'enabled' : 'disabled'}`);
    return { success: true, enabled: this.enabled };
  }

  /**
   * Get current service status
   */
  getStatus() {
    return {
      enabled: this.enabled,
      platform: this.platform,
      backendAvailable: this.virtualControllerBackend?.isAvailable() || false,
      activeSessions: Array.from(this.activeSessions.entries()).map(([channelId, session]) => ({
        channelId,
        hostUserId: session.hostUserId,
        hostUsername: session.hostUsername,
        startedAt: session.startedAt,
        playerCount: session.players.size,
        players: Array.from(session.players.entries()).map(([userId, player]) => ({
          userId,
          username: player.username,
          playerSlot: player.playerSlot,
          controllerConnected: player.controllerConnected
        }))
      }))
    };
  }

  /**
   * Start a new Game Together session
   * The host becomes Player 1, others join as Players 2, 3, 4, etc.
   */
  async startSession(channelId, hostUserId, hostUsername) {
    if (!this.enabled) {
      throw new Error('Game Together service is not enabled');
    }

    if (this.activeSessions.has(channelId)) {
      throw new Error('A Game Together session is already active in this channel');
    }

    if (!this.virtualControllerBackend.isAvailable()) {
      throw new Error(`Virtual controller backend not available on ${this.platform}. Please install required drivers.`);
    }

    console.log(`[GameTogether] Starting session in channel ${channelId} by ${hostUsername}`);

    const session = {
      channelId,
      hostUserId,
      hostUsername,
      startedAt: new Date(),
      players: new Map(), // userId -> { username, playerSlot, virtualController, inputState, controllerConnected }
      maxPlayers: 4, // Can be increased for games that support more players
      nextPlayerSlot: 2 // Host is Player 1, others start from Player 2
    };

    // Host is always Player 1 (their physical controller)
    session.players.set(hostUserId, {
      userId: hostUserId,
      username: hostUsername,
      playerSlot: 1,
      virtualController: null, // Host uses their physical controller
      inputState: {},
      controllerConnected: true,
      joinedAt: new Date()
    });

    this.activeSessions.set(channelId, session);

    // Emit session started event
    this.io.to(channelId).emit('gameTogether:session-started', {
      channelId,
      hostUserId,
      hostUsername,
      maxPlayers: session.maxPlayers
    });

    return session;
  }

  /**
   * Stop a Game Together session
   */
  async stopSession(channelId, userId) {
    const session = this.activeSessions.get(channelId);
    if (!session) {
      throw new Error('No active session in this channel');
    }

    // Only the host can stop the session
    if (session.hostUserId !== userId) {
      throw new Error('Only the host can stop the session');
    }

    console.log(`[GameTogether] Stopping session in channel ${channelId}`);

    // Destroy all virtual controllers
    for (const [playerId, player] of session.players.entries()) {
      if (player.virtualController) {
        try {
          await this.virtualControllerBackend.destroyController(player.virtualController);
        } catch (error) {
          console.error(`[GameTogether] Error destroying controller for player ${playerId}:`, error);
        }
      }
    }

    this.activeSessions.delete(channelId);

    // Emit session stopped event
    this.io.to(channelId).emit('gameTogether:session-stopped', {
      channelId
    });

    return { success: true };
  }

  /**
   * Player joins a Game Together session
   */
  async joinPlayer(channelId, userId, username) {
    const session = this.activeSessions.get(channelId);
    if (!session) {
      throw new Error('No active session in this channel');
    }

    if (session.players.has(userId)) {
      throw new Error('You are already in this session');
    }

    if (session.players.size >= session.maxPlayers) {
      throw new Error(`Session is full (${session.maxPlayers} players maximum)`);
    }

    console.log(`[GameTogether] Player ${username} joining session in channel ${channelId}`);

    const playerSlot = session.nextPlayerSlot++;

    // Create virtual controller for this player
    let virtualController;
    try {
      virtualController = await this.virtualControllerBackend.createController(playerSlot);
      console.log(`[GameTogether] Created virtual controller ${playerSlot} for ${username}`);
    } catch (error) {
      console.error(`[GameTogether] Failed to create virtual controller:`, error);
      throw new Error('Failed to create virtual controller');
    }

    // Add player to session
    const player = {
      userId,
      username,
      playerSlot,
      virtualController,
      inputState: this.getDefaultInputState(),
      controllerConnected: true,
      joinedAt: new Date()
    };

    session.players.set(userId, player);

    // Emit player joined event
    this.io.to(channelId).emit('gameTogether:player-joined', {
      channelId,
      userId,
      username,
      playerSlot,
      playerCount: session.players.size
    });

    return {
      success: true,
      playerSlot,
      maxPlayers: session.maxPlayers
    };
  }

  /**
   * Player leaves a Game Together session
   */
  async leavePlayer(channelId, userId) {
    const session = this.activeSessions.get(channelId);
    if (!session) {
      throw new Error('No active session in this channel');
    }

    const player = session.players.get(userId);
    if (!player) {
      throw new Error('You are not in this session');
    }

    // Host cannot leave, they must stop the session
    if (userId === session.hostUserId) {
      throw new Error('Host cannot leave. Use stop session instead.');
    }

    console.log(`[GameTogether] Player ${player.username} leaving session in channel ${channelId}`);

    // Destroy virtual controller
    if (player.virtualController) {
      try {
        await this.virtualControllerBackend.destroyController(player.virtualController);
      } catch (error) {
        console.error(`[GameTogether] Error destroying controller:`, error);
      }
    }

    session.players.delete(userId);

    // Emit player left event
    this.io.to(channelId).emit('gameTogether:player-left', {
      channelId,
      userId,
      playerSlot: player.playerSlot,
      playerCount: session.players.size
    });

    return { success: true };
  }

  /**
   * Handle controller input from a player
   */
  async handleInput(channelId, userId, inputData) {
    const session = this.activeSessions.get(channelId);
    if (!session) {
      console.warn(`[GameTogether] No active session in channel ${channelId}`);
      return;
    }

    const player = session.players.get(userId);
    if (!player) {
      console.warn(`[GameTogether] Player ${userId} not in session`);
      return;
    }

    // Host uses their physical controller, no need to emulate
    if (userId === session.hostUserId) {
      return;
    }

    // Update player's input state
    player.inputState = inputData;
    player.controllerConnected = true;

    // Send input to virtual controller
    try {
      await this.sendInputToVirtualController(player.virtualController, inputData);
    } catch (error) {
      console.error(`[GameTogether] Error sending input to virtual controller:`, error);
    }
  }

  /**
   * Send input data to a virtual controller
   */
  async sendInputToVirtualController(virtualController, inputData) {
    if (!virtualController) return;

    const { buttons = {}, axes = {} } = inputData;

    // Send button states
    for (const [button, pressed] of Object.entries(buttons)) {
      await this.virtualControllerBackend.setButton(virtualController, button, pressed);
    }

    // Send axis values
    for (const [axis, value] of Object.entries(axes)) {
      await this.virtualControllerBackend.setAxis(virtualController, axis, value);
    }

    // Update the virtual controller
    await this.virtualControllerBackend.update(virtualController);
  }

  /**
   * Get default input state
   */
  getDefaultInputState() {
    return {
      buttons: {
        A: false, B: false, X: false, Y: false,
        LB: false, RB: false,
        BACK: false, START: false,
        LS: false, RS: false,
        DPAD_UP: false, DPAD_DOWN: false, DPAD_LEFT: false, DPAD_RIGHT: false,
        GUIDE: false
      },
      axes: {
        LEFT_X: 0, LEFT_Y: 0,
        RIGHT_X: 0, RIGHT_Y: 0,
        LT: 0, RT: 0
      }
    };
  }

  /**
   * Get active session in a channel
   */
  getSession(channelId) {
    return this.activeSessions.get(channelId);
  }

  /**
   * Get all active sessions
   */
  getAllSessions() {
    const sessions = [];
    for (const [channelId, session] of this.activeSessions) {
      sessions.push({
        channelId,
        hostUserId: session.hostUserId,
        hostUsername: session.hostUsername,
        playerCount: session.players.size,
        players: Array.from(session.players.values())
      });
    }
    return sessions;
  }

  /**
   * Check if a user is in a session
   */
  isPlayerInSession(channelId, userId) {
    const session = this.activeSessions.get(channelId);
    return session && session.players.has(userId);
  }
}

// =============================================================================
// Virtual Controller Backends
// =============================================================================

/**
 * Base class for virtual controller backends
 */
class VirtualControllerBackend {
  async initialize() {
    throw new Error('initialize() must be implemented');
  }

  isAvailable() {
    throw new Error('isAvailable() must be implemented');
  }

  async createController(playerSlot) {
    throw new Error('createController() must be implemented');
  }

  async destroyController(controller) {
    throw new Error('destroyController() must be implemented');
  }

  async setButton(controller, button, pressed) {
    throw new Error('setButton() must be implemented');
  }

  async setAxis(controller, axis, value) {
    throw new Error('setAxis() must be implemented');
  }

  async update(controller) {
    throw new Error('update() must be implemented');
  }
}

/**
 * Windows ViGEm backend (requires ViGEmBus driver)
 */
class WindowsViGEmBackend extends VirtualControllerBackend {
  constructor() {
    super();
    this.available = false;
    this.vigem = null;
    this.controllers = new Map();
  }

  async initialize() {
    try {
      // Try to load node-vigem if available
      // In production, you would need to: npm install node-vigem
      // For now, we'll check if it's available
      console.log('[ViGEm] Attempting to initialize ViGEmBus backend');

      // Check if ViGEmBus driver is installed by trying to spawn a test process
      // In a real implementation, you would use the node-vigem library
      this.available = await this.checkViGEmAvailable();

      if (this.available) {
        console.log('[ViGEm] ViGEmBus backend initialized successfully');
      } else {
        console.warn('[ViGEm] ViGEmBus driver not found. Please install from: https://github.com/ViGEm/ViGEmBus/releases');
      }
    } catch (error) {
      console.error('[ViGEm] Failed to initialize:', error);
      this.available = false;
    }
  }

  async checkViGEmAvailable() {
    // Check if ViGEmBus driver is installed
    // In production, this would actually check for the driver
    // For now, return false and require manual installation
    return false;
  }

  isAvailable() {
    return this.available;
  }

  async createController(playerSlot) {
    if (!this.available) {
      throw new Error('ViGEmBus not available');
    }

    // In production, this would use node-vigem to create a virtual Xbox 360 controller
    const controller = {
      id: `vigem_${playerSlot}`,
      playerSlot,
      type: 'xbox360',
      state: {
        buttons: {},
        axes: {}
      }
    };

    this.controllers.set(controller.id, controller);
    console.log(`[ViGEm] Created virtual Xbox 360 controller for player slot ${playerSlot}`);

    return controller;
  }

  async destroyController(controller) {
    if (!controller) return;

    // In production, this would destroy the ViGEm controller
    this.controllers.delete(controller.id);
    console.log(`[ViGEm] Destroyed controller ${controller.id}`);
  }

  async setButton(controller, button, pressed) {
    if (!controller) return;
    controller.state.buttons[button] = pressed;
  }

  async setAxis(controller, axis, value) {
    if (!controller) return;
    controller.state.axes[axis] = value;
  }

  async update(controller) {
    if (!controller) return;

    // In production, this would call the ViGEm API to update the controller state
    // For now, we just log it in debug mode
    // console.log(`[ViGEm] Update controller ${controller.id}:`, controller.state);
  }
}

/**
 * Linux uinput backend (requires uinput kernel module)
 */
class LinuxUInputBackend extends VirtualControllerBackend {
  constructor() {
    super();
    this.available = false;
    this.controllers = new Map();
  }

  async initialize() {
    try {
      console.log('[uinput] Attempting to initialize uinput backend');

      // Check if /dev/uinput exists
      const fs = require('fs').promises;
      try {
        await fs.access('/dev/uinput');
        this.available = true;
        console.log('[uinput] uinput backend initialized successfully');
      } catch (error) {
        console.warn('[uinput] /dev/uinput not accessible. Run: sudo modprobe uinput && sudo chmod 666 /dev/uinput');
        this.available = false;
      }
    } catch (error) {
      console.error('[uinput] Failed to initialize:', error);
      this.available = false;
    }
  }

  isAvailable() {
    return this.available;
  }

  async createController(playerSlot) {
    if (!this.available) {
      throw new Error('uinput not available');
    }

    // In production, this would create a uinput device
    // You would use a library like 'node-uinput' or write native bindings
    const controller = {
      id: `uinput_${playerSlot}`,
      playerSlot,
      type: 'xbox360',
      state: {
        buttons: {},
        axes: {}
      }
    };

    this.controllers.set(controller.id, controller);
    console.log(`[uinput] Created virtual Xbox controller for player slot ${playerSlot}`);

    return controller;
  }

  async destroyController(controller) {
    if (!controller) return;

    this.controllers.delete(controller.id);
    console.log(`[uinput] Destroyed controller ${controller.id}`);
  }

  async setButton(controller, button, pressed) {
    if (!controller) return;
    controller.state.buttons[button] = pressed;
  }

  async setAxis(controller, axis, value) {
    if (!controller) return;
    controller.state.axes[axis] = value;
  }

  async update(controller) {
    if (!controller) return;
    // In production, this would write to the uinput device
  }
}

/**
 * macOS foohid backend (requires foohid kernel extension)
 */
class MacOSFoohidBackend extends VirtualControllerBackend {
  constructor() {
    super();
    this.available = false;
    this.controllers = new Map();
  }

  async initialize() {
    console.log('[foohid] macOS virtual controller support requires foohid kernel extension');
    console.log('[foohid] Alternative: Use USB/IP to forward controller from another machine');
    this.available = false;
  }

  isAvailable() {
    return this.available;
  }

  async createController(playerSlot) {
    throw new Error('macOS virtual controllers not yet implemented');
  }

  async destroyController(controller) {}
  async setButton(controller, button, pressed) {}
  async setAxis(controller, axis, value) {}
  async update(controller) {}
}

/**
 * Mock backend for development/testing
 */
class MockControllerBackend extends VirtualControllerBackend {
  constructor() {
    super();
    this.controllers = new Map();
  }

  async initialize() {
    console.log('[Mock] Mock controller backend initialized (development mode)');
  }

  isAvailable() {
    // Always available for testing
    return true;
  }

  async createController(playerSlot) {
    const controller = {
      id: `mock_${playerSlot}`,
      playerSlot,
      type: 'mock',
      state: {
        buttons: {},
        axes: {}
      }
    };

    this.controllers.set(controller.id, controller);
    console.log(`[Mock] Created mock controller for player slot ${playerSlot}`);

    return controller;
  }

  async destroyController(controller) {
    if (!controller) return;
    this.controllers.delete(controller.id);
    console.log(`[Mock] Destroyed mock controller ${controller.id}`);
  }

  async setButton(controller, button, pressed) {
    if (!controller) return;
    controller.state.buttons[button] = pressed;
  }

  async setAxis(controller, axis, value) {
    if (!controller) return;
    controller.state.axes[axis] = value;
  }

  async update(controller) {
    if (!controller) return;
    // In debug mode, you can log the state
    // console.log(`[Mock] Controller ${controller.id} state:`, controller.state);
  }
}

module.exports = GameTogetherService;
