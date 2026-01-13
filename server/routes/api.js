const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticate, adminOnly } = require('../middleware/auth');
const { requirePermission } = require('../middleware/accessControl');
const authController = require('../controllers/authController');
const adminController = require('../controllers/adminController');
const channelController = require('../controllers/channelController');
const userController = require('../controllers/userController');
const federationController = require('../controllers/federationController');
const youtubeBotController = require('../controllers/youtubeBotController');
const plexBotController = require('../controllers/plexBotController');
const embyBotController = require('../controllers/embyBotController');
const jellyfinBotController = require('../controllers/jellyfinBotController');
const chromeBotController = require('../controllers/chromeBotController');
const iptvBotController = require('../controllers/iptvBotController');
const spotifyBotController = require('../controllers/spotifyBotController');
const groupController = require('../controllers/groupController');
const fileShareController = require('../controllers/fileShareController');
const activityController = require('../controllers/activityController');
const activityStatsBotController = require('../controllers/activityStatsBotController');
const rpgBotController = require('../controllers/rpgBotController');
const socialAccountsController = require('../controllers/socialAccountsController');
const steamAuthController = require('../controllers/steamAuthController');
const serverSettingsController = require('../controllers/serverSettingsController');
const twoFactorController = require('../controllers/twoFactorController');

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

// ===== Emby Bot Routes =====
router.get('/admin/emby-bot/status', authenticate, adminOnly, embyBotController.getStatus);
router.post('/admin/emby-bot/enable', authenticate, adminOnly, embyBotController.setEnabled);
router.post('/admin/emby-bot/connect', authenticate, adminOnly, embyBotController.connect);
router.post('/admin/emby-bot/disconnect', authenticate, adminOnly, embyBotController.disconnect);
router.get('/admin/emby-bot/search', authenticate, adminOnly, embyBotController.search);
router.post('/admin/emby-bot/play', authenticate, adminOnly, embyBotController.play);
router.post('/admin/emby-bot/stop', authenticate, adminOnly, embyBotController.stop);

// ===== Jellyfin Bot Routes =====
router.get('/admin/jellyfin-bot/status', authenticate, adminOnly, jellyfinBotController.getStatus);
router.post('/admin/jellyfin-bot/enable', authenticate, adminOnly, jellyfinBotController.setEnabled);
router.post('/admin/jellyfin-bot/connect', authenticate, adminOnly, jellyfinBotController.connect);
router.post('/admin/jellyfin-bot/disconnect', authenticate, adminOnly, jellyfinBotController.disconnect);
router.get('/admin/jellyfin-bot/search', authenticate, adminOnly, jellyfinBotController.search);
router.post('/admin/jellyfin-bot/play', authenticate, adminOnly, jellyfinBotController.play);
router.post('/admin/jellyfin-bot/stop', authenticate, adminOnly, jellyfinBotController.stop);

// ===== Chrome Bot Routes =====
router.get('/admin/chrome-bot/status', authenticate, adminOnly, chromeBotController.getStatus);
router.post('/admin/chrome-bot/enable', authenticate, adminOnly, chromeBotController.setEnabled);
router.post('/admin/chrome-bot/start', authenticate, adminOnly, chromeBotController.startSession);
router.get('/admin/chrome-bot/session/:channelId', authenticate, chromeBotController.getSession);
router.post('/admin/chrome-bot/navigate', authenticate, chromeBotController.navigate);
router.post('/admin/chrome-bot/back', authenticate, chromeBotController.goBack);
router.post('/admin/chrome-bot/forward', authenticate, chromeBotController.goForward);
router.post('/admin/chrome-bot/refresh', authenticate, chromeBotController.refresh);
router.post('/admin/chrome-bot/stop', authenticate, adminOnly, chromeBotController.stopSession);
router.post('/admin/chrome-bot/join', authenticate, chromeBotController.joinSession);
router.post('/admin/chrome-bot/transfer', authenticate, chromeBotController.transferControl);

// ===== IPTV Bot Routes =====
router.get('/admin/iptv-bot/status', authenticate, adminOnly, iptvBotController.getStatus);
router.post('/admin/iptv-bot/enable', authenticate, adminOnly, iptvBotController.setEnabled);
router.post('/admin/iptv-bot/configure', authenticate, adminOnly, iptvBotController.configure);
router.get('/admin/iptv-bot/channels', authenticate, iptvBotController.getChannels);
router.get('/admin/iptv-bot/groups', authenticate, iptvBotController.getGroups);
router.get('/admin/iptv-bot/epg/:channelId', authenticate, iptvBotController.getEPG);
router.post('/admin/iptv-bot/play', authenticate, iptvBotController.play);
router.post('/admin/iptv-bot/change-channel', authenticate, iptvBotController.changeChannel);
router.post('/admin/iptv-bot/stop', authenticate, iptvBotController.stop);
router.post('/admin/iptv-bot/recordings', authenticate, iptvBotController.scheduleRecording);
router.get('/admin/iptv-bot/recordings', authenticate, iptvBotController.getRecordings);
router.delete('/admin/iptv-bot/recordings/:recordingId', authenticate, iptvBotController.cancelRecording);
router.post('/admin/iptv-bot/recordings/:recordingId/tag', authenticate, iptvBotController.tagUser);

