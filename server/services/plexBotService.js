/**
 * Plex Bot Service
 * Streams audio from Plex Media Server to voice channels
 */

class PlexBotService {
  constructor(io) {
    this.io = io;
    this.enabled = false;
    this.connected = false;
    this.serverUrl = null;
    this.token = null;
    this.serverInfo = null;
    this.activeStreams = {}; // channelId -> { ratingKey, title, playing, startTime }
  }

  // Enable/disable the bot
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.stopAll();
    }
    return { enabled: this.enabled };
  }

  // Connect to Plex server
  async connect(serverUrl, token) {
    const fetch = (await import('node-fetch')).default;

    // Validate connection
    try {
      const response = await fetch(`${serverUrl}/`, {
        headers: {
          'X-Plex-Token': token,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to connect to Plex server');
      }

      const data = await response.json();

      this.serverUrl = serverUrl;
      this.token = token;
      this.connected = true;
      this.serverInfo = {
        name: data.MediaContainer?.friendlyName || 'Plex Server',
        version: data.MediaContainer?.version,
        machineIdentifier: data.MediaContainer?.machineIdentifier
      };

      // Get libraries
      const librariesResponse = await fetch(`${serverUrl}/library/sections`, {
        headers: {
          'X-Plex-Token': token,
          'Accept': 'application/json'
        }
      });

      if (librariesResponse.ok) {
        const librariesData = await librariesResponse.json();
        this.serverInfo.libraries = (librariesData.MediaContainer?.Directory || []).map(lib => ({
          key: lib.key,
          title: lib.title,
          type: lib.type
        }));
      }

      return {
        connected: true,
        serverInfo: this.serverInfo
      };
    } catch (error) {
      this.connected = false;
      this.serverUrl = null;
      this.token = null;
      throw new Error('Failed to connect to Plex: ' + error.message);
    }
  }

  // Disconnect from Plex
  disconnect() {
    this.stopAll();
    this.connected = false;
    this.serverUrl = null;
    this.token = null;
    this.serverInfo = null;
    return { connected: false };
  }

  // Search Plex library
  async search(query) {
    if (!this.connected) {
      throw new Error('Not connected to Plex');
    }

    const fetch = (await import('node-fetch')).default;

    const response = await fetch(
      `${this.serverUrl}/hubs/search?query=${encodeURIComponent(query)}&limit=20`,
      {
        headers: {
          'X-Plex-Token': this.token,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Search failed');
    }

    const data = await response.json();
    const results = [];

    // Extract results from hubs
    const hubs = data.MediaContainer?.Hub || [];
    for (const hub of hubs) {
      if (hub.Metadata) {
        for (const item of hub.Metadata) {
          results.push({
            ratingKey: item.ratingKey,
            title: item.title,
            type: item.type,
            year: item.year,
            thumb: item.thumb,
            duration: item.duration,
            artist: item.grandparentTitle || item.parentTitle
          });
        }
      }
    }

    return results.slice(0, 20);
  }

  // Get media item details
  async getMediaInfo(ratingKey) {
    if (!this.connected) {
      throw new Error('Not connected to Plex');
    }

    const fetch = (await import('node-fetch')).default;

    const response = await fetch(
      `${this.serverUrl}/library/metadata/${ratingKey}`,
      {
        headers: {
          'X-Plex-Token': this.token,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to get media info');
    }

    const data = await response.json();
    const item = data.MediaContainer?.Metadata?.[0];

    if (!item) {
      throw new Error('Media not found');
    }

    return {
      ratingKey: item.ratingKey,
      title: item.title,
      type: item.type,
      year: item.year,
      thumb: item.thumb,
      duration: item.duration,
      artist: item.grandparentTitle || item.parentTitle,
      media: item.Media
    };
  }

  // Get stream URL for media
  async getStreamUrl(ratingKey) {
    if (!this.connected) {
      throw new Error('Not connected to Plex');
    }

    // For audio, we can use the direct stream endpoint
    const streamUrl = `${this.serverUrl}/library/metadata/${ratingKey}/file?X-Plex-Token=${this.token}`;

    // Alternative: transcode to a specific format
    // const transcodeUrl = `${this.serverUrl}/photo/:/transcode?...`;

    return streamUrl;
  }

  // Get thumbnail proxy URL
  getThumbUrl(thumbPath) {
    if (!this.connected || !thumbPath) {
      return null;
    }
    return `${this.serverUrl}${thumbPath}?X-Plex-Token=${this.token}`;
  }

  // Play media in a channel
  async play(channelId, ratingKey, requestedBy) {
    if (!this.enabled) {
      throw new Error('Plex bot is disabled');
    }

    if (!this.connected) {
      throw new Error('Not connected to Plex');
    }

    // Get media info
    const mediaInfo = await this.getMediaInfo(ratingKey);
    const streamUrl = await this.getStreamUrl(ratingKey);

    // Store active stream
    this.activeStreams[channelId] = {
      ratingKey,
      title: mediaInfo.title,
      type: mediaInfo.type,
      artist: mediaInfo.artist,
      streamUrl,
      playing: true,
      startTime: Date.now(),
      requestedBy
    };

    // Emit to channel
    this.io.to(`channel:${channelId}`).emit('plex:play', {
      channelId,
      title: mediaInfo.title,
      artist: mediaInfo.artist,
      type: mediaInfo.type,
      streamUrl,
      duration: mediaInfo.duration
    });

    return {
      title: mediaInfo.title,
      artist: mediaInfo.artist,
      channelId,
      streamUrl
    };
  }

  // Stop playback in a channel
  stop(channelId) {
    if (channelId) {
      if (this.activeStreams[channelId]) {
        delete this.activeStreams[channelId];
        this.io.to(`channel:${channelId}`).emit('plex:stop', { channelId });
      }
    } else {
      this.stopAll();
    }
    return { stopped: true };
  }

  // Stop all playback
  stopAll() {
    for (const channelId in this.activeStreams) {
      this.io.to(`channel:${channelId}`).emit('plex:stop', { channelId });
    }
    this.activeStreams = {};
  }

  // Get bot status
  getStatus() {
    return {
      enabled: this.enabled,
      connected: this.connected,
      serverInfo: this.serverInfo,
      activeStreams: Object.entries(this.activeStreams).map(([channelId, stream]) => ({
        channelId,
        ...stream
      }))
    };
  }
}

module.exports = { PlexBotService };
