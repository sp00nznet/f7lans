// Twitch Bot Service
// Enables watching Twitch streams in voice channels

class TwitchBotService {
  constructor(io) {
    this.io = io;
    this.enabled = false;
    this.activeStreams = new Map(); // channelId -> { streamInfo, startedBy, startedAt }
    this.clientId = process.env.TWITCH_CLIENT_ID || null;
    this.clientSecret = process.env.TWITCH_CLIENT_SECRET || null;
    this.accessToken = null;
    this.tokenExpiresAt = null;
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

  // Configure Twitch API credentials
  configure(clientId, clientSecret) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.accessToken = null; // Reset token
    return true;
  }

  isConfigured() {
    return !!(this.clientId && this.clientSecret);
  }

  // Get OAuth token from Twitch
  async getAccessToken() {
    if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error('Twitch API credentials not configured');
    }

    try {
      const response = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'client_credentials'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get Twitch access token');
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 60000; // Refresh 1 min early

      return this.accessToken;
    } catch (error) {
      console.error('Twitch auth error:', error);
      throw error;
    }
  }

  // Search for streams
  async searchStreams(query) {
    const token = await this.getAccessToken();

    const response = await fetch(
      `https://api.twitch.tv/helix/search/channels?query=${encodeURIComponent(query)}&live_only=true&first=10`,
      {
        headers: {
          'Client-ID': this.clientId,
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to search Twitch');
    }

    const data = await response.json();
    return data.data.map(channel => ({
      id: channel.id,
      username: channel.broadcaster_login,
      displayName: channel.display_name,
      isLive: channel.is_live,
      gameId: channel.game_id,
      gameName: channel.game_name,
      title: channel.title,
      thumbnailUrl: channel.thumbnail_url,
      language: channel.broadcaster_language
    }));
  }

  // Get stream info by username
  async getStreamInfo(username) {
    const token = await this.getAccessToken();

    // Get user info
    const userResponse = await fetch(
      `https://api.twitch.tv/helix/users?login=${encodeURIComponent(username)}`,
      {
        headers: {
          'Client-ID': this.clientId,
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!userResponse.ok) {
      throw new Error('Failed to get Twitch user');
    }

    const userData = await userResponse.json();
    if (!userData.data || userData.data.length === 0) {
      throw new Error('Twitch user not found');
    }

    const user = userData.data[0];

    // Get stream info
    const streamResponse = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(username)}`,
      {
        headers: {
          'Client-ID': this.clientId,
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const streamData = await streamResponse.json();
    const stream = streamData.data && streamData.data[0];

    return {
      user: {
        id: user.id,
        username: user.login,
        displayName: user.display_name,
        profileImage: user.profile_image_url,
        description: user.description
      },
      stream: stream ? {
        id: stream.id,
        title: stream.title,
        gameName: stream.game_name,
        viewerCount: stream.viewer_count,
        startedAt: stream.started_at,
        thumbnailUrl: stream.thumbnail_url
          .replace('{width}', '640')
          .replace('{height}', '360'),
        language: stream.language,
        isMature: stream.is_mature
      } : null,
      isLive: !!stream
    };
  }

  // Start watching a stream in a channel
  async play(channelId, username, startedBy) {
    if (!this.enabled) {
      throw new Error('Twitch bot is not enabled');
    }

    if (!this.isConfigured()) {
      throw new Error('Twitch API credentials not configured');
    }

    const streamInfo = await this.getStreamInfo(username);

    if (!streamInfo.isLive) {
      throw new Error(`${streamInfo.user.displayName} is not currently live`);
    }

    const streamData = {
      username,
      user: streamInfo.user,
      stream: streamInfo.stream,
      startedBy,
      startedAt: new Date()
    };

    this.activeStreams.set(channelId, streamData);

    // Notify channel
    this.io.to(`voice:${channelId}`).emit('twitch:started', {
      channelId,
      ...streamData
    });

    return streamData;
  }

  // Stop watching in a channel
  stop(channelId) {
    const stream = this.activeStreams.get(channelId);
    if (stream) {
      this.activeStreams.delete(channelId);

      this.io.to(`voice:${channelId}`).emit('twitch:stopped', {
        channelId
      });
    }
  }

  // Stop all streams
  stopAll() {
    for (const [channelId] of this.activeStreams) {
      this.stop(channelId);
    }
  }

  // Get active stream for a channel
  getActiveStream(channelId) {
    return this.activeStreams.get(channelId) || null;
  }

  // Get all active streams
  getAllStreams() {
    const streams = [];
    for (const [channelId, stream] of this.activeStreams) {
      streams.push({ channelId, ...stream });
    }
    return streams;
  }

  // Get embed URL for a stream
  getEmbedUrl(username, parentDomain = 'localhost') {
    return `https://player.twitch.tv/?channel=${username}&parent=${parentDomain}&muted=false`;
  }

  // Get chat embed URL
  getChatEmbedUrl(username, parentDomain = 'localhost') {
    return `https://www.twitch.tv/embed/${username}/chat?parent=${parentDomain}`;
  }

  // Get status
  getStatus() {
    return {
      enabled: this.enabled,
      configured: this.isConfigured(),
      activeStreams: this.getAllStreams()
    };
  }
}

module.exports = TwitchBotService;
