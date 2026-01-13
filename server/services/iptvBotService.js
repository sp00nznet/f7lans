/**
 * IPTV Bot Service
 * IPTV client with EPG support, recording, and user tagging
 */

const fs = require('fs').promises;
const path = require('path');

class IPTVBotService {
  constructor(io) {
    this.io = io;
    this.enabled = false;
    this.configured = false;
    this.playlistUrl = null;
    this.epgUrl = null;
    this.channels = [];
    this.epgData = {};
    this.activeStreams = {}; // channelId -> { iptvChannel, title }
    this.recordings = []; // { id, channelName, programTitle, startTime, endTime, requestedBy, taggedUsers }
    this.scheduledRecordings = []; // Future recordings
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.stopAll();
    }
    return { enabled: this.enabled };
  }

  // Configure IPTV with M3U playlist and EPG
  async configure(playlistUrl, epgUrl) {
    try {
      await this.loadPlaylist(playlistUrl);

      if (epgUrl) {
        await this.loadEPG(epgUrl);
      }

      this.playlistUrl = playlistUrl;
      this.epgUrl = epgUrl;
      this.configured = true;

      return {
        configured: true,
        channelCount: this.channels.length,
        hasEPG: !!epgUrl
      };
    } catch (error) {
      throw new Error('Failed to configure IPTV: ' + error.message);
    }
  }

  // Load M3U playlist
  async loadPlaylist(url) {
    const fetch = (await import('node-fetch')).default;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch playlist');
    }

    const content = await response.text();
    this.channels = this.parseM3U(content);

    return this.channels.length;
  }

  // Parse M3U playlist
  parseM3U(content) {
    const lines = content.split('\n');
    const channels = [];
    let currentChannel = null;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('#EXTINF:')) {
        // Parse channel info
        const match = trimmed.match(/#EXTINF:(-?\d+)\s*(?:.*?tvg-id="([^"]*)")?(?:.*?tvg-name="([^"]*)")?(?:.*?tvg-logo="([^"]*)")?(?:.*?group-title="([^"]*)")?,(.*)$/);

        if (match) {
          currentChannel = {
            id: match[2] || `ch_${channels.length}`,
            name: match[6]?.trim() || match[3] || `Channel ${channels.length + 1}`,
            logo: match[4] || null,
            group: match[5] || 'Uncategorized',
            tvgId: match[2] || null
          };
        } else {
          // Simple format
          const nameMatch = trimmed.match(/#EXTINF:(-?\d+),(.*)$/);
          if (nameMatch) {
            currentChannel = {
              id: `ch_${channels.length}`,
              name: nameMatch[2].trim(),
              logo: null,
              group: 'Uncategorized',
              tvgId: null
            };
          }
        }
      } else if (trimmed && !trimmed.startsWith('#') && currentChannel) {
        currentChannel.url = trimmed;
        channels.push(currentChannel);
        currentChannel = null;
      }
    }

    return channels;
  }

  // Load EPG data
  async loadEPG(url) {
    const fetch = (await import('node-fetch')).default;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error('Failed to fetch EPG');
        return;
      }

      const content = await response.text();
      this.epgData = this.parseXMLTV(content);
    } catch (error) {
      console.error('Failed to load EPG:', error);
    }
  }

  // Parse XMLTV EPG format (simplified)
  parseXMLTV(content) {
    const epg = {};

    // Parse channels
    const channelMatches = content.matchAll(/<channel id="([^"]+)"[^>]*>[\s\S]*?<display-name[^>]*>([^<]+)<\/display-name>[\s\S]*?<\/channel>/g);
    for (const match of channelMatches) {
      epg[match[1]] = {
        name: match[2],
        programs: []
      };
    }

    // Parse programs
    const programMatches = content.matchAll(/<programme start="([^"]+)" stop="([^"]+)" channel="([^"]+)"[^>]*>[\s\S]*?<title[^>]*>([^<]+)<\/title>[\s\S]*?(?:<desc[^>]*>([^<]*)<\/desc>)?[\s\S]*?<\/programme>/g);

    for (const match of programMatches) {
      const channelId = match[3];
      if (epg[channelId]) {
        epg[channelId].programs.push({
          start: this.parseEPGDate(match[1]),
          stop: this.parseEPGDate(match[2]),
          title: match[4],
          description: match[5] || ''
        });
      }
    }

    return epg;
  }

  // Parse EPG date format (YYYYMMDDHHmmss +ZZZZ)
  parseEPGDate(dateStr) {
    const match = dateStr.match(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
    if (match) {
      return new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`);
    }
    return new Date(dateStr);
  }

  // Get channel list
  getChannels(group = null) {
    if (group) {
      return this.channels.filter(ch => ch.group === group);
    }
    return this.channels;
  }

  // Get channel groups
  getGroups() {
    const groups = new Set(this.channels.map(ch => ch.group));
    return Array.from(groups);
  }

  // Get EPG for a channel
  getChannelEPG(channelId, date = new Date()) {
    const channel = this.channels.find(ch => ch.id === channelId || ch.tvgId === channelId);
    if (!channel) {
      return null;
    }

    const epgChannel = this.epgData[channel.tvgId] || this.epgData[channel.id];
    if (!epgChannel) {
      return { channel: channel.name, programs: [] };
    }

    // Filter programs for the specified date
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const programs = epgChannel.programs.filter(p =>
      p.start >= dayStart && p.start <= dayEnd
    );

    return {
      channel: channel.name,
      programs: programs.map(p => ({
        title: p.title,
        description: p.description,
        start: p.start,
        stop: p.stop,
        isLive: new Date() >= p.start && new Date() <= p.stop
      }))
    };
  }

  // Get current program for a channel
  getCurrentProgram(channelId) {
    const epg = this.getChannelEPG(channelId);
    if (!epg) return null;

    const now = new Date();
    return epg.programs.find(p => now >= p.start && now <= p.stop) || null;
  }

  // Play a channel in a voice channel
  play(voiceChannelId, iptvChannelId, requestedBy) {
    if (!this.enabled) {
      throw new Error('IPTV bot is disabled');
    }

    if (!this.configured) {
      throw new Error('IPTV not configured');
    }

    const channel = this.channels.find(ch => ch.id === iptvChannelId);
    if (!channel) {
      throw new Error('IPTV channel not found');
    }

    const currentProgram = this.getCurrentProgram(iptvChannelId);

    this.activeStreams[voiceChannelId] = {
      iptvChannel: channel,
      currentProgram,
      startTime: Date.now(),
      requestedBy
    };

    this.io.to(`channel:${voiceChannelId}`).emit('iptv:play', {
      channelId: voiceChannelId,
      iptvChannel: channel,
      currentProgram,
      streamUrl: channel.url
    });

    return {
      channel: channel.name,
      streamUrl: channel.url,
      currentProgram
    };
  }

  // Change channel
  changeChannel(voiceChannelId, iptvChannelId, requestedBy) {
    return this.play(voiceChannelId, iptvChannelId, requestedBy);
  }

  // Stop playback
  stop(voiceChannelId) {
    if (voiceChannelId) {
      if (this.activeStreams[voiceChannelId]) {
        delete this.activeStreams[voiceChannelId];
        this.io.to(`channel:${voiceChannelId}`).emit('iptv:stop', { channelId: voiceChannelId });
      }
    } else {
      this.stopAll();
    }
    return { stopped: true };
  }

  stopAll() {
    for (const channelId in this.activeStreams) {
      this.io.to(`channel:${channelId}`).emit('iptv:stop', { channelId });
    }
    this.activeStreams = {};
  }

  // Schedule a recording
  scheduleRecording(iptvChannelId, programTitle, startTime, endTime, requestedBy, taggedUsers = []) {
    const channel = this.channels.find(ch => ch.id === iptvChannelId);
    if (!channel) {
      throw new Error('IPTV channel not found');
    }

    const recording = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      channelId: iptvChannelId,
      channelName: channel.name,
      programTitle,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      requestedBy,
      taggedUsers,
      status: 'scheduled',
      createdAt: new Date()
    };

    this.scheduledRecordings.push(recording);

    // Notify tagged users
    for (const userId of taggedUsers) {
      this.io.to(`user:${userId}`).emit('iptv:recording-scheduled', {
        recording,
        taggedBy: requestedBy
      });
    }

    return recording;
  }

  // Get scheduled recordings
  getScheduledRecordings(userId = null) {
    if (userId) {
      return this.scheduledRecordings.filter(r =>
        r.requestedBy === userId || r.taggedUsers.includes(userId)
      );
    }
    return this.scheduledRecordings;
  }

  // Get recordings
  getRecordings(userId = null) {
    if (userId) {
      return this.recordings.filter(r =>
        r.requestedBy === userId || r.taggedUsers.includes(userId)
      );
    }
    return this.recordings;
  }

  // Cancel a scheduled recording
  cancelRecording(recordingId, userId) {
    const index = this.scheduledRecordings.findIndex(r => r.id === recordingId);
    if (index === -1) {
      throw new Error('Recording not found');
    }

    const recording = this.scheduledRecordings[index];
    if (recording.requestedBy !== userId) {
      throw new Error('Only the user who scheduled the recording can cancel it');
    }

    this.scheduledRecordings.splice(index, 1);

    // Notify tagged users
    for (const taggedUserId of recording.taggedUsers) {
      this.io.to(`user:${taggedUserId}`).emit('iptv:recording-cancelled', {
        recording,
        cancelledBy: userId
      });
    }

    return { cancelled: true };
  }

  // Tag a user on a recording
  tagUserOnRecording(recordingId, targetUserId, taggedBy) {
    let recording = this.recordings.find(r => r.id === recordingId);
    if (!recording) {
      recording = this.scheduledRecordings.find(r => r.id === recordingId);
    }

    if (!recording) {
      throw new Error('Recording not found');
    }

    if (!recording.taggedUsers.includes(targetUserId)) {
      recording.taggedUsers.push(targetUserId);

      this.io.to(`user:${targetUserId}`).emit('iptv:tagged-on-recording', {
        recording,
        taggedBy
      });
    }

    return recording;
  }

  // Get status
  getStatus() {
    return {
      enabled: this.enabled,
      configured: this.configured,
      channelCount: this.channels.length,
      groupCount: this.getGroups().length,
      hasEPG: Object.keys(this.epgData).length > 0,
      activeStreams: Object.entries(this.activeStreams).map(([channelId, stream]) => ({
        channelId,
        iptvChannel: stream.iptvChannel.name,
        currentProgram: stream.currentProgram?.title
      })),
      scheduledRecordingsCount: this.scheduledRecordings.length,
      recordingsCount: this.recordings.length
    };
  }
}

module.exports = { IPTVBotService };
