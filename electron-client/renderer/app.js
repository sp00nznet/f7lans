// F7Lans Electron Client
// Desktop Application for F7Lans Gaming Community

// State
const state = {
  user: null,
  token: null,
  serverUrl: null,
  socket: null,
  channels: [],
  currentChannel: null,
  messages: [],
  inVoice: false,
  voiceChannel: null,
  isMuted: false,
  isDeafened: false,
  isCameraOn: false,
  isScreenSharing: false,
  isPTTActive: false,
  localStream: null,
  cameraStream: null,
  screenStreams: {}, // Multiple screen shares: { shareId: stream }
  settings: {},
  devices: {
    audioInputs: [],
    audioOutputs: [],
    videoInputs: []
  }
};

// Initialize application
async function init() {
  // Load settings from electron store
  if (window.electronAPI) {
    state.settings = await window.electronAPI.getSettings();
    state.serverUrl = state.settings.serverUrl;
    state.token = state.settings.token;

    // Set up IPC listeners
    setupIPCListeners();
  }

  // If we have a token, try to auto-login
  if (state.token && state.serverUrl) {
    document.getElementById('serverUrl').value = state.serverUrl;
    tryAutoLogin();
  }

  // Set up form handler
  document.getElementById('connectionForm').addEventListener('submit', handleConnect);

  // Set up in-window PTT keyboard handling
  // PTT only works when window is focused (safer than global hotkeys)
  setupPTTKeyboard();
}

// Set up push-to-talk keyboard handling within the window
function setupPTTKeyboard() {
  let pttKeyDown = false;

  document.addEventListener('keydown', (e) => {
    // Skip if typing in an input/textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // Check if PTT is enabled and this is the PTT key
    const pttKey = state.settings?.pushToTalkKey;
    if (!pttKey || state.settings?.voiceActivated) return;

    // Map key names
    const pressedKey = e.code; // e.g., 'Space', 'KeyV', 'F1'

    if (pressedKey === pttKey && !pttKeyDown && state.inVoice) {
      pttKeyDown = true;
      e.preventDefault();
      state.isPTTActive = true;
      if (state.localStream) {
        state.localStream.getAudioTracks().forEach(t => t.enabled = true);
      }
      showPTTIndicator(true);
    }
  });

  document.addEventListener('keyup', (e) => {
    const pttKey = state.settings?.pushToTalkKey;
    if (!pttKey || state.settings?.voiceActivated) return;

    const pressedKey = e.code;

    if (pressedKey === pttKey && pttKeyDown) {
      pttKeyDown = false;
      e.preventDefault();
      state.isPTTActive = false;
      if (state.localStream && state.isMuted) {
        state.localStream.getAudioTracks().forEach(t => t.enabled = false);
      }
      showPTTIndicator(false);
    }
  });
}

// Set up IPC listeners from main process
function setupIPCListeners() {
  window.electronAPI.onToggleMute(() => {
    toggleMute();
  });

  window.electronAPI.onToggleDeafen(() => {
    toggleDeafen();
  });

  window.electronAPI.onPTTStart(() => {
    if (!state.settings.voiceActivated && state.inVoice && state.isMuted) {
      state.isPTTActive = true;
      if (state.localStream) {
        state.localStream.getAudioTracks().forEach(t => t.enabled = true);
      }
      showPTTIndicator(true);
    }
  });

  window.electronAPI.onPTTEnd(() => {
    if (state.isPTTActive) {
      state.isPTTActive = false;
      if (state.localStream && state.isMuted) {
        state.localStream.getAudioTracks().forEach(t => t.enabled = false);
      }
      showPTTIndicator(false);
    }
  });

  window.electronAPI.onOpenSettings(() => {
    openSettings();
  });
}

