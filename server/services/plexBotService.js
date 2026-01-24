/**
 * Plex Bot Service
 * Streams audio from Plex Media Server to voice channels
 */

const BotSettings = require('../models/BotSettings');

class PlexBotService {
  constructor(io) {
    this.io = io;
    this.enabled = false;
    this.connected = false;
    this.serverUrl = null;
    this.token = null;
    this.serverInfo = null;
    this.activeStreams = {}; // channelId -> { ratingKey, title, playing, startTime }

    // Load saved settings on startup
    this.loadSavedSettings();
  }

  // Load settings from MongoDB
  async loadSavedSettings() {
    try {
      const settings = await BotSettings.findOne({ botType: 'plex' });
      if (settings) {
        this.enabled = settings.enabled;
        if (settings.config?.serverUrl && settings.config?.token) {
          console.log('[Plex] Found saved settings, attempting to reconnect...');
          // Try to reconnect with saved credentials
          try {
            await this.connect(settings.config.serverUrl, settings.config.token);
            console.log('[Plex] Reconnected to server:', this.serverInfo?.name);
          } catch (err) {
            console.error('[Plex] Failed to reconnect:', err.message);
            // Keep the saved config even if connection fails
            this.serverUrl = settings.config.serverUrl;
            this.token = settings.config.token;
          }
        }
      }
    } catch (err) {
      console.error('[Plex] Failed to load saved settings:', err.message);
    }
  }

  // Save settings to MongoDB
  async saveSettings() {
    try {
      await BotSettings.findOneAndUpdate(
        { botType: 'plex' },
        {
          botType: 'plex',
          enabled: this.enabled,
          config: {
            serverUrl: this.serverUrl,
            token: this.token
          }
        },
        { upsert: true, new: true }
      );
      console.log('[Plex] Settings saved to database');
    } catch (err) {
      console.error('[Plex] Failed to save settings:', err.message);
    }
  }

  // Enable/disable the bot
  async setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.stopAll();
    }
    await this.saveSettings();
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

      // Save settings after successful connection
      await this.saveSettings();

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

  // Get stream URL for media (direct Plex URL)
  async getStreamUrl(ratingKey, mediaInfo = null) {
    if (!this.connected) {
      throw new Error('Not connected to Plex');
    }

    // Get media info if not provided
    if (!mediaInfo) {
      mediaInfo = await this.getMediaInfo(ratingKey);
    }

    // Get the file path from Media[0].Part[0].key
    const media = mediaInfo.media?.[0];
    const part = media?.Part?.[0];

    if (part?.key) {
      // Use the part key for direct stream
      return `${this.serverUrl}${part.key}?X-Plex-Token=${this.token}`;
    }

    // Fallback: use universal transcoder endpoint (works for most media types)
    return `${this.serverUrl}/video/:/transcode/universal/start.m3u8?path=/library/metadata/${ratingKey}&mediaIndex=0&partIndex=0&protocol=hls&X-Plex-Token=${this.token}`;
  }

  // Get proxied stream URL for browser playback (bypasses CORS)
  getProxiedStreamUrl(directUrl) {
    // Wrap the direct URL through our proxy endpoint
    return `/api/stream/proxy?url=${encodeURIComponent(directUrl)}`;
  }

  // Get thumbnail proxy URL (proxied for browser access)
  getThumbUrl(thumbPath) {
    if (!this.connected || !thumbPath) {
      return null;
    }
    const directUrl = `${this.serverUrl}${thumbPath}?X-Plex-Token=${this.token}`;
    return this.getProxiedStreamUrl(directUrl);
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
    const directStreamUrl = await this.getStreamUrl(ratingKey, mediaInfo);

    // Use proxied URL for browser playback (bypasses CORS)
    const streamUrl = this.getProxiedStreamUrl(directStreamUrl);

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

    // Emit to channel (media:playing for client compatibility)
    this.io.to(`voice:${channelId}`).emit('media:playing', {
      source: 'Plex',
      channelId,
      title: mediaInfo.title,
      artist: mediaInfo.artist,
      type: mediaInfo.type,
      streamUrl,
      duration: mediaInfo.duration,
      thumbnail: null
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
        this.io.to(`voice:${channelId}`).emit('media:stopped', { source: 'Plex', channelId });
      }
    } else {
      this.stopAll();
    }
    return { stopped: true };
  }

  // Stop all playback
  stopAll() {
    for (const channelId in this.activeStreams) {
      this.io.to(`voice:${channelId}`).emit('media:stopped', { source: 'Plex', channelId });
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
