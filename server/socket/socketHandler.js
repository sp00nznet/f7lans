const { socketAuth } = require('../middleware/auth');
const User = require('../models/User');
const Channel = require('../models/Channel');
const Message = require('../models/Message');
const DirectMessage = require('../models/DirectMessage');

// Connected users map
const connectedUsers = new Map();
const userSockets = new Map();

const initializeSocket = (io) => {
  // Authentication middleware
  io.use(socketAuth);

  io.on('connection', async (socket) => {
    const user = socket.user;
    console.log(`User connected: ${user.username} (${socket.id})`);

    // Store socket reference
    connectedUsers.set(user._id.toString(), socket.id);
    userSockets.set(socket.id, user._id.toString());

    // Update user status
    await User.findByIdAndUpdate(user._id, { status: 'online' });

    // Broadcast online status
    socket.broadcast.emit('user:status', {
      userId: user._id,
      status: 'online'
    });

    // Join user's personal room
    socket.join(`user:${user._id}`);

    // ===== Channel Messages =====
    socket.on('channel:join', async (channelId) => {
      socket.join(`channel:${channelId}`);
      console.log(`${user.username} joined channel ${channelId}`);
    });

    socket.on('channel:leave', async (channelId) => {
      socket.leave(`channel:${channelId}`);
    });

    socket.on('message:send', async (data) => {
      try {
        const { channelId, content, replyTo, attachments } = data;

        if (!content && (!attachments || attachments.length === 0)) {
          return socket.emit('error', { message: 'Message content required' });
        }

        // Check for YouTube bot command
        let messageType = 'text';
        let youtubeData = null;

        if (content.startsWith('!play ') || content.startsWith('!youtube ')) {
          const query = content.replace(/^!(play|youtube)\s+/, '');
          messageType = 'youtube';
          youtubeData = {
            videoId: 'placeholder', // Would extract from YouTube API
            title: query,
            thumbnail: '',
            duration: ''
          };
        }

        const message = new Message({
          channel: channelId,
          author: user._id,
          content,
          type: messageType,
          replyTo,
          attachments: attachments || [],
          youtubeData
        });

        await message.save();
        await message.populate('author', 'username displayName avatar role');

        if (replyTo) {
          await message.populate('replyTo', 'content author');
        }

        io.to(`channel:${channelId}`).emit('message:new', message);
      } catch (error) {
        console.error('Message send error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('message:edit', async (data) => {
      try {
        const { messageId, content } = data;

        const message = await Message.findById(messageId);
        if (!message) {
          return socket.emit('error', { message: 'Message not found' });
        }

        if (message.author.toString() !== user._id.toString()) {
          return socket.emit('error', { message: 'Not authorized' });
        }

        message.content = content;
        message.edited = true;
        message.editedAt = new Date();
        await message.save();

        io.to(`channel:${message.channel}`).emit('message:updated', message);
      } catch (error) {
        console.error('Message edit error:', error);
        socket.emit('error', { message: 'Failed to edit message' });
      }
    });

    socket.on('message:delete', async (data) => {
      try {
        const { messageId } = data;

        const message = await Message.findById(messageId);
        if (!message) {
          return socket.emit('error', { message: 'Message not found' });
        }

        const isOwner = message.author.toString() === user._id.toString();
        const isAdmin = user.role === 'admin' || user.role === 'superadmin';

        if (!isOwner && !isAdmin) {
          return socket.emit('error', { message: 'Not authorized' });
        }

        message.deleted = true;
        await message.save();

        io.to(`channel:${message.channel}`).emit('message:deleted', { messageId });
      } catch (error) {
        console.error('Message delete error:', error);
        socket.emit('error', { message: 'Failed to delete message' });
      }
    });

    socket.on('message:reaction', async (data) => {
      try {
        const { messageId, emoji, action } = data;

        const message = await Message.findById(messageId);
        if (!message) return;

        const reactionIndex = message.reactions.findIndex(r => r.emoji === emoji);

        if (action === 'add') {
          if (reactionIndex === -1) {
            message.reactions.push({ emoji, users: [user._id] });
          } else if (!message.reactions[reactionIndex].users.includes(user._id)) {
            message.reactions[reactionIndex].users.push(user._id);
          }
        } else if (action === 'remove' && reactionIndex !== -1) {
          const userIndex = message.reactions[reactionIndex].users.indexOf(user._id);
          if (userIndex !== -1) {
            message.reactions[reactionIndex].users.splice(userIndex, 1);
            if (message.reactions[reactionIndex].users.length === 0) {
              message.reactions.splice(reactionIndex, 1);
            }
          }
        }

        await message.save();
        io.to(`channel:${message.channel}`).emit('message:reacted', {
          messageId,
          reactions: message.reactions
        });
      } catch (error) {
        console.error('Reaction error:', error);
      }
    });

    // ===== Direct Messages =====
    socket.on('dm:send', async (data) => {
      try {
        const { recipientId, content, attachments } = data;

        if (!content && (!attachments || attachments.length === 0)) {
          return socket.emit('error', { message: 'Message content required' });
        }

        // Check if blocked
        const recipient = await User.findById(recipientId);
        if (!recipient) {
          return socket.emit('error', { message: 'User not found' });
        }

        if (recipient.blockedUsers.includes(user._id)) {
          return socket.emit('error', { message: 'Cannot message this user' });
        }

        const dm = new DirectMessage({
          participants: [user._id, recipientId],
          sender: user._id,
          content,
          attachments: attachments || []
        });

        await dm.save();
        await dm.populate('sender', 'username displayName avatar');

        // Send to both users
        socket.emit('dm:new', dm);
        io.to(`user:${recipientId}`).emit('dm:new', dm);
      } catch (error) {
        console.error('DM send error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('dm:read', async (data) => {
      try {
        const { senderId } = data;

        await DirectMessage.updateMany(
          {
            participants: { $all: [user._id, senderId] },
            sender: senderId,
            read: false
          },
          { read: true, readAt: new Date() }
        );

        io.to(`user:${senderId}`).emit('dm:read', { readBy: user._id });
      } catch (error) {
        console.error('DM read error:', error);
      }
    });

    // ===== Voice/Video Channels =====
    socket.on('voice:join', async (channelId) => {
      try {
        const channel = await Channel.findById(channelId);
        if (!channel || !['voice', 'video'].includes(channel.type)) {
          return socket.emit('error', { message: 'Invalid voice channel' });
        }

        // Leave current voice channel if in one
        const currentVoice = await Channel.findOne({
          'currentUsers.user': user._id,
          type: { $in: ['voice', 'video'] }
        });

        if (currentVoice) {
          await Channel.findByIdAndUpdate(currentVoice._id, {
            $pull: { currentUsers: { user: user._id } }
          });
          socket.leave(`voice:${currentVoice._id}`);
          io.to(`voice:${currentVoice._id}`).emit('voice:userLeft', {
            userId: user._id,
            channelId: currentVoice._id
          });
        }

        // Join new channel
        await Channel.findByIdAndUpdate(channelId, {
          $push: {
            currentUsers: {
              user: user._id,
              joinedAt: new Date(),
              isMuted: false,
              isDeafened: false
            }
          }
        });

        socket.join(`voice:${channelId}`);
        socket.voiceChannel = channelId;

        // Notify others
        io.to(`voice:${channelId}`).emit('voice:userJoined', {
          userId: user._id,
          user: user.toPublicProfile(),
          channelId
        });

        // Send current users to the joining user
        const updatedChannel = await Channel.findById(channelId)
          .populate('currentUsers.user', 'username displayName avatar status');

        socket.emit('voice:currentUsers', {
          channelId,
          users: updatedChannel.currentUsers
        });
      } catch (error) {
        console.error('Voice join error:', error);
        socket.emit('error', { message: 'Failed to join voice channel' });
      }
    });

    socket.on('voice:leave', async () => {
      try {
        if (socket.voiceChannel) {
          await Channel.findByIdAndUpdate(socket.voiceChannel, {
            $pull: { currentUsers: { user: user._id } }
          });

          io.to(`voice:${socket.voiceChannel}`).emit('voice:userLeft', {
            userId: user._id,
            channelId: socket.voiceChannel
          });

          socket.leave(`voice:${socket.voiceChannel}`);
          socket.voiceChannel = null;
        }
      } catch (error) {
        console.error('Voice leave error:', error);
      }
    });

    socket.on('voice:mute', async (isMuted) => {
      if (socket.voiceChannel) {
        await Channel.updateOne(
          { _id: socket.voiceChannel, 'currentUsers.user': user._id },
          { $set: { 'currentUsers.$.isMuted': isMuted } }
        );

        io.to(`voice:${socket.voiceChannel}`).emit('voice:userMuted', {
          userId: user._id,
          isMuted
        });
      }
    });

    socket.on('voice:deafen', async (isDeafened) => {
      if (socket.voiceChannel) {
        await Channel.updateOne(
          { _id: socket.voiceChannel, 'currentUsers.user': user._id },
          { $set: { 'currentUsers.$.isDeafened': isDeafened } }
        );

        io.to(`voice:${socket.voiceChannel}`).emit('voice:userDeafened', {
          userId: user._id,
          isDeafened
        });
      }
    });

    // ===== WebRTC Signaling =====
    socket.on('webrtc:offer', (data) => {
      const { targetUserId, offer } = data;
      const targetSocketId = connectedUsers.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('webrtc:offer', {
          fromUserId: user._id,
          offer
        });
      }
    });

    socket.on('webrtc:answer', (data) => {
      const { targetUserId, answer } = data;
      const targetSocketId = connectedUsers.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('webrtc:answer', {
          fromUserId: user._id,
          answer
        });
      }
    });

    socket.on('webrtc:ice-candidate', (data) => {
      const { targetUserId, candidate } = data;
      const targetSocketId = connectedUsers.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('webrtc:ice-candidate', {
          fromUserId: user._id,
          candidate
        });
      }
    });

    // Screen share signals
    socket.on('screen:start', () => {
      if (socket.voiceChannel) {
        Channel.updateOne(
          { _id: socket.voiceChannel, 'currentUsers.user': user._id },
          { $set: { 'currentUsers.$.isStreaming': true } }
        );

        io.to(`voice:${socket.voiceChannel}`).emit('screen:started', {
          userId: user._id
        });
      }
    });

    socket.on('screen:stop', () => {
      if (socket.voiceChannel) {
        Channel.updateOne(
          { _id: socket.voiceChannel, 'currentUsers.user': user._id },
          { $set: { 'currentUsers.$.isStreaming': false } }
        );

        io.to(`voice:${socket.voiceChannel}`).emit('screen:stopped', {
          userId: user._id
        });
      }
    });

    // Camera toggle
    socket.on('camera:toggle', (isOn) => {
      if (socket.voiceChannel) {
        Channel.updateOne(
          { _id: socket.voiceChannel, 'currentUsers.user': user._id },
          { $set: { 'currentUsers.$.isCameraOn': isOn } }
        );

        io.to(`voice:${socket.voiceChannel}`).emit('camera:toggled', {
          userId: user._id,
          isOn
        });
      }
    });

    // ===== Typing Indicators =====
    socket.on('typing:start', (channelId) => {
      socket.to(`channel:${channelId}`).emit('typing:started', {
        userId: user._id,
        username: user.displayName || user.username
      });
    });

    socket.on('typing:stop', (channelId) => {
      socket.to(`channel:${channelId}`).emit('typing:stopped', {
        userId: user._id
      });
    });

    // ===== User Status =====
    socket.on('status:update', async (status) => {
      if (['online', 'idle', 'dnd', 'offline'].includes(status)) {
        await User.findByIdAndUpdate(user._id, { status });
        io.emit('user:status', { userId: user._id, status });
      }
    });

    socket.on('status:custom', async (customStatus) => {
      await User.findByIdAndUpdate(user._id, { customStatus: customStatus.substring(0, 128) });
      io.emit('user:customStatus', { userId: user._id, customStatus });
    });

    // ===== Disconnect =====
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${user.username}`);

      // Clean up voice channel
      if (socket.voiceChannel) {
        await Channel.findByIdAndUpdate(socket.voiceChannel, {
          $pull: { currentUsers: { user: user._id } }
        });

        io.to(`voice:${socket.voiceChannel}`).emit('voice:userLeft', {
          userId: user._id,
          channelId: socket.voiceChannel
        });
      }

      // Update status
      await User.findByIdAndUpdate(user._id, {
        status: 'offline',
        lastSeen: new Date()
      });

      // Remove from connected users
      connectedUsers.delete(user._id.toString());
      userSockets.delete(socket.id);

      // Broadcast offline status
      socket.broadcast.emit('user:status', {
        userId: user._id,
        status: 'offline'
      });
    });
  });

  return io;
};

module.exports = { initializeSocket, connectedUsers, userSockets };