// Try auto login with saved token
async function tryAutoLogin() {
  try {
    const response = await fetch(`${state.serverUrl}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (response.ok) {
      const data = await response.json();
      state.user = data.user;
      showMainApp();
      connectSocket();
    } else {
      // Token invalid, clear it
      if (window.electronAPI) {
        await window.electronAPI.clearToken();
      }
      state.token = null;
    }
  } catch (error) {
    console.error('Auto-login failed:', error);
  }
}

// Handle connection form submit
async function handleConnect(e) {
  e.preventDefault();

  const serverUrl = document.getElementById('serverUrl').value.trim();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const rememberMe = document.getElementById('rememberMe').checked;

  const btn = e.target.querySelector('button[type="submit"]');
  const errorEl = document.getElementById('errorMessage');

  btn.disabled = true;
  btn.innerHTML = '<div class="loading-spinner"></div>';
  errorEl.textContent = '';

  try {
    // Validate server URL
    const cleanUrl = serverUrl.replace(/\/$/, '');

    // Try to login
    const response = await fetch(`${cleanUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    // Save credentials
    state.user = data.user;
    state.token = data.token;
    state.serverUrl = cleanUrl;

    if (window.electronAPI && rememberMe) {
      await window.electronAPI.saveToken(data.token);
      await window.electronAPI.setServerUrl(cleanUrl);
    }

    // Show main app
    showMainApp();
    connectSocket();

    // Update tray
    if (window.electronAPI) {
      window.electronAPI.updateTrayStatus('Online');
    }

  } catch (error) {
    errorEl.textContent = error.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Connect';
  }
}

// Connect to Socket.io server
function connectSocket() {
  state.socket = io(state.serverUrl, {
    auth: { token: state.token },
    transports: ['websocket', 'polling']
  });

  state.socket.on('connect', () => {
    console.log('Connected to F7Lans server');
    showToast('Connected to server', 'success');
    loadChannels();
  });

  state.socket.on('disconnect', () => {
    showToast('Disconnected from server', 'warning');
    if (window.electronAPI) {
      window.electronAPI.updateTrayStatus('Disconnected');
    }
  });

  state.socket.on('error', (data) => {
    showToast(data.message, 'error');
  });

  // Message handlers
  state.socket.on('message:new', (message) => {
    if (state.currentChannel && message.channel === state.currentChannel._id) {
      state.messages.push(message);
      renderMessages();
      scrollToBottom();
    }

    // Desktop notification if window not focused
    if (window.electronAPI && document.hidden) {
      const author = message.author.displayName || message.author.username;
      window.electronAPI.showNotification(`${author} in #${state.currentChannel?.name || 'channel'}`, message.content.substring(0, 100));
      window.electronAPI.flashWindow();
    }
  });

  state.socket.on('message:updated', (message) => {
    const idx = state.messages.findIndex(m => m._id === message._id);
    if (idx !== -1) {
      state.messages[idx] = message;
      renderMessages();
    }
  });

  state.socket.on('message:deleted', (data) => {
    state.messages = state.messages.filter(m => m._id !== data.messageId);
    renderMessages();
  });

  // Voice handlers
  state.socket.on('voice:userJoined', (data) => {
    showToast(`${data.user.displayName || data.user.username} joined voice`, 'info');
    renderVoiceUsers();
    loadChannels(); // Refresh channel user counts
  });

  state.socket.on('voice:userLeft', (data) => {
    renderVoiceUsers();
    loadChannels();
  });

  state.socket.on('voice:currentUsers', (data) => {
    renderVoiceUsers(data.users);
  });
}

// Show main app UI
function showMainApp() {
  document.getElementById('connectionScreen').style.display = 'none';
  document.getElementById('mainApp').style.display = 'grid';

  renderMainApp();
}

// Render main application
function renderMainApp() {
  const mainApp = document.getElementById('mainApp');

  mainApp.innerHTML = `
    <nav class="server-list">
      <div class="server-icon active" title="F7Lans Home">F7</div>
      <div class="server-divider"></div>
    </nav>

    <aside class="channel-sidebar">
      <div class="server-header">
        <h2>F7Lans</h2>
        <span>▼</span>
      </div>

      <div class="channels-container" id="channelsList"></div>

      <div class="voice-status" id="voiceStatus" style="display: none;">
        <div class="voice-info">
          <div class="status-dot"></div>
          <div>
            <div class="voice-text">Voice Connected</div>
            <div class="channel-name-small" id="connectedChannelName"></div>
          </div>
        </div>
        <div class="voice-controls">
          <button class="voice-btn" id="muteBtn" onclick="toggleMute()" title="Mute">🎤</button>
          <button class="voice-btn" id="deafenBtn" onclick="toggleDeafen()" title="Deafen">🎧</button>
          <button class="voice-btn" onclick="toggleScreenShare()" title="Share Screen">📺</button>
          <button class="voice-btn disconnect" onclick="leaveVoice()" title="Disconnect">📞</button>
        </div>
      </div>

      <div class="user-panel">
        <div class="user-avatar" onclick="openSettings()">
          ${state.user?.avatar ? `<img src="${state.user.avatar}">` : (state.user?.displayName || state.user?.username || 'U')[0].toUpperCase()}
          <div class="status-indicator online"></div>
        </div>
        <div class="user-info">
          <div class="user-name">${state.user?.displayName || state.user?.username}</div>
          <div class="user-tag">#${state.user?.username}</div>
        </div>
        <div class="user-controls">
          <button class="user-btn" onclick="toggleMute()" title="Mute">🎤</button>
          <button class="user-btn" onclick="toggleDeafen()" title="Deafen">🎧</button>
          <button class="user-btn" onclick="openSettings()" title="Settings">⚙️</button>
        </div>
      </div>
    </aside>

    <main class="main-content">
      <header class="channel-header">
        <span class="hash">#</span>
        <h3 id="channelName">general</h3>
        <div class="divider"></div>
        <span class="description" id="channelDescription"></span>
        <div class="header-actions">
          <button class="header-btn" onclick="showMembers()" title="Members">👥</button>
          <button class="header-btn" onclick="openSettings()" title="Settings">⚙️</button>
        </div>
      </header>

      <div class="messages-area" id="messagesArea"></div>

      <div class="message-input-container">
        <div class="message-input-wrapper">
          <div class="input-actions-left">
            <button class="input-btn" title="Attach">➕</button>
          </div>
          <textarea class="message-input" id="messageInput"
            placeholder="Message #general"
            rows="1"
            onkeydown="handleInputKeyDown(event)"></textarea>
          <div class="input-actions-right">
            <button class="input-btn" title="Emoji">😀</button>
          </div>
        </div>
      </div>
    </main>

    <aside class="voice-panel" id="voicePanel" style="display: none;">
      <div class="voice-panel-header">
        <h3 id="voicePanelTitle">Voice</h3>
        <button class="header-btn">⛶</button>
      </div>
      <div class="voice-panel-content">
        <div id="videoGrid" class="video-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; margin-bottom: 12px;"></div>
        <div class="voice-participants">
          <h4>In Voice — <span id="participantCount">0</span></h4>
          <div id="participantsList"></div>
        </div>
      </div>
      <div class="voice-actions">
        <button class="action-btn" id="micBtnPanel" onclick="toggleMute()">
          <span class="icon">🎤</span>
          <span class="label">Mute</span>
        </button>
        <button class="action-btn" id="camBtnPanel" onclick="toggleCamera()">
          <span class="icon">📷</span>
          <span class="label">Camera</span>
        </button>
        <button class="action-btn" id="shareBtnPanel" onclick="toggleScreenShare()">
          <span class="icon">📺</span>
          <span class="label">Share</span>
        </button>
        <button class="action-btn danger" onclick="leaveVoice()">
          <span class="icon">📞</span>
          <span class="label">Leave</span>
        </button>
      </div>
    </aside>

    <div class="ptt-indicator" id="pttIndicator">🎤 Transmitting...</div>
    <div class="toast-container" id="toastContainer"></div>
    <div class="modal-overlay" id="modalOverlay" onclick="closeModal()">
      <div class="modal" onclick="event.stopPropagation()" id="modalContent"></div>
    </div>
  `;
}

// Load channels from server
async function loadChannels() {
  try {
    const response = await fetch(`${state.serverUrl}/api/channels`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    const data = await response.json();
    state.channels = data.channels;
    renderChannels();

    // Select first text channel if none selected
    if (!state.currentChannel) {
      const textChannel = state.channels.find(c => c.type === 'text');
      if (textChannel) selectChannel(textChannel);
    }
  } catch (error) {
    showToast('Failed to load channels', 'error');
  }
}

// Render channels list
function renderChannels() {
  const container = document.getElementById('channelsList');
  if (!container) return;

  const grouped = state.channels.reduce((acc, ch) => {
    const cat = ch.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ch);
    return acc;
  }, {});

  let html = '';

  for (const [category, channels] of Object.entries(grouped)) {
    html += `<div class="channel-category"><span>▼</span><span>${category}</span></div>`;

    for (const channel of channels) {
      const isActive = state.currentChannel?._id === channel._id;
      const isVoice = ['voice', 'video'].includes(channel.type);
      const userCount = channel.currentUsers?.length || 0;

      html += `
        <div class="channel ${isActive ? 'active' : ''}"
             onclick="${isVoice ? `joinVoice('${channel._id}')` : `selectChannelById('${channel._id}')`}">
          <span class="channel-icon">${isVoice ? '🔊' : '#'}</span>
          <span class="channel-name">${channel.name}</span>
          ${isVoice && userCount > 0 ? `<span class="channel-users">${userCount}</span>` : ''}
        </div>
      `;
    }
  }

  container.innerHTML = html;
}

// Select channel by ID
function selectChannelById(channelId) {
  const channel = state.channels.find(c => c._id === channelId);
  if (channel) selectChannel(channel);
}

// Select channel
async function selectChannel(channel) {
  state.currentChannel = channel;

  if (state.socket) {
    state.socket.emit('channel:join', channel._id);
  }

  renderChannels();

  // Update header
  document.getElementById('channelName').textContent = channel.name;
  document.getElementById('channelDescription').textContent = channel.description || '';
  document.getElementById('messageInput').placeholder = `Message #${channel.name}`;

  // Load messages
  await loadMessages(channel._id);
}

// Load messages
async function loadMessages(channelId) {
  try {
    const response = await fetch(`${state.serverUrl}/api/channels/${channelId}/messages`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    const data = await response.json();
    state.messages = data.messages;
    renderMessages();
    scrollToBottom();
  } catch (error) {
    showToast('Failed to load messages', 'error');
  }
}

// Render messages
function renderMessages() {
  const container = document.getElementById('messagesArea');
  if (!container) return;

  if (state.messages.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-muted);">
        <h2 style="color: var(--text-primary); margin-bottom: 8px;">Welcome to #${state.currentChannel?.name || 'general'}!</h2>
        <p>This is the beginning of the channel.</p>
      </div>
    `;
    return;
  }

  let html = '';
  let lastAuthor = null;

  for (const msg of state.messages) {
    const author = msg.author;
    const time = new Date(msg.createdAt);
    const showHeader = lastAuthor !== author._id;

    if (showHeader) {
      const timeStr = formatTime(time);
      const avatarColor = getAvatarColor(author.username);

      html += `
        <div class="message-group">
          <div class="message-avatar" style="background: ${avatarColor};">
            ${author.avatar ? `<img src="${author.avatar}">` : (author.displayName || author.username)[0].toUpperCase()}
          </div>
          <div class="message-content">
            <div class="message-header">
              <span class="message-author" style="color: ${getRoleColor(author.role)};">${author.displayName || author.username}</span>
              <span class="message-timestamp">${timeStr}</span>
            </div>
      `;
    }

    html += `<div class="message-text">${escapeHtml(msg.content)}</div>`;

    if (showHeader) {
      html += '</div></div>';
    }

    lastAuthor = author._id;
  }

  container.innerHTML = html;
}

// Voice functions
async function joinVoice(channelId) {
  const channel = state.channels.find(c => c._id === channelId);
  if (!channel) return;

  try {
    // Use selected audio input device if configured
    const audioInputDevice = state.settings.audioInputDevice || undefined;
    const audioConstraints = {
      echoCancellation: true,
      noiseSuppression: true
    };

    if (audioInputDevice) {
      audioConstraints.deviceId = { exact: audioInputDevice };
    }

    state.localStream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints
    });

    // Apply initial mute state
    if (state.isMuted || !state.settings.voiceActivated) {
      state.localStream.getAudioTracks().forEach(t => t.enabled = false);
      state.isMuted = true;
    }

    state.inVoice = true;
    state.voiceChannel = channel;

    state.socket.emit('voice:join', channelId);

    document.getElementById('mainApp').classList.add('voice-active');
    document.getElementById('voiceStatus').style.display = 'block';
    document.getElementById('voicePanel').style.display = 'flex';
    document.getElementById('connectedChannelName').textContent = channel.name;
    document.getElementById('voicePanelTitle').textContent = channel.name;

    updateVoiceUI();
    showToast(`Joined ${channel.name}`, 'success');

    if (window.electronAPI) {
      window.electronAPI.updateTrayStatus(`In voice: ${channel.name}`);
    }
  } catch (error) {
    showToast('Could not access microphone', 'error');
  }
}

function leaveVoice() {
  if (state.localStream) {
    state.localStream.getTracks().forEach(t => t.stop());
    state.localStream = null;
  }

  if (state.socket) {
    state.socket.emit('voice:leave');
  }

  state.inVoice = false;
  state.voiceChannel = null;
  state.isMuted = false;
  state.isDeafened = false;

  document.getElementById('mainApp')?.classList.remove('voice-active');
  document.getElementById('voiceStatus').style.display = 'none';
  document.getElementById('voicePanel').style.display = 'none';

  showToast('Left voice channel', 'success');

  if (window.electronAPI) {
    window.electronAPI.updateTrayStatus('Online');
  }
}

function toggleMute() {
  state.isMuted = !state.isMuted;

  if (state.localStream) {
    state.localStream.getAudioTracks().forEach(t => {
      t.enabled = !state.isMuted;
    });
  }

  if (state.socket && state.inVoice) {
    state.socket.emit('voice:mute', state.isMuted);
  }

  updateVoiceUI();
}

function toggleDeafen() {
  state.isDeafened = !state.isDeafened;

  if (state.isDeafened && !state.isMuted) {
    toggleMute();
  }

  if (state.socket && state.inVoice) {
    state.socket.emit('voice:deafen', state.isDeafened);
  }

  updateVoiceUI();
}

async function toggleCamera() {
  if (!state.isCameraOn) {
    try {
      // Get the selected camera device or use default
      const cameraDeviceId = state.settings.cameraDevice || undefined;

      const constraints = {
        video: cameraDeviceId
          ? { deviceId: { exact: cameraDeviceId }, width: 640, height: 480 }
          : { width: 640, height: 480, facingMode: 'user' },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      state.cameraStream = stream;
      state.isCameraOn = true;

      if (state.socket && state.inVoice) {
        state.socket.emit('camera:toggle', true);
      }

      // Add video to grid
      addVideoToGrid('local-camera', stream, state.user?.displayName || 'You', true);

      showToast('Camera enabled', 'success');
    } catch (error) {
      console.error('Camera error:', error);
      if (error.name === 'NotAllowedError') {
        showToast('Camera access denied. Please allow camera access in your system settings.', 'error');
      } else if (error.name === 'NotFoundError') {
        showToast('No camera found. Please connect a camera.', 'error');
      } else {
        showToast('Could not access camera: ' + error.message, 'error');
      }
    }
  } else {
    // Stop camera
    if (state.cameraStream) {
      state.cameraStream.getTracks().forEach(track => track.stop());
      state.cameraStream = null;
    }
    state.isCameraOn = false;

    if (state.socket && state.inVoice) {
      state.socket.emit('camera:toggle', false);
    }

    // Remove video from grid
    removeVideoFromGrid('local-camera');

    showToast('Camera disabled', 'success');
  }

  updateVoiceUI();
}

async function toggleScreenShare() {
  // Always allow adding more screen shares - show picker
  if (window.electronAPI && window.electronAPI.getScreenSources) {
    try {
      const sources = await window.electronAPI.getScreenSources();
      openScreenPickerModal(sources);
    } catch (error) {
      console.error('Failed to get screen sources:', error);
      showToast('Could not get screen sources: ' + error.message, 'error');
    }
  } else {
    // Fallback for web (browser) - use getDisplayMedia
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1920, height: 1080, frameRate: 30 },
        audio: true
      });
      const shareId = 'screen-' + Date.now();
      startScreenShare(stream, shareId);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Screen share error:', error);
        showToast('Could not share screen: ' + error.message, 'error');
      }
    }
  }
}

// Show screen picker modal for Electron
function openScreenPickerModal(sources) {
  const overlay = document.getElementById('modalOverlay');
  const modal = document.getElementById('modalContent');

  // Store sources globally so we can access thumbnails by index
  window._screenSources = sources;

  const sourcesHtml = sources.map((source, index) => `
    <div class="screen-source" onclick="selectScreenSource('${source.id}')"
         style="cursor: pointer; padding: 8px; border-radius: 8px; background: var(--bg-dark); text-align: center; transition: all 0.2s;">
      <div class="screen-thumbnail" data-index="${index}"
           style="width: 100%; height: 120px; border-radius: 4px; margin-bottom: 8px; border: 2px solid transparent; background: var(--bg-medium); display: flex; align-items: center; justify-content: center; overflow: hidden;">
        <span style="color: var(--text-muted); font-size: 32px;">🖥️</span>
      </div>
      <div style="font-size: 12px; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${escapeHtml(source.name)}
      </div>
    </div>
  `).join('');

  modal.innerHTML = `
    <div class="modal-header">
      <h2>Share Your Screen</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body" style="max-height: 400px; overflow-y: auto;">
      <p style="color: var(--text-muted); margin-bottom: 16px;">Select a screen or window to share:</p>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px;">
        ${sourcesHtml}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
    </div>
  `;

  // Add hover effect
  const style = document.createElement('style');
  style.textContent = `.screen-source:hover { background: var(--bg-medium) !important; } .screen-source:hover .screen-thumbnail { border-color: var(--accent-primary) !important; }`;
  modal.appendChild(style);

  overlay.classList.add('active');

  // Load thumbnails after modal is shown
  setTimeout(() => {
    document.querySelectorAll('.screen-thumbnail').forEach((el) => {
      const index = parseInt(el.dataset.index);
      const source = window._screenSources[index];
      if (source && source.thumbnail) {
        const img = document.createElement('img');
        img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
        img.onload = () => {
          el.innerHTML = '';
          el.appendChild(img);
        };
        img.onerror = () => {
          // Keep the fallback icon on error
          console.log('Failed to load thumbnail for:', source.name);
        };
        img.src = source.thumbnail;
      }
    });
  }, 50);
}

// Select a screen source from the picker
async function selectScreenSource(sourceId) {
  closeModal();

  try {
    // Use the selected source with getUserMedia (Electron way)
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
          maxWidth: 1920,
          maxHeight: 1080,
          maxFrameRate: 30
        }
      }
    });

    // Generate unique share ID
    const shareId = 'screen-' + Date.now();

    // Find the source name for the label
    const source = window._screenSources?.find(s => s.id === sourceId);
    const label = source?.name || 'Screen Share';

    startScreenShare(stream, shareId, label);
  } catch (error) {
    console.error('Failed to start screen share:', error);
    showToast('Could not share screen: ' + error.message, 'error');
  }
}

// Start screen sharing with a stream
function startScreenShare(stream, shareId, label = 'Your Screen') {
  state.screenStreams[shareId] = stream;
  state.isScreenSharing = Object.keys(state.screenStreams).length > 0;

  if (state.socket) {
    state.socket.emit('screen:start', { shareId, label });
  }

  // Add screen share to grid with close button
  addVideoToGrid(shareId, stream, label, false, true);

  // Handle user stopping share via system
  stream.getVideoTracks()[0].onended = () => {
    stopScreenShare(shareId);
    showToast('Screen sharing stopped', 'info');
  };

  showToast('Screen sharing started: ' + label, 'success');
  updateVoiceUI();
}

// Stop a specific screen share or all if no shareId
function stopScreenShare(shareId) {
  if (shareId) {
    // Stop specific share
    if (state.screenStreams[shareId]) {
      state.screenStreams[shareId].getTracks().forEach(t => t.stop());
      delete state.screenStreams[shareId];
      removeVideoFromGrid(shareId);
    }
  } else {
    // Stop all shares
    for (const id in state.screenStreams) {
      state.screenStreams[id].getTracks().forEach(t => t.stop());
      removeVideoFromGrid(id);
    }
    state.screenStreams = {};
  }

  state.isScreenSharing = Object.keys(state.screenStreams).length > 0;

  if (state.socket) {
    state.socket.emit('screen:stop', { shareId });
  }

  updateVoiceUI();
}

// Add video element to the video grid
function addVideoToGrid(id, stream, label, isMirrored = false, showCloseButton = false) {
  const grid = document.getElementById('videoGrid');
  if (!grid) return;

  // Remove existing element if present
  removeVideoFromGrid(id);

  const tile = document.createElement('div');
  tile.className = 'video-tile';
  tile.id = `video-tile-${id}`;
  tile.style.cssText = 'position: relative; background: var(--bg-dark); border-radius: 8px; overflow: hidden;';
  tile.innerHTML = `
    <video id="video-${id}" autoplay playsinline style="width: 100%; height: 100%; object-fit: cover; ${isMirrored ? 'transform: scaleX(-1);' : ''}"></video>
    <div class="video-label" style="position: absolute; bottom: 8px; left: 8px; background: rgba(0,0,0,0.7); padding: 4px 8px; border-radius: 4px; font-size: 12px;">${escapeHtml(label)}</div>
    ${showCloseButton ? `<button onclick="stopScreenShare('${id}')" style="position: absolute; top: 8px; right: 8px; background: rgba(255,0,0,0.8); border: none; color: white; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center;">✕</button>` : ''}
  `;

  grid.appendChild(tile);

  const video = document.getElementById(`video-${id}`);
  if (video) {
    video.srcObject = stream;
    video.muted = true; // Mute local playback to prevent echo
  }
}

// Remove video element from the grid
function removeVideoFromGrid(id) {
  const tile = document.getElementById(`video-tile-${id}`);
  if (tile) {
    const video = tile.querySelector('video');
    if (video) {
      video.srcObject = null;
    }
    tile.remove();
  }
}

function updateVoiceUI() {
  const muteBtn = document.getElementById('muteBtn');
  const deafenBtn = document.getElementById('deafenBtn');
  const micBtnPanel = document.getElementById('micBtnPanel');
  const shareBtnPanel = document.getElementById('shareBtnPanel');

  if (muteBtn) {
    muteBtn.classList.toggle('active', state.isMuted);
    muteBtn.textContent = state.isMuted ? '🔇' : '🎤';
  }

  if (deafenBtn) {
    deafenBtn.classList.toggle('active', state.isDeafened);
    deafenBtn.textContent = state.isDeafened ? '🔈' : '🎧';
  }

  if (micBtnPanel) {
    micBtnPanel.classList.toggle('active', state.isMuted);
    micBtnPanel.querySelector('.icon').textContent = state.isMuted ? '🔇' : '🎤';
  }

  if (shareBtnPanel) {
    shareBtnPanel.classList.toggle('active', state.isScreenSharing);
  }
}

function renderVoiceUsers(users = []) {
  const container = document.getElementById('participantsList');
  const countEl = document.getElementById('participantCount');
  if (!container) return;

  countEl.textContent = users.length;

  let html = '';
  for (const cu of users) {
    const user = cu.user;
    const avatarColor = getAvatarColor(user.username);

    html += `
      <div class="participant">
        <div class="avatar" style="background: ${avatarColor};">
          ${(user.displayName || user.username)[0].toUpperCase()}
        </div>
        <span class="name">${user.displayName || user.username}</span>
        <div class="status-icons">
          ${cu.isMuted ? '<span class="muted">🔇</span>' : ''}
          ${cu.isDeafened ? '<span>🔈</span>' : ''}
          ${cu.isStreaming ? '<span>📺</span>' : ''}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

function showPTTIndicator(show) {
  const indicator = document.getElementById('pttIndicator');
  if (indicator) {
    indicator.classList.toggle('active', show);
  }
}

// Message input
function handleInputKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function sendMessage() {
  const input = document.getElementById('messageInput');
  const content = input.value.trim();

  if (!content || !state.currentChannel || !state.socket) return;

  state.socket.emit('message:send', {
    channelId: state.currentChannel._id,
    content
  });

  input.value = '';
}

// Settings modal
async function openSettings() {
  const modal = document.getElementById('modalOverlay');
  const content = document.getElementById('modalContent');

  // Enumerate devices first
  await enumerateDevices();

  const audioInputOptions = state.devices.audioInputs.map(d =>
    `<option value="${d.deviceId}" ${state.settings.audioInputDevice === d.deviceId ? 'selected' : ''}>${escapeHtml(d.label || 'Microphone ' + (state.devices.audioInputs.indexOf(d) + 1))}</option>`
  ).join('');

  const audioOutputOptions = state.devices.audioOutputs.map(d =>
    `<option value="${d.deviceId}" ${state.settings.audioOutputDevice === d.deviceId ? 'selected' : ''}>${escapeHtml(d.label || 'Speaker ' + (state.devices.audioOutputs.indexOf(d) + 1))}</option>`
  ).join('');

  const videoInputOptions = state.devices.videoInputs.map(d =>
    `<option value="${d.deviceId}" ${state.settings.cameraDevice === d.deviceId ? 'selected' : ''}>${escapeHtml(d.label || 'Camera ' + (state.devices.videoInputs.indexOf(d) + 1))}</option>`
  ).join('');

  content.innerHTML = `
    <div class="modal-header">
      <h2>Settings</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body" style="max-height: 500px; overflow-y: auto;">
      <div class="settings-section">
        <h3>Devices</h3>
        <div class="settings-row">
          <label>Microphone</label>
          <select id="audioInputDevice" style="flex: 1; max-width: 200px; padding: 8px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
            <option value="">Default</option>
            ${audioInputOptions}
          </select>
          <button class="btn-secondary" onclick="testMicrophone()" style="margin-left: 8px; padding: 8px;">Test</button>
        </div>
        <div class="settings-row">
          <label>Speakers</label>
          <select id="audioOutputDevice" style="flex: 1; max-width: 200px; padding: 8px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
            <option value="">Default</option>
            ${audioOutputOptions}
          </select>
        </div>
        <div class="settings-row">
          <label>Camera</label>
          <select id="cameraDevice" style="flex: 1; max-width: 200px; padding: 8px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
            <option value="">Default</option>
            ${videoInputOptions}
          </select>
          <button class="btn-secondary" onclick="testCamera()" style="margin-left: 8px; padding: 8px;">Preview</button>
        </div>
        <div id="cameraPreviewContainer" style="display: none; margin-top: 12px; background: var(--bg-dark); border-radius: 8px; overflow: hidden;">
          <video id="cameraPreview" autoplay playsinline muted style="width: 100%; max-height: 180px; transform: scaleX(-1);"></video>
        </div>
      </div>

      <div class="settings-section">
        <h3>Audio</h3>
        <div class="settings-row">
          <label>Input Volume</label>
          <input type="range" min="0" max="200" value="${state.settings.inputVolume || 100}" id="inputVolume">
          <span id="inputVolumeLabel" style="min-width: 40px; text-align: right;">${state.settings.inputVolume || 100}%</span>
        </div>
        <div class="settings-row">
          <label>Output Volume</label>
          <input type="range" min="0" max="200" value="${state.settings.outputVolume || 100}" id="outputVolume">
          <span id="outputVolumeLabel" style="min-width: 40px; text-align: right;">${state.settings.outputVolume || 100}%</span>
        </div>
        <div class="settings-row">
          <label>Voice Mode</label>
          <select id="voiceMode" onchange="togglePTTKeyRow()">
            <option value="ptt" ${!state.settings.voiceActivated ? 'selected' : ''}>Push to Talk</option>
            <option value="vad" ${state.settings.voiceActivated ? 'selected' : ''}>Voice Activated</option>
          </select>
        </div>
        <div class="settings-row" id="pttKeyRow" style="display: ${!state.settings.voiceActivated ? 'flex' : 'none'};">
          <label>Push to Talk Key</label>
          <button id="pttKeyBtn" onclick="capturePTTKey()" style="padding: 8px 16px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary); cursor: pointer;">
            ${state.settings.pushToTalkKey || 'Click to set key'}
          </button>
          <input type="hidden" value="${state.settings.pushToTalkKey || ''}" id="pttKey">
          <small style="color: var(--text-muted); font-size: 11px; margin-left: 8px;">(Works when app is focused)</small>
        </div>
      </div>

      <div class="settings-section">
        <h3>Behavior</h3>
        <div class="settings-row">
          <label>Minimize to Tray</label>
          <input type="checkbox" ${state.settings.minimizeToTray ? 'checked' : ''} id="minimizeToTray">
        </div>
        <div class="settings-row">
          <label>Start Minimized</label>
          <input type="checkbox" ${state.settings.startMinimized ? 'checked' : ''} id="startMinimized">
        </div>
      </div>

      <div class="settings-section">
        <h3>Account</h3>
        <div class="settings-row">
          <label>Display Name</label>
          <input type="text" value="${state.user?.displayName || ''}" id="displayName" style="width: 150px; padding: 8px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
        </div>
        <div class="settings-row">
          <label>Steam ID</label>
          <input type="text" value="${state.user?.steamId || ''}" id="steamId" style="width: 150px; padding: 8px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
        </div>
      </div>

      ${state.user?.role === 'admin' || state.user?.role === 'superadmin' ? `
      <div class="settings-section">
        <h3>Administration</h3>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn-secondary" onclick="openInviteModal()">Create Invite</button>
          <button class="btn-secondary" onclick="openCreateUserModal()">Create User</button>
          <button class="btn-secondary" onclick="openAdminPanel()">Manage Users</button>
          <button class="btn-secondary" onclick="openFederationModal()">Federation</button>
        </div>
        <h4 style="margin-top: 16px; color: var(--text-muted);">Media Bots</h4>
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;">
          <button class="btn-secondary" onclick="openYouTubeBotModal()">YouTube</button>
          <button class="btn-secondary" onclick="openPlexBotModal()">Plex</button>
          <button class="btn-secondary" onclick="openEmbyBotModal()">Emby</button>
          <button class="btn-secondary" onclick="openJellyfinBotModal()">Jellyfin</button>
          <button class="btn-secondary" onclick="openSpotifyBotModal()">Spotify</button>
          <button class="btn-secondary" onclick="openIPTVBotModal()">IPTV</button>
          <button class="btn-secondary" onclick="openChromeBotModal()">Chrome</button>
        </div>
      </div>
      ` : ''}
    </div>
    <div class="modal-footer">
      <button class="btn-danger" onclick="disconnect()">Disconnect</button>
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="saveSettings()">Save</button>
    </div>
  `;

  // Set up volume label updates
  document.getElementById('inputVolume').addEventListener('input', (e) => {
    document.getElementById('inputVolumeLabel').textContent = e.target.value + '%';
  });
  document.getElementById('outputVolume').addEventListener('input', (e) => {
    document.getElementById('outputVolumeLabel').textContent = e.target.value + '%';
  });

  modal.classList.add('active');
}

// Enumerate available media devices
async function enumerateDevices() {
  try {
    // Request permission first to get device labels
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach(track => track.stop());
    } catch (e) {
      // Try audio only if video fails
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      } catch (e2) {
        console.log('Could not get media permissions for device enumeration');
      }
    }

    const devices = await navigator.mediaDevices.enumerateDevices();

    state.devices.audioInputs = devices.filter(d => d.kind === 'audioinput');
    state.devices.audioOutputs = devices.filter(d => d.kind === 'audiooutput');
    state.devices.videoInputs = devices.filter(d => d.kind === 'videoinput');
  } catch (error) {
    console.error('Failed to enumerate devices:', error);
  }
}

// Toggle PTT key row visibility
function togglePTTKeyRow() {
  const voiceMode = document.getElementById('voiceMode').value;
  const pttRow = document.getElementById('pttKeyRow');
  pttRow.style.display = voiceMode === 'ptt' ? 'flex' : 'none';
}

// Test microphone
let micTestStream = null;
async function testMicrophone() {
  const deviceId = document.getElementById('audioInputDevice').value;

  if (micTestStream) {
    micTestStream.getTracks().forEach(t => t.stop());
    micTestStream = null;
    showToast('Microphone test stopped', 'info');
    return;
  }

  try {
    micTestStream = await navigator.mediaDevices.getUserMedia({
      audio: deviceId ? { deviceId: { exact: deviceId } } : true
    });
    showToast('Microphone working! Speak to test. Click again to stop.', 'success');
  } catch (error) {
    showToast('Could not access microphone: ' + error.message, 'error');
  }
}

// Test camera preview
let cameraTestStream = null;
async function testCamera() {
  const deviceId = document.getElementById('cameraDevice').value;
  const container = document.getElementById('cameraPreviewContainer');
  const video = document.getElementById('cameraPreview');

  if (cameraTestStream) {
    cameraTestStream.getTracks().forEach(t => t.stop());
    cameraTestStream = null;
    video.srcObject = null;
    container.style.display = 'none';
    return;
  }

  try {
    cameraTestStream = await navigator.mediaDevices.getUserMedia({
      video: deviceId ? { deviceId: { exact: deviceId } } : true
    });
    video.srcObject = cameraTestStream;
    container.style.display = 'block';
  } catch (error) {
    showToast('Could not access camera: ' + error.message, 'error');
  }
}

async function saveSettings() {
  // Stop any test streams before saving
  if (micTestStream) {
    micTestStream.getTracks().forEach(t => t.stop());
    micTestStream = null;
  }
  if (cameraTestStream) {
    cameraTestStream.getTracks().forEach(t => t.stop());
    cameraTestStream = null;
  }

  const newSettings = {
    // Device settings
    audioInputDevice: document.getElementById('audioInputDevice').value,
    audioOutputDevice: document.getElementById('audioOutputDevice').value,
    cameraDevice: document.getElementById('cameraDevice').value,
    // Audio settings
    inputVolume: parseInt(document.getElementById('inputVolume').value),
    outputVolume: parseInt(document.getElementById('outputVolume').value),
    voiceActivated: document.getElementById('voiceMode').value === 'vad',
    pushToTalkKey: document.getElementById('pttKey').value,
    // Behavior settings
    minimizeToTray: document.getElementById('minimizeToTray').checked,
    startMinimized: document.getElementById('startMinimized').checked
  };

  state.settings = { ...state.settings, ...newSettings };

  if (window.electronAPI) {
    await window.electronAPI.saveSettings(newSettings);
  }

  // Save profile updates
  const displayName = document.getElementById('displayName').value;
  const steamId = document.getElementById('steamId').value;

  try {
    await fetch(`${state.serverUrl}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ displayName, steamId })
    });

    state.user.displayName = displayName;
    state.user.steamId = steamId;
  } catch (error) {
    console.error('Failed to update profile:', error);
  }

  closeModal();
  showToast('Settings saved', 'success');
  renderMainApp();
}

// Capture a key for PTT
function capturePTTKey() {
  const btn = document.getElementById('pttKeyBtn');
  const input = document.getElementById('pttKey');
  if (!btn) return;

  btn.textContent = 'Press any key...';
  btn.style.borderColor = 'var(--accent-primary)';

  const handler = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Use the key code (e.g., 'Space', 'KeyV', 'F1')
    const keyCode = e.code;
    btn.textContent = keyCode;
    btn.style.borderColor = 'var(--bg-light)';
    input.value = keyCode;

    document.removeEventListener('keydown', handler);
  };

  document.addEventListener('keydown', handler);
}

// ===== Admin Panel Functions =====
function openInviteModal() {
  const overlay = document.getElementById('modalOverlay');
  const modal = document.getElementById('modalContent');

  modal.innerHTML = `
    <div class="modal-header">
      <h2>Create Invite</h2>
      <button class="close-btn" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="settings-row" style="flex-direction: column; align-items: flex-start; gap: 8px;">
        <label>Email (optional)</label>
        <input type="email" id="inviteEmail" placeholder="user@example.com" style="width: 100%; padding: 10px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
        <small style="color: var(--text-muted);">Leave blank to generate a link without sending email</small>
      </div>
      <div class="settings-row" style="margin-top: 16px;">
        <label>Max Uses</label>
        <input type="number" id="inviteMaxUses" value="1" min="1" max="100" style="width: 80px; padding: 8px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
      </div>
      <div id="inviteResult" style="display: none; margin-top: 16px; padding: 12px; background: var(--bg-dark); border-radius: var(--radius-sm);">
        <label style="font-size: 12px; color: var(--text-muted);">Invite Code:</label>
        <div style="display: flex; gap: 8px; margin-top: 4px;">
          <input type="text" id="inviteCode" readonly style="flex: 1; padding: 8px; background: var(--bg-medium); border: 1px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--accent-primary); font-family: monospace;">
          <button class="btn-secondary" onclick="copyInviteCode()">Copy</button>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeModal()">Close</button>
      <button class="btn-primary" onclick="createInvite()">Generate Invite</button>
    </div>
  `;

  overlay.classList.add('active');
}

async function createInvite() {
  const email = document.getElementById('inviteEmail').value;
  const maxUses = parseInt(document.getElementById('inviteMaxUses').value) || 1;

  try {
    const response = await fetch(`${state.serverUrl}/api/admin/invites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ email: email || null, maxUses })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

    document.getElementById('inviteCode').value = result.invite?.code || result.code;
    document.getElementById('inviteResult').style.display = 'block';
    showToast('Invite created!', 'success');
  } catch (error) {
    showToast('Failed to create invite: ' + error.message, 'error');
  }
}

function copyInviteCode() {
  const code = document.getElementById('inviteCode');
  code.select();
  document.execCommand('copy');
  showToast('Invite code copied!', 'success');
}

function openCreateUserModal() {
  const overlay = document.getElementById('modalOverlay');
  const modal = document.getElementById('modalContent');

  modal.innerHTML = `
    <div class="modal-header">
      <h2>Create User</h2>
      <button class="close-btn" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="settings-row" style="flex-direction: column; align-items: flex-start; gap: 8px;">
        <label>Username</label>
        <input type="text" id="newUsername" required style="width: 100%; padding: 10px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
      </div>
      <div class="settings-row" style="flex-direction: column; align-items: flex-start; gap: 8px; margin-top: 12px;">
        <label>Email</label>
        <input type="email" id="newEmail" required style="width: 100%; padding: 10px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
      </div>
      <div class="settings-row" style="flex-direction: column; align-items: flex-start; gap: 8px; margin-top: 12px;">
        <label>Password</label>
        <input type="password" id="newPassword" required style="width: 100%; padding: 10px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
      </div>
      <div class="settings-row" style="margin-top: 12px;">
        <label>Role</label>
        <select id="newRole" style="padding: 10px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
          <option value="user">User</option>
          <option value="moderator">Moderator</option>
          <option value="admin">Admin</option>
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="createUser()">Create User</button>
    </div>
  `;

  overlay.classList.add('active');
}

async function createUser() {
  const username = document.getElementById('newUsername').value;
  const email = document.getElementById('newEmail').value;
  const password = document.getElementById('newPassword').value;
  const role = document.getElementById('newRole').value;

  if (!username || !email || !password) {
    showToast('Please fill in all fields', 'error');
    return;
  }

  try {
    const response = await fetch(`${state.serverUrl}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ username, email, password, role })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

    showToast('User created successfully!', 'success');
    closeModal();
  } catch (error) {
    showToast('Failed to create user: ' + error.message, 'error');
  }
}

async function openAdminPanel() {
  const overlay = document.getElementById('modalOverlay');
  const modal = document.getElementById('modalContent');

  modal.innerHTML = `
    <div class="modal-header">
      <h2>User Management</h2>
      <button class="close-btn" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body" style="max-height: 400px; overflow-y: auto;">
      <div id="adminUserList">Loading users...</div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeModal()">Close</button>
    </div>
  `;

  overlay.classList.add('active');

  // Load users
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/users`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    const users = data.users || [];

    const userListHtml = users.map(user => `
      <div style="display: flex; align-items: center; gap: 12px; padding: 10px; background: var(--bg-dark); border-radius: var(--radius-sm); margin-bottom: 8px;">
        <div style="width: 36px; height: 36px; border-radius: 50%; background: ${getRoleColor(user.role)}; display: flex; align-items: center; justify-content: center; font-weight: 600;">
          ${user.username.charAt(0).toUpperCase()}
        </div>
        <div style="flex: 1;">
          <div style="font-weight: 500;">${escapeHtml(user.displayName || user.username)}</div>
          <div style="font-size: 12px; color: var(--text-muted);">@${escapeHtml(user.username)} • ${user.role}</div>
        </div>
        ${user._id !== state.user._id ? `
          <select onchange="updateUserRole('${user._id}', this.value)" style="padding: 6px; background: var(--bg-medium); border: 1px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
            <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
            <option value="moderator" ${user.role === 'moderator' ? 'selected' : ''}>Moderator</option>
            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
        ` : '<span style="color: var(--text-muted); font-size: 12px;">You</span>'}
      </div>
    `).join('');

    document.getElementById('adminUserList').innerHTML = userListHtml || '<p style="color: var(--text-muted);">No users found</p>';
  } catch (error) {
    document.getElementById('adminUserList').innerHTML = `<p style="color: var(--danger);">Failed to load users: ${error.message}</p>`;
  }
}

async function updateUserRole(userId, role) {
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/users/${userId}/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ role })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

    showToast('User role updated', 'success');
  } catch (error) {
    showToast('Failed to update role: ' + error.message, 'error');
    openAdminPanel(); // Refresh the list
  }
}

