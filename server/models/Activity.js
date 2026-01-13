const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['game', 'application', 'streaming', 'listening', 'watching', 'custom'],
    default: 'game'
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  details: {
    type: String,
    trim: true,
    default: ''
  },
  // For games - store Steam app ID if available
  appId: {
    type: String,
    default: null
  },
  // Activity start time
  startedAt: {
    type: Date,
    default: Date.now
  },
  // Activity end time (null if still active)
  endedAt: {
    type: Date,
    default: null
  },
  // Duration in seconds (calculated when activity ends)
  duration: {
    type: Number,
    default: 0
  },
  // Platform detected from
  platform: {
    type: String,
    enum: ['windows', 'linux', 'mac', 'web', 'unknown'],
    default: 'unknown'
  }
}, {
  timestamps: true
});

// Index for querying user activities efficiently
activitySchema.index({ user: 1, startedAt: -1 });
activitySchema.index({ user: 1, name: 1 });

// Static method to get user's activity stats
activitySchema.statics.getUserStats = async function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const stats = await this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        startedAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$name',
        totalDuration: { $sum: '$duration' },
        sessions: { $sum: 1 },
        lastPlayed: { $max: '$startedAt' }
      }
    },
    {
      $sort: { totalDuration: -1 }
    }
  ]);

  return stats;
};

// Static method to get top activities across all users
activitySchema.statics.getTopActivities = async function(days = 30, limit = 10) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const stats = await this.aggregate([
    {
      $match: {
        startedAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$name',
        totalDuration: { $sum: '$duration' },
        uniqueUsers: { $addToSet: '$user' },
        sessions: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 1,
        totalDuration: 1,
        sessions: 1,
        userCount: { $size: '$uniqueUsers' }
      }
    },
    {
      $sort: { userCount: -1, totalDuration: -1 }
    },
    {
      $limit: limit
    }
  ]);

  return stats;
};

// Static method to find common activities between users
activitySchema.statics.getCommonActivities = async function(userId1, userId2, days = 90) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const user1Activities = await this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId1),
        startedAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$name',
        totalDuration: { $sum: '$duration' }
      }
    }
  ]);

  const user2Activities = await this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId2),
        startedAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$name',
        totalDuration: { $sum: '$duration' }
      }
    }
  ]);

  const user1Map = new Map(user1Activities.map(a => [a._id, a.totalDuration]));
  const user2Map = new Map(user2Activities.map(a => [a._id, a.totalDuration]));

  const common = [];
  for (const [name, duration1] of user1Map) {
    if (user2Map.has(name)) {
      common.push({
        name,
        user1Duration: duration1,
        user2Duration: user2Map.get(name),
        combinedDuration: duration1 + user2Map.get(name)
      });
    }
  }

  return common.sort((a, b) => b.combinedDuration - a.combinedDuration);
};

module.exports = mongoose.model('Activity', activitySchema);
