require('dotenv').config();

const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');

const connectDB = require('./config/database');
const apiRoutes = require('./routes/api');
const { initializeSocket } = require('./socket/socketHandler');
const User = require('./models/User');
const Channel = require('./models/Channel');

const app = express();

// Configuration
const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const ENABLE_HTTPS = process.env.ENABLE_HTTPS === 'true';
const FEDERATION_ENABLED = process.env.FEDERATION_ENABLED === 'true';

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
  origin: [CLIENT_URL, 'http://localhost:3000', 'http://localhost:5000'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files for uploads only
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API routes
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    name: 'F7Lans Server',
    version: '1.0.0',
    federationEnabled: FEDERATION_ENABLED,
    timestamp: new Date().toISOString()
  });
});

// Create HTTP(S) server
let server;
if (ENABLE_HTTPS && fs.existsSync('./ssl/key.pem') && fs.existsSync('./ssl/cert.pem')) {
  const sslOptions = {
    key: fs.readFileSync('./ssl/key.pem'),
    cert: fs.readFileSync('./ssl/cert.pem')
  };
  server = https.createServer(sslOptions, app);
  console.log('HTTPS enabled');
} else {
  server = http.createServer(app);
}

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: [CLIENT_URL, 'http://localhost:3000', 'http://localhost:5000'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Store io in app for controllers
app.set('io', io);

// Initialize socket handlers
initializeSocket(io);

// Federation service (optional)
let federationService = null;

// YouTube bot service
let youtubeBotService = null;

// Plex bot service
let plexBotService = null;

// Database and server startup
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Create default admin if not exists
    const adminExists = await User.findOne({ role: 'superadmin' });
    if (!adminExists) {
      const defaultAdmin = new User({
        username: 'admin',
        displayName: 'F7 Admin',
        email: 'admin@f7lans.local',
        password: 'admin123', // Change this in production!
        role: 'superadmin'
      });
      await defaultAdmin.save();
      console.log('Default admin created: admin / admin123');
    }

    // Create default channels if none exist
    const channelCount = await Channel.countDocuments();
    if (channelCount === 0) {
      const adminUser = await User.findOne({ role: 'superadmin' });

      const defaultChannels = [
        { name: 'general', type: 'text', category: 'Text Channels', description: 'General discussion' },
        { name: 'announcements', type: 'announcement', category: 'Text Channels', description: 'Important announcements' },
        { name: 'gaming', type: 'text', category: 'Text Channels', description: 'Gaming discussion' },
        { name: 'general-voice', type: 'voice', category: 'Voice Channels', description: 'General voice chat' },
        { name: 'gaming-voice', type: 'voice', category: 'Voice Channels', description: 'Voice chat for gaming' },
        { name: 'stream-room', type: 'video', category: 'Voice Channels', description: 'Screen sharing and streaming' }
      ];

      for (let i = 0; i < defaultChannels.length; i++) {
        await Channel.create({
          ...defaultChannels[i],
          position: i,
          createdBy: adminUser._id
        });
      }
      console.log('Default channels created');
    }

    // Initialize federation if enabled
    let federationStatus = 'Disabled';
    if (FEDERATION_ENABLED) {
      try {
        const { FederationService } = require('./services/federationService');
        federationService = new FederationService(io);
        await federationService.initialize();
        federationStatus = 'Enabled';
      } catch (err) {
        console.error('Federation failed to initialize:', err.message);
        federationStatus = 'Failed';
      }
    }

    // Initialize YouTube bot service
    try {
      const { YouTubeBotService } = require('./services/youtubeBotService');
      const youtubeBotController = require('./controllers/youtubeBotController');
      youtubeBotService = new YouTubeBotService(io);
      youtubeBotController.initialize(youtubeBotService);
      console.log('YouTube bot service initialized');
    } catch (err) {
      console.error('YouTube bot service failed to initialize:', err.message);
    }

    // Initialize Plex bot service
    try {
      const { PlexBotService } = require('./services/plexBotService');
      const plexBotController = require('./controllers/plexBotController');
      plexBotService = new PlexBotService(io);
      plexBotController.initialize(plexBotService);
      console.log('Plex bot service initialized');
    } catch (err) {
      console.error('Plex bot service failed to initialize:', err.message);
    }

    // Initialize Emby bot service
    try {
      const { EmbyBotService } = require('./services/embyBotService');
      const embyBotController = require('./controllers/embyBotController');
      const embyBotService = new EmbyBotService(io);
      embyBotController.initialize(embyBotService);
      console.log('Emby bot service initialized');
    } catch (err) {
      console.error('Emby bot service failed to initialize:', err.message);
    }

    // Initialize Jellyfin bot service
    try {
      const { JellyfinBotService } = require('./services/jellyfinBotService');
      const jellyfinBotController = require('./controllers/jellyfinBotController');
      const jellyfinBotService = new JellyfinBotService(io);
      jellyfinBotController.initialize(jellyfinBotService);
      console.log('Jellyfin bot service initialized');
    } catch (err) {
      console.error('Jellyfin bot service failed to initialize:', err.message);
    }

    // Initialize Chrome bot service
    try {
      const { ChromeBotService } = require('./services/chromeBotService');
      const chromeBotController = require('./controllers/chromeBotController');
      const chromeBotService = new ChromeBotService(io);
      chromeBotController.initialize(chromeBotService);
      console.log('Chrome bot service initialized');
    } catch (err) {
      console.error('Chrome bot service failed to initialize:', err.message);
    }

    // Initialize IPTV bot service
    try {
      const { IPTVBotService } = require('./services/iptvBotService');
      const iptvBotController = require('./controllers/iptvBotController');
      const iptvBotService = new IPTVBotService(io);
      iptvBotController.initialize(iptvBotService);
      console.log('IPTV bot service initialized');
    } catch (err) {
      console.error('IPTV bot service failed to initialize:', err.message);
    }

    // Initialize Spotify bot service
    try {
      const { SpotifyBotService } = require('./services/spotifyBotService');
      const spotifyBotController = require('./controllers/spotifyBotController');
      const spotifyBotService = new SpotifyBotService(io);
      spotifyBotController.initialize(spotifyBotService);
      console.log('Spotify bot service initialized');
    } catch (err) {
      console.error('Spotify bot service failed to initialize:', err.message);
    }

    // Initialize Group service
    let groupService = null;
    try {
      const { GroupService } = require('./services/groupService');
      const groupController = require('./controllers/groupController');
      const accessControl = require('./middleware/accessControl');
      groupService = new GroupService();
      groupController.initialize(groupService);
      accessControl.initialize(groupService);
      console.log('Group service initialized');
    } catch (err) {
      console.error('Group service failed to initialize:', err.message);
    }

    // Initialize File Share service
    try {
      const { FileShareService } = require('./services/fileShareService');
      const fileShareController = require('./controllers/fileShareController');
      const fileShareService = new FileShareService(io);
      fileShareController.initialize(fileShareService, groupService);
      console.log('File share service initialized');
    } catch (err) {
      console.error('File share service failed to initialize:', err.message);
    }

    // Initialize Game Together service (Virtual controller emulation)
    try {
      const GameTogetherService = require('./services/gameTogetherService');
      const gameTogetherController = require('./controllers/gameTogetherController');
      const gameTogetherService = new GameTogetherService(io);
      gameTogetherController.initialize(gameTogetherService);
      console.log('Game Together service initialized (virtual controller emulation)');
    } catch (err) {
      console.error('Game Together service failed to initialize:', err.message);
    }

    // Start server
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🎮  F7Lans Server v1.0.0                               ║
║                                                           ║
║   Server running on port ${PORT}                            ║
║   ${ENABLE_HTTPS ? 'HTTPS' : 'HTTP'}: ${ENABLE_HTTPS ? 'https' : 'http'}://localhost:${PORT}                       ║
║                                                           ║
║   Federation: ${federationStatus.padEnd(8)}                               ║
║                                                           ║
║   Default Admin: admin / admin123                         ║
║   (Change password after first login!)                    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');

  if (federationService) {
    await federationService.shutdown();
    console.log('Federation connections closed');
  }

  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  if (federationService) {
    await federationService.shutdown();
  }
  server.close(() => {
    process.exit(0);
  });
});

module.exports = { app, server, io, federationService };