// YouTube Bot Modal
async function openYouTubeBotModal() {
  const overlay = document.getElementById('modalOverlay');
  const modal = document.getElementById('modalContent');

  modal.innerHTML = `
    <div class="modal-header">
      <h2>YouTube Bot</h2>
      <button class="close-btn" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div id="youtubeBotContent">Loading...</div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeModal()">Close</button>
    </div>
  `;

  overlay.classList.add('active');

  // Load bot status
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/youtube-bot/status`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    renderYouTubeBotContent(data);
  } catch (error) {
    document.getElementById('youtubeBotContent').innerHTML = `
      <p style="color: var(--danger);">Failed to load YouTube bot status: ${error.message}</p>
      <p style="color: var(--text-muted); font-size: 12px; margin-top: 8px;">
        Make sure the server has ytdl-core installed: <code>npm install @distube/ytdl-core</code>
      </p>
    `;
  }
}

function renderYouTubeBotContent(data) {
  const { enabled, activeStreams } = data;
  const streamList = activeStreams || [];

  document.getElementById('youtubeBotContent').innerHTML = `
    <div class="settings-section" style="margin-bottom: 16px;">
      <h3>Bot Status</h3>
      <div style="display: flex; align-items: center; gap: 16px; margin-top: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: var(--text-muted);">Status:</span>
          <span style="color: ${enabled ? 'var(--success)' : 'var(--danger)'}; font-weight: 600;">
            ${enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <button class="btn-${enabled ? 'danger' : 'primary'}" onclick="toggleYouTubeBot(${!enabled})">
          ${enabled ? 'Disable Bot' : 'Enable Bot'}
        </button>
      </div>
    </div>

    ${enabled ? `
    <div class="settings-section" style="margin-bottom: 16px;">
      <h3>Play Video</h3>
      <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 12px;">
        <div style="display: flex; gap: 8px; align-items: center;">
          <label style="min-width: 80px;">Channel:</label>
          <select id="ytBotChannel" style="flex: 1; padding: 8px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
            ${state.channels.filter(c => c.type === 'voice').map(c => `
              <option value="${c._id}">${escapeHtml(c.name)}</option>
            `).join('')}
          </select>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <label style="min-width: 80px;">URL:</label>
          <input type="text" id="ytBotUrl" placeholder="YouTube video URL" style="flex: 1; padding: 8px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn-primary" onclick="playYouTubeVideo()">Play</button>
          <button class="btn-secondary" onclick="previewYouTubeVideo()">Preview Info</button>
        </div>
        <div id="ytVideoPreview" style="display: none; padding: 12px; background: var(--bg-dark); border-radius: var(--radius-sm);"></div>
      </div>
    </div>

    <div class="settings-section">
      <h3>Active Streams (${streamList.length})</h3>
      <div id="ytActiveStreams" style="margin-top: 12px;">
        ${streamList.length > 0 ? streamList.map(stream => `
          <div style="display: flex; align-items: center; gap: 12px; padding: 10px; background: var(--bg-dark); border-radius: var(--radius-sm); margin-bottom: 8px;">
            <div style="flex: 1;">
              <div style="font-weight: 500;">${escapeHtml(stream.title || 'Unknown')}</div>
              <div style="font-size: 12px; color: var(--text-muted);">
                Channel: ${escapeHtml(stream.channelName || stream.channelId)} •
                By: ${escapeHtml(stream.requestedBy || 'Unknown')}
              </div>
            </div>
            <button class="btn-danger" onclick="stopYouTubeStream('${stream.channelId}')" style="padding: 6px 12px;">Stop</button>
          </div>
        `).join('') : '<p style="color: var(--text-muted);">No active streams</p>'}
      </div>
      ${streamList.length > 0 ? `
        <button class="btn-danger" onclick="stopAllYouTubeStreams()" style="margin-top: 12px;">Stop All Streams</button>
      ` : ''}
    </div>
    ` : `
    <div style="text-align: center; padding: 24px; color: var(--text-muted);">
      <p>Enable the bot to play YouTube videos in voice channels.</p>
    </div>
    `}
  `;
}

async function toggleYouTubeBot(enabled) {
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/youtube-bot/enable`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ enabled })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

    showToast(result.message, 'success');
    openYouTubeBotModal(); // Refresh
  } catch (error) {
    showToast('Failed to toggle bot: ' + error.message, 'error');
  }
}

