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
const FederationService = require('./services/federationService');
const { getServerId } = require('./config/federation');

const app = express();

// Configuration
const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const ENABLE_HTTPS = process.env.ENABLE_HTTPS === 'true';

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

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve web client in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
}

// API routes
app.use('/api', apiRoutes);

// Health check
app.get('/health', async (req, res) => {
  const serverId = await getServerId();
  res.json({
    status: 'ok',
    name: 'F7Lans Server',
    version: '1.0.0',
    serverId: serverId,
    federationEnabled: true,
    timestamp: new Date().toISOString()
  });
});

// Serve client for all other routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

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

// Initialize socket handlers
initializeSocket(io);

// Initialize federation service
const federationService = new FederationService(io);

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

    // Initialize federation service (reconnect to federated servers)
    const serverId = await getServerId();
    await federationService.initialize();
    console.log(`Federation initialized. Server ID: ${serverId}`);

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
║   Federation: Enabled                                     ║
║   Server ID: ${serverId.substring(0, 20)}...              ║
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

  // Disconnect from federated servers
  await federationService.shutdown();
  console.log('Federation connections closed');

  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await federationService.shutdown();
  server.close(() => {
    process.exit(0);
  });
});

module.exports = { app, server, io, federationService };
