const Activity = require('../models/Activity');
const User = require('../models/User');

class ActivityStatsBotService {
  constructor(io, activityService) {
    this.io = io;
    this.activityService = activityService;
    this.enabled = false;
    this.activeChannels = new Map(); // channelId -> { lastUpdate, interval }

    // Auto-update interval (5 minutes)
    this.updateInterval = 5 * 60 * 1000;
  }

  isEnabled() {
    return this.enabled;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.stopAll();
    }
    return this.enabled;
  }

  // Start stats in a channel
  startStats(channelId) {
    if (!this.enabled) {
      throw new Error('Activity stats bot is not enabled');
    }

    if (this.activeChannels.has(channelId)) {
      // Already active, just send update
      this.sendStatsToChannel(channelId);
      return;
    }

    // Set up periodic updates
    const interval = setInterval(() => {
      this.sendStatsToChannel(channelId);
    }, this.updateInterval);

    this.activeChannels.set(channelId, {
      lastUpdate: new Date(),
      interval
    });

    // Send initial stats
    this.sendStatsToChannel(channelId);
  }

  // Stop stats in a channel
  stopStats(channelId) {
    const channel = this.activeChannels.get(channelId);
    if (channel) {
      clearInterval(channel.interval);
      this.activeChannels.delete(channelId);
    }
  }

  // Stop all
  stopAll() {
    for (const [channelId, channel] of this.activeChannels) {
      clearInterval(channel.interval);
    }
    this.activeChannels.clear();
  }

  // Send stats to a channel
  async sendStatsToChannel(channelId) {
    try {
      const stats = await this.getFormattedStats();

      this.io.to(`channel:${channelId}`).emit('bot:activity-stats', {
        channelId,
        stats,
        timestamp: new Date().toISOString()
      });

      const channel = this.activeChannels.get(channelId);
      if (channel) {
        channel.lastUpdate = new Date();
      }
    } catch (error) {
      console.error('Error sending activity stats:', error);
    }
  }

  // Get formatted stats for display
  async getFormattedStats() {
    const serverStats = await this.activityService.getServerStats(30);
    const onlineUsers = await this.getOnlineUsersWithActivity();

    return {
      summary: {
        totalPlaytime: this.formatDuration(serverStats.totalDuration),
        totalSessions: serverStats.totalSessions,
        activeUsers: serverStats.activeUsers,
        uniqueGames: serverStats.uniqueGames
      },
      topGames: serverStats.topActivities.slice(0, 5).map((game, index) => ({
        rank: index + 1,
        name: game._id,
        players: game.userCount,
        totalTime: this.formatDuration(game.totalDuration)
      })),
      currentlyPlaying: onlineUsers.map(user => ({
        username: user.displayName || user.username,
        activity: user.currentActivity?.name || 'Unknown',
        duration: user.currentActivity?.startedAt
          ? this.formatDuration(Math.floor((Date.now() - new Date(user.currentActivity.startedAt)) / 1000))
          : 'Just started'
      }))
    };
  }

  // Get online users with current activity
  async getOnlineUsersWithActivity() {
    return User.find({
      status: { $in: ['online', 'idle'] },
      'currentActivity.name': { $ne: null }
    }).select('username displayName currentActivity').lean();
  }

  // Get user leaderboard
  async getLeaderboard(days = 30, limit = 10) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const leaderboard = await Activity.aggregate([
      {
        $match: {
          startedAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$user',
          totalDuration: { $sum: '$duration' },
          sessions: { $sum: 1 },
          games: { $addToSet: '$name' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          _id: 0,
          username: '$user.username',
          displayName: '$user.displayName',
          totalDuration: 1,
          sessions: 1,
          gamesPlayed: { $size: '$games' }
        }
      },
      {
        $sort: { totalDuration: -1 }
      },
      {
        $limit: limit
      }
    ]);

    return leaderboard.map((entry, index) => ({
      rank: index + 1,
      name: entry.displayName || entry.username,
      totalTime: this.formatDuration(entry.totalDuration),
      sessions: entry.sessions,
      gamesPlayed: entry.gamesPlayed
    }));
  }

  // Get game-specific stats
  async getGameStats(gameName, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await Activity.aggregate([
      {
        $match: {
          name: { $regex: new RegExp(gameName, 'i') },
          startedAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$user',
          totalDuration: { $sum: '$duration' },
          sessions: { $sum: 1 },
          lastPlayed: { $max: '$startedAt' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          _id: 0,
          username: '$user.username',
          displayName: '$user.displayName',
          totalDuration: 1,
          sessions: 1,
          lastPlayed: 1
        }
      },
      {
        $sort: { totalDuration: -1 }
      }
    ]);

    const totalDuration = stats.reduce((sum, s) => sum + s.totalDuration, 0);
    const totalSessions = stats.reduce((sum, s) => sum + s.sessions, 0);

    return {
      gameName,
      totalPlayers: stats.length,
      totalPlaytime: this.formatDuration(totalDuration),
      totalSessions,
      players: stats.slice(0, 10).map((s, i) => ({
        rank: i + 1,
        name: s.displayName || s.username,
        time: this.formatDuration(s.totalDuration),
        sessions: s.sessions
      }))
    };
  }

  formatDuration(seconds) {
    if (!seconds || seconds < 60) return '< 1m';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  // Get status
  getStatus() {
    return {
      enabled: this.enabled,
      activeChannels: Array.from(this.activeChannels.keys())
    };
  }
}

module.exports = ActivityStatsBotService;
