const User = require('../models/User');
const DirectMessage = require('../models/DirectMessage');
const path = require('path');
const fs = require('fs');

// Get user profile
const getProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select('-password -email')
      .populate('friends', 'username displayName avatar status');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: user.toPublicProfile() });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
};

// Upload avatar
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    // Delete old avatar if exists
    const user = await User.findById(req.user._id);
    if (user.avatar && user.avatar.startsWith('/uploads/')) {
      const oldPath = path.join(__dirname, '..', user.avatar);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Update user avatar
    await User.findByIdAndUpdate(req.user._id, { avatar: avatarUrl });

    res.json({ avatarUrl });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
};

// Send friend request
const sendFriendRequest = async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already friends
    if (req.user.friends.includes(userId)) {
      return res.status(400).json({ error: 'Already friends' });
    }

    // Check if request already sent
    const existingRequest = targetUser.friendRequests.find(
      r => r.from.toString() === req.user._id.toString()
    );
    if (existingRequest) {
      return res.status(400).json({ error: 'Friend request already sent' });
    }

    // Check if blocked
    if (targetUser.blockedUsers.includes(req.user._id)) {
      return res.status(403).json({ error: 'Cannot send friend request to this user' });
    }

    // Add friend request
    targetUser.friendRequests.push({ from: req.user._id });
    await targetUser.save();

    res.json({ message: 'Friend request sent' });
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
};

// Accept friend request
const acceptFriendRequest = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(req.user._id);
    const requestIndex = user.friendRequests.findIndex(
      r => r.from.toString() === userId
    );

    if (requestIndex === -1) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    // Remove request
    user.friendRequests.splice(requestIndex, 1);

    // Add to friends (both users)
    user.friends.push(userId);
    await user.save();

    await User.findByIdAndUpdate(userId, {
      $push: { friends: req.user._id }
    });

    res.json({ message: 'Friend request accepted' });
  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
};

// Decline friend request
const declineFriendRequest = async (req, res) => {
  try {
    const { userId } = req.params;

    await User.findByIdAndUpdate(req.user._id, {
      $pull: { friendRequests: { from: userId } }
    });

    res.json({ message: 'Friend request declined' });
  } catch (error) {
    console.error('Decline friend request error:', error);
    res.status(500).json({ error: 'Failed to decline friend request' });
  }
};

// Remove friend
const removeFriend = async (req, res) => {
  try {
    const { userId } = req.params;

    await User.findByIdAndUpdate(req.user._id, {
      $pull: { friends: userId }
    });

    await User.findByIdAndUpdate(userId, {
      $pull: { friends: req.user._id }
    });

    res.json({ message: 'Friend removed' });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ error: 'Failed to remove friend' });
  }
};

// Block user
const blockUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }

    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { blockedUsers: userId },
      $pull: { friends: userId }
    });

    // Remove from their friends too
    await User.findByIdAndUpdate(userId, {
      $pull: { friends: req.user._id }
    });

    res.json({ message: 'User blocked' });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ error: 'Failed to block user' });
  }
};

// Unblock user
const unblockUser = async (req, res) => {
  try {
    const { userId } = req.params;

    await User.findByIdAndUpdate(req.user._id, {
      $pull: { blockedUsers: userId }
    });

    res.json({ message: 'User unblocked' });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
};

// Get common games (Steam integration)
const getCommonGames = async (req, res) => {
  try {
    const { userId } = req.params;

    const [currentUser, targetUser] = await Promise.all([
      User.findById(req.user._id),
      User.findById(userId)
    ]);

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!currentUser.steamId || !targetUser.steamId) {
      return res.json({
        commonGames: [],
        message: 'Both users need to have Steam IDs set up'
      });
    }

    // In a real implementation, you would call the Steam API here
    // For now, return a placeholder response
    res.json({
      currentUserSteamId: currentUser.steamId,
      targetUserSteamId: targetUser.steamId,
      message: 'Steam API integration required for game data',
      commonGames: []
    });
  } catch (error) {
    console.error('Get common games error:', error);
    res.status(500).json({ error: 'Failed to get common games' });
  }
};

// Get direct messages
const getDirectMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const { before, limit = 50 } = req.query;

    const query = {
      participants: { $all: [req.user._id, userId] },
      deleted: { $ne: true }
    };

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await DirectMessage.find(query)
      .populate('sender', 'username displayName avatar')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // Mark as read
    await DirectMessage.updateMany(
      {
        participants: { $all: [req.user._id, userId] },
        sender: userId,
        read: false
      },
      { read: true, readAt: new Date() }
    );

    res.json({ messages: messages.reverse() });
  } catch (error) {
    console.error('Get DMs error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
};

// Get DM conversations list
const getConversations = async (req, res) => {
  try {
    // Get unique conversations
    const messages = await DirectMessage.aggregate([
      {
        $match: {
          participants: req.user._id,
          deleted: { $ne: true }
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: [{ $arrayElemAt: ['$participants', 0] }, req.user._id] },
              { $arrayElemAt: ['$participants', 1] },
              { $arrayElemAt: ['$participants', 0] }
            ]
          },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ['$sender', req.user._id] }, { $eq: ['$read', false] }] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    // Populate user info
    const conversations = await User.populate(messages, {
      path: '_id',
      select: 'username displayName avatar status'
    });

    res.json({
      conversations: conversations.map(c => ({
        user: c._id,
        lastMessage: c.lastMessage,
        unreadCount: c.unreadCount
      }))
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
};

module.exports = {
  getProfile,
  uploadAvatar,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  blockUser,
  unblockUser,
  getCommonGames,
  getDirectMessages,
  getConversations
};
