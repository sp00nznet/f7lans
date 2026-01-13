/**
 * File Share Service
 * Allows users to share folders with other users
 */

const fs = require('fs');
const path = require('path');

class FileShareService {
  constructor(io) {
    this.io = io;
    this.enabled = false;
    this.sharedFolders = {}; // userId -> [{ folderId, folderPath, folderName, sharedAt }]
    this.userSockets = {}; // userId -> socketId (for file requests)
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      // Notify all users that file sharing is disabled
      this.io.emit('fileshare:disabled');
    } else {
      this.io.emit('fileshare:enabled');
    }
    return { enabled: this.enabled };
  }

  isEnabled() {
    return this.enabled;
  }

  registerUserSocket(userId, socketId) {
    this.userSockets[userId] = socketId;
  }

  unregisterUserSocket(userId) {
    delete this.userSockets[userId];
  }

  shareFolder(userId, username, folderPath, folderName) {
    if (!this.enabled) {
      throw new Error('File sharing is disabled');
    }

    if (!this.sharedFolders[userId]) {
      this.sharedFolders[userId] = [];
    }

    // Check if already shared
    const existing = this.sharedFolders[userId].find(f => f.folderPath === folderPath);
    if (existing) {
      return { message: 'Folder already shared', folder: existing };
    }

    const folderId = `${userId}-${Date.now()}`;
    const sharedFolder = {
      folderId,
      folderPath,
      folderName,
      sharedAt: new Date().toISOString(),
      userId,
      username
    };

    this.sharedFolders[userId].push(sharedFolder);

    // Notify other users
    this.io.emit('fileshare:folder-added', {
      userId,
      username,
      folder: {
        folderId,
        folderName,
        sharedAt: sharedFolder.sharedAt
      }
    });

    return { message: 'Folder shared', folder: sharedFolder };
  }

  unshareFolder(userId, folderId) {
    if (!this.sharedFolders[userId]) {
      throw new Error('No shared folders found');
    }

    const index = this.sharedFolders[userId].findIndex(f => f.folderId === folderId);
    if (index === -1) {
      throw new Error('Folder not found');
    }

    const folder = this.sharedFolders[userId].splice(index, 1)[0];

    // Notify other users
    this.io.emit('fileshare:folder-removed', {
      userId,
      folderId
    });

    return { message: 'Folder unshared', folder };
  }

  getMySharedFolders(userId) {
    return this.sharedFolders[userId] || [];
  }

  getAllSharedFolders() {
    const allFolders = [];
    for (const userId in this.sharedFolders) {
      for (const folder of this.sharedFolders[userId]) {
        allFolders.push({
          folderId: folder.folderId,
          folderName: folder.folderName,
          sharedAt: folder.sharedAt,
          userId: folder.userId,
          username: folder.username
        });
      }
    }
    return allFolders;
  }

  getUserSharedFolders(userId) {
    const folders = this.sharedFolders[userId] || [];
    return folders.map(f => ({
      folderId: f.folderId,
      folderName: f.folderName,
      sharedAt: f.sharedAt,
      userId: f.userId,
      username: f.username
    }));
  }

  // Request file listing from a user's shared folder
  async requestFolderContents(requesterId, targetUserId, folderId, subPath = '') {
    if (!this.enabled) {
      throw new Error('File sharing is disabled');
    }

    const folders = this.sharedFolders[targetUserId];
    if (!folders) {
      throw new Error('User has no shared folders');
    }

    const folder = folders.find(f => f.folderId === folderId);
    if (!folder) {
      throw new Error('Folder not found');
    }

    const targetSocketId = this.userSockets[targetUserId];
    if (!targetSocketId) {
      throw new Error('User is offline');
    }

    // Send request to target user's client
    return new Promise((resolve, reject) => {
      const requestId = `${requesterId}-${Date.now()}`;
      const timeout = setTimeout(() => {
        reject(new Error('Request timed out'));
      }, 30000);

      // Listen for response
      const responseHandler = (response) => {
        if (response.requestId === requestId) {
          clearTimeout(timeout);
          this.io.sockets.sockets.get(targetSocketId)?.off('fileshare:contents-response', responseHandler);
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.contents);
          }
        }
      };

      const targetSocket = this.io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.on('fileshare:contents-response', responseHandler);
        targetSocket.emit('fileshare:contents-request', {
          requestId,
          folderId,
          folderPath: folder.folderPath,
          subPath,
          requesterId
        });
      } else {
        clearTimeout(timeout);
        reject(new Error('User socket not found'));
      }
    });
  }

  // Request file download from a user
  async requestFileDownload(requesterId, targetUserId, folderId, filePath) {
    if (!this.enabled) {
      throw new Error('File sharing is disabled');
    }

    const folders = this.sharedFolders[targetUserId];
    if (!folders) {
      throw new Error('User has no shared folders');
    }

    const folder = folders.find(f => f.folderId === folderId);
    if (!folder) {
      throw new Error('Folder not found');
    }

    const targetSocketId = this.userSockets[targetUserId];
    if (!targetSocketId) {
      throw new Error('User is offline');
    }

    // Return info for P2P transfer setup
    return {
      targetSocketId,
      folderId,
      folderPath: folder.folderPath,
      filePath,
      targetUserId
    };
  }

  getStatus() {
    const totalFolders = Object.values(this.sharedFolders).reduce((sum, folders) => sum + folders.length, 0);
    const onlineUsers = Object.keys(this.userSockets).length;

    return {
      enabled: this.enabled,
      totalSharedFolders: totalFolders,
      usersSharing: Object.keys(this.sharedFolders).length,
      onlineUsers
    };
  }
}

module.exports = { FileShareService };
