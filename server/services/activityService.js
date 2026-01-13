const Activity = require('../models/Activity');
const User = require('../models/User');

// Known game name variations for matching
const gameNameVariations = {
  'counter-strike 2': ['cs2', 'counter strike 2', 'counterstrike 2'],
  'counter-strike: global offensive': ['csgo', 'cs:go', 'counter strike go'],
  'grand theft auto v': ['gta v', 'gta 5', 'gtav', 'gta5'],
  'league of legends': ['lol', 'league'],
  'world of warcraft': ['wow', 'warcraft'],
  'call of duty': ['cod'],
  'call of duty: warzone': ['warzone', 'cod warzone'],
  'apex legends': ['apex'],
  'valorant': ['val'],
  'fortnite': ['fn', 'fort'],
  'minecraft': ['mc'],
  'rocket league': ['rl'],
  'dota 2': ['dota'],
  'overwatch 2': ['ow2', 'overwatch'],
  'rust': [],
  'pubg': ['playerunknown\'s battlegrounds', 'pubg: battlegrounds'],
  'destiny 2': ['d2', 'destiny'],
  'escape from tarkov': ['tarkov', 'eft'],
  'rainbow six siege': ['r6', 'siege', 'rainbow 6'],
  'dead by daylight': ['dbd'],
  'the elder scrolls online': ['eso'],
  'final fantasy xiv': ['ffxiv', 'ff14'],
  'path of exile': ['poe'],
  'diablo iv': ['diablo 4', 'd4']
};

// Normalize game name for matching
function normalizeGameName(name) {
  if (!name) return null;
  const lower = name.toLowerCase().trim();

  // Check for exact or variation matches
  for (const [canonical, variations] of Object.entries(gameNameVariations)) {
    if (lower === canonical || variations.includes(lower)) {
      return canonical;
    }
  }

  return lower;
}

class ActivityService {
  constructor(io) {
    this.io = io;
    this.activeActivities = new Map(); // userId -> activityId
  }

  // Start tracking an activity for a user
  async startActivity(userId, activityData) {
    try {
      // End any existing activity first
      await this.endActivity(userId);

      const normalizedName = normalizeGameName(activityData.name) || activityData.name;

      const activity = new Activity({
        user: userId,
        type: activityData.type || 'game',
        name: normalizedName,
        details: activityData.details || '',
        appId: activityData.appId || null,
        platform: activityData.platform || 'unknown',
        startedAt: new Date()
      });

      await activity.save();
      this.activeActivities.set(userId.toString(), activity._id);

      // Update user's current activity
      await User.findByIdAndUpdate(userId, {
        currentActivity: {
          type: activityData.type || 'game',
          name: normalizedName,
          details: activityData.details || '',
          startedAt: activity.startedAt,
          appId: activityData.appId || null
        }
      });

      // Broadcast activity update
      this.broadcastActivityUpdate(userId, {
        type: activityData.type || 'game',
        name: normalizedName,
        details: activityData.details || '',
        startedAt: activity.startedAt
      });

      return activity;
    } catch (error) {
      console.error('Error starting activity:', error);
      throw error;
    }
  }

  // End the current activity for a user
  async endActivity(userId) {
    try {
      const activityId = this.activeActivities.get(userId.toString());
      if (!activityId) return null;

      const activity = await Activity.findById(activityId);
      if (!activity || activity.endedAt) return null;

      const endedAt = new Date();
      const duration = Math.floor((endedAt - activity.startedAt) / 1000);

      activity.endedAt = endedAt;
      activity.duration = duration;
      await activity.save();

      this.activeActivities.delete(userId.toString());

      // Clear user's current activity
      await User.findByIdAndUpdate(userId, {
        currentActivity: {
          type: null,
          name: null,
          details: null,
          startedAt: null,
          appId: null
        }
      });

      // Broadcast activity ended
      this.broadcastActivityUpdate(userId, null);

      return activity;
    } catch (error) {
      console.error('Error ending activity:', error);
      throw error;
    }
  }

  // Get user's activity statistics
  async getUserStats(userId, days = 30) {
    try {
      const stats = await Activity.getUserStats(userId, days);

      // Calculate percentages
      const totalDuration = stats.reduce((sum, s) => sum + s.totalDuration, 0);

      return stats.map(stat => ({
        name: stat._id,
        totalDuration: stat.totalDuration,
        sessions: stat.sessions,
        lastPlayed: stat.lastPlayed,
        percentage: totalDuration > 0 ? Math.round((stat.totalDuration / totalDuration) * 100) : 0
      }));
    } catch (error) {
      console.error('Error getting user stats:', error);
      throw error;
    }
  }

  // Get common activities between two users
  async getCommonActivities(userId1, userId2) {
    try {
      return await Activity.getCommonActivities(userId1, userId2);
    } catch (error) {
      console.error('Error getting common activities:', error);
      throw error;
    }
  }

  // Get top activities across all users
  async getTopActivities(days = 30, limit = 10) {
    try {
      return await Activity.getTopActivities(days, limit);
    } catch (error) {
      console.error('Error getting top activities:', error);
      throw error;
    }
  }

  // Get server-wide activity stats
  async getServerStats(days = 30) {
    try {
      const topActivities = await this.getTopActivities(days, 20);

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get total time tracked
      const totalStats = await Activity.aggregate([
        {
          $match: {
            startedAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: null,
            totalDuration: { $sum: '$duration' },
            totalSessions: { $sum: 1 },
            uniqueUsers: { $addToSet: '$user' },
            uniqueGames: { $addToSet: '$name' }
          }
        }
      ]);

      const stats = totalStats[0] || {
        totalDuration: 0,
        totalSessions: 0,
        uniqueUsers: [],
        uniqueGames: []
      };

      return {
        topActivities,
        totalDuration: stats.totalDuration,
        totalSessions: stats.totalSessions,
        activeUsers: stats.uniqueUsers.length,
        uniqueGames: stats.uniqueGames.length
      };
    } catch (error) {
      console.error('Error getting server stats:', error);
      throw error;
    }
  }

  // Broadcast activity update to all connected clients
  broadcastActivityUpdate(userId, activity) {
    if (this.io) {
      this.io.emit('activity:update', {
        userId: userId.toString(),
        activity
      });
    }
  }

  // Format duration for display
  static formatDuration(seconds) {
    if (!seconds) return '0m';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
}

module.exports = ActivityService;
