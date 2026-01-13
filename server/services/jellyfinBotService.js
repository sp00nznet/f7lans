/**
 * Jellyfin Bot Service
 * Streams media from Jellyfin Media Server to voice channels
 */

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
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.stopAll();
    }
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

  getThumbUrl(itemId) {
    if (!this.connected || !itemId) {
      return null;
    }
    return `${this.serverUrl}/Items/${itemId}/Images/Primary?api_key=${this.apiKey}`;
  }

  async play(channelId, itemId, requestedBy) {
    if (!this.enabled) {
      throw new Error('Jellyfin bot is disabled');
    }

    if (!this.connected) {
      throw new Error('Not connected to Jellyfin');
    }

    const mediaInfo = await this.getMediaInfo(itemId);
    const streamUrl = await this.getStreamUrl(itemId);

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

    this.io.to(`channel:${channelId}`).emit('jellyfin:play', {
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

  stop(channelId) {
    if (channelId) {
      if (this.activeStreams[channelId]) {
        delete this.activeStreams[channelId];
        this.io.to(`channel:${channelId}`).emit('jellyfin:stop', { channelId });
      }
    } else {
      this.stopAll();
    }
    return { stopped: true };
  }

  stopAll() {
    for (const channelId in this.activeStreams) {
      this.io.to(`channel:${channelId}`).emit('jellyfin:stop', { channelId });
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