async function previewYouTubeVideo() {
  const url = document.getElementById('ytBotUrl').value.trim();
  if (!url) {
    showToast('Please enter a YouTube URL', 'error');
    return;
  }

  const preview = document.getElementById('ytVideoPreview');
  preview.style.display = 'block';
  preview.innerHTML = 'Loading video info...';

  try {
    const response = await fetch(`${state.serverUrl}/api/admin/youtube-bot/video-info?url=${encodeURIComponent(url)}`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    preview.innerHTML = `
      <div style="display: flex; gap: 12px;">
        ${data.thumbnail ? `<img src="${data.thumbnail}" style="width: 120px; height: 68px; border-radius: 4px; object-fit: cover;">` : ''}
        <div>
          <div style="font-weight: 600;">${escapeHtml(data.title)}</div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
            ${escapeHtml(data.author)} • ${data.duration || 'Unknown duration'}
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    preview.innerHTML = `<span style="color: var(--danger);">Failed to load: ${error.message}</span>`;
  }
}

async function playYouTubeVideo() {
  const channelId = document.getElementById('ytBotChannel').value;
  const url = document.getElementById('ytBotUrl').value.trim();

  if (!channelId) {
    showToast('Please select a channel', 'error');
    return;
  }
  if (!url) {
    showToast('Please enter a YouTube URL', 'error');
    return;
  }

  try {
    const response = await fetch(`${state.serverUrl}/api/admin/youtube-bot/play`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ channelId, url })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

    showToast(`Now playing: ${result.title || 'Video'}`, 'success');
    openYouTubeBotModal(); // Refresh
  } catch (error) {
    showToast('Failed to play video: ' + error.message, 'error');
  }
}

async function stopYouTubeStream(channelId) {
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/youtube-bot/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ channelId })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

    showToast('Playback stopped', 'success');
    openYouTubeBotModal(); // Refresh
  } catch (error) {
    showToast('Failed to stop: ' + error.message, 'error');
  }
}

async function stopAllYouTubeStreams() {
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/youtube-bot/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({})
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

    showToast('All streams stopped', 'success');
    openYouTubeBotModal(); // Refresh
  } catch (error) {
    showToast('Failed to stop streams: ' + error.message, 'error');
  }
}

// ==================== Plex Bot Modal ====================
async function openPlexBotModal() {
  const overlay = document.getElementById('modalOverlay');
  const modal = document.getElementById('modalContent');

  modal.innerHTML = `
    <div class="modal-header">
      <h2>Plex Bot</h2>
      <button class="close-btn" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div id="plexBotContent">Loading...</div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeModal()">Close</button>
    </div>
  `;

  overlay.classList.add('active');

  try {
    const response = await fetch(`${state.serverUrl}/api/admin/plex-bot/status`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    renderPlexBotContent(data);
  } catch (error) {
    document.getElementById('plexBotContent').innerHTML = `
      <p style="color: var(--danger);">Failed to load Plex bot status: ${error.message}</p>
    `;
  }
}

function renderPlexBotContent(data) {
  const { enabled, connected, activeStreams, serverInfo } = data;
  const streamList = activeStreams || [];

  document.getElementById('plexBotContent').innerHTML = `
    <div class="settings-section" style="margin-bottom: 16px;">
      <h3>Bot Status</h3>
      <div style="display: flex; align-items: center; gap: 16px; margin-top: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: var(--text-muted);">Status:</span>
          <span style="color: ${enabled ? 'var(--success)' : 'var(--danger)'}; font-weight: 600;">
            ${enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: var(--text-muted);">Plex:</span>
          <span style="color: ${connected ? 'var(--success)' : 'var(--text-muted)'}; font-weight: 600;">
            ${connected ? 'Connected' : 'Not Connected'}
          </span>
        </div>
        <button class="btn-${enabled ? 'danger' : 'primary'}" onclick="togglePlexBot(${!enabled})">
          ${enabled ? 'Disable Bot' : 'Enable Bot'}
        </button>
      </div>
    </div>

    <div class="settings-section" style="margin-bottom: 16px;">
      <h3>Plex Account</h3>
      <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 12px;">
        ${connected && serverInfo ? `
          <div style="padding: 12px; background: var(--bg-dark); border-radius: var(--radius-sm);">
            <div style="font-weight: 600;">${escapeHtml(serverInfo.name || 'Plex Server')}</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
              ${serverInfo.libraries?.length || 0} libraries available
            </div>
          </div>
          <button class="btn-danger" onclick="disconnectPlex()">Disconnect Plex</button>
        ` : `
          <div style="display: flex; gap: 8px; align-items: center;">
            <label style="min-width: 100px;">Server URL:</label>
            <input type="text" id="plexServerUrl" placeholder="http://your-plex:32400" style="flex: 1; padding: 8px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <label style="min-width: 100px;">Plex Token:</label>
            <input type="password" id="plexToken" placeholder="Your Plex token" style="flex: 1; padding: 8px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
          </div>
          <div style="font-size: 11px; color: var(--text-muted);">
            Get your token from app.plex.tv settings or use plex-token CLI tools
          </div>
          <button class="btn-primary" onclick="connectPlex()">Connect to Plex</button>
        `}
      </div>
    </div>

    ${enabled && connected ? `
    <div class="settings-section" style="margin-bottom: 16px;">
      <h3>Play Media</h3>
      <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 12px;">
        <div style="display: flex; gap: 8px; align-items: center;">
          <label style="min-width: 80px;">Channel:</label>
          <select id="plexBotChannel" style="flex: 1; padding: 8px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
            ${state.channels.filter(c => c.type === 'voice').map(c => `
              <option value="${c._id}">${escapeHtml(c.name)}</option>
            `).join('')}
          </select>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <label style="min-width: 80px;">Search:</label>
          <input type="text" id="plexSearch" placeholder="Search for music, movies..." style="flex: 1; padding: 8px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
          <button class="btn-secondary" onclick="searchPlex()">Search</button>
        </div>
        <div id="plexSearchResults" style="max-height: 200px; overflow-y: auto;"></div>
      </div>
    </div>

    <div class="settings-section">
      <h3>Active Streams (${streamList.length})</h3>
      <div id="plexActiveStreams" style="margin-top: 12px;">
        ${streamList.length > 0 ? streamList.map(stream => `
          <div style="display: flex; align-items: center; gap: 12px; padding: 10px; background: var(--bg-dark); border-radius: var(--radius-sm); margin-bottom: 8px;">
            <div style="flex: 1;">
              <div style="font-weight: 500;">${escapeHtml(stream.title || 'Unknown')}</div>
              <div style="font-size: 12px; color: var(--text-muted);">
                Channel: ${escapeHtml(stream.channelName || stream.channelId)}
              </div>
            </div>
            <button class="btn-danger" onclick="stopPlexStream('${stream.channelId}')" style="padding: 6px 12px;">Stop</button>
          </div>
        `).join('') : '<p style="color: var(--text-muted);">No active streams</p>'}
      </div>
      ${streamList.length > 0 ? `
        <button class="btn-danger" onclick="stopAllPlexStreams()" style="margin-top: 12px;">Stop All Streams</button>
      ` : ''}
    </div>
    ` : ''}
  `;
}

async function togglePlexBot(enabled) {
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/plex-bot/enable`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ enabled })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

    showToast(result.message, 'success');
    openPlexBotModal();
  } catch (error) {
    showToast('Failed to toggle Plex bot: ' + error.message, 'error');
  }
}

