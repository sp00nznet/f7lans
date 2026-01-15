/**
 * Group Service
 * Manages user groups and access control
 */

const fs = require('fs');
const path = require('path');

class GroupService {
  constructor() {
    this.dataFile = path.join(__dirname, '../data/groups.json');
    this.groups = {};
    this.userGroups = {}; // userId -> [groupId]
    this.permissions = {}; // groupId -> { feature: boolean }
    this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
        this.groups = data.groups || {};
        this.userGroups = data.userGroups || {};
        this.permissions = data.permissions || {};
      } else {
        // Create default groups
        this.createDefaultGroups();
      }
    } catch (error) {
      console.error('Failed to load groups data:', error);
      this.createDefaultGroups();
    }
  }

  saveData() {
    try {
      const dir = path.dirname(this.dataFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.dataFile, JSON.stringify({
        groups: this.groups,
        userGroups: this.userGroups,
        permissions: this.permissions
      }, null, 2));
    } catch (error) {
      console.error('Failed to save groups data:', error);
    }
  }

  createDefaultGroups() {
    // Create default "Everyone" group with basic permissions
    this.groups['everyone'] = {
      id: 'everyone',
      name: 'Everyone',
      description: 'Default group for all users',
      createdAt: new Date().toISOString(),
      isDefault: true
    };

    // Create "Admins" group with all permissions
    this.groups['admins'] = {
      id: 'admins',
      name: 'Admins',
      description: 'Administrators with full access',
      createdAt: new Date().toISOString(),
      isDefault: true
    };

    // Set default permissions
    this.permissions['everyone'] = {
      'voice-channels': true,
      'text-channels': true,
      'screen-share': true,
      'youtube-bot': false,
      'plex-bot': false,
      'emby-bot': false,
      'jellyfin-bot': false,
      'chrome-bot': false,
      'iptv-bot': false,
      'spotify-bot': false,
      'emulator-bot': false,
      'file-share': false
    };

    this.permissions['admins'] = {
      'voice-channels': true,
      'text-channels': true,
      'screen-share': true,
      'youtube-bot': true,
      'plex-bot': true,
      'emby-bot': true,
      'jellyfin-bot': true,
      'chrome-bot': true,
      'iptv-bot': true,
      'spotify-bot': true,
      'emulator-bot': true,
      'file-share': true,
      'admin-panel': true
    };

    this.saveData();
  }

  // Group CRUD operations
  createGroup(name, description = '') {
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-');

    if (this.groups[id]) {
      throw new Error('Group already exists');
    }

    this.groups[id] = {
      id,
      name,
      description,
      createdAt: new Date().toISOString(),
      isDefault: false
    };

    // Initialize with no permissions
    this.permissions[id] = {
      'voice-channels': true,
      'text-channels': true,
      'screen-share': false,
      'youtube-bot': false,
      'plex-bot': false,
      'emby-bot': false,
      'jellyfin-bot': false,
      'chrome-bot': false,
      'iptv-bot': false,
      'spotify-bot': false,
      'emulator-bot': false,
      'file-share': false
    };

    this.saveData();
    return this.groups[id];
  }

  updateGroup(groupId, updates) {
    if (!this.groups[groupId]) {
      throw new Error('Group not found');
    }

    if (this.groups[groupId].isDefault && updates.name) {
      throw new Error('Cannot rename default groups');
    }

    this.groups[groupId] = {
      ...this.groups[groupId],
      ...updates,
      id: groupId, // Prevent ID change
      updatedAt: new Date().toISOString()
    };

    this.saveData();
    return this.groups[groupId];
  }

  deleteGroup(groupId) {
    if (!this.groups[groupId]) {
      throw new Error('Group not found');
    }

    if (this.groups[groupId].isDefault) {
      throw new Error('Cannot delete default groups');
    }

    // Remove users from this group
    for (const userId in this.userGroups) {
      this.userGroups[userId] = this.userGroups[userId].filter(g => g !== groupId);
    }

    delete this.groups[groupId];
    delete this.permissions[groupId];

    this.saveData();
    return { deleted: true };
  }

  getGroup(groupId) {
    return this.groups[groupId] || null;
  }

  getAllGroups() {
    return Object.values(this.groups);
  }

  // User-Group membership
  addUserToGroup(userId, groupId) {
    if (!this.groups[groupId]) {
      throw new Error('Group not found');
    }

    if (!this.userGroups[userId]) {
      this.userGroups[userId] = ['everyone']; // Always in everyone group
    }

    if (!this.userGroups[userId].includes(groupId)) {
      this.userGroups[userId].push(groupId);
    }

    this.saveData();
    return { userId, groups: this.userGroups[userId] };
  }

  removeUserFromGroup(userId, groupId) {
    if (groupId === 'everyone') {
      throw new Error('Cannot remove user from Everyone group');
    }

    if (!this.userGroups[userId]) {
      return { userId, groups: ['everyone'] };
    }

    this.userGroups[userId] = this.userGroups[userId].filter(g => g !== groupId);

    this.saveData();
    return { userId, groups: this.userGroups[userId] };
  }

  getUserGroups(userId) {
    return this.userGroups[userId] || ['everyone'];
  }

  getGroupMembers(groupId) {
    if (!this.groups[groupId]) {
      throw new Error('Group not found');
    }

    const members = [];
    for (const userId in this.userGroups) {
      if (this.userGroups[userId].includes(groupId)) {
        members.push(userId);
      }
    }

    // For "everyone" group, return indication that all users are members
    if (groupId === 'everyone') {
      return { allUsers: true, note: 'All users are members of this group' };
    }

    return members;
  }

  setUserGroups(userId, groupIds) {
    // Ensure 'everyone' is always included
    if (!groupIds.includes('everyone')) {
      groupIds.unshift('everyone');
    }

    // Validate all groups exist
    for (const groupId of groupIds) {
      if (!this.groups[groupId]) {
        throw new Error(`Group '${groupId}' not found`);
      }
    }

    this.userGroups[userId] = groupIds;
    this.saveData();
    return { userId, groups: groupIds };
  }

  // Permission management
  setGroupPermissions(groupId, permissions) {
    if (!this.groups[groupId]) {
      throw new Error('Group not found');
    }

    this.permissions[groupId] = {
      ...this.permissions[groupId],
      ...permissions
    };

    this.saveData();
    return this.permissions[groupId];
  }

  getGroupPermissions(groupId) {
    return this.permissions[groupId] || {};
  }

  // Check if user has permission for a feature
  userHasPermission(userId, feature, isAdmin = false) {
    // Admins always have access
    if (isAdmin) {
      return true;
    }

    const userGroupIds = this.getUserGroups(userId);

    // Check if any of user's groups has the permission
    for (const groupId of userGroupIds) {
      const groupPerms = this.permissions[groupId];
      if (groupPerms && groupPerms[feature]) {
        return true;
      }
    }

    return false;
  }

  // Get all permissions for a user (union of all group permissions)
  getUserPermissions(userId, isAdmin = false) {
    if (isAdmin) {
      // Return all permissions as true for admins
      return {
        'voice-channels': true,
        'text-channels': true,
        'screen-share': true,
        'youtube-bot': true,
        'plex-bot': true,
        'emby-bot': true,
        'jellyfin-bot': true,
        'chrome-bot': true,
        'iptv-bot': true,
        'spotify-bot': true,
        'emulator-bot': true,
        'file-share': true,
        'admin-panel': true
      };
    }

    const userGroupIds = this.getUserGroups(userId);
    const mergedPermissions = {};

    for (const groupId of userGroupIds) {
      const groupPerms = this.permissions[groupId] || {};
      for (const [feature, allowed] of Object.entries(groupPerms)) {
        if (allowed) {
          mergedPermissions[feature] = true;
        } else if (!(feature in mergedPermissions)) {
          mergedPermissions[feature] = false;
        }
      }
    }

    return mergedPermissions;
  }

  // Get available features list
  getAvailableFeatures() {
    return [
      { id: 'voice-channels', name: 'Voice Channels', description: 'Join and use voice channels' },
      { id: 'text-channels', name: 'Text Channels', description: 'Send messages in text channels' },
      { id: 'screen-share', name: 'Screen Share', description: 'Share screen in voice channels' },
      { id: 'youtube-bot', name: 'YouTube Bot', description: 'Use YouTube bot to play videos' },
      { id: 'plex-bot', name: 'Plex Bot', description: 'Stream media from Plex' },
      { id: 'emby-bot', name: 'Emby Bot', description: 'Stream media from Emby' },
      { id: 'jellyfin-bot', name: 'Jellyfin Bot', description: 'Stream media from Jellyfin' },
      { id: 'chrome-bot', name: 'Chrome Bot', description: 'Use shared browser sessions' },
      { id: 'iptv-bot', name: 'IPTV Bot', description: 'Watch IPTV channels' },
      { id: 'spotify-bot', name: 'Spotify Bot', description: 'Listen to Spotify together' },
      { id: 'emulator-bot', name: 'Emulator Bot', description: 'Play multiplayer emulator games (Xbox, Dreamcast, GameCube/Wii, PS3)' },
      { id: 'file-share', name: 'File Sharing', description: 'Share folders with other users' },
      { id: 'admin-panel', name: 'Admin Panel', description: 'Access admin settings' }
    ];
  }
}

module.exports = { GroupService };
