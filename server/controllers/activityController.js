const Activity = require('../models/Activity');
const User = require('../models/User');

// Get activity service from app context (will be set in server.js)
let activityService = null;

function setActivityService(service) {
  activityService = service;
}

// Start activity
async function startActivity(req, res) {
  try {
    const { type, name, details, appId, platform } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Activity name is required' });
    }

    if (!activityService) {
      return res.status(500).json({ error: 'Activity service not initialized' });
    }

    const activity = await activityService.startActivity(req.user._id, {
      type: type || 'game',
      name,
      details,
      appId,
      platform: platform || 'unknown'
    });

    res.json({ success: true, activity });
  } catch (error) {
    console.error('Error starting activity:', error);
    res.status(500).json({ error: 'Failed to start activity' });
  }
}

// End activity
async function endActivity(req, res) {
  try {
    if (!activityService) {
      return res.status(500).json({ error: 'Activity service not initialized' });
    }

    const activity = await activityService.endActivity(req.user._id);
    res.json({ success: true, activity });
  } catch (error) {
    console.error('Error ending activity:', error);
    res.status(500).json({ error: 'Failed to end activity' });
  }
}

// Get my activity stats
async function getMyStats(req, res) {
  try {
    const days = parseInt(req.query.days) || 30;

    if (!activityService) {
      return res.status(500).json({ error: 'Activity service not initialized' });
    }

    const stats = await activityService.getUserStats(req.user._id, days);
    res.json({ stats });
  } catch (error) {
    console.error('Error getting user stats:', error);
    res.status(500).json({ error: 'Failed to get activity stats' });
  }
}

// Get another user's activity stats
async function getUserStats(req, res) {
  try {
    const { userId } = req.params;
    const days = parseInt(req.query.days) || 30;

    if (!activityService) {
      return res.status(500).json({ error: 'Activity service not initialized' });
    }

    const stats = await activityService.getUserStats(userId, days);
    res.json({ stats });
  } catch (error) {
    console.error('Error getting user stats:', error);
    res.status(500).json({ error: 'Failed to get activity stats' });
  }
}

// Get common activities with another user
async function getCommonActivities(req, res) {
  try {
    const { userId } = req.params;

    if (!activityService) {
      return res.status(500).json({ error: 'Activity service not initialized' });
    }

    const common = await activityService.getCommonActivities(req.user._id, userId);
    res.json({ common });
  } catch (error) {
    console.error('Error getting common activities:', error);
    res.status(500).json({ error: 'Failed to get common activities' });
  }
}

// Get server-wide activity stats (admin)
async function getServerStats(req, res) {
  try {
    const days = parseInt(req.query.days) || 30;

    if (!activityService) {
      return res.status(500).json({ error: 'Activity service not initialized' });
    }

    const stats = await activityService.getServerStats(days);
    res.json(stats);
  } catch (error) {
    console.error('Error getting server stats:', error);
    res.status(500).json({ error: 'Failed to get server stats' });
  }
}

// Get my activity history
async function getMyHistory(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const skip = parseInt(req.query.skip) || 0;

    const activities = await Activity.find({ user: req.user._id })
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Activity.countDocuments({ user: req.user._id });

    res.json({ activities, total });
  } catch (error) {
    console.error('Error getting activity history:', error);
    res.status(500).json({ error: 'Failed to get activity history' });
  }
}

// Get current activity
async function getCurrentActivity(req, res) {
  try {
    const user = await User.findById(req.user._id).select('currentActivity').lean();
    res.json({ activity: user?.currentActivity || null });
  } catch (error) {
    console.error('Error getting current activity:', error);
    res.status(500).json({ error: 'Failed to get current activity' });
  }
}

module.exports = {
  setActivityService,
  startActivity,
  endActivity,
  getMyStats,
  getUserStats,
  getCommonActivities,
  getServerStats,
  getMyHistory,
  getCurrentActivity
};