async function connectPlex() {
  const serverUrl = document.getElementById('plexServerUrl').value.trim();
  const token = document.getElementById('plexToken').value.trim();

  if (!serverUrl || !token) {
    showToast('Please enter server URL and token', 'error');
    return;
  }

  try {
    const response = await fetch(`${state.serverUrl}/api/admin/plex-bot/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ serverUrl, token })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

    showToast('Connected to Plex!', 'success');
    openPlexBotModal();
  } catch (error) {
    showToast('Failed to connect: ' + error.message, 'error');
  }
}

async function disconnectPlex() {
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/plex-bot/disconnect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      }
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

    showToast('Disconnected from Plex', 'success');
    openPlexBotModal();
  } catch (error) {
    showToast('Failed to disconnect: ' + error.message, 'error');
  }
}

async function searchPlex() {
  const query = document.getElementById('plexSearch').value.trim();
  if (!query) {
    showToast('Please enter a search query', 'error');
    return;
  }

  const resultsDiv = document.getElementById('plexSearchResults');
  resultsDiv.innerHTML = 'Searching...';

  try {
    const response = await fetch(`${state.serverUrl}/api/admin/plex-bot/search?query=${encodeURIComponent(query)}`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    const results = data.results || [];
    resultsDiv.innerHTML = results.length > 0 ? results.map(item => `
      <div style="display: flex; align-items: center; gap: 12px; padding: 10px; background: var(--bg-dark); border-radius: var(--radius-sm); margin-bottom: 8px; cursor: pointer;" onclick="playPlexItem('${item.ratingKey}')">
        ${item.thumb ? `<img src="${state.serverUrl}/api/admin/plex-bot/thumb?key=${encodeURIComponent(item.thumb)}" style="width: 48px; height: 48px; border-radius: 4px; object-fit: cover;">` : ''}
        <div style="flex: 1;">
          <div style="font-weight: 500;">${escapeHtml(item.title)}</div>
          <div style="font-size: 12px; color: var(--text-muted);">${escapeHtml(item.type)} ${item.year ? '(' + item.year + ')' : ''}</div>
        </div>
        <button class="btn-primary" style="padding: 6px 12px;" onclick="event.stopPropagation(); playPlexItem('${item.ratingKey}')">Play</button>
      </div>
    `).join('') : '<p style="color: var(--text-muted);">No results found</p>';
  } catch (error) {
    resultsDiv.innerHTML = `<span style="color: var(--danger);">Search failed: ${error.message}</span>`;
  }
}

async function playPlexItem(ratingKey) {
  const channelId = document.getElementById('plexBotChannel').value;

  try {
    const response = await fetch(`${state.serverUrl}/api/admin/plex-bot/play`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ channelId, ratingKey })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

    showToast(`Now playing: ${result.title || 'Media'}`, 'success');
    openPlexBotModal();
  } catch (error) {
    showToast('Failed to play: ' + error.message, 'error');
  }
}

async function stopPlexStream(channelId) {
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/plex-bot/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ channelId })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

    showToast('Playback stopped', 'success');
    openPlexBotModal();
  } catch (error) {
    showToast('Failed to stop: ' + error.message, 'error');
  }
}

async function stopAllPlexStreams() {
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/plex-bot/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({})
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

    showToast('All Plex streams stopped', 'success');
    openPlexBotModal();
  } catch (error) {
    showToast('Failed to stop streams: ' + error.message, 'error');
  }
}

// ==================== Federation Modal ====================
async function openFederationModal() {
  const overlay = document.getElementById('modalOverlay');
  const modal = document.getElementById('modalContent');

  modal.innerHTML = `
    <div class="modal-header">
      <h2>Federation</h2>
      <button class="close-btn" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body" style="max-height: 500px; overflow-y: auto;">
      <div id="federationContent">Loading...</div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeModal()">Close</button>
    </div>
  `;

  overlay.classList.add('active');

  try {
    const response = await fetch(`${state.serverUrl}/api/federation/status`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    renderFederationContent(data);
  } catch (error) {
    document.getElementById('federationContent').innerHTML = `
      <p style="color: var(--danger);">Failed to load federation status: ${error.message}</p>
    `;
  }
}

function renderFederationContent(data) {
  const { enabled, serverId, serverName, servers, pendingRequests } = data;

  document.getElementById('federationContent').innerHTML = `
    <div class="settings-section" style="margin-bottom: 16px;">
      <h3>This Server</h3>
      <div style="padding: 12px; background: var(--bg-dark); border-radius: var(--radius-sm); margin-top: 12px;">
        <div style="font-weight: 600;">${escapeHtml(serverName || 'F7Lans Server')}</div>
        <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
          ID: ${serverId || 'Unknown'}<br>
          Federation: ${enabled ? '<span style="color: var(--success);">Enabled</span>' : '<span style="color: var(--danger);">Disabled</span>'}
        </div>
      </div>
    </div>

    <div class="settings-section" style="margin-bottom: 16px;">
      <h3>Join Federation</h3>
      <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 12px;">
        <div style="display: flex; gap: 8px; align-items: center;">
          <label style="min-width: 100px;">Server URL:</label>
          <input type="text" id="federationTargetUrl" placeholder="https://other-server.com" style="flex: 1; padding: 8px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn-secondary" onclick="analyzeFederation()">Analyze</button>
          <button class="btn-primary" onclick="initiateFederation()">Connect</button>
        </div>
        <div id="federationAnalysis" style="display: none; padding: 12px; background: var(--bg-dark); border-radius: var(--radius-sm);"></div>
      </div>
    </div>

    ${pendingRequests && pendingRequests.length > 0 ? `
    <div class="settings-section" style="margin-bottom: 16px;">
      <h3>Pending Requests (${pendingRequests.length})</h3>
      <div style="margin-top: 12px;">
        ${pendingRequests.map(req => `
          <div style="display: flex; align-items: center; gap: 12px; padding: 10px; background: var(--bg-dark); border-radius: var(--radius-sm); margin-bottom: 8px;">
            <div style="flex: 1;">
              <div style="font-weight: 500;">${escapeHtml(req.fromServer?.name || 'Unknown Server')}</div>
              <div style="font-size: 12px; color: var(--text-muted);">
                ${escapeHtml(req.fromServer?.url || '')}
              </div>
            </div>
            <button class="btn-primary" onclick="approveFederationRequest('${req._id}')" style="padding: 6px 12px;">Approve</button>
            <button class="btn-danger" onclick="rejectFederationRequest('${req._id}')" style="padding: 6px 12px;">Reject</button>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <div class="settings-section">
      <h3>Connected Servers (${servers?.filter(s => s.status === 'active').length || 0})</h3>
      <div style="margin-top: 12px;">
        ${servers && servers.length > 0 ? servers.map(server => `
          <div style="display: flex; align-items: center; gap: 12px; padding: 10px; background: var(--bg-dark); border-radius: var(--radius-sm); margin-bottom: 8px;">
            <div style="width: 10px; height: 10px; border-radius: 50%; background: ${server.status === 'active' ? 'var(--success)' : 'var(--danger)'};"></div>
            <div style="flex: 1;">
              <div style="font-weight: 500;">${escapeHtml(server.name)}</div>
              <div style="font-size: 12px; color: var(--text-muted);">
                ${escapeHtml(server.url)} • ${server.status}
              </div>
            </div>
            <button class="btn-danger" onclick="removeFederatedServer('${server.serverId}')" style="padding: 6px 12px;">Remove</button>
          </div>
        `).join('') : '<p style="color: var(--text-muted);">No federated servers</p>'}
      </div>
    </div>
  `;
}

async function analyzeFederation() {
  const targetUrl = document.getElementById('federationTargetUrl').value.trim();
  if (!targetUrl) {
    showToast('Please enter a server URL', 'error');
    return;
  }

  const analysisDiv = document.getElementById('federationAnalysis');
  analysisDiv.style.display = 'block';
  analysisDiv.innerHTML = 'Analyzing...';

  try {
    const response = await fetch(`${state.serverUrl}/api/federation/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ targetUrl })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    analysisDiv.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 8px;">Server: ${escapeHtml(data.targetServer?.name || 'Unknown')}</div>
      <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">
        Users: ${data.targetServer?.stats?.userCount || 0} •
        Channels: ${data.targetServer?.stats?.channelCount || 0}
      </div>
      ${data.hasConflicts ? `
        <div style="color: var(--warning); font-size: 12px;">
          ${data.conflicts.length} channel name conflict(s) detected
        </div>
      ` : `
        <div style="color: var(--success); font-size: 12px;">No conflicts detected</div>
      `}
    `;
  } catch (error) {
    analysisDiv.innerHTML = `<span style="color: var(--danger);">Analysis failed: ${error.message}</span>`;
  }
}

async function initiateFederation() {
  const targetUrl = document.getElementById('federationTargetUrl').value.trim();
  if (!targetUrl) {
    showToast('Please enter a server URL', 'error');
    return;
  }

  try {
    const response = await fetch(`${state.serverUrl}/api/federation/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ targetUrl })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

    showToast(result.message || 'Federation request sent!', 'success');
    openFederationModal();
  } catch (error) {
    showToast('Federation failed: ' + error.message, 'error');
  }
}