// ===== Spotify Bot Routes =====
router.get('/admin/spotify-bot/status', authenticate, adminOnly, spotifyBotController.getStatus);
router.post('/admin/spotify-bot/enable', authenticate, adminOnly, spotifyBotController.setEnabled);
router.post('/admin/spotify-bot/configure', authenticate, adminOnly, spotifyBotController.configure);
router.get('/admin/spotify-bot/auth-url', authenticate, adminOnly, spotifyBotController.getAuthUrl);
router.post('/admin/spotify-bot/callback', authenticate, adminOnly, spotifyBotController.callback);
router.post('/admin/spotify-bot/disconnect', authenticate, adminOnly, spotifyBotController.disconnect);
router.get('/admin/spotify-bot/search', authenticate, spotifyBotController.search);
router.get('/admin/spotify-bot/playlists', authenticate, spotifyBotController.getPlaylists);
router.get('/admin/spotify-bot/playlists/:playlistId/tracks', authenticate, spotifyBotController.getPlaylistTracks);
router.post('/admin/spotify-bot/play', authenticate, spotifyBotController.play);
router.post('/admin/spotify-bot/queue', authenticate, spotifyBotController.addToQueue);
router.post('/admin/spotify-bot/skip', authenticate, spotifyBotController.skip);
router.get('/admin/spotify-bot/queue/:channelId', authenticate, spotifyBotController.getQueue);
router.post('/admin/spotify-bot/stop', authenticate, spotifyBotController.stop);

// ===== Channel Moderation Routes =====
router.post('/channels/:channelId/kick/:userId', authenticate, adminOnly, channelController.kickUser);

// ===== Group Management Routes =====
router.get('/admin/groups', authenticate, adminOnly, groupController.getAllGroups);
router.post('/admin/groups', authenticate, adminOnly, groupController.createGroup);
router.get('/admin/groups/features', authenticate, adminOnly, groupController.getAvailableFeatures);
router.get('/admin/groups/:groupId', authenticate, adminOnly, groupController.getGroup);
router.put('/admin/groups/:groupId', authenticate, adminOnly, groupController.updateGroup);
router.delete('/admin/groups/:groupId', authenticate, adminOnly, groupController.deleteGroup);
router.get('/admin/groups/:groupId/members', authenticate, adminOnly, groupController.getGroupMembers);
router.get('/admin/groups/:groupId/permissions', authenticate, adminOnly, groupController.getGroupPermissions);
router.put('/admin/groups/:groupId/permissions', authenticate, adminOnly, groupController.setGroupPermissions);
router.post('/admin/groups/:groupId/users/:userId', authenticate, adminOnly, groupController.addUserToGroup);
router.delete('/admin/groups/:groupId/users/:userId', authenticate, adminOnly, groupController.removeUserFromGroup);
router.get('/admin/users/:userId/groups', authenticate, adminOnly, groupController.getUserGroups);
router.put('/admin/users/:userId/groups', authenticate, adminOnly, groupController.setUserGroups);

// User permission endpoints (non-admin)
router.get('/permissions/me', authenticate, groupController.getMyPermissions);
router.get('/permissions/check/:feature', authenticate, groupController.checkPermission);

// ===== File Share Routes =====
router.get('/admin/file-share/status', authenticate, adminOnly, fileShareController.getStatus);
router.post('/admin/file-share/enable', authenticate, adminOnly, fileShareController.setEnabled);

// User file share endpoints
router.get('/file-share/folders', authenticate, requirePermission('file-share'), fileShareController.getAllSharedFolders);
router.get('/file-share/my-folders', authenticate, requirePermission('file-share'), fileShareController.getMySharedFolders);
router.post('/file-share/folders', authenticate, requirePermission('file-share'), fileShareController.shareFolder);
router.delete('/file-share/folders/:folderId', authenticate, requirePermission('file-share'), fileShareController.unshareFolder);
router.get('/file-share/users/:userId/folders', authenticate, requirePermission('file-share'), fileShareController.getUserSharedFolders);
router.get('/file-share/users/:userId/folders/:folderId/contents', authenticate, requirePermission('file-share'), fileShareController.getFolderContents);
router.post('/file-share/users/:userId/folders/:folderId/download', authenticate, requirePermission('file-share'), fileShareController.requestDownload);

