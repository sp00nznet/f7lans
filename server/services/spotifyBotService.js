/**
 * Spotify Bot Service
 * Music streaming from Spotify to voice channels
 * Note: Requires Spotify Premium for playback control
 */

class SpotifyBotService {
  constructor(io) {
    this.io = io;
    this.enabled = false;
    this.connected = false;
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.clientId = null;
    this.clientSecret = null;
    this.userInfo = null;
    this.activeStreams = {}; // channelId -> { track, playlist, queue }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.stopAll();
    }
    return { enabled: this.enabled };
  }

  // Configure Spotify credentials
  configure(clientId, clientSecret) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    return { configured: true };
  }

  // Get authorization URL for OAuth
  getAuthUrl(redirectUri) {
    if (!this.clientId) {
      throw new Error('Spotify not configured');
    }

    const scopes = [
      'user-read-playback-state',
      'user-modify-playback-state',
      'user-read-currently-playing',
      'streaming',
      'playlist-read-private',
      'user-library-read'
    ].join(' ');

    return `https://accounts.spotify.com/authorize?client_id=${this.clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
  }

  // Exchange authorization code for tokens
  async exchangeCode(code, redirectUri) {
    const fetch = (await import('node-fetch')).default;

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      })
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code');
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000);
    this.connected = true;

    // Get user info
    await this.getUserInfo();

    return {
      connected: true,
      user: this.userInfo
    };
  }

  // Refresh access token
  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const fetch = (await import('node-fetch')).default;

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken
      })
    });

    if (!response.ok) {
      this.connected = false;
      throw new Error('Failed to refresh token');
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000);

    if (data.refresh_token) {
      this.refreshToken = data.refresh_token;
    }
  }

  // Ensure token is valid
  async ensureToken() {
    if (!this.accessToken) {
      throw new Error('Not connected to Spotify');
    }

    if (Date.now() >= this.tokenExpiry - 60000) { // Refresh 1 minute before expiry
      await this.refreshAccessToken();
    }
  }

  // Get user info
  async getUserInfo() {
    await this.ensureToken();
    const fetch = (await import('node-fetch')).default;

    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': `Bearer ${this.accessToken}` }
    });

    if (response.ok) {
      const data = await response.json();
      this.userInfo = {
        id: data.id,
        name: data.display_name,
        email: data.email,
        image: data.images?.[0]?.url,
        premium: data.product === 'premium'
      };
    }

    return this.userInfo;
  }

  // Search for tracks, albums, playlists, artists
  async search(query, types = ['track', 'album', 'playlist', 'artist']) {
    await this.ensureToken();
    const fetch = (await import('node-fetch')).default;

    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${types.join(',')}&limit=10`,
      {
        headers: { 'Authorization': `Bearer ${this.accessToken}` }
      }
    );

    if (!response.ok) {
      throw new Error('Search failed');
    }

    const data = await response.json();
    const results = [];

    if (data.tracks?.items) {
      for (const track of data.tracks.items) {
        results.push({
          type: 'track',
          id: track.id,
          uri: track.uri,
          name: track.name,
          artist: track.artists.map(a => a.name).join(', '),
          album: track.album.name,
          image: track.album.images?.[0]?.url,
          duration: track.duration_ms,
          previewUrl: track.preview_url
        });
      }
    }

    if (data.albums?.items) {
      for (const album of data.albums.items) {
        results.push({
          type: 'album',
          id: album.id,
          uri: album.uri,
          name: album.name,
          artist: album.artists.map(a => a.name).join(', '),
          image: album.images?.[0]?.url,
          totalTracks: album.total_tracks
        });
      }
    }

    if (data.playlists?.items) {
      for (const playlist of data.playlists.items) {
        results.push({
          type: 'playlist',
          id: playlist.id,
          uri: playlist.uri,
          name: playlist.name,
          owner: playlist.owner.display_name,
          image: playlist.images?.[0]?.url,
          totalTracks: playlist.tracks.total
        });
      }
    }

    if (data.artists?.items) {
      for (const artist of data.artists.items) {
        results.push({
          type: 'artist',
          id: artist.id,
          uri: artist.uri,
          name: artist.name,
          image: artist.images?.[0]?.url,
          genres: artist.genres
        });
      }
    }

    return results;
  }

  // Get user's playlists
  async getUserPlaylists() {
    await this.ensureToken();
    const fetch = (await import('node-fetch')).default;

    const response = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
      headers: { 'Authorization': `Bearer ${this.accessToken}` }
    });

    if (!response.ok) {
      throw new Error('Failed to get playlists');
    }

    const data = await response.json();

    return data.items.map(playlist => ({
      id: playlist.id,
      uri: playlist.uri,
      name: playlist.name,
      image: playlist.images?.[0]?.url,
      totalTracks: playlist.tracks.total,
      owner: playlist.owner.display_name
    }));
  }

  // Get playlist tracks
  async getPlaylistTracks(playlistId) {
    await this.ensureToken();
    const fetch = (await import('node-fetch')).default;

    const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`, {
      headers: { 'Authorization': `Bearer ${this.accessToken}` }
    });

    if (!response.ok) {
      throw new Error('Failed to get playlist tracks');
    }

    const data = await response.json();

    return data.items.map(item => ({
      id: item.track.id,
      uri: item.track.uri,
      name: item.track.name,
      artist: item.track.artists.map(a => a.name).join(', '),
      album: item.track.album.name,
      image: item.track.album.images?.[0]?.url,
      duration: item.track.duration_ms,
      previewUrl: item.track.preview_url
    }));
  }

  // Play a track/album/playlist in a channel
  async play(voiceChannelId, uri, requestedBy) {
    if (!this.enabled) {
      throw new Error('Spotify bot is disabled');
    }

    await this.ensureToken();

    // For now, we'll broadcast the track info
    // Full playback requires Spotify Connect or Web Playback SDK

    let trackInfo;
    const type = uri.split(':')[1]; // spotify:track:xxx -> track
    const id = uri.split(':')[2];

    const fetch = (await import('node-fetch')).default;

    if (type === 'track') {
      const response = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
        headers: { 'Authorization': `Bearer ${this.accessToken}` }
      });

      if (response.ok) {
        const track = await response.json();
        trackInfo = {
          type: 'track',
          id: track.id,
          uri: track.uri,
          name: track.name,
          artist: track.artists.map(a => a.name).join(', '),
          album: track.album.name,
          image: track.album.images?.[0]?.url,
          duration: track.duration_ms,
          previewUrl: track.preview_url
        };
      }
    }

    this.activeStreams[voiceChannelId] = {
      track: trackInfo,
      queue: [],
      startTime: Date.now(),
      requestedBy
    };

    this.io.to(`channel:${voiceChannelId}`).emit('spotify:play', {
      channelId: voiceChannelId,
      track: trackInfo
    });

    return trackInfo;
  }

  // Add to queue
  async addToQueue(voiceChannelId, uri, requestedBy) {
    const stream = this.activeStreams[voiceChannelId];
    if (!stream) {
      throw new Error('No active Spotify session in this channel');
    }

    // Get track info
    await this.ensureToken();
    const id = uri.split(':')[2];

    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
      headers: { 'Authorization': `Bearer ${this.accessToken}` }
    });

    if (!response.ok) {
      throw new Error('Failed to get track info');
    }

    const track = await response.json();
    const trackInfo = {
      id: track.id,
      uri: track.uri,
      name: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      image: track.album.images?.[0]?.url,
      duration: track.duration_ms,
      previewUrl: track.preview_url,
      addedBy: requestedBy
    };

    stream.queue.push(trackInfo);

    this.io.to(`channel:${voiceChannelId}`).emit('spotify:queue-updated', {
      channelId: voiceChannelId,
      queue: stream.queue
    });

    return trackInfo;
  }

  // Skip to next track
  skip(voiceChannelId, userId) {
    const stream = this.activeStreams[voiceChannelId];
    if (!stream) {
      throw new Error('No active Spotify session in this channel');
    }

    if (stream.queue.length === 0) {
      return { message: 'Queue is empty' };
    }

    const nextTrack = stream.queue.shift();
    stream.track = nextTrack;

    this.io.to(`channel:${voiceChannelId}`).emit('spotify:play', {
      channelId: voiceChannelId,
      track: nextTrack,
      skippedBy: userId
    });

    return nextTrack;
  }

  // Get queue
  getQueue(voiceChannelId) {
    const stream = this.activeStreams[voiceChannelId];
    if (!stream) {
      return [];
    }
    return stream.queue;
  }

  // Stop playback
  stop(voiceChannelId) {
    if (voiceChannelId) {
      if (this.activeStreams[voiceChannelId]) {
        delete this.activeStreams[voiceChannelId];
        this.io.to(`channel:${voiceChannelId}`).emit('spotify:stop', { channelId: voiceChannelId });
      }
    } else {
      this.stopAll();
    }
    return { stopped: true };
  }

  stopAll() {
    for (const channelId in this.activeStreams) {
      this.io.to(`channel:${channelId}`).emit('spotify:stop', { channelId });
    }
    this.activeStreams = {};
  }

  // Disconnect
  disconnect() {
    this.stopAll();
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.userInfo = null;
    this.connected = false;
    return { disconnected: true };
  }

  // Get status
  getStatus() {
    return {
      enabled: this.enabled,
      configured: !!this.clientId,
      connected: this.connected,
      user: this.userInfo,
      activeStreams: Object.entries(this.activeStreams).map(([channelId, stream]) => ({
        channelId,
        track: stream.track?.name,
        artist: stream.track?.artist,
        queueLength: stream.queue.length
      }))
    };
  }
}

module.exports = { SpotifyBotService };
