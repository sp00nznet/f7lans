/**
 * Jellyfin Bot Service
 * Streams media from Jellyfin Media Server to voice channels
 */

const BotSettings = require('../models/BotSettings');

class JellyfinBotService {
  constructor(io) {
    this.io = io;
    this.enabled = false;
    this.connected = false;
    this.serverUrl = null;
    this.apiKey = null;
    this.userId = null;
    this.serverInfo = null;
    this.activeStreams = {};

    this.loadSavedSettings();
  }

  async loadSavedSettings() {
    try {
      const settings = await BotSettings.findOne({ botType: 'jellyfin' });
      if (settings) {
        this.enabled = settings.enabled;
        if (settings.config?.serverUrl && settings.config?.apiKey) {
          console.log('[Jellyfin] Found saved settings, attempting to reconnect...');
          try {
            await this.connect(settings.config.serverUrl, settings.config.apiKey);
            console.log('[Jellyfin] Reconnected to server:', this.serverInfo?.name);
          } catch (err) {
            console.error('[Jellyfin] Failed to reconnect:', err.message);
            this.serverUrl = settings.config.serverUrl;
            this.apiKey = settings.config.apiKey;
          }
        }
      }
    } catch (err) {
      console.error('[Jellyfin] Failed to load saved settings:', err.message);
    }
  }

  async saveSettings() {
    try {
      await BotSettings.findOneAndUpdate(
        { botType: 'jellyfin' },
        {
          botType: 'jellyfin',
          enabled: this.enabled,
          config: {
            serverUrl: this.serverUrl,
            apiKey: this.apiKey
          }
        },
        { upsert: true, new: true }
      );
      console.log('[Jellyfin] Settings saved to database');
    } catch (err) {
      console.error('[Jellyfin] Failed to save settings:', err.message);
    }
  }

  async setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.stopAll();
    }
    await this.saveSettings();
    return { enabled: this.enabled };
  }

  async connect(serverUrl, apiKey) {
    const fetch = (await import('node-fetch')).default;

    try {
      const response = await fetch(`${serverUrl}/System/Info/Public`);

      if (!response.ok) {
        throw new Error('Failed to connect to Jellyfin server');
      }

      const data = await response.json();

      this.serverUrl = serverUrl;
      this.apiKey = apiKey;
      this.connected = true;
      this.serverInfo = {
        name: data.ServerName,
        version: data.Version,
        id: data.Id
      };

      // Get users to find one for library access
      const usersResponse = await fetch(`${serverUrl}/Users`, {
        headers: { 'Authorization': `MediaBrowser Token="${apiKey}"` }
      });

      if (usersResponse.ok) {
        const users = await usersResponse.json();
        if (users.length > 0) {
          this.userId = users[0].Id;
        }
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
      this.apiKey = null;
      throw new Error('Failed to connect to Jellyfin: ' + error.message);
    }
  }

  disconnect() {
    this.stopAll();
    this.connected = false;
    this.serverUrl = null;
    this.apiKey = null;
    this.serverInfo = null;
    return { connected: false };
  }

  async search(query) {
    if (!this.connected) {
      throw new Error('Not connected to Jellyfin');
    }

    const fetch = (await import('node-fetch')).default;

    const response = await fetch(
      `${this.serverUrl}/Items?SearchTerm=${encodeURIComponent(query)}&Recursive=true&IncludeItemTypes=Movie,Series,Audio,MusicAlbum&Limit=20`,
      {
        headers: { 'Authorization': `MediaBrowser Token="${this.apiKey}"` }
      }
    );

    if (!response.ok) {
      throw new Error('Search failed');
    }

    const data = await response.json();

    return (data.Items || []).map(item => ({
      itemId: item.Id,
      title: item.Name,
      type: item.Type,
      year: item.ProductionYear,
      thumb: item.ImageTags?.Primary ? `${this.serverUrl}/Items/${item.Id}/Images/Primary` : null,
      duration: item.RunTimeTicks ? Math.floor(item.RunTimeTicks / 10000000) : null,
      artist: item.AlbumArtist || item.Artists?.[0]
    }));
  }

  async getMediaInfo(itemId) {
    if (!this.connected) {
      throw new Error('Not connected to Jellyfin');
    }

    const fetch = (await import('node-fetch')).default;

    const response = await fetch(
      `${this.serverUrl}/Items/${itemId}`,
      {
        headers: { 'Authorization': `MediaBrowser Token="${this.apiKey}"` }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to get media info');
    }

    const item = await response.json();

    return {
      itemId: item.Id,
      title: item.Name,
      type: item.Type,
      year: item.ProductionYear,
      thumb: item.ImageTags?.Primary ? `${this.serverUrl}/Items/${item.Id}/Images/Primary` : null,
      duration: item.RunTimeTicks ? Math.floor(item.RunTimeTicks / 10000000) : null,
      artist: item.AlbumArtist || item.Artists?.[0]
    };
  }

  async getStreamUrl(itemId) {
    if (!this.connected) {
      throw new Error('Not connected to Jellyfin');
    }

    return `${this.serverUrl}/Audio/${itemId}/universal?api_key=${this.apiKey}&AudioCodec=mp3`;
  }

  // Get proxied stream URL for browser playback (bypasses CORS)
  getProxiedStreamUrl(directUrl) {
    return `/api/stream/proxy?url=${encodeURIComponent(directUrl)}`;
  }

  getThumbUrl(itemId) {
    if (!this.connected || !itemId) {
      return null;
    }
    const directUrl = `${this.serverUrl}/Items/${itemId}/Images/Primary?api_key=${this.apiKey}`;
    return this.getProxiedStreamUrl(directUrl);
  }

  async play(channelId, itemId, requestedBy) {
    if (!this.enabled) {
      throw new Error('Jellyfin bot is disabled');
    }

    if (!this.connected) {
      throw new Error('Not connected to Jellyfin');
    }

    const mediaInfo = await this.getMediaInfo(itemId);
    const directStreamUrl = await this.getStreamUrl(itemId);

    // Use proxied URL for browser playback (bypasses CORS)
    const streamUrl = this.getProxiedStreamUrl(directStreamUrl);

    this.activeStreams[channelId] = {
      itemId,
      title: mediaInfo.title,
      type: mediaInfo.type,
      artist: mediaInfo.artist,
      streamUrl,
      playing: true,
      startTime: Date.now(),
      requestedBy
    };

    // Emit media:playing for client compatibility
    this.io.to(`voice:${channelId}`).emit('media:playing', {
      source: 'Jellyfin',
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

  stop(channelId) {
    if (channelId) {
      if (this.activeStreams[channelId]) {
        delete this.activeStreams[channelId];
        this.io.to(`voice:${channelId}`).emit('media:stopped', { source: 'Jellyfin', channelId });
      }
    } else {
      this.stopAll();
    }
    return { stopped: true };
  }

  stopAll() {
    for (const channelId in this.activeStreams) {
      this.io.to(`voice:${channelId}`).emit('media:stopped', { source: 'Jellyfin', channelId });
    }
    this.activeStreams = {};
  }

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

module.exports = { JellyfinBotService };