// ===== Activity Routes =====
router.post('/activity/start', authenticate, activityController.startActivity);
router.post('/activity/end', authenticate, activityController.endActivity);
router.get('/activity/current', authenticate, activityController.getCurrentActivity);
router.get('/activity/stats', authenticate, activityController.getMyStats);
router.get('/activity/history', authenticate, activityController.getMyHistory);
router.get('/activity/users/:userId/stats', authenticate, activityController.getUserStats);
router.get('/activity/users/:userId/common', authenticate, activityController.getCommonActivities);
router.get('/admin/activity/stats', authenticate, adminOnly, activityController.getServerStats);

// ===== Activity Stats Bot Routes =====
router.get('/admin/activity-bot/status', authenticate, adminOnly, activityStatsBotController.getStatus);
router.post('/admin/activity-bot/enable', authenticate, adminOnly, activityStatsBotController.setEnabled);
router.post('/admin/activity-bot/start', authenticate, activityStatsBotController.startStats);
router.post('/admin/activity-bot/stop', authenticate, activityStatsBotController.stopStats);
router.get('/admin/activity-bot/current-stats', authenticate, activityStatsBotController.getStats);
router.get('/admin/activity-bot/leaderboard', authenticate, activityStatsBotController.getLeaderboard);
router.get('/admin/activity-bot/game/:gameName', authenticate, activityStatsBotController.getGameStats);

// ===== RPG Bot Routes =====
router.get('/admin/rpg-bot/status', authenticate, adminOnly, rpgBotController.getStatus);
router.post('/admin/rpg-bot/enable', authenticate, adminOnly, rpgBotController.setEnabled);
router.post('/rpg/campaign', authenticate, rpgBotController.createCampaign);
router.post('/rpg/join', authenticate, rpgBotController.joinCampaign);
router.post('/rpg/start', authenticate, rpgBotController.startAdventure);
router.post('/rpg/action', authenticate, rpgBotController.takeAction);
router.get('/rpg/campaign/:channelId', authenticate, rpgBotController.getCampaign);
router.post('/rpg/end', authenticate, rpgBotController.endCampaign);
router.post('/rpg/roll', authenticate, rpgBotController.rollDice);

// ===== Social Accounts Routes =====
router.get('/social/accounts', authenticate, socialAccountsController.getLinkedAccounts);
router.post('/social/reddit/link', authenticate, socialAccountsController.linkReddit);
router.post('/social/reddit/verify', authenticate, socialAccountsController.verifyReddit);
router.post('/social/twitter/link', authenticate, socialAccountsController.linkTwitter);
router.post('/social/twitter/verify', authenticate, socialAccountsController.verifyTwitter);
router.post('/social/xbox/link', authenticate, socialAccountsController.linkXbox);
router.post('/social/xbox/verify', authenticate, socialAccountsController.verifyXbox);
router.post('/social/playstation/link', authenticate, socialAccountsController.linkPlayStation);
router.post('/social/playstation/verify', authenticate, socialAccountsController.verifyPlayStation);
router.post('/social/blizzard/link', authenticate, socialAccountsController.linkBlizzard);
router.post('/social/blizzard/verify', authenticate, socialAccountsController.verifyBlizzard);
router.delete('/social/:platform', authenticate, socialAccountsController.unlinkAccount);

// ===== Steam Auth Routes =====
router.post('/steam/auth-url', authenticate, steamAuthController.getAuthUrl);
router.get('/steam/callback', steamAuthController.handleCallback);
router.post('/steam/link', authenticate, steamAuthController.linkSteamManual);
router.get('/steam/profile', authenticate, steamAuthController.getSteamProfile);
router.delete('/steam/unlink', authenticate, steamAuthController.unlinkSteam);

// ===== Server Settings Routes =====
router.get('/settings', authenticate, serverSettingsController.getPublicSettings);
router.get('/admin/settings', authenticate, adminOnly, serverSettingsController.getSettings);
router.put('/admin/settings', authenticate, adminOnly, serverSettingsController.updateSettings);
router.get('/admin/settings/video', authenticate, adminOnly, serverSettingsController.getVideoSettings);
router.put('/admin/settings/video', authenticate, adminOnly, serverSettingsController.updateVideoSettings);
router.get('/admin/settings/languages', authenticate, serverSettingsController.getSupportedLanguages);
router.get('/admin/settings/bots', authenticate, adminOnly, serverSettingsController.getBotStatus);
router.put('/admin/settings/bots', authenticate, adminOnly, serverSettingsController.updateBotStatus);

// ===== Two-Factor Authentication Routes =====
router.get('/auth/2fa/status', authenticate, twoFactorController.getStatus);
router.post('/auth/2fa/setup', authenticate, twoFactorController.setupStart);
router.post('/auth/2fa/verify-setup', authenticate, twoFactorController.setupComplete);
router.post('/auth/2fa/disable', authenticate, twoFactorController.disable);
router.post('/auth/2fa/verify', twoFactorController.verify); // No auth - used during login
router.post('/auth/2fa/backup-codes', authenticate, twoFactorController.regenerateBackupCodes);

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
