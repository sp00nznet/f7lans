const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticate, adminOnly } = require('../middleware/auth');
const authController = require('../controllers/authController');
const adminController = require('../controllers/adminController');
const channelController = require('../controllers/channelController');
const userController = require('../controllers/userController');
const federationController = require('../controllers/federationController');
const youtubeBotController = require('../controllers/youtubeBotController');
const plexBotController = require('../controllers/plexBotController');

const router = express.Router();

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/avatars'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.user._id}-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;
    if (allowed.test(ext) && allowed.test(mime)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// ===== Auth Routes =====
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.get('/auth/me', authenticate, authController.getMe);
router.put('/auth/profile', authenticate, authController.updateProfile);
router.put('/auth/password', authenticate, authController.changePassword);
router.post('/auth/logout', authenticate, authController.logout);

// ===== User Routes =====
router.get('/users/:userId', authenticate, userController.getProfile);
router.post('/users/avatar', authenticate, upload.single('avatar'), userController.uploadAvatar);
router.get('/users/:userId/common-games', authenticate, userController.getCommonGames);

// Friends
router.post('/users/:userId/friend-request', authenticate, userController.sendFriendRequest);
router.post('/users/:userId/friend-accept', authenticate, userController.acceptFriendRequest);
router.post('/users/:userId/friend-decline', authenticate, userController.declineFriendRequest);
router.delete('/users/:userId/friend', authenticate, userController.removeFriend);
router.post('/users/:userId/block', authenticate, userController.blockUser);
router.delete('/users/:userId/block', authenticate, userController.unblockUser);

// Direct Messages
router.get('/dm/conversations', authenticate, userController.getConversations);
router.get('/dm/:userId', authenticate, userController.getDirectMessages);

// ===== Channel Routes =====
router.get('/channels', authenticate, channelController.getChannels);
router.get('/channels/:channelId', authenticate, channelController.getChannel);
router.post('/channels', authenticate, adminOnly, channelController.createChannel);
router.put('/channels/:channelId', authenticate, adminOnly, channelController.updateChannel);
router.delete('/channels/:channelId', authenticate, adminOnly, channelController.deleteChannel);
router.get('/channels/:channelId/messages', authenticate, channelController.getMessages);
router.get('/channels/:channelId/pinned', authenticate, channelController.getPinnedMessages);

// ===== Admin Routes =====
router.get('/admin/users', authenticate, adminOnly, adminController.getAllUsers);
router.post('/admin/users', authenticate, adminOnly, adminController.createUser);
router.put('/admin/users/:userId/role', authenticate, adminOnly, adminController.updateUserRole);
router.put('/admin/users/:userId/ban', authenticate, adminOnly, adminController.toggleUserBan);
router.get('/admin/invites', authenticate, adminOnly, adminController.getInvites);
router.post('/admin/invites', authenticate, adminOnly, adminController.createInvite);
router.delete('/admin/invites/:inviteId', authenticate, adminOnly, adminController.deleteInvite);
router.get('/admin/stats', authenticate, adminOnly, adminController.getStats);

// ===== Federation Routes =====
// Public endpoints (for server-to-server communication)
router.get('/federation/info', federationController.getServerInfo);
router.post('/federation/request', federationController.handleFederationRequest);
router.post('/federation/approved', federationController.handleApprovalNotification);
router.post('/federation/rejected', federationController.handleRejectionNotification);

// Admin endpoints (for managing federation)
router.get('/federation/status', authenticate, adminOnly, federationController.getFederationStatus);
router.get('/federation/servers', authenticate, adminOnly, federationController.getFederatedServers);
router.get('/federation/requests', authenticate, adminOnly, federationController.getPendingRequests);
router.get('/federation/channels', authenticate, adminOnly, federationController.getFederatedChannels);

router.post('/federation/initiate', authenticate, adminOnly, federationController.initiateFederation);
router.post('/federation/analyze', authenticate, adminOnly, federationController.analyzeConflicts);
router.post('/federation/requests/:requestId/approve', authenticate, adminOnly, federationController.approveFederationRequest);
router.post('/federation/requests/:requestId/reject', authenticate, adminOnly, federationController.rejectFederationRequest);

router.put('/federation/servers/:serverId/settings', authenticate, adminOnly, federationController.updateServerSettings);
router.put('/federation/channels/:channelId/sync', authenticate, adminOnly, federationController.toggleChannelSync);

router.post('/federation/servers/:serverId/disconnect', authenticate, adminOnly, federationController.disconnectServer);
router.delete('/federation/servers/:serverId', authenticate, adminOnly, federationController.removeFederation);

// ===== YouTube Bot Routes =====
router.get('/admin/youtube-bot/status', authenticate, adminOnly, youtubeBotController.getStatus);
router.post('/admin/youtube-bot/enable', authenticate, adminOnly, youtubeBotController.setEnabled);
router.post('/admin/youtube-bot/play', authenticate, adminOnly, youtubeBotController.play);
router.post('/admin/youtube-bot/stop', authenticate, adminOnly, youtubeBotController.stop);
router.get('/admin/youtube-bot/video-info', authenticate, adminOnly, youtubeBotController.getVideoInfo);
router.get('/admin/youtube-bot/stream-url', authenticate, youtubeBotController.getStreamUrl);

// ===== Plex Bot Routes =====
router.get('/admin/plex-bot/status', authenticate, adminOnly, plexBotController.getStatus);
router.post('/admin/plex-bot/enable', authenticate, adminOnly, plexBotController.setEnabled);
router.post('/admin/plex-bot/connect', authenticate, adminOnly, plexBotController.connect);
router.post('/admin/plex-bot/disconnect', authenticate, adminOnly, plexBotController.disconnect);
router.get('/admin/plex-bot/search', authenticate, adminOnly, plexBotController.search);
router.post('/admin/plex-bot/play', authenticate, adminOnly, plexBotController.play);
router.post('/admin/plex-bot/stop', authenticate, adminOnly, plexBotController.stop);
router.get('/admin/plex-bot/thumb', authenticate, plexBotController.getThumb);

// ===== Channel Moderation Routes =====
router.post('/channels/:channelId/kick/:userId', authenticate, adminOnly, channelController.kickUser);

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
