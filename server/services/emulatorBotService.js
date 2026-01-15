/**
 * Emulator Bot Service
 * Multiplayer emulator support for:
 * - Xbox (xemu) - up to 4 players
 * - Dreamcast (flycast) - up to 4 players
 * - GameCube/Wii (dolphin) - up to 4 players
 * - PS3 (rpcs3) - up to 7 players (though most games support 4)
 *
 * Streams video to voice channels and accepts controller input from players
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');

// Max players (4 is the common max for most consoles)
const MAX_PLAYERS = 4;

// Emulator configurations
const EMULATOR_CONFIG = {
  xbox: {
    name: 'xemu',
    displayName: 'Xbox (xemu)',
    executable: process.platform === 'win32' ? 'xemu.exe' : 'xemu',
    defaultPath: process.platform === 'win32'
      ? 'C:\\Program Files\\xemu\\xemu.exe'
      : '/usr/bin/xemu',
    romExtensions: ['.iso', '.xiso'],
    maxPlayers: 4,
    defaultArgs: ['-full-screen'],
    inputPort: 6000,
    website: 'https://xemu.app/',
    github: 'https://github.com/xemu-project/xemu'
  },
  dreamcast: {
    name: 'flycast',
    displayName: 'Dreamcast (flycast)',
    executable: process.platform === 'win32' ? 'flycast.exe' : 'flycast',
    defaultPath: process.platform === 'win32'
      ? 'C:\\Program Files\\Flycast\\flycast.exe'
      : '/usr/bin/flycast',
    romExtensions: ['.gdi', '.cdi', '.chd', '.cue', '.bin'],
    maxPlayers: 4,
    defaultArgs: [],
    inputPort: 6100,
    website: 'https://flycast.github.io/',
    github: 'https://github.com/flyinghead/flycast'
  },
  gamecube: {
    name: 'dolphin',
    displayName: 'GameCube/Wii (Dolphin)',
    executable: process.platform === 'win32' ? 'Dolphin.exe' : 'dolphin-emu',
    defaultPath: process.platform === 'win32'
      ? 'C:\\Program Files\\Dolphin\\Dolphin.exe'
      : '/usr/bin/dolphin-emu',
    romExtensions: ['.iso', '.gcm', '.gcz', '.wbfs', '.ciso', '.wad', '.dol', '.elf', '.rvz'],
    maxPlayers: 4,
    defaultArgs: ['--batch', '--exec'],
    inputPort: 6200,
    website: 'https://dolphin-emu.org/',
    github: 'https://github.com/dolphin-emu/dolphin'
  },
  ps3: {
    name: 'rpcs3',
    displayName: 'PS3 (RPCS3)',
    executable: process.platform === 'win32' ? 'rpcs3.exe' : 'rpcs3',
    defaultPath: process.platform === 'win32'
      ? 'C:\\Program Files\\RPCS3\\rpcs3.exe'
      : '/usr/bin/rpcs3',
    romExtensions: ['.pkg', '.bin'],
    maxPlayers: 4, // Most games support 4, some support up to 7
    defaultArgs: ['--no-gui'],
    inputPort: 6300,
    website: 'https://rpcs3.net/',
    github: 'https://github.com/RPCS3/rpcs3',
    // PS3 games are typically in folder format with EBOOT.BIN
    isFolderBased: true,
    gameExecutable: 'PS3_GAME/USRDIR/EBOOT.BIN'
  }
};

// Standard Xbox controller button mappings (used as common standard)
const XBOX_BUTTONS = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  BACK: 6,
  START: 7,
  LS: 8,  // Left stick press
  RS: 9,  // Right stick press
  GUIDE: 10,
  DPAD_UP: 11,
  DPAD_DOWN: 12,
  DPAD_LEFT: 13,
  DPAD_RIGHT: 14
};

// Standard Xbox controller axes
const XBOX_AXES = {
  LEFT_X: 0,
  LEFT_Y: 1,
  RIGHT_X: 2,
  RIGHT_Y: 3,
  LT: 4,  // Left trigger
  RT: 5   // Right trigger
};

// Controller mappings for different platforms (maps Xbox buttons to native)
const CONTROLLER_MAPPINGS = {
  xbox: {
    // Xbox to Xbox - direct mapping
    A: 'A', B: 'B', X: 'X', Y: 'Y',
    LB: 'LB', RB: 'RB', BACK: 'BACK', START: 'START',
    LS: 'LS', RS: 'RS', GUIDE: 'GUIDE'
  },
  dreamcast: {
    // Xbox to Dreamcast
    A: 'A', B: 'B', X: 'X', Y: 'Y',
    LB: 'L', RB: 'R', START: 'START'
  },
  gamecube: {
    // Xbox to GameCube
    A: 'A', B: 'B', X: 'X', Y: 'Y',
    LB: 'L', RB: 'R', BACK: 'Z', START: 'START'
  },
  ps3: {
    // Xbox to PS3
    A: 'CROSS', B: 'CIRCLE', X: 'SQUARE', Y: 'TRIANGLE',
    LB: 'L1', RB: 'R1', BACK: 'SELECT', START: 'START',
    LS: 'L3', RS: 'R3', GUIDE: 'PS'
  }
};

class EmulatorBotService extends EventEmitter {
  constructor(io) {
    super();
    this.io = io;
    this.enabled = false;
    this.activeSessions = {}; // channelId -> session

    // Initialize emulator paths with defaults
    this.emulatorPaths = {};
    this.romPaths = {};
    for (const [key, config] of Object.entries(EMULATOR_CONFIG)) {
      this.emulatorPaths[key] = config.defaultPath;
      this.romPaths[key] = '';
    }

    this.ffmpegPath = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    this.frameRate = 30;
    this.videoQuality = 'medium'; // low, medium, high
    this.streamResolution = { width: 1280, height: 720 };
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.stopAll();
    }
    return { enabled: this.enabled };
  }

  // Configure emulator paths and settings
  configure(config) {
    // Emulator paths
    if (config.xboxPath) this.emulatorPaths.xbox = config.xboxPath;
    if (config.dreamcastPath) this.emulatorPaths.dreamcast = config.dreamcastPath;
    if (config.gamecubePath) this.emulatorPaths.gamecube = config.gamecubePath;
    if (config.dolphinPath) this.emulatorPaths.gamecube = config.dolphinPath; // Alias
    if (config.ps3Path) this.emulatorPaths.ps3 = config.ps3Path;
    if (config.rpcs3Path) this.emulatorPaths.ps3 = config.rpcs3Path; // Alias

    // ROM paths
    if (config.xboxRomPath) this.romPaths.xbox = config.xboxRomPath;
    if (config.dreamcastRomPath) this.romPaths.dreamcast = config.dreamcastRomPath;
    if (config.gamecubeRomPath) this.romPaths.gamecube = config.gamecubeRomPath;
    if (config.wiiRomPath) this.romPaths.gamecube = config.wiiRomPath; // Same as GC for Dolphin
    if (config.ps3RomPath) this.romPaths.ps3 = config.ps3RomPath;

    // Video settings
    if (config.ffmpegPath) this.ffmpegPath = config.ffmpegPath;
    if (config.frameRate) this.frameRate = Math.min(60, Math.max(15, config.frameRate));
    if (config.videoQuality) this.videoQuality = config.videoQuality;
    if (config.resolution) this.streamResolution = config.resolution;

    return this.getStatus();
  }

  // Get list of available ROMs/games for an emulator
  async getAvailableGames(emulatorType) {
    const config = EMULATOR_CONFIG[emulatorType];
    if (!config) {
      throw new Error('Invalid emulator type');
    }

    const romPath = this.romPaths[emulatorType];
    if (!romPath || !fs.existsSync(romPath)) {
      return [];
    }

    const games = [];

    // For folder-based games (like PS3)
    if (config.isFolderBased) {
      const entries = fs.readdirSync(romPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const ebootPath = path.join(romPath, entry.name, config.gameExecutable);
          if (fs.existsSync(ebootPath)) {
            games.push({
              name: entry.name,
              filename: entry.name,
              path: path.join(romPath, entry.name),
              isFolder: true
            });
          }
        }
      }
    } else {
      // File-based games
      const files = fs.readdirSync(romPath);
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (config.romExtensions.includes(ext)) {
          games.push({
            name: path.basename(file, ext),
            filename: file,
            path: path.join(romPath, file),
            extension: ext
          });
        }
      }
    }

    return games.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Start an emulator session in a voice channel
  async startSession(channelId, emulatorType, gamePath, startedBy) {
    if (!this.enabled) {
      throw new Error('Emulator bot is disabled');
    }

    if (this.activeSessions[channelId]) {
      throw new Error('Emulator session already active in this channel');
    }

    const config = EMULATOR_CONFIG[emulatorType];
    if (!config) {
      const validTypes = Object.keys(EMULATOR_CONFIG).join(', ');
      throw new Error(`Invalid emulator type. Valid types: ${validTypes}`);
    }

    const emulatorPath = this.emulatorPaths[emulatorType];
    if (!emulatorPath || !fs.existsSync(emulatorPath)) {
      throw new Error(`${config.displayName} emulator not found at: ${emulatorPath}`);
    }

    if (gamePath && !fs.existsSync(gamePath)) {
      throw new Error(`Game file not found: ${gamePath}`);
    }

    // Create session
    const session = {
      channelId,
      emulatorType,
      config,
      gamePath,
      startedBy,
      startTime: Date.now(),
      players: [],
      maxPlayers: config.maxPlayers || MAX_PLAYERS,
      emulatorProcess: null,
      ffmpegProcess: null,
      isStreaming: false,
      isPaused: false,
      inputState: {}, // playerId -> controller state
      spectators: []
    };

    // Build emulator arguments
    const args = [...config.defaultArgs];
    if (gamePath) {
      // Special handling for PS3 folder-based games
      if (config.isFolderBased && fs.statSync(gamePath).isDirectory()) {
        const ebootPath = path.join(gamePath, config.gameExecutable);
        if (fs.existsSync(ebootPath)) {
          args.push(ebootPath);
        } else {
          args.push(gamePath);
        }
      } else {
        args.push(gamePath);
      }
    }

    try {
      // Spawn emulator process
      session.emulatorProcess = spawn(emulatorPath, args, {
        detached: false,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      session.emulatorProcess.on('error', (error) => {
        console.error(`Emulator process error: ${error.message}`);
        this.handleEmulatorError(channelId, error);
      });

      session.emulatorProcess.on('exit', (code) => {
        console.log(`Emulator ${config.name} exited with code: ${code}`);
        this.handleEmulatorExit(channelId, code);
      });

      // Log emulator output
      session.emulatorProcess.stdout.on('data', (data) => {
        console.log(`[${config.name}] ${data.toString().trim()}`);
      });

      session.emulatorProcess.stderr.on('data', (data) => {
        console.log(`[${config.name}] ${data.toString().trim()}`);
      });

      // Wait for emulator window to appear
      await this.waitForEmulatorWindow(config.name, 5000);

      // Start video capture
      await this.startVideoCapture(session);

      this.activeSessions[channelId] = session;

      // Notify channel
      this.io.to(`voice:${channelId}`).emit('emulator:session-started', {
        channelId,
        emulatorType,
        displayName: config.displayName,
        gamePath,
        startedBy,
        maxPlayers: session.maxPlayers
      });

      console.log(`Emulator session started: ${config.displayName} in channel ${channelId}`);

      return {
        channelId,
        emulatorType,
        displayName: config.displayName,
        gamePath,
        startedBy,
        maxPlayers: session.maxPlayers
      };
    } catch (error) {
      // Clean up on failure
      if (session.emulatorProcess) {
        session.emulatorProcess.kill();
      }
      throw error;
    }
  }

  // Wait for emulator window to appear
  async waitForEmulatorWindow(windowName, timeout) {
    return new Promise((resolve) => {
      // Simple timeout-based wait since window detection is platform-specific
      setTimeout(resolve, Math.min(timeout, 2000));
    });
  }

  // Start video capture using FFmpeg
  async startVideoCapture(session) {
    const qualityPresets = {
      low: { bitrate: '1500k', crf: 28 },
      medium: { bitrate: '3000k', crf: 23 },
      high: { bitrate: '6000k', crf: 18 }
    };

    const preset = qualityPresets[this.videoQuality] || qualityPresets.medium;

    // Platform-specific screen capture
    let inputArgs;
    if (process.platform === 'win32') {
      // Windows: Use GDI grab or DirectShow
      inputArgs = [
        '-f', 'gdigrab',
        '-framerate', String(this.frameRate),
        '-i', `title=${session.config.name}`
      ];
    } else if (process.platform === 'darwin') {
      // macOS: Use AVFoundation
      inputArgs = [
        '-f', 'avfoundation',
        '-framerate', String(this.frameRate),
        '-i', '1:none'
      ];
    } else {
      // Linux: Use X11grab
      inputArgs = [
        '-f', 'x11grab',
        '-framerate', String(this.frameRate),
        '-video_size', `${this.streamResolution.width}x${this.streamResolution.height}`,
        '-i', ':0.0'
      ];
    }

    // Output to raw frames for streaming
    const outputArgs = [
      '-vf', `scale=${this.streamResolution.width}:${this.streamResolution.height}`,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-tune', 'zerolatency',
      '-crf', String(preset.crf),
      '-b:v', preset.bitrate,
      '-maxrate', preset.bitrate,
      '-bufsize', String(parseInt(preset.bitrate) * 2) + 'k',
      '-pix_fmt', 'yuv420p',
      '-g', String(this.frameRate * 2), // Keyframe interval
      '-f', 'mpegts',
      '-'
    ];

    const ffmpegArgs = [...inputArgs, ...outputArgs];

    session.ffmpegProcess = spawn(this.ffmpegPath, ffmpegArgs, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    session.isStreaming = true;

    // Stream video data to clients
    session.ffmpegProcess.stdout.on('data', (chunk) => {
      this.broadcastVideoChunk(session.channelId, chunk);
    });

    session.ffmpegProcess.stderr.on('data', (data) => {
      // FFmpeg outputs info to stderr
      const message = data.toString();
      if (message.includes('Error') || message.includes('error')) {
        console.error(`FFmpeg error: ${message}`);
      }
    });

    session.ffmpegProcess.on('error', (error) => {
      console.error(`FFmpeg process error: ${error.message}`);
      session.isStreaming = false;
    });

    session.ffmpegProcess.on('exit', (code) => {
      console.log(`FFmpeg exited with code: ${code}`);
      session.isStreaming = false;
    });
  }

  // Broadcast video chunk to all viewers
  broadcastVideoChunk(channelId, chunk) {
    const session = this.activeSessions[channelId];
    if (!session || !session.isStreaming) return;

    // Send to all players and spectators
    this.io.to(`voice:${channelId}`).emit('emulator:video-chunk', {
      channelId,
      data: chunk.toString('base64'),
      timestamp: Date.now()
    });
  }

  // Player joins the session (max 4 players typically)
  joinAsPlayer(channelId, userId, playerSlot = null) {
    const session = this.activeSessions[channelId];
    if (!session) {
      throw new Error('No emulator session in this channel');
    }

    // Check if user is already a player
    const existingPlayer = session.players.find(p => p.userId === userId);
    if (existingPlayer) {
      return {
        message: 'Already joined as player',
        slot: existingPlayer.slot
      };
    }

    // Check if slots are available
    if (session.players.length >= session.maxPlayers) {
      throw new Error(`All player slots are full (${session.maxPlayers}/${session.maxPlayers})`);
    }

    // Find available slot
    const usedSlots = session.players.map(p => p.slot);
    let assignedSlot;

    if (playerSlot !== null && playerSlot >= 0 && playerSlot < session.maxPlayers) {
      if (usedSlots.includes(playerSlot)) {
        throw new Error(`Player slot ${playerSlot + 1} is already taken`);
      }
      assignedSlot = playerSlot;
    } else {
      for (let i = 0; i < session.maxPlayers; i++) {
        if (!usedSlots.includes(i)) {
          assignedSlot = i;
          break;
        }
      }
    }

    // Add player
    const player = {
      userId,
      slot: assignedSlot,
      joinedAt: Date.now()
    };
    session.players.push(player);

    // Initialize input state for this player
    session.inputState[userId] = {
      buttons: {},
      axes: {
        [XBOX_AXES.LEFT_X]: 0,
        [XBOX_AXES.LEFT_Y]: 0,
        [XBOX_AXES.RIGHT_X]: 0,
        [XBOX_AXES.RIGHT_Y]: 0,
        [XBOX_AXES.LT]: 0,
        [XBOX_AXES.RT]: 0
      }
    };

    // Remove from spectators if was spectating
    session.spectators = session.spectators.filter(s => s !== userId);

    // Notify channel
    this.io.to(`voice:${channelId}`).emit('emulator:player-joined', {
      channelId,
      userId,
      slot: assignedSlot,
      players: session.players.map(p => ({ userId: p.userId, slot: p.slot }))
    });

    return {
      slot: assignedSlot,
      playerNumber: assignedSlot + 1,
      players: session.players.map(p => ({ userId: p.userId, slot: p.slot }))
    };
  }

  // Player leaves the session
  leaveAsPlayer(channelId, userId) {
    const session = this.activeSessions[channelId];
    if (!session) {
      return { left: true };
    }

    const playerIndex = session.players.findIndex(p => p.userId === userId);
    if (playerIndex === -1) {
      return { left: true, wasPlayer: false };
    }

    const removedPlayer = session.players[playerIndex];
    session.players.splice(playerIndex, 1);
    delete session.inputState[userId];

    // Notify channel
    this.io.to(`voice:${channelId}`).emit('emulator:player-left', {
      channelId,
      userId,
      slot: removedPlayer.slot,
      players: session.players.map(p => ({ userId: p.userId, slot: p.slot }))
    });

    return { left: true, wasPlayer: true, slot: removedPlayer.slot };
  }

  // Join as spectator (watch only)
  joinAsSpectator(channelId, userId) {
    const session = this.activeSessions[channelId];
    if (!session) {
      throw new Error('No emulator session in this channel');
    }

    // Check if already a player
    const isPlayer = session.players.some(p => p.userId === userId);
    if (isPlayer) {
      return { message: 'Already joined as player' };
    }

    if (!session.spectators.includes(userId)) {
      session.spectators.push(userId);
    }

    this.io.to(`voice:${channelId}`).emit('emulator:spectator-joined', {
      channelId,
      userId,
      spectatorCount: session.spectators.length
    });

    return {
      isSpectator: true,
      spectatorCount: session.spectators.length
    };
  }

  // Handle controller input from a player
  handleInput(channelId, userId, inputData) {
    const session = this.activeSessions[channelId];
    if (!session) {
      return { error: 'No active session' };
    }

    const player = session.players.find(p => p.userId === userId);
    if (!player) {
      return { error: 'Not a player in this session' };
    }

    // Update input state
    const state = session.inputState[userId];
    if (!state) {
      return { error: 'No input state for player' };
    }

    // Process button inputs
    if (inputData.buttons) {
      for (const [button, pressed] of Object.entries(inputData.buttons)) {
        state.buttons[button] = pressed;
      }
    }

    // Process axis inputs
    if (inputData.axes) {
      for (const [axis, value] of Object.entries(inputData.axes)) {
        // Clamp axis values to -1.0 to 1.0 (or 0 to 1.0 for triggers)
        state.axes[axis] = Math.max(-1, Math.min(1, value));
      }
    }

    // Send input to emulator
    this.sendInputToEmulator(session, player.slot, state);

    return { processed: true };
  }

  // Send input to the emulator
  sendInputToEmulator(session, playerSlot, inputState) {
    if (!session.emulatorProcess || session.emulatorProcess.killed) {
      return;
    }

    // Map Xbox buttons to the target platform
    const mapping = CONTROLLER_MAPPINGS[session.emulatorType] || CONTROLLER_MAPPINGS.xbox;
    const mappedInput = this.mapControllerInput(inputState, mapping);

    // Format input command based on emulator type
    const inputCommand = this.formatInputCommand(session.emulatorType, playerSlot, mappedInput);

    // If emulator supports stdin commands
    if (session.emulatorProcess.stdin && inputCommand) {
      try {
        session.emulatorProcess.stdin.write(inputCommand + '\n');
      } catch (error) {
        // Emulator might not support stdin input
      }
    }

    // Emit input state for debugging/visualization
    this.io.to(`voice:${session.channelId}`).emit('emulator:input-state', {
      channelId: session.channelId,
      playerSlot,
      inputState: mappedInput
    });
  }

  // Map controller input from Xbox to target platform
  mapControllerInput(inputState, mapping) {
    const mapped = {
      buttons: {},
      axes: inputState.axes
    };

    for (const [xboxButton, pressed] of Object.entries(inputState.buttons)) {
      const mappedButton = mapping[xboxButton] || xboxButton;
      mapped.buttons[mappedButton] = pressed;
    }

    return mapped;
  }

  // Format input command for specific emulator
  formatInputCommand(emulatorType, playerSlot, inputState) {
    // This would be customized per emulator's input protocol
    // For now, return a JSON representation
    return JSON.stringify({
      player: playerSlot,
      buttons: inputState.buttons,
      axes: inputState.axes
    });
  }

  // Handle emulator error
  handleEmulatorError(channelId, error) {
    const session = this.activeSessions[channelId];
    if (!session) return;

    this.io.to(`voice:${channelId}`).emit('emulator:error', {
      channelId,
      message: error.message
    });
  }

  // Handle emulator exit
  handleEmulatorExit(channelId, code) {
    const session = this.activeSessions[channelId];
    if (!session) return;

    // Clean up FFmpeg if still running
    if (session.ffmpegProcess && !session.ffmpegProcess.killed) {
      session.ffmpegProcess.kill();
    }

    delete this.activeSessions[channelId];

    this.io.to(`voice:${channelId}`).emit('emulator:session-ended', {
      channelId,
      exitCode: code,
      reason: code === 0 ? 'normal' : 'error'
    });
  }

  // Load a different game
  async loadGame(channelId, gamePath, userId) {
    const session = this.activeSessions[channelId];
    if (!session) {
      throw new Error('No emulator session in this channel');
    }

    if (!fs.existsSync(gamePath)) {
      throw new Error('Game file not found');
    }

    // Save current state before loading new game
    const emulatorType = session.emulatorType;
    const players = [...session.players];

    // Stop current session
    await this.stopSession(channelId);

    // Start new session with new game
    await this.startSession(channelId, emulatorType, gamePath, userId);

    // Re-add players
    const newSession = this.activeSessions[channelId];
    if (newSession) {
      for (const player of players) {
        try {
          this.joinAsPlayer(channelId, player.userId, player.slot);
        } catch (e) {
          // Player rejoining failed
        }
      }
    }

    this.io.to(`voice:${channelId}`).emit('emulator:game-loaded', {
      channelId,
      gamePath,
      loadedBy: userId
    });

    return { loaded: true, gamePath };
  }

  // Save state
  async saveState(channelId, slotNumber = 0) {
    const session = this.activeSessions[channelId];
    if (!session) {
      throw new Error('No emulator session in this channel');
    }

    // Save state commands vary by emulator
    // Most emulators support hotkeys like F1-F10 for save states

    this.io.to(`voice:${channelId}`).emit('emulator:state-saved', {
      channelId,
      slot: slotNumber
    });

    return { saved: true, slot: slotNumber };
  }

  // Load state
  async loadState(channelId, slotNumber = 0) {
    const session = this.activeSessions[channelId];
    if (!session) {
      throw new Error('No emulator session in this channel');
    }

    this.io.to(`voice:${channelId}`).emit('emulator:state-loaded', {
      channelId,
      slot: slotNumber
    });

    return { loaded: true, slot: slotNumber };
  }

  // Pause/Resume emulation
  togglePause(channelId) {
    const session = this.activeSessions[channelId];
    if (!session) {
      throw new Error('No emulator session in this channel');
    }

    session.isPaused = !session.isPaused;

    this.io.to(`voice:${channelId}`).emit('emulator:pause-toggled', {
      channelId,
      isPaused: session.isPaused
    });

    return { isPaused: session.isPaused };
  }

  // Stop session
  async stopSession(channelId) {
    const session = this.activeSessions[channelId];
    if (!session) {
      return { stopped: true };
    }

    // Stop FFmpeg
    if (session.ffmpegProcess && !session.ffmpegProcess.killed) {
      session.ffmpegProcess.kill('SIGTERM');
    }

    // Stop emulator
    if (session.emulatorProcess && !session.emulatorProcess.killed) {
      session.emulatorProcess.kill('SIGTERM');

      // Force kill after timeout
      setTimeout(() => {
        if (session.emulatorProcess && !session.emulatorProcess.killed) {
          session.emulatorProcess.kill('SIGKILL');
        }
      }, 3000);
    }

    delete this.activeSessions[channelId];

    this.io.to(`voice:${channelId}`).emit('emulator:session-ended', {
      channelId,
      reason: 'stopped'
    });

    return { stopped: true };
  }

  // Stop all sessions
  async stopAll() {
    const channelIds = Object.keys(this.activeSessions);
    for (const channelId of channelIds) {
      await this.stopSession(channelId);
    }
    return { stopped: true, count: channelIds.length };
  }

  // Get session info
  getSession(channelId) {
    const session = this.activeSessions[channelId];
    if (!session) {
      return null;
    }

    return {
      channelId,
      emulatorType: session.emulatorType,
      displayName: session.config.displayName,
      gamePath: session.gamePath,
      startedBy: session.startedBy,
      startTime: session.startTime,
      isStreaming: session.isStreaming,
      isPaused: session.isPaused,
      players: session.players.map(p => ({ userId: p.userId, slot: p.slot })),
      spectatorCount: session.spectators.length,
      maxPlayers: session.maxPlayers
    };
  }

  // Get status
  getStatus() {
    return {
      enabled: this.enabled,
      emulatorPaths: this.emulatorPaths,
      romPaths: this.romPaths,
      frameRate: this.frameRate,
      videoQuality: this.videoQuality,
      resolution: this.streamResolution,
      supportedEmulators: Object.entries(EMULATOR_CONFIG).map(([key, config]) => ({
        id: key,
        name: config.name,
        displayName: config.displayName,
        maxPlayers: config.maxPlayers,
        romExtensions: config.romExtensions,
        website: config.website,
        github: config.github,
        pathConfigured: fs.existsSync(this.emulatorPaths[key] || ''),
        romPathConfigured: fs.existsSync(this.romPaths[key] || '')
      })),
      activeSessions: Object.values(this.activeSessions).map(session => ({
        channelId: session.channelId,
        emulatorType: session.emulatorType,
        displayName: session.config.displayName,
        gamePath: session.gamePath,
        playerCount: session.players.length,
        spectatorCount: session.spectators.length,
        isStreaming: session.isStreaming,
        startTime: session.startTime
      }))
    };
  }

  // Check if emulator is available on the system
  async checkEmulatorAvailability(emulatorType) {
    const config = EMULATOR_CONFIG[emulatorType];
    if (!config) {
      return { available: false, error: 'Invalid emulator type' };
    }

    const emulatorPath = this.emulatorPaths[emulatorType];

    // Check if file exists
    if (!emulatorPath || !fs.existsSync(emulatorPath)) {
      return {
        available: false,
        error: `Emulator not found at: ${emulatorPath}`,
        config,
        downloadUrl: config.website
      };
    }

    return {
      available: true,
      path: emulatorPath,
      config
    };
  }

  // Get controller mapping info
  getControllerMapping(emulatorType = null) {
    const result = {
      standardButtons: XBOX_BUTTONS,
      standardAxes: XBOX_AXES,
      description: {
        buttons: {
          A: 'A button (bottom)',
          B: 'B button (right)',
          X: 'X button (left)',
          Y: 'Y button (top)',
          LB: 'Left bumper',
          RB: 'Right bumper',
          BACK: 'Back/Select button',
          START: 'Start/Menu button',
          LS: 'Left stick click',
          RS: 'Right stick click',
          GUIDE: 'Guide/Home button',
          DPAD_UP: 'D-pad up',
          DPAD_DOWN: 'D-pad down',
          DPAD_LEFT: 'D-pad left',
          DPAD_RIGHT: 'D-pad right'
        },
        axes: {
          LEFT_X: 'Left stick horizontal (-1 to 1)',
          LEFT_Y: 'Left stick vertical (-1 to 1)',
          RIGHT_X: 'Right stick horizontal (-1 to 1)',
          RIGHT_Y: 'Right stick vertical (-1 to 1)',
          LT: 'Left trigger (0 to 1)',
          RT: 'Right trigger (0 to 1)'
        }
      }
    };

    if (emulatorType && CONTROLLER_MAPPINGS[emulatorType]) {
      result.platformMapping = CONTROLLER_MAPPINGS[emulatorType];
    } else {
      result.allPlatformMappings = CONTROLLER_MAPPINGS;
    }

    return result;
  }

  // Get list of all supported emulators
  getSupportedEmulators() {
    return Object.entries(EMULATOR_CONFIG).map(([key, config]) => ({
      id: key,
      name: config.name,
      displayName: config.displayName,
      maxPlayers: config.maxPlayers,
      romExtensions: config.romExtensions,
      website: config.website,
      github: config.github
    }));
  }
}

module.exports = {
  EmulatorBotService,
  EMULATOR_CONFIG,
  XBOX_BUTTONS,
  XBOX_AXES,
  CONTROLLER_MAPPINGS,
  MAX_PLAYERS
};