async function approveFederationRequest(requestId) {
  try {
    const response = await fetch(`${state.serverUrl}/api/federation/requests/${requestId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      }
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

    showToast('Federation approved!', 'success');
    openFederationModal();
  } catch (error) {
    showToast('Failed to approve: ' + error.message, 'error');
  }
}

async function rejectFederationRequest(requestId) {
  try {
    const response = await fetch(`${state.serverUrl}/api/federation/requests/${requestId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ reason: 'Rejected by admin' })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

    showToast('Federation request rejected', 'info');
    openFederationModal();
  } catch (error) {
    showToast('Failed to reject: ' + error.message, 'error');
  }
}

async function removeFederatedServer(serverId) {
  if (!confirm('Are you sure you want to remove this federated server?')) return;

  try {
    const response = await fetch(`${state.serverUrl}/api/federation/servers/${serverId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

    showToast('Server removed from federation', 'success');
    openFederationModal();
  } catch (error) {
    showToast('Failed to remove server: ' + error.message, 'error');
  }
}

// ==================== Kick User Function ====================
async function kickUserFromChannel(userId, channelId) {
  if (!confirm('Are you sure you want to kick this user from the channel?')) return;

  try {
    const response = await fetch(`${state.serverUrl}/api/channels/${channelId}/kick/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      }
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

    showToast('User kicked from channel', 'success');
  } catch (error) {
    showToast('Failed to kick user: ' + error.message, 'error');
  }
}

// ==================== Emby Bot Modal ====================
async function openEmbyBotModal() {
  const overlay = document.getElementById('modalOverlay');
  const modal = document.getElementById('modalContent');

  modal.innerHTML = `
    <div class="modal-header">
      <h2>Emby Bot</h2>
      <button class="close-btn" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div id="embyBotContent">Loading...</div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeModal()">Close</button>
    </div>
  `;

  overlay.classList.add('active');

  try {
    const response = await fetch(`${state.serverUrl}/api/admin/emby-bot/status`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    renderMediaBotContent('emby', data);
  } catch (error) {
    document.getElementById('embyBotContent').innerHTML = `<p style="color: var(--danger);">Failed to load: ${error.message}</p>`;
  }
}

// ==================== Jellyfin Bot Modal ====================
async function openJellyfinBotModal() {
  const overlay = document.getElementById('modalOverlay');
  const modal = document.getElementById('modalContent');

  modal.innerHTML = `
    <div class="modal-header">
      <h2>Jellyfin Bot</h2>
      <button class="close-btn" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div id="jellyfinBotContent">Loading...</div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeModal()">Close</button>
    </div>
  `;

  overlay.classList.add('active');

  try {
    const response = await fetch(`${state.serverUrl}/api/admin/jellyfin-bot/status`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    renderMediaBotContent('jellyfin', data);
  } catch (error) {
    document.getElementById('jellyfinBotContent').innerHTML = `<p style="color: var(--danger);">Failed to load: ${error.message}</p>`;
  }
}

// Generic media bot content renderer (Emby/Jellyfin)
function renderMediaBotContent(botType, data) {
  const { enabled, connected, serverInfo, activeStreams } = data;
  const streamList = activeStreams || [];
  const contentId = `${botType}BotContent`;

  document.getElementById(contentId).innerHTML = `
    <div class="settings-section" style="margin-bottom: 16px;">
      <h3>Bot Status</h3>
      <div style="display: flex; align-items: center; gap: 16px; margin-top: 12px;">
        <span style="color: ${enabled ? 'var(--success)' : 'var(--danger)'}; font-weight: 600;">${enabled ? 'Enabled' : 'Disabled'}</span>
        <span style="color: ${connected ? 'var(--success)' : 'var(--text-muted)'};">${connected ? 'Connected' : 'Not Connected'}</span>
        <button class="btn-${enabled ? 'danger' : 'primary'}" onclick="toggleMediaBot('${botType}', ${!enabled})">${enabled ? 'Disable' : 'Enable'}</button>
      </div>
    </div>

    <div class="settings-section" style="margin-bottom: 16px;">
      <h3>Server Connection</h3>
      ${connected && serverInfo ? `
        <div style="padding: 12px; background: var(--bg-dark); border-radius: var(--radius-sm); margin-top: 12px;">
          <div style="font-weight: 600;">${escapeHtml(serverInfo.name || 'Server')}</div>
          <div style="font-size: 12px; color: var(--text-muted);">Version: ${serverInfo.version || 'Unknown'}</div>
        </div>
        <button class="btn-danger" onclick="disconnectMediaBot('${botType}')" style="margin-top: 8px;">Disconnect</button>
      ` : `
        <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 12px;">
          <input type="text" id="${botType}ServerUrl" placeholder="Server URL (http://server:port)" style="padding: 8px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
          <input type="password" id="${botType}ApiKey" placeholder="API Key" style="padding: 8px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
          <button class="btn-primary" onclick="connectMediaBot('${botType}')">Connect</button>
        </div>
      `}
    </div>

    ${enabled && connected ? `
    <div class="settings-section" style="margin-bottom: 16px;">
      <h3>Play Media</h3>
      <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 12px;">
        <select id="${botType}Channel" style="padding: 8px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
          ${state.channels.filter(c => c.type === 'voice').map(c => `<option value="${c._id}">${escapeHtml(c.name)}</option>`).join('')}
        </select>
        <div style="display: flex; gap: 8px;">
          <input type="text" id="${botType}Search" placeholder="Search..." style="flex: 1; padding: 8px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
          <button class="btn-secondary" onclick="searchMediaBot('${botType}')">Search</button>
        </div>
        <div id="${botType}Results" style="max-height: 200px; overflow-y: auto;"></div>
      </div>
    </div>

    <div class="settings-section">
      <h3>Active Streams (${streamList.length})</h3>
      <div style="margin-top: 12px;">
        ${streamList.length > 0 ? streamList.map(s => `
          <div style="display: flex; align-items: center; gap: 12px; padding: 10px; background: var(--bg-dark); border-radius: var(--radius-sm); margin-bottom: 8px;">
            <div style="flex: 1;">
              <div style="font-weight: 500;">${escapeHtml(s.title || 'Unknown')}</div>
            </div>
            <button class="btn-danger" onclick="stopMediaBot('${botType}', '${s.channelId}')" style="padding: 6px 12px;">Stop</button>
          </div>
        `).join('') : '<p style="color: var(--text-muted);">No active streams</p>'}
      </div>
    </div>
    ` : ''}
  `;
}

async function toggleMediaBot(botType, enabled) {
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/${botType}-bot/enable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
      body: JSON.stringify({ enabled })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    showToast(result.message, 'success');
    if (botType === 'emby') openEmbyBotModal();
    else if (botType === 'jellyfin') openJellyfinBotModal();
  } catch (error) {
    showToast('Failed: ' + error.message, 'error');
  }
}

async function connectMediaBot(botType) {
  const serverUrl = document.getElementById(`${botType}ServerUrl`).value.trim();
  const apiKey = document.getElementById(`${botType}ApiKey`).value.trim();
  if (!serverUrl || !apiKey) { showToast('Please enter server URL and API key', 'error'); return; }
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/${botType}-bot/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
      body: JSON.stringify({ serverUrl, apiKey })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    showToast('Connected!', 'success');
    if (botType === 'emby') openEmbyBotModal();
    else if (botType === 'jellyfin') openJellyfinBotModal();
  } catch (error) {
    showToast('Failed: ' + error.message, 'error');
  }
}

