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
  settings: {}
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
    state.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true
      }
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
  state.isCameraOn = !state.isCameraOn;

  if (state.socket && state.inVoice) {
    state.socket.emit('camera:toggle', state.isCameraOn);
  }

  updateVoiceUI();
}

async function toggleScreenShare() {
  if (!state.isScreenSharing) {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1920, height: 1080, frameRate: 30 },
        audio: true
      });

      state.isScreenSharing = true;

      stream.getVideoTracks()[0].onended = () => {
        state.isScreenSharing = false;
        if (state.socket) state.socket.emit('screen:stop');
        updateVoiceUI();
      };

      if (state.socket) state.socket.emit('screen:start');
      showToast('Screen sharing started', 'success');
    } catch (error) {
      if (error.name !== 'AbortError') {
        showToast('Could not share screen', 'error');
      }
    }
  } else {
    state.isScreenSharing = false;
    if (state.socket) state.socket.emit('screen:stop');
    showToast('Screen sharing stopped', 'success');
  }

  updateVoiceUI();
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
function openSettings() {
  const modal = document.getElementById('modalOverlay');
  const content = document.getElementById('modalContent');

  content.innerHTML = `
    <div class="modal-header">
      <h2>Settings</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="settings-section">
        <h3>Audio</h3>
        <div class="settings-row">
          <label>Input Volume</label>
          <input type="range" min="0" max="200" value="${state.settings.inputVolume || 100}" id="inputVolume">
        </div>
        <div class="settings-row">
          <label>Output Volume</label>
          <input type="range" min="0" max="200" value="${state.settings.outputVolume || 100}" id="outputVolume">
        </div>
        <div class="settings-row">
          <label>Voice Mode</label>
          <select id="voiceMode">
            <option value="ptt" ${!state.settings.voiceActivated ? 'selected' : ''}>Push to Talk</option>
            <option value="vad" ${state.settings.voiceActivated ? 'selected' : ''}>Voice Activated</option>
          </select>
        </div>
        <div class="settings-row">
          <label>Push to Talk Key</label>
          <input type="text" value="${state.settings.pushToTalkKey || 'Space'}" id="pttKey" style="width: 100px; padding: 8px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
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
    </div>
    <div class="modal-footer">
      <button class="btn-danger" onclick="disconnect()">Disconnect</button>
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="saveSettings()">Save</button>
    </div>
  `;

  modal.classList.add('active');
}

async function saveSettings() {
  const newSettings = {
    inputVolume: parseInt(document.getElementById('inputVolume').value),
    outputVolume: parseInt(document.getElementById('outputVolume').value),
    voiceActivated: document.getElementById('voiceMode').value === 'vad',
    pushToTalkKey: document.getElementById('pttKey').value,
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

function closeModal() {
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
