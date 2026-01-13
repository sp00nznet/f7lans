/**
 * Chrome Bot Service
 * Shared browser control for voice channels
 * Users can collaboratively browse the web together
 */

class ChromeBotService {
  constructor(io) {
    this.io = io;
    this.enabled = false;
    this.activeSessions = {}; // channelId -> { url, controller, participants, history }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.stopAll();
    }
    return { enabled: this.enabled };
  }

  // Start a browser session in a channel
  startSession(channelId, initialUrl = 'https://google.com', startedBy) {
    if (!this.enabled) {
      throw new Error('Chrome bot is disabled');
    }

    if (this.activeSessions[channelId]) {
      throw new Error('Browser session already active in this channel');
    }

    this.activeSessions[channelId] = {
      url: initialUrl,
      controller: startedBy,
      participants: [startedBy],
      history: [initialUrl],
      historyIndex: 0,
      startTime: Date.now(),
      startedBy
    };

    this.io.to(`channel:${channelId}`).emit('chrome:session-started', {
      channelId,
      url: initialUrl,
      controller: startedBy
    });

    return {
      channelId,
      url: initialUrl,
      controller: startedBy
    };
  }

  // Navigate to a URL
  navigate(channelId, url, userId) {
    const session = this.activeSessions[channelId];
    if (!session) {
      throw new Error('No browser session in this channel');
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      throw new Error('Invalid URL');
    }

    session.url = url;
    session.history = session.history.slice(0, session.historyIndex + 1);
    session.history.push(url);
    session.historyIndex = session.history.length - 1;
    session.lastAction = { type: 'navigate', by: userId, url, time: Date.now() };

    this.io.to(`channel:${channelId}`).emit('chrome:navigate', {
      channelId,
      url,
      navigatedBy: userId
    });

    return { url, navigatedBy: userId };
  }

  // Go back in history
  goBack(channelId, userId) {
    const session = this.activeSessions[channelId];
    if (!session) {
      throw new Error('No browser session in this channel');
    }

    if (session.historyIndex > 0) {
      session.historyIndex--;
      session.url = session.history[session.historyIndex];
      session.lastAction = { type: 'back', by: userId, time: Date.now() };

      this.io.to(`channel:${channelId}`).emit('chrome:navigate', {
        channelId,
        url: session.url,
        navigatedBy: userId,
        action: 'back'
      });

      return { url: session.url };
    }

    return { url: session.url, message: 'Already at beginning of history' };
  }

  // Go forward in history
  goForward(channelId, userId) {
    const session = this.activeSessions[channelId];
    if (!session) {
      throw new Error('No browser session in this channel');
    }

    if (session.historyIndex < session.history.length - 1) {
      session.historyIndex++;
      session.url = session.history[session.historyIndex];
      session.lastAction = { type: 'forward', by: userId, time: Date.now() };

      this.io.to(`channel:${channelId}`).emit('chrome:navigate', {
        channelId,
        url: session.url,
        navigatedBy: userId,
        action: 'forward'
      });

      return { url: session.url };
    }

    return { url: session.url, message: 'Already at end of history' };
  }

  // Refresh page
  refresh(channelId, userId) {
    const session = this.activeSessions[channelId];
    if (!session) {
      throw new Error('No browser session in this channel');
    }

    session.lastAction = { type: 'refresh', by: userId, time: Date.now() };

    this.io.to(`channel:${channelId}`).emit('chrome:refresh', {
      channelId,
      refreshedBy: userId
    });

    return { refreshed: true };
  }

  // Send scroll/click/input events (for shared control)
  sendInput(channelId, inputData, userId) {
    const session = this.activeSessions[channelId];
    if (!session) {
      throw new Error('No browser session in this channel');
    }

    session.lastAction = { type: 'input', by: userId, data: inputData, time: Date.now() };

    this.io.to(`channel:${channelId}`).emit('chrome:input', {
      channelId,
      inputData,
      sentBy: userId
    });

    return { sent: true };
  }

  // Transfer control to another user
  transferControl(channelId, toUserId, fromUserId) {
    const session = this.activeSessions[channelId];
    if (!session) {
      throw new Error('No browser session in this channel');
    }

    session.controller = toUserId;
    session.lastAction = { type: 'transfer', from: fromUserId, to: toUserId, time: Date.now() };

    this.io.to(`channel:${channelId}`).emit('chrome:control-transferred', {
      channelId,
      newController: toUserId,
      previousController: fromUserId
    });

    return { controller: toUserId };
  }

  // Join a session as participant
  joinSession(channelId, userId) {
    const session = this.activeSessions[channelId];
    if (!session) {
      throw new Error('No browser session in this channel');
    }

    if (!session.participants.includes(userId)) {
      session.participants.push(userId);
    }

    this.io.to(`channel:${channelId}`).emit('chrome:participant-joined', {
      channelId,
      userId,
      participants: session.participants
    });

    return {
      url: session.url,
      controller: session.controller,
      participants: session.participants
    };
  }

  // Leave a session
  leaveSession(channelId, userId) {
    const session = this.activeSessions[channelId];
    if (!session) {
      return { left: true };
    }

    session.participants = session.participants.filter(p => p !== userId);

    // If controller leaves, transfer to next participant
    if (session.controller === userId && session.participants.length > 0) {
      session.controller = session.participants[0];
      this.io.to(`channel:${channelId}`).emit('chrome:control-transferred', {
        channelId,
        newController: session.controller,
        reason: 'Previous controller left'
      });
    }

    this.io.to(`channel:${channelId}`).emit('chrome:participant-left', {
      channelId,
      userId,
      participants: session.participants
    });

    // End session if no participants
    if (session.participants.length === 0) {
      this.stopSession(channelId);
    }

    return { left: true };
  }

  // Stop a session
  stopSession(channelId) {
    if (this.activeSessions[channelId]) {
      delete this.activeSessions[channelId];
      this.io.to(`channel:${channelId}`).emit('chrome:session-ended', { channelId });
    }
    return { stopped: true };
  }

  // Stop all sessions
  stopAll() {
    for (const channelId in this.activeSessions) {
      this.io.to(`channel:${channelId}`).emit('chrome:session-ended', { channelId });
    }
    this.activeSessions = {};
  }

  // Get session info
  getSession(channelId) {
    return this.activeSessions[channelId] || null;
  }

  // Get status
  getStatus() {
    return {
      enabled: this.enabled,
      activeSessions: Object.entries(this.activeSessions).map(([channelId, session]) => ({
        channelId,
        url: session.url,
        controller: session.controller,
        participantCount: session.participants.length,
        startedBy: session.startedBy,
        startTime: session.startTime
      }))
    };
  }
}

module.exports = { ChromeBotService };
