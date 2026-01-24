/**
 * Bot Registry
 * Central registry for bot services to allow querying active sessions
 */

const registeredBots = {};

const register = (name, service) => {
  registeredBots[name] = service;
  console.log(`[BotRegistry] Registered bot: ${name}`);
};

const getActiveSessionsForChannel = (channelId) => {
  const activeSessions = [];

  // Check Chrome bot
  if (registeredBots.chrome?.activeSessions?.[channelId]) {
    const session = registeredBots.chrome.activeSessions[channelId];
    activeSessions.push({
      type: 'chrome',
      event: 'chrome:session-started',
      data: {
        channelId,
        url: session.url,
        controller: session.controller
      }
    });
  }

  // Check YouTube bot
  if (registeredBots.youtube?.activeStreams?.[channelId]) {
    const session = registeredBots.youtube.activeStreams[channelId];
    activeSessions.push({
      type: 'youtube',
      event: 'youtube:playing',
      data: {
        channelId,
        url: session.url,
        title: session.title,
        thumbnail: session.thumbnail
      }
    });
  }

  // Check IPTV bot
  if (registeredBots.iptv?.activeStreams?.[channelId]) {
    const session = registeredBots.iptv.activeStreams[channelId];
    activeSessions.push({
      type: 'iptv',
      event: 'iptv:playing',
      data: {
        channelId,
        channelName: session.iptvChannel?.name,
        streamUrl: session.iptvChannel?.url,
        currentProgram: session.currentProgram
      }
    });
  }

  // Check Plex bot
  if (registeredBots.plex?.activeStreams?.[channelId]) {
    const session = registeredBots.plex.activeStreams[channelId];
    activeSessions.push({
      type: 'plex',
      event: 'media:playing',
      data: {
        source: 'Plex',
        channelId,
        title: session.title,
        streamUrl: session.streamUrl,
        thumbnail: null
      }
    });
  }

  // Check Emby bot
  if (registeredBots.emby?.activeStreams?.[channelId]) {
    const session = registeredBots.emby.activeStreams[channelId];
    activeSessions.push({
      type: 'emby',
      event: 'media:playing',
      data: {
        source: 'Emby',
        channelId,
        title: session.title,
        streamUrl: session.streamUrl,
        thumbnail: null
      }
    });
  }

  // Check Jellyfin bot
  if (registeredBots.jellyfin?.activeStreams?.[channelId]) {
    const session = registeredBots.jellyfin.activeStreams[channelId];
    activeSessions.push({
      type: 'jellyfin',
      event: 'media:playing',
      data: {
        source: 'Jellyfin',
        channelId,
        title: session.title,
        streamUrl: session.streamUrl,
        thumbnail: null
      }
    });
  }

  // Check Twitch bot
  if (registeredBots.twitch?.activeStreams?.get?.(channelId)) {
    const session = registeredBots.twitch.activeStreams.get(channelId);
    activeSessions.push({
      type: 'twitch',
      event: 'twitch:started',
      data: {
        channelId,
        streamer: session.streamer,
        embedUrl: session.embedUrl
      }
    });
  }

  return activeSessions;
};

module.exports = {
  register,
  getActiveSessionsForChannel
};