async function disconnectMediaBot(botType) {
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/${botType}-bot/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` }
    });
    if (!response.ok) throw new Error((await response.json()).error);
    showToast('Disconnected', 'success');
    if (botType === 'emby') openEmbyBotModal();
    else if (botType === 'jellyfin') openJellyfinBotModal();
  } catch (error) {
    showToast('Failed: ' + error.message, 'error');
  }
}

async function searchMediaBot(botType) {
  const query = document.getElementById(`${botType}Search`).value.trim();
  if (!query) { showToast('Enter a search term', 'error'); return; }
  const resultsDiv = document.getElementById(`${botType}Results`);
  resultsDiv.innerHTML = 'Searching...';
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/${botType}-bot/search?query=${encodeURIComponent(query)}`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    resultsDiv.innerHTML = data.results?.length > 0 ? data.results.map(item => `
      <div style="display: flex; align-items: center; gap: 12px; padding: 10px; background: var(--bg-dark); border-radius: var(--radius-sm); margin-bottom: 8px;">
        <div style="flex: 1;"><div style="font-weight: 500;">${escapeHtml(item.title)}</div><div style="font-size: 12px; color: var(--text-muted);">${item.type}</div></div>
        <button class="btn-primary" onclick="playMediaBot('${botType}', '${item.itemId}')" style="padding: 6px 12px;">Play</button>
      </div>
    `).join('') : '<p style="color: var(--text-muted);">No results</p>';
  } catch (error) {
    resultsDiv.innerHTML = `<span style="color: var(--danger);">${error.message}</span>`;
  }
}

async function playMediaBot(botType, itemId) {
  const channelId = document.getElementById(`${botType}Channel`).value;
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/${botType}-bot/play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
      body: JSON.stringify({ channelId, itemId })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    showToast(`Playing: ${result.title || 'Media'}`, 'success');
    if (botType === 'emby') openEmbyBotModal();
    else if (botType === 'jellyfin') openJellyfinBotModal();
  } catch (error) {
    showToast('Failed: ' + error.message, 'error');
  }
}

async function stopMediaBot(botType, channelId) {
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/${botType}-bot/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
      body: JSON.stringify({ channelId })
    });
    if (!response.ok) throw new Error((await response.json()).error);
    showToast('Stopped', 'success');
    if (botType === 'emby') openEmbyBotModal();
    else if (botType === 'jellyfin') openJellyfinBotModal();
  } catch (error) {
    showToast('Failed: ' + error.message, 'error');
  }
}

// ==================== Chrome Bot Modal ====================
async function openChromeBotModal() {
  const overlay = document.getElementById('modalOverlay');
  const modal = document.getElementById('modalContent');

  modal.innerHTML = `
    <div class="modal-header">
      <h2>Chrome Bot (Shared Browser)</h2>
      <button class="close-btn" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div id="chromeBotContent">Loading...</div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeModal()">Close</button>
    </div>
  `;

  overlay.classList.add('active');

  try {
    const response = await fetch(`${state.serverUrl}/api/admin/chrome-bot/status`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    renderChromeBotContent(data);
  } catch (error) {
    document.getElementById('chromeBotContent').innerHTML = `<p style="color: var(--danger);">Failed to load: ${error.message}</p>`;
  }
}

function renderChromeBotContent(data) {
  const { enabled, activeSessions } = data;
  document.getElementById('chromeBotContent').innerHTML = `
    <div class="settings-section" style="margin-bottom: 16px;">
      <h3>Bot Status</h3>
      <div style="display: flex; align-items: center; gap: 16px; margin-top: 12px;">
        <span style="color: ${enabled ? 'var(--success)' : 'var(--danger)'}; font-weight: 600;">${enabled ? 'Enabled' : 'Disabled'}</span>
        <button class="btn-${enabled ? 'danger' : 'primary'}" onclick="toggleChromeBot(${!enabled})">${enabled ? 'Disable' : 'Enable'}</button>
      </div>
      <p style="color: var(--text-muted); font-size: 12px; margin-top: 8px;">Allows users to share a browser session that everyone in the channel can view and control.</p>
    </div>

    ${enabled ? `
    <div class="settings-section" style="margin-bottom: 16px;">
      <h3>Start Session</h3>
      <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 12px;">
        <select id="chromeChannel" style="padding: 8px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
          ${state.channels.filter(c => c.type === 'voice').map(c => `<option value="${c._id}">${escapeHtml(c.name)}</option>`).join('')}
        </select>
        <input type="text" id="chromeStartUrl" value="https://google.com" placeholder="Starting URL" style="padding: 8px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
        <button class="btn-primary" onclick="startChromeSession()">Start Browser Session</button>
      </div>
    </div>

    <div class="settings-section">
      <h3>Active Sessions (${activeSessions?.length || 0})</h3>
      <div style="margin-top: 12px;">
        ${activeSessions?.length > 0 ? activeSessions.map(s => `
          <div style="display: flex; align-items: center; gap: 12px; padding: 10px; background: var(--bg-dark); border-radius: var(--radius-sm); margin-bottom: 8px;">
            <div style="flex: 1;">
              <div style="font-weight: 500; word-break: break-all;">${escapeHtml(s.url)}</div>
              <div style="font-size: 12px; color: var(--text-muted);">${s.participantCount} participants • Controller: ${escapeHtml(s.controller)}</div>
            </div>
            <button class="btn-danger" onclick="stopChromeSession('${s.channelId}')" style="padding: 6px 12px;">Stop</button>
          </div>
        `).join('') : '<p style="color: var(--text-muted);">No active sessions</p>'}
      </div>
    </div>
    ` : ''}
  `;
}

async function toggleChromeBot(enabled) {
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/chrome-bot/enable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
      body: JSON.stringify({ enabled })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    showToast(result.message, 'success');
    openChromeBotModal();
  } catch (error) {
    showToast('Failed: ' + error.message, 'error');
  }
}

async function startChromeSession() {
  const channelId = document.getElementById('chromeChannel').value;
  const url = document.getElementById('chromeStartUrl').value.trim();
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/chrome-bot/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
      body: JSON.stringify({ channelId, url })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    showToast('Browser session started', 'success');
    openChromeBotModal();
  } catch (error) {
    showToast('Failed: ' + error.message, 'error');
  }
}

async function stopChromeSession(channelId) {
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/chrome-bot/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
      body: JSON.stringify({ channelId })
    });
    if (!response.ok) throw new Error((await response.json()).error);
    showToast('Session stopped', 'success');
    openChromeBotModal();
  } catch (error) {
    showToast('Failed: ' + error.message, 'error');
  }
}

// ==================== IPTV Bot Modal ====================
async function openIPTVBotModal() {
  const overlay = document.getElementById('modalOverlay');
  const modal = document.getElementById('modalContent');

  modal.innerHTML = `
    <div class="modal-header">
      <h2>IPTV Bot</h2>
      <button class="close-btn" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body" style="max-height: 500px; overflow-y: auto;">
      <div id="iptvBotContent">Loading...</div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeModal()">Close</button>
    </div>
  `;

  overlay.classList.add('active');

  try {
    const response = await fetch(`${state.serverUrl}/api/admin/iptv-bot/status`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    renderIPTVBotContent(data);
  } catch (error) {
    document.getElementById('iptvBotContent').innerHTML = `<p style="color: var(--danger);">Failed to load: ${error.message}</p>`;
  }
}

function renderIPTVBotContent(data) {
  const { enabled, configured, channelCount, groupCount, hasEPG, activeStreams, scheduledRecordingsCount } = data;
  document.getElementById('iptvBotContent').innerHTML = `
    <div class="settings-section" style="margin-bottom: 16px;">
      <h3>Bot Status</h3>
      <div style="display: flex; align-items: center; gap: 16px; margin-top: 12px;">
        <span style="color: ${enabled ? 'var(--success)' : 'var(--danger)'}; font-weight: 600;">${enabled ? 'Enabled' : 'Disabled'}</span>
        <span style="color: ${configured ? 'var(--success)' : 'var(--text-muted)'};">${configured ? `${channelCount} channels` : 'Not Configured'}</span>
        <button class="btn-${enabled ? 'danger' : 'primary'}" onclick="toggleIPTVBot(${!enabled})">${enabled ? 'Disable' : 'Enable'}</button>
      </div>
    </div>

    <div class="settings-section" style="margin-bottom: 16px;">
      <h3>Configure IPTV</h3>
      <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 12px;">
        <input type="text" id="iptvPlaylistUrl" placeholder="M3U Playlist URL" style="padding: 8px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
        <input type="text" id="iptvEpgUrl" placeholder="EPG/XMLTV URL (optional)" style="padding: 8px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
        <button class="btn-primary" onclick="configureIPTV()">Load Playlist</button>
      </div>
    </div>

    ${enabled && configured ? `
    <div class="settings-section" style="margin-bottom: 16px;">
      <h3>Watch TV</h3>
      <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 12px;">
        <select id="iptvVoiceChannel" style="padding: 8px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
          ${state.channels.filter(c => c.type === 'voice').map(c => `<option value="${c._id}">${escapeHtml(c.name)}</option>`).join('')}
        </select>
        <button class="btn-secondary" onclick="loadIPTVChannels()">Load Channel Guide</button>
        <div id="iptvChannelList" style="max-height: 200px; overflow-y: auto;"></div>
      </div>
    </div>

    <div class="settings-section">
      <h3>Active Streams (${activeStreams?.length || 0})</h3>
      <div style="margin-top: 12px;">
        ${activeStreams?.length > 0 ? activeStreams.map(s => `
          <div style="display: flex; align-items: center; gap: 12px; padding: 10px; background: var(--bg-dark); border-radius: var(--radius-sm); margin-bottom: 8px;">
            <div style="flex: 1;">
              <div style="font-weight: 500;">${escapeHtml(s.iptvChannel)}</div>
              ${s.currentProgram ? `<div style="font-size: 12px; color: var(--text-muted);">Now: ${escapeHtml(s.currentProgram)}</div>` : ''}
            </div>
            <button class="btn-danger" onclick="stopIPTV('${s.channelId}')" style="padding: 6px 12px;">Stop</button>
          </div>
        `).join('') : '<p style="color: var(--text-muted);">No active streams</p>'}
      </div>
    </div>

    <div class="settings-section" style="margin-top: 16px;">
      <h3>Scheduled Recordings (${scheduledRecordingsCount || 0})</h3>
      <button class="btn-secondary" onclick="loadIPTVRecordings()" style="margin-top: 8px;">View Recordings</button>
      <div id="iptvRecordings" style="margin-top: 12px;"></div>
    </div>
    ` : ''}
  `;
}

async function toggleIPTVBot(enabled) {
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/iptv-bot/enable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
      body: JSON.stringify({ enabled })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    showToast(result.message, 'success');
    openIPTVBotModal();
  } catch (error) {
    showToast('Failed: ' + error.message, 'error');
  }
}

async function configureIPTV() {
  const playlistUrl = document.getElementById('iptvPlaylistUrl').value.trim();
  const epgUrl = document.getElementById('iptvEpgUrl').value.trim();
  if (!playlistUrl) { showToast('Playlist URL required', 'error'); return; }
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/iptv-bot/configure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
      body: JSON.stringify({ playlistUrl, epgUrl: epgUrl || undefined })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    showToast(`Loaded ${result.channelCount} channels`, 'success');
    openIPTVBotModal();
  } catch (error) {
    showToast('Failed: ' + error.message, 'error');
  }
}

