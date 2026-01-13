const Channel = require('../models/Channel');
const Message = require('../models/Message');

// Get all channels
const getChannels = async (req, res) => {
  try {
    const channels = await Channel.find()
      .populate('currentUsers.user', 'username displayName avatar status')
      .sort({ category: 1, position: 1, createdAt: 1 });

    // Group by category
    const grouped = channels.reduce((acc, channel) => {
      const cat = channel.category || 'General';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(channel);
      return acc;
    }, {});

    res.json({ channels, grouped });
  } catch (error) {
    console.error('Get channels error:', error);
    res.status(500).json({ error: 'Failed to get channels' });
  }
};

// Get single channel
const getChannel = async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.channelId)
      .populate('currentUsers.user', 'username displayName avatar status')
      .populate('createdBy', 'username displayName');

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    res.json({ channel });
  } catch (error) {
    console.error('Get channel error:', error);
    res.status(500).json({ error: 'Failed to get channel' });
  }
};

// Create channel (admin only)
const createChannel = async (req, res) => {
  try {
    const { name, type, category, description, isPrivate } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Channel name is required' });
    }

    // Get max position in category
    const maxPos = await Channel.findOne({ category: category || 'General' })
      .sort({ position: -1 })
      .select('position');

    const channel = new Channel({
      name: name.toLowerCase().replace(/\s+/g, '-'),
      type: type || 'text',
      category: category || 'General',
      description: description || '',
      isPrivate: isPrivate || false,
      position: maxPos ? maxPos.position + 1 : 0,
      createdBy: req.user._id
    });

    await channel.save();

    res.status(201).json({ channel });
  } catch (error) {
    console.error('Create channel error:', error);
    res.status(500).json({ error: 'Failed to create channel' });
  }
};

// Update channel (admin only)
const updateChannel = async (req, res) => {
  try {
    const { channelId } = req.params;
    const allowedUpdates = ['name', 'description', 'category', 'position', 'isPrivate'];

    const updates = {};
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (updates.name) {
      updates.name = updates.name.toLowerCase().replace(/\s+/g, '-');
    }

    const channel = await Channel.findByIdAndUpdate(
      channelId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    res.json({ channel });
  } catch (error) {
    console.error('Update channel error:', error);
    res.status(500).json({ error: 'Failed to update channel' });
  }
};

// Delete channel (admin only)
const deleteChannel = async (req, res) => {
  try {
    const { channelId } = req.params;

    const channel = await Channel.findByIdAndDelete(channelId);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Delete all messages in channel
    await Message.deleteMany({ channel: channelId });

    res.json({ message: 'Channel deleted' });
  } catch (error) {
    console.error('Delete channel error:', error);
    res.status(500).json({ error: 'Failed to delete channel' });
  }
};

// Get channel messages
const getMessages = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { before, limit = 50 } = req.query;

    const query = {
      channel: channelId,
      deleted: { $ne: true }
    };

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .populate('author', 'username displayName avatar role')
      .populate('replyTo', 'content author')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({ messages: messages.reverse() });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
};

// Get pinned messages
const getPinnedMessages = async (req, res) => {
  try {
    const { channelId } = req.params;

    const messages = await Message.find({
      channel: channelId,
      pinned: true,
      deleted: { $ne: true }
    })
      .populate('author', 'username displayName avatar')
      .sort({ createdAt: -1 });

    res.json({ messages });
  } catch (error) {
    console.error('Get pinned error:', error);
    res.status(500).json({ error: 'Failed to get pinned messages' });
  }
};

module.exports = {
  getChannels,
  getChannel,
  createChannel,
  updateChannel,
  deleteChannel,
  getMessages,
  getPinnedMessages
};