async function loadIPTVChannels() {
  const listDiv = document.getElementById('iptvChannelList');
  listDiv.innerHTML = 'Loading...';
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/iptv-bot/channels`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    listDiv.innerHTML = data.channels?.length > 0 ? data.channels.slice(0, 50).map(ch => `
      <div style="display: flex; align-items: center; gap: 12px; padding: 8px; background: var(--bg-dark); border-radius: var(--radius-sm); margin-bottom: 4px;">
        ${ch.logo ? `<img src="${ch.logo}" style="width: 32px; height: 32px; border-radius: 4px; object-fit: cover;">` : ''}
        <div style="flex: 1;"><div style="font-weight: 500;">${escapeHtml(ch.name)}</div><div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(ch.group)}</div></div>
        <button class="btn-primary" onclick="playIPTV('${ch.id}')" style="padding: 4px 8px; font-size: 12px;">Watch</button>
      </div>
    `).join('') : '<p style="color: var(--text-muted);">No channels</p>';
  } catch (error) {
    listDiv.innerHTML = `<span style="color: var(--danger);">${error.message}</span>`;
  }
}

async function playIPTV(iptvChannelId) {
  const voiceChannelId = document.getElementById('iptvVoiceChannel').value;
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/iptv-bot/play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
      body: JSON.stringify({ voiceChannelId, iptvChannelId })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    showToast(`Now watching: ${result.channel}`, 'success');
    openIPTVBotModal();
  } catch (error) {
    showToast('Failed: ' + error.message, 'error');
  }
}

async function stopIPTV(voiceChannelId) {
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/iptv-bot/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
      body: JSON.stringify({ voiceChannelId })
    });
    if (!response.ok) throw new Error((await response.json()).error);
    showToast('Stopped', 'success');
    openIPTVBotModal();
  } catch (error) {
    showToast('Failed: ' + error.message, 'error');
  }
}

async function loadIPTVRecordings() {
  const div = document.getElementById('iptvRecordings');
  div.innerHTML = 'Loading...';
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/iptv-bot/recordings`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    const all = [...(data.scheduled || []), ...(data.recordings || [])];
    div.innerHTML = all.length > 0 ? all.map(r => `
      <div style="padding: 8px; background: var(--bg-dark); border-radius: var(--radius-sm); margin-bottom: 4px;">
        <div style="font-weight: 500;">${escapeHtml(r.programTitle)}</div>
        <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(r.channelName)} • ${r.status}</div>
      </div>
    `).join('') : '<p style="color: var(--text-muted);">No recordings</p>';
  } catch (error) {
    div.innerHTML = `<span style="color: var(--danger);">${error.message}</span>`;
  }
}

// ==================== Spotify Bot Modal ====================
async function openSpotifyBotModal() {
  const overlay = document.getElementById('modalOverlay');
  const modal = document.getElementById('modalContent');

  modal.innerHTML = `
    <div class="modal-header">
      <h2>Spotify Bot</h2>
      <button class="close-btn" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body" style="max-height: 500px; overflow-y: auto;">
      <div id="spotifyBotContent">Loading...</div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeModal()">Close</button>
    </div>
  `;

  overlay.classList.add('active');

  try {
    const response = await fetch(`${state.serverUrl}/api/admin/spotify-bot/status`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    renderSpotifyBotContent(data);
  } catch (error) {
    document.getElementById('spotifyBotContent').innerHTML = `<p style="color: var(--danger);">Failed to load: ${error.message}</p>`;
  }
}

function renderSpotifyBotContent(data) {
  const { enabled, configured, connected, user, activeStreams } = data;
  document.getElementById('spotifyBotContent').innerHTML = `
    <div class="settings-section" style="margin-bottom: 16px;">
      <h3>Bot Status</h3>
      <div style="display: flex; align-items: center; gap: 16px; margin-top: 12px;">
        <span style="color: ${enabled ? 'var(--success)' : 'var(--danger)'}; font-weight: 600;">${enabled ? 'Enabled' : 'Disabled'}</span>
        <span style="color: ${connected ? 'var(--success)' : 'var(--text-muted)'};">${connected ? 'Connected' : 'Not Connected'}</span>
        <button class="btn-${enabled ? 'danger' : 'primary'}" onclick="toggleSpotifyBot(${!enabled})">${enabled ? 'Disable' : 'Enable'}</button>
      </div>
    </div>

    <div class="settings-section" style="margin-bottom: 16px;">
      <h3>Spotify Account</h3>
      ${connected && user ? `
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-dark); border-radius: var(--radius-sm); margin-top: 12px;">
          ${user.image ? `<img src="${user.image}" style="width: 48px; height: 48px; border-radius: 50%;">` : ''}
          <div>
            <div style="font-weight: 600;">${escapeHtml(user.name || 'Spotify User')}</div>
            <div style="font-size: 12px; color: var(--text-muted);">${user.premium ? 'Premium' : 'Free'} Account</div>
          </div>
        </div>
        <button class="btn-danger" onclick="disconnectSpotify()" style="margin-top: 8px;">Disconnect</button>
      ` : !configured ? `
        <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 12px;">
          <p style="color: var(--text-muted); font-size: 12px;">Enter your Spotify API credentials from developer.spotify.com</p>
          <input type="text" id="spotifyClientId" placeholder="Client ID" style="padding: 8px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
          <input type="password" id="spotifyClientSecret" placeholder="Client Secret" style="padding: 8px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
          <button class="btn-primary" onclick="configureSpotify()">Configure</button>
        </div>
      ` : `
        <div style="margin-top: 12px;">
          <p style="color: var(--text-muted); font-size: 12px; margin-bottom: 8px;">Click below to authorize with Spotify</p>
          <button class="btn-primary" onclick="authorizeSpotify()">Connect to Spotify</button>
        </div>
      `}
    </div>

    ${enabled && connected ? `
    <div class="settings-section" style="margin-bottom: 16px;">
      <h3>Play Music</h3>
      <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 12px;">
        <select id="spotifyChannel" style="padding: 8px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
          ${state.channels.filter(c => c.type === 'voice').map(c => `<option value="${c._id}">${escapeHtml(c.name)}</option>`).join('')}
        </select>
        <div style="display: flex; gap: 8px;">
          <input type="text" id="spotifySearch" placeholder="Search tracks, albums, playlists..." style="flex: 1; padding: 8px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
          <button class="btn-secondary" onclick="searchSpotify()">Search</button>
        </div>
        <div id="spotifyResults" style="max-height: 200px; overflow-y: auto;"></div>
      </div>
    </div>

    <div class="settings-section">
      <h3>Active Streams (${activeStreams?.length || 0})</h3>
      <div style="margin-top: 12px;">
        ${activeStreams?.length > 0 ? activeStreams.map(s => `
          <div style="display: flex; align-items: center; gap: 12px; padding: 10px; background: var(--bg-dark); border-radius: var(--radius-sm); margin-bottom: 8px;">
            <div style="flex: 1;">
              <div style="font-weight: 500;">${escapeHtml(s.track || 'Unknown')}</div>
              <div style="font-size: 12px; color: var(--text-muted);">${escapeHtml(s.artist || '')} • Queue: ${s.queueLength || 0}</div>
            </div>
            <button class="btn-secondary" onclick="skipSpotify('${s.channelId}')" style="padding: 6px 12px;">Skip</button>
            <button class="btn-danger" onclick="stopSpotify('${s.channelId}')" style="padding: 6px 12px;">Stop</button>
          </div>
        `).join('') : '<p style="color: var(--text-muted);">No active streams</p>'}
      </div>
    </div>
    ` : ''}
  `;
}

async function toggleSpotifyBot(enabled) {
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/spotify-bot/enable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
      body: JSON.stringify({ enabled })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    showToast(result.message, 'success');
    openSpotifyBotModal();
  } catch (error) {
    showToast('Failed: ' + error.message, 'error');
  }
}

async function configureSpotify() {
  const clientId = document.getElementById('spotifyClientId').value.trim();
  const clientSecret = document.getElementById('spotifyClientSecret').value.trim();
  if (!clientId || !clientSecret) { showToast('Enter client ID and secret', 'error'); return; }
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/spotify-bot/configure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
      body: JSON.stringify({ clientId, clientSecret })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    showToast('Configured! Now connect to Spotify.', 'success');
    openSpotifyBotModal();
  } catch (error) {
    showToast('Failed: ' + error.message, 'error');
  }
}

async function authorizeSpotify() {
  const redirectUri = `${state.serverUrl}/api/admin/spotify-bot/callback`;
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/spotify-bot/auth-url?redirectUri=${encodeURIComponent(redirectUri)}`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    window.open(data.url, '_blank', 'width=500,height=700');
  } catch (error) {
    showToast('Failed: ' + error.message, 'error');
  }
}

async function disconnectSpotify() {
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/spotify-bot/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` }
    });
    if (!response.ok) throw new Error((await response.json()).error);
    showToast('Disconnected', 'success');
    openSpotifyBotModal();
  } catch (error) {
    showToast('Failed: ' + error.message, 'error');
  }
}

async function searchSpotify() {
  const query = document.getElementById('spotifySearch').value.trim();
  if (!query) { showToast('Enter search term', 'error'); return; }
  const div = document.getElementById('spotifyResults');
  div.innerHTML = 'Searching...';
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/spotify-bot/search?query=${encodeURIComponent(query)}`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    div.innerHTML = data.results?.length > 0 ? data.results.filter(r => r.type === 'track').slice(0, 10).map(track => `
      <div style="display: flex; align-items: center; gap: 12px; padding: 8px; background: var(--bg-dark); border-radius: var(--radius-sm); margin-bottom: 4px;">
        ${track.image ? `<img src="${track.image}" style="width: 40px; height: 40px; border-radius: 4px;">` : ''}
        <div style="flex: 1;"><div style="font-weight: 500;">${escapeHtml(track.name)}</div><div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(track.artist)}</div></div>
        <button class="btn-primary" onclick="playSpotify('${track.uri}')" style="padding: 4px 8px; font-size: 12px;">Play</button>
        <button class="btn-secondary" onclick="queueSpotify('${track.uri}')" style="padding: 4px 8px; font-size: 12px;">Queue</button>
      </div>
    `).join('') : '<p style="color: var(--text-muted);">No results</p>';
  } catch (error) {
    div.innerHTML = `<span style="color: var(--danger);">${error.message}</span>`;
  }
}

async function playSpotify(uri) {
  const channelId = document.getElementById('spotifyChannel').value;
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/spotify-bot/play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
      body: JSON.stringify({ channelId, uri })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    showToast(`Playing: ${result.name || 'Track'}`, 'success');
    openSpotifyBotModal();
  } catch (error) {
    showToast('Failed: ' + error.message, 'error');
  }
}

async function queueSpotify(uri) {
  const channelId = document.getElementById('spotifyChannel').value;
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/spotify-bot/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
      body: JSON.stringify({ channelId, uri })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    showToast(`Added to queue: ${result.name || 'Track'}`, 'success');
  } catch (error) {
    showToast('Failed: ' + error.message, 'error');
  }
}

async function skipSpotify(channelId) {
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/spotify-bot/skip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
      body: JSON.stringify({ channelId })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    showToast('Skipped', 'success');
    openSpotifyBotModal();
  } catch (error) {
    showToast('Failed: ' + error.message, 'error');
  }
}

async function stopSpotify(channelId) {
  try {
    const response = await fetch(`${state.serverUrl}/api/admin/spotify-bot/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
      body: JSON.stringify({ channelId })
    });
    if (!response.ok) throw new Error((await response.json()).error);
    showToast('Stopped', 'success');
    openSpotifyBotModal();
  } catch (error) {
    showToast('Failed: ' + error.message, 'error');
  }
}

function getRoleColor(role) {
  switch (role) {
    case 'superadmin': return 'var(--accent-primary)';
    case 'admin': return '#ff6b6b';
    case 'moderator': return '#6bff6b';
    default: return 'var(--bg-lighter)';
  }
}

function closeModal() {
  // Stop any test streams
  if (micTestStream) {
    micTestStream.getTracks().forEach(t => t.stop());
    micTestStream = null;
  }
  if (cameraTestStream) {
    cameraTestStream.getTracks().forEach(t => t.stop());
    cameraTestStream = null;
  }
  document.getElementById('modalOverlay').classList.remove('active');
}

function disconnect() {
  if (state.socket) {
    state.socket.disconnect();
  }

  if (window.electronAPI) {
    window.electronAPI.clearToken();
  }

  state.user = null;
  state.token = null;
  state.socket = null;

  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('connectionScreen').style.display = 'flex';

  closeModal();
}

// Utility functions
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</div>
    <span class="toast-message">${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function scrollToBottom() {
  const container = document.getElementById('messagesArea');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(date) {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  if (isToday) return `Today at ${time}`;
  return date.toLocaleDateString() + ` at ${time}`;
}

function getAvatarColor(name) {
  const colors = [
    'linear-gradient(135deg, #ff8c00, #ff6b00)',
    'linear-gradient(135deg, #ff6b6b, #ff8e53)',
    'linear-gradient(135deg, #4ecdc4, #44a08d)',
    'linear-gradient(135deg, #667eea, #764ba2)',
    'linear-gradient(135deg, #4facfe, #00f2fe)'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getRoleColor(role) {
  switch (role) {
    case 'superadmin': return '#ff8c00';
    case 'admin': return '#ff6b6b';
    default: return '#ffffff';
  }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
