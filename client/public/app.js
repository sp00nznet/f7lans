// F7Lans Web Client
// Gaming Community Platform

const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : '/api';
const WS_URL = window.location.hostname === 'localhost'
  ? 'ws://localhost:3001'
  : `wss://${window.location.host}`;

// Application State
const state = {
  user: null,
  token: localStorage.getItem('f7lans_token'),
  currentChannel: null,
  channels: [],
  messages: [],
  users: new Map(),
  socket: null,
  inVoice: false,
  voiceChannel: null,
  isMuted: false,
  isDeafened: false,
  isCameraOn: false,
  isScreenSharing: false,
  localStream: null,
  screenStream: null,
  peerConnections: new Map(),
  typingUsers: new Map(),
  unreadCounts: new Map(),
  view: 'login' // login, register, app
};

// ===== API Functions =====
const api = {
  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (state.token) {
      headers['Authorization'] = `Bearer ${state.token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  },

  // Auth
  async login(username, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    return data;
  },

  async register(username, email, password, inviteCode) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password, inviteCode })
    });
    return data;
  },

  async getMe() {
    return this.request('/auth/me');
  },

  async updateProfile(updates) {
    return this.request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  },

  // Channels
  async getChannels() {
    return this.request('/channels');
  },

  async getMessages(channelId, before = null) {
    const query = before ? `?before=${before}` : '';
    return this.request(`/channels/${channelId}/messages${query}`);
  },

  // Users
  async getUser(userId) {
    return this.request(`/users/${userId}`);
  },

  // DMs
  async getConversations() {
    return this.request('/dm/conversations');
  },

  async getDirectMessages(userId) {
    return this.request(`/dm/${userId}`);
  },

  // Admin
  async createInvite(email, maxUses = 1) {
    return this.request('/admin/invites', {
      method: 'POST',
      body: JSON.stringify({ email, maxUses })
    });
  },

  async getInvites() {
    return this.request('/admin/invites');
  },

  async getUsers() {
    return this.request('/admin/users');
  },

  async createUser(userData) {
    return this.request('/admin/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  },

  async updateUserRole(userId, role) {
    return this.request(`/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role })
    });
  },

  async deleteUser(userId) {
    return this.request(`/admin/users/${userId}`, {
      method: 'DELETE'
    });
  }
};

// ===== Socket Functions =====
function initSocket() {
  if (!state.token) return;

  // Load socket.io client
  const script = document.createElement('script');
  script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
  script.onload = () => {
    state.socket = io(WS_URL, {
      auth: { token: state.token },
      transports: ['websocket', 'polling']
    });

    setupSocketListeners();
  };
  document.head.appendChild(script);
}

function setupSocketListeners() {
  const socket = state.socket;

  socket.on('connect', () => {
    console.log('Connected to F7Lans server');
    showToast('Connected to server', 'success');
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
    showToast('Disconnected from server', 'warning');
  });

  socket.on('error', (data) => {
    showToast(data.message, 'error');
  });

  // Messages
  socket.on('message:new', (message) => {
    if (state.currentChannel && message.channel === state.currentChannel._id) {
      state.messages.push(message);
      renderMessages();
      scrollToBottom();
    } else {
      // Increment unread count
      const count = state.unreadCounts.get(message.channel) || 0;
      state.unreadCounts.set(message.channel, count + 1);
      renderChannels();
    }
    playNotificationSound();
  });

  socket.on('message:updated', (message) => {
    const idx = state.messages.findIndex(m => m._id === message._id);
    if (idx !== -1) {
      state.messages[idx] = message;
      renderMessages();
    }
  });

  socket.on('message:deleted', (data) => {
    state.messages = state.messages.filter(m => m._id !== data.messageId);
    renderMessages();
  });

  // Direct Messages
  socket.on('dm:new', (dm) => {
    playNotificationSound();
    showToast(`New message from ${dm.sender.displayName || dm.sender.username}`, 'info');
  });

  // Typing
  socket.on('typing:started', (data) => {
    state.typingUsers.set(data.userId, data.username);
    renderTypingIndicator();
  });

  socket.on('typing:stopped', (data) => {
    state.typingUsers.delete(data.userId);
    renderTypingIndicator();
  });

  // User status
  socket.on('user:status', (data) => {
    const user = state.users.get(data.userId);
    if (user) {
      user.status = data.status;
      state.users.set(data.userId, user);
    }
  });

  // Voice
  socket.on('voice:userJoined', (data) => {
    showToast(`${data.user.displayName || data.user.username} joined voice`, 'info');
    renderVoiceUsers();
  });

  socket.on('voice:userLeft', (data) => {
    renderVoiceUsers();
  });

  socket.on('voice:currentUsers', (data) => {
    renderVoiceUsers(data.users);
  });

  // WebRTC
  socket.on('webrtc:offer', async (data) => {
    await handleOffer(data.fromUserId, data.offer);
  });

  socket.on('webrtc:answer', async (data) => {
    await handleAnswer(data.fromUserId, data.answer);
  });

  socket.on('webrtc:ice-candidate', async (data) => {
    await handleIceCandidate(data.fromUserId, data.candidate);
  });
}

// ===== WebRTC Functions =====
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

async function createPeerConnection(userId) {
  const pc = new RTCPeerConnection(rtcConfig);
  state.peerConnections.set(userId, pc);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      state.socket.emit('webrtc:ice-candidate', {
        targetUserId: userId,
        candidate: event.candidate
      });
    }
  };

  pc.ontrack = (event) => {
    // Handle incoming audio/video track
    const remoteAudio = document.getElementById(`audio-${userId}`) || document.createElement('audio');
    remoteAudio.id = `audio-${userId}`;
    remoteAudio.srcObject = event.streams[0];
    remoteAudio.autoplay = true;
    document.body.appendChild(remoteAudio);
  };

  // Add local stream if exists
  if (state.localStream) {
    state.localStream.getTracks().forEach(track => {
      pc.addTrack(track, state.localStream);
    });
  }

  return pc;
}

async function handleOffer(fromUserId, offer) {
  const pc = await createPeerConnection(fromUserId);
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  state.socket.emit('webrtc:answer', {
    targetUserId: fromUserId,
    answer: answer
  });
}

async function handleAnswer(fromUserId, answer) {
  const pc = state.peerConnections.get(fromUserId);
  if (pc) {
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }
}

async function handleIceCandidate(fromUserId, candidate) {
  const pc = state.peerConnections.get(fromUserId);
  if (pc) {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  }
}

// ===== UI Rendering =====
function render() {
  const app = document.getElementById('app');

  if (state.view === 'login') {
    renderLoginPage();
  } else if (state.view === 'register') {
    renderRegisterPage();
  } else {
    renderApp();
  }
}

function renderLoginPage() {
  document.getElementById('app').innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-logo">
          <img src="logo.svg" alt="F7Lans" class="logo-icon-img">
          <h1>F7Lans</h1>
          <p>Gaming Community Platform</p>
        </div>
        <form id="loginForm" class="auth-form">
          <div class="form-group">
            <label>Username or Email</label>
            <input type="text" id="loginUsername" placeholder="Enter username or email" required>
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="loginPassword" placeholder="Enter password" required>
          </div>
          <button type="submit" class="btn-primary">Login</button>
          <p class="auth-switch">
            Don't have an account? <a href="#" onclick="showRegister()">Register</a>
          </p>
        </form>
      </div>
    </div>
  `;

  document.getElementById('loginForm').addEventListener('submit', handleLogin);
}

function renderRegisterPage() {
  document.getElementById('app').innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-logo">
          <img src="logo.svg" alt="F7Lans" class="logo-icon-img">
          <h1>F7Lans</h1>
          <p>Join the Gaming Community</p>
        </div>
        <form id="registerForm" class="auth-form">
          <div class="form-group">
            <label>Username</label>
            <input type="text" id="regUsername" placeholder="Choose a username" required minlength="3">
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="regEmail" placeholder="Enter your email" required>
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="regPassword" placeholder="Choose a password" required minlength="6">
          </div>
          <div class="form-group">
            <label>Invite Code (optional)</label>
            <input type="text" id="regInvite" placeholder="Enter invite code">
          </div>
          <button type="submit" class="btn-primary">Create Account</button>
          <p class="auth-switch">
            Already have an account? <a href="#" onclick="showLogin()">Login</a>
          </p>
        </form>
      </div>
    </div>
  `;

  document.getElementById('registerForm').addEventListener('submit', handleRegister);
}

function renderApp() {
  document.getElementById('app').innerHTML = `
    <div class="app-container ${state.inVoice ? 'voice-active' : ''}">
      <!-- Server List -->
      <nav class="server-list">
        <div class="server-icon active" title="F7Lans Home">
          <span>F7</span>
        </div>
        <div class="server-divider"></div>
        <div class="server-icon add-server" title="Add Server" onclick="showToast('Coming soon!', 'info')">+</div>
      </nav>

      <!-- Channel Sidebar -->
      <aside class="channel-sidebar">
        <div class="server-header">
          <h2>F7Lans</h2>
          <span class="dropdown-icon">▼</span>
        </div>

        <div class="channels-container" id="channelsList">
          <!-- Channels rendered here -->
        </div>

        <!-- Voice Status -->
        <div class="voice-status" id="voiceStatus" style="display: ${state.inVoice ? 'block' : 'none'};">
          <div class="voice-info">
            <div class="status-dot"></div>
            <div>
              <div class="voice-text">Voice Connected</div>
              <div class="channel-name-small" id="connectedChannelName">${state.voiceChannel?.name || ''}</div>
            </div>
          </div>
          <div class="voice-controls">
            <button class="voice-btn ${state.isMuted ? 'active' : ''}" onclick="toggleMute()" title="Mute">
              ${state.isMuted ? '🔇' : '🎤'}
            </button>
            <button class="voice-btn ${state.isDeafened ? 'active' : ''}" onclick="toggleDeafen()" title="Deafen">
              ${state.isDeafened ? '🔈' : '🎧'}
            </button>
            <button class="voice-btn" onclick="openShareModal()" title="Share Screen">📺</button>
            <button class="voice-btn disconnect" onclick="leaveVoice()" title="Disconnect">📞</button>
          </div>
        </div>

        <!-- User Panel -->
        <div class="user-panel">
          <div class="user-avatar" onclick="openSettings()">
            ${state.user?.avatar ? `<img src="${state.user.avatar}" alt="">` : `<span>${(state.user?.displayName || state.user?.username || 'U')[0].toUpperCase()}</span>`}
            <div class="status-indicator ${state.user?.status || 'online'}"></div>
          </div>
          <div class="user-info">
            <div class="user-name">${state.user?.displayName || state.user?.username || 'User'}</div>
            <div class="user-tag">#${state.user?.username || 'user'}</div>
          </div>
          <div class="user-controls">
            <button class="user-btn" onclick="toggleMute()" title="Mute">🎤</button>
            <button class="user-btn" onclick="toggleDeafen()" title="Deafen">🎧</button>
            <button class="user-btn" onclick="openSettings()" title="Settings">⚙️</button>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="main-content">
        <header class="channel-header">
          <span class="hash">${state.currentChannel?.type === 'voice' ? '🔊' : '#'}</span>
          <h3>${state.currentChannel?.name || 'general'}</h3>
          <div class="divider"></div>
          <span class="description">${state.currentChannel?.description || 'Welcome to F7Lans!'}</span>
          <div class="header-actions">
            <button class="header-btn" onclick="showMembers()" title="Members">👥</button>
            <button class="header-btn" onclick="showPinned()" title="Pinned">📌</button>
            <button class="header-btn" onclick="showSearch()" title="Search">🔍</button>
          </div>
        </header>

        <div class="messages-area" id="messagesArea">
          <!-- Messages rendered here -->
        </div>

        <div class="typing-indicator" id="typingIndicator" style="display: none;"></div>

        <div class="message-input-container">
          <div class="message-input-wrapper">
            <div class="input-actions-left">
              <button class="input-btn" title="Attach" onclick="attachFile()">➕</button>
            </div>
            <textarea class="message-input" id="messageInput"
              placeholder="Message #${state.currentChannel?.name || 'general'}"
              rows="1"
              onkeydown="handleInputKeyDown(event)"
              oninput="handleInputChange()"></textarea>
            <div class="input-actions-right">
              <button class="input-btn" title="GIF" onclick="showGifPicker()">GIF</button>
              <button class="input-btn" title="Emoji" onclick="showEmojiPicker()">😀</button>
            </div>
          </div>
        </div>
      </main>

      <!-- Voice Panel -->
      <aside class="voice-panel" id="voicePanel" style="display: ${state.inVoice ? 'flex' : 'none'};">
        <div class="voice-panel-header">
          <h3 id="voicePanelTitle">${state.voiceChannel?.name || 'Voice'}</h3>
          <button class="header-btn" onclick="expandVideo()">⛶</button>
        </div>

        <div class="voice-panel-content">
          <div class="video-grid" id="videoGrid">
            <!-- Video tiles rendered here -->
          </div>

          <div class="voice-participants">
            <h4>In Voice — <span id="participantCount">0</span></h4>
            <div id="participantsList">
              <!-- Participants rendered here -->
            </div>
          </div>
        </div>

        <div class="voice-actions">
          <button class="action-btn ${state.isMuted ? 'active' : ''}" onclick="toggleMute()">
            <span class="icon">${state.isMuted ? '🔇' : '🎤'}</span>
            <span class="label">Mute</span>
          </button>
          <button class="action-btn ${state.isCameraOn ? 'active' : ''}" onclick="toggleCamera()">
            <span class="icon">📷</span>
            <span class="label">Camera</span>
          </button>
          <button class="action-btn ${state.isScreenSharing ? 'active' : ''}" onclick="toggleScreenShare()">
            <span class="icon">📺</span>
            <span class="label">Share</span>
          </button>
          <button class="action-btn danger" onclick="leaveVoice()">
            <span class="icon">📞</span>
            <span class="label">Leave</span>
          </button>
        </div>
      </aside>
    </div>

    <!-- Toast Container -->
    <div class="toast-container" id="toastContainer"></div>

    <!-- Modals -->
    <div class="modal-overlay" id="modalOverlay" onclick="closeModal()">
      <div class="modal" onclick="event.stopPropagation()" id="modalContent">
        <!-- Modal content -->
      </div>
    </div>
  `;

  loadChannels();
  if (state.currentChannel) {
    loadMessages(state.currentChannel._id);
  }
}

async function loadChannels() {
  try {
    const data = await api.getChannels();
    state.channels = data.channels;
    renderChannels();

    // Select first text channel if none selected
    if (!state.currentChannel) {
      const textChannel = state.channels.find(c => c.type === 'text');
      if (textChannel) {
        selectChannel(textChannel);
      }
    }
  } catch (error) {
    showToast('Failed to load channels', 'error');
  }
}

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
    html += `
      <div class="channel-category">
        <span>▼</span>
        <span>${category}</span>
      </div>
    `;

    for (const channel of channels) {
      const isActive = state.currentChannel?._id === channel._id;
      const isVoice = ['voice', 'video'].includes(channel.type);
      const unread = state.unreadCounts.get(channel._id) || 0;
      const userCount = channel.currentUsers?.length || 0;

      html += `
        <div class="channel ${isActive ? 'active' : ''}" onclick="${isVoice ? `joinVoice('${channel._id}')` : `selectChannel(${JSON.stringify(channel).replace(/"/g, '&quot;')})`}">
          <span class="channel-icon">${isVoice ? '🔊' : '#'}</span>
          <span class="channel-name">${channel.name}</span>
          ${unread > 0 ? `<span class="unread-badge">${unread}</span>` : ''}
          ${isVoice && userCount > 0 ? `<span class="channel-users">${userCount}</span>` : ''}
        </div>
      `;

      // Show users in voice channel
      if (isVoice && channel.currentUsers?.length > 0) {
        for (const cu of channel.currentUsers) {
          html += `
            <div class="voice-user">
              <span class="voice-user-avatar">${(cu.user?.displayName || cu.user?.username || 'U')[0]}</span>
              <span class="voice-user-name">${cu.user?.displayName || cu.user?.username}</span>
              ${cu.isMuted ? '<span class="voice-user-muted">🔇</span>' : ''}
            </div>
          `;
        }
      }
    }
  }

  container.innerHTML = html;
}

async function selectChannel(channel) {
  state.currentChannel = channel;
  state.unreadCounts.set(channel._id, 0);

  // Join socket room
  if (state.socket) {
    state.socket.emit('channel:join', channel._id);
  }

  renderChannels();
  updateChannelHeader();
  loadMessages(channel._id);
}

function updateChannelHeader() {
  const hashEl = document.querySelector('.channel-header .hash');
  const nameEl = document.querySelector('.channel-header h3');
  const descEl = document.querySelector('.channel-header .description');
  const inputEl = document.getElementById('messageInput');

  if (hashEl) hashEl.textContent = state.currentChannel?.type === 'voice' ? '🔊' : '#';
  if (nameEl) nameEl.textContent = state.currentChannel?.name || 'general';
  if (descEl) descEl.textContent = state.currentChannel?.description || '';
  if (inputEl) inputEl.placeholder = `Message #${state.currentChannel?.name || 'general'}`;
}

async function loadMessages(channelId) {
  try {
    const data = await api.getMessages(channelId);
    state.messages = data.messages;
    renderMessages();
    scrollToBottom();
  } catch (error) {
    showToast('Failed to load messages', 'error');
  }
}

function renderMessages() {
  const container = document.getElementById('messagesArea');
  if (!container) return;

  if (state.messages.length === 0) {
    container.innerHTML = `
      <div class="welcome-message">
        <h2>Welcome to #${state.currentChannel?.name || 'general'}!</h2>
        <p>This is the beginning of the channel. Start the conversation!</p>
      </div>
    `;
    return;
  }

  let html = '';
  let lastAuthor = null;
  let lastTime = null;

  for (const msg of state.messages) {
    const author = msg.author;
    const time = new Date(msg.createdAt);
    const isSameAuthor = lastAuthor === author._id;
    const isSameTimeBlock = lastTime && (time - lastTime) < 5 * 60 * 1000; // 5 minutes

    const showHeader = !isSameAuthor || !isSameTimeBlock;

    if (showHeader) {
      const timeStr = formatTime(time);
      const avatarColor = getAvatarColor(author.username);

      html += `
        <div class="message-group">
          <div class="message-avatar" style="background: ${avatarColor};">
            ${author.avatar ? `<img src="${author.avatar}" alt="">` : (author.displayName || author.username)[0].toUpperCase()}
          </div>
          <div class="message-content">
            <div class="message-header">
              <span class="message-author" style="color: ${getRoleColor(author.role)};">${author.displayName || author.username}</span>
              ${author.role === 'admin' || author.role === 'superadmin' ? '<span class="admin-badge">ADMIN</span>' : ''}
              <span class="message-timestamp">${timeStr}</span>
            </div>
      `;
    }

    // Message content
    const content = escapeHtml(msg.content);
    const formattedContent = formatMessageContent(content);

    html += `
      <div class="message-text" data-id="${msg._id}">
        ${formattedContent}
        ${msg.edited ? '<span class="edited-tag">(edited)</span>' : ''}
      </div>
    `;

    // YouTube embed
    if (msg.type === 'youtube' && msg.youtubeData) {
      html += `
        <div class="youtube-embed">
          <div class="youtube-info">
            <span class="youtube-icon">▶️</span>
            <span>${msg.youtubeData.title}</span>
          </div>
        </div>
      `;
    }

    // Attachments
    if (msg.attachments?.length > 0) {
      for (const att of msg.attachments) {
        if (att.type === 'image') {
          html += `<img class="message-image" src="${att.url}" alt="${att.filename}" onclick="expandImage('${att.url}')">`;
        }
      }
    }

    // Reactions
    if (msg.reactions?.length > 0) {
      html += '<div class="reactions">';
      for (const reaction of msg.reactions) {
        const count = reaction.users.length;
        const hasReacted = reaction.users.some(u => u.toString() === state.user?._id);
        html += `
          <button class="reaction ${hasReacted ? 'active' : ''}" onclick="toggleReaction('${msg._id}', '${reaction.emoji}')">
            ${reaction.emoji} ${count}
          </button>
        `;
      }
      html += '</div>';
    }

    if (showHeader) {
      html += '</div></div>';
    }

    lastAuthor = author._id;
    lastTime = time;
  }

  container.innerHTML = html;
}

function renderTypingIndicator() {
  const container = document.getElementById('typingIndicator');
  if (!container) return;

  const users = Array.from(state.typingUsers.values());

  if (users.length === 0) {
    container.style.display = 'none';
    return;
  }

  let text;
  if (users.length === 1) {
    text = `${users[0]} is typing...`;
  } else if (users.length === 2) {
    text = `${users[0]} and ${users[1]} are typing...`;
  } else {
    text = `${users.length} people are typing...`;
  }

  container.textContent = text;
  container.style.display = 'block';
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
        <div class="avatar ${cu.isSpeaking ? 'speaking' : ''}" style="background: ${avatarColor};">
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

// ===== Event Handlers =====
async function handleLogin(e) {
  e.preventDefault();

  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const data = await api.login(username, password);
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('f7lans_token', data.token);
    state.view = 'app';
    initSocket();
    render();
    showToast(`Welcome back, ${data.user.displayName || data.user.username}!`, 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleRegister(e) {
  e.preventDefault();

  const username = document.getElementById('regUsername').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const inviteCode = document.getElementById('regInvite').value;

  try {
    const data = await api.register(username, email, password, inviteCode);
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('f7lans_token', data.token);
    state.view = 'app';
    initSocket();
    render();
    showToast(`Welcome to F7Lans, ${data.user.username}!`, 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function handleInputKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function handleInputChange() {
  const input = document.getElementById('messageInput');

  // Auto-resize
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 200) + 'px';

  // Typing indicator
  if (state.socket && state.currentChannel) {
    state.socket.emit('typing:start', state.currentChannel._id);

    clearTimeout(state.typingTimeout);
    state.typingTimeout = setTimeout(() => {
      state.socket.emit('typing:stop', state.currentChannel._id);
    }, 2000);
  }
}

function sendMessage() {
  const input = document.getElementById('messageInput');
  const content = input.value.trim();

  if (!content || !state.currentChannel) return;

  state.socket.emit('message:send', {
    channelId: state.currentChannel._id,
    content
  });

  input.value = '';
  input.style.height = 'auto';

  // Stop typing indicator
  state.socket.emit('typing:stop', state.currentChannel._id);
}

// ===== Voice Functions =====
async function joinVoice(channelId) {
  const channel = state.channels.find(c => c._id === channelId);
  if (!channel) return;

  try {
    // Get microphone
    state.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true
      }
    });

    state.inVoice = true;
    state.voiceChannel = channel;

    state.socket.emit('voice:join', channelId);

    document.querySelector('.app-container').classList.add('voice-active');
    document.getElementById('voiceStatus').style.display = 'block';
    document.getElementById('voicePanel').style.display = 'flex';
    document.getElementById('connectedChannelName').textContent = channel.name;
    document.getElementById('voicePanelTitle').textContent = channel.name;

    showToast(`Joined ${channel.name}`, 'success');
  } catch (error) {
    showToast('Could not access microphone', 'error');
  }
}

function leaveVoice() {
  if (state.localStream) {
    state.localStream.getTracks().forEach(t => t.stop());
    state.localStream = null;
  }

  if (state.screenStream) {
    state.screenStream.getTracks().forEach(t => t.stop());
    state.screenStream = null;
  }

  // Close peer connections
  state.peerConnections.forEach(pc => pc.close());
  state.peerConnections.clear();

  state.socket.emit('voice:leave');

  state.inVoice = false;
  state.voiceChannel = null;
  state.isMuted = false;
  state.isDeafened = false;
  state.isCameraOn = false;
  state.isScreenSharing = false;

  document.querySelector('.app-container')?.classList.remove('voice-active');
  document.getElementById('voiceStatus').style.display = 'none';
  document.getElementById('voicePanel').style.display = 'none';

  showToast('Left voice channel', 'success');
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

  render();
}

function toggleDeafen() {
  state.isDeafened = !state.isDeafened;
  if (state.isDeafened && !state.isMuted) {
    toggleMute();
  }

  if (state.socket && state.inVoice) {
    state.socket.emit('voice:deafen', state.isDeafened);
  }

  render();
}

async function toggleCamera() {
  if (!state.isCameraOn) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false
      });
      state.localStream = stream;
      state.isCameraOn = true;

      if (state.socket) {
        state.socket.emit('camera:toggle', true);
      }

      // Add video to grid
      addVideoToGrid('local-camera', stream, state.user?.displayName || 'You', true);

      showToast('Camera enabled', 'success');
      render();
    } catch (error) {
      console.error('Camera error:', error);
      showToast('Could not access camera: ' + error.message, 'error');
    }
  } else {
    // Stop camera
    if (state.localStream) {
      state.localStream.getTracks().forEach(track => track.stop());
      state.localStream = null;
    }
    state.isCameraOn = false;

    if (state.socket) {
      state.socket.emit('camera:toggle', false);
    }

    // Remove video from grid
    removeVideoFromGrid('local-camera');

    showToast('Camera disabled', 'success');
    render();
  }
}

async function toggleScreenShare() {
  if (!state.isScreenSharing) {
    try {
      state.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1920, height: 1080, frameRate: 30 },
        audio: true
      });

      state.isScreenSharing = true;

      if (state.socket) {
        state.socket.emit('screen:start');
      }

      // Add screen share to grid
      addVideoToGrid('local-screen', state.screenStream, 'Your Screen', false);

      // Handle user stopping share via browser UI
      state.screenStream.getVideoTracks()[0].onended = () => {
        state.isScreenSharing = false;
        state.screenStream = null;
        removeVideoFromGrid('local-screen');
        if (state.socket) {
          state.socket.emit('screen:stop');
        }
        showToast('Screen sharing stopped', 'info');
        render();
      };

      showToast('Screen sharing started', 'success');
      render();
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Screen share error:', error);
        showToast('Could not share screen: ' + error.message, 'error');
      }
    }
  } else {
    if (state.screenStream) {
      state.screenStream.getTracks().forEach(t => t.stop());
      state.screenStream = null;
    }
    state.isScreenSharing = false;

    if (state.socket) {
      state.socket.emit('screen:stop');
    }

    removeVideoFromGrid('local-screen');
    showToast('Screen sharing stopped', 'success');
    render();
  }
}

// Add video element to the video grid
function addVideoToGrid(id, stream, label, isMirrored = false) {
  const grid = document.getElementById('videoGrid');
  if (!grid) return;

  // Remove existing element if present
  removeVideoFromGrid(id);

  const tile = document.createElement('div');
  tile.className = 'video-tile';
  tile.id = `video-tile-${id}`;
  tile.innerHTML = `
    <video id="video-${id}" autoplay playsinline ${isMirrored ? 'style="transform: scaleX(-1);"' : ''}></video>
    <div class="video-label">${escapeHtml(label)}</div>
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

// ===== Utility Functions =====
function showLogin() {
  state.view = 'login';
  render();
}

function showRegister() {
  state.view = 'register';
  render();
}

function logout() {
  localStorage.removeItem('f7lans_token');
  state.token = null;
  state.user = null;
  if (state.socket) {
    state.socket.disconnect();
    state.socket = null;
  }
  state.view = 'login';
  render();
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '⚠' : 'ℹ'}</div>
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

function formatMessageContent(content) {
  // Bold
  content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic
  content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Code
  content = content.replace(/`(.*?)`/g, '<code>$1</code>');
  // Links
  content = content.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  // Mentions
  content = content.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
  // Newlines
  content = content.replace(/\n/g, '<br>');

  return content;
}

function formatTime(date) {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  if (isToday) {
    return `Today at ${time}`;
  } else if (isYesterday) {
    return `Yesterday at ${time}`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ` at ${time}`;
  }
}

function getAvatarColor(name) {
  const colors = [
    'linear-gradient(135deg, #ff8c00, #ff6b00)',
    'linear-gradient(135deg, #ff6b6b, #ff8e53)',
    'linear-gradient(135deg, #4ecdc4, #44a08d)',
    'linear-gradient(135deg, #667eea, #764ba2)',
    'linear-gradient(135deg, #f093fb, #f5576c)',
    'linear-gradient(135deg, #4facfe, #00f2fe)',
    'linear-gradient(135deg, #43e97b, #38f9d7)',
    'linear-gradient(135deg, #fa709a, #fee140)'
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

function playNotificationSound() {
  // Create audio context for notification
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.frequency.value = 800;
  gain.gain.value = 0.1;

  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.1);
}

function openSettings() {
  const modal = document.getElementById('modalOverlay');
  const content = document.getElementById('modalContent');

  content.innerHTML = `
    <div class="modal-header">
      <h2>Settings</h2>
    </div>
    <div class="modal-body">
      <div class="settings-section">
        <h3>Profile</h3>
        <div class="form-group">
          <label>Display Name</label>
          <input type="text" id="settingsDisplayName" value="${state.user?.displayName || ''}" placeholder="Display name">
        </div>
        <div class="form-group">
          <label>Steam ID</label>
          <input type="text" id="settingsSteamId" value="${state.user?.steamId || ''}" placeholder="Your Steam ID">
        </div>
      </div>

      <div class="settings-section">
        <h3>Audio</h3>
        <div class="form-group">
          <label>Input Volume</label>
          <input type="range" min="0" max="200" value="${state.user?.audioSettings?.inputVolume || 100}">
        </div>
        <div class="form-group">
          <label>Output Volume</label>
          <input type="range" min="0" max="200" value="${state.user?.audioSettings?.outputVolume || 100}">
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" ${state.user?.audioSettings?.voiceActivated ? 'checked' : ''}> Voice Activated
          </label>
        </div>
      </div>

      ${state.user?.role === 'admin' || state.user?.role === 'superadmin' ? `
      <div class="settings-section">
        <h3>Administration</h3>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn-secondary" onclick="openInviteModal()">Create Invite</button>
          <button class="btn-secondary" onclick="openCreateUserModal()">Create User</button>
          <button class="btn-secondary" onclick="openAdminPanel()">Manage Users</button>
        </div>
      </div>
      ` : ''}
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="saveSettings()">Save</button>
      <button class="btn-danger" onclick="logout()">Logout</button>
    </div>
  `;

  modal.classList.add('active');
}

async function saveSettings() {
  const displayName = document.getElementById('settingsDisplayName').value;
  const steamId = document.getElementById('settingsSteamId').value;

  try {
    await api.updateProfile({ displayName, steamId });
    state.user.displayName = displayName;
    state.user.steamId = steamId;
    closeModal();
    showToast('Settings saved', 'success');
    render();
  } catch (error) {
    showToast('Failed to save settings', 'error');
  }
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
      <div class="form-group">
        <label>Email (optional)</label>
        <input type="email" id="inviteEmail" placeholder="user@example.com" style="width: 100%; padding: 10px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
        <small style="color: var(--text-muted);">Leave blank to generate a link without sending email</small>
      </div>
      <div class="form-group">
        <label>Max Uses</label>
        <input type="number" id="inviteMaxUses" value="1" min="1" max="100" style="width: 100px; padding: 10px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
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
    const result = await api.createInvite(email || null, maxUses);
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
      <div class="form-group">
        <label>Username</label>
        <input type="text" id="newUsername" required style="width: 100%; padding: 10px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="newEmail" required style="width: 100%; padding: 10px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="newPassword" required style="width: 100%; padding: 10px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
      </div>
      <div class="form-group">
        <label>Role</label>
        <select id="newRole" style="width: 100%; padding: 10px; background: var(--bg-medium); border: 2px solid var(--bg-light); border-radius: var(--radius-sm); color: var(--text-primary);">
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
    await api.createUser({ username, email, password, role });
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
    const data = await api.getUsers();
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
    await api.updateUserRole(userId, role);
    showToast('User role updated', 'success');
  } catch (error) {
    showToast('Failed to update role: ' + error.message, 'error');
    openAdminPanel(); // Refresh the list
  }
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
}

function toggleReaction(messageId, emoji) {
  const msg = state.messages.find(m => m._id === messageId);
  if (!msg) return;

  const reaction = msg.reactions?.find(r => r.emoji === emoji);
  const hasReacted = reaction?.users.some(u => u.toString() === state.user?._id);

  state.socket.emit('message:reaction', {
    messageId,
    emoji,
    action: hasReacted ? 'remove' : 'add'
  });
}

// ===== Initialization =====
async function init() {
  // Check for existing token
  if (state.token) {
    try {
      const data = await api.getMe();
      state.user = data.user;
      state.view = 'app';
      initSocket();
    } catch (error) {
      // Token invalid
      localStorage.removeItem('f7lans_token');
      state.token = null;
    }
  }

  render();

  // Add styles
  addStyles();
}

function addStyles() {
  const style = document.createElement('style');
  style.textContent = `
    :root {
      --bg-darkest: #0a0a0f;
      --bg-darker: #111118;
      --bg-dark: #1a1a24;
      --bg-medium: #23232f;
      --bg-light: #2d2d3a;
      --bg-lighter: #383848;
      --accent-primary: #ff8c00;
      --accent-secondary: #ff6b00;
      --accent-gradient: linear-gradient(135deg, #ff8c00 0%, #ff6b00 100%);
      --accent-glow: rgba(255, 140, 0, 0.4);
      --text-primary: #ffffff;
      --text-secondary: #b8b8c8;
      --text-muted: #6e6e82;
      --success: #5cffb8;
      --warning: #ffb85c;
      --danger: #ff5c8a;
      --online: #5cffb8;
      --idle: #ffb85c;
      --dnd: #ff5c8a;
      --offline: #6e6e82;
      --radius-sm: 6px;
      --radius-md: 10px;
      --radius-lg: 16px;
      --radius-xl: 24px;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Outfit', -apple-system, sans-serif;
      background: var(--bg-darkest);
      color: var(--text-primary);
      overflow: hidden;
      height: 100vh;
    }

    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--bg-lighter); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--accent-primary); }

    /* Auth Pages */
    .auth-container {
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--bg-darkest) 0%, var(--bg-dark) 100%);
    }

    .auth-card {
      background: var(--bg-darker);
      padding: 40px;
      border-radius: var(--radius-xl);
      width: 100%;
      max-width: 400px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    }

    .auth-logo {
      text-align: center;
      margin-bottom: 30px;
    }

    .logo-icon {
      width: 80px;
      height: 80px;
      background: var(--accent-gradient);
      border-radius: var(--radius-lg);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 16px;
    }

    .logo-icon-img {
      width: 100px;
      height: 100px;
      margin-bottom: 16px;
      filter: invert(1) drop-shadow(0 4px 20px var(--accent-glow));
    }

    .auth-logo h1 {
      font-size: 28px;
      font-weight: 700;
      color: var(--accent-primary);
    }

    .auth-logo p {
      color: var(--text-muted);
      margin-top: 4px;
    }

    .auth-form { display: flex; flex-direction: column; gap: 16px; }

    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group label { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
    .form-group input {
      padding: 12px 16px;
      background: var(--bg-dark);
      border: 2px solid var(--bg-light);
      border-radius: var(--radius-md);
      color: var(--text-primary);
      font-size: 14px;
      transition: border-color 0.2s;
    }
    .form-group input:focus {
      outline: none;
      border-color: var(--accent-primary);
    }

    .btn-primary, .btn-secondary, .btn-danger {
      padding: 12px 24px;
      border-radius: var(--radius-md);
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }

    .btn-primary {
      background: var(--accent-gradient);
      color: #000;
    }
    .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }

    .btn-secondary {
      background: var(--bg-light);
      color: var(--text-primary);
    }
    .btn-secondary:hover { background: var(--bg-lighter); }

    .btn-danger {
      background: var(--danger);
      color: white;
    }

    .auth-switch {
      text-align: center;
      color: var(--text-muted);
      font-size: 14px;
    }
    .auth-switch a {
      color: var(--accent-primary);
      text-decoration: none;
    }
    .auth-switch a:hover { text-decoration: underline; }

    /* App Layout */
    .app-container {
      display: grid;
      grid-template-columns: 72px 240px 1fr;
      height: 100vh;
    }
    .app-container.voice-active {
      grid-template-columns: 72px 240px 1fr 320px;
    }

    /* Server List */
    .server-list {
      background: var(--bg-darkest);
      padding: 12px 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      overflow-y: auto;
    }

    .server-icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--bg-dark);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
      font-weight: 700;
      font-size: 16px;
      color: var(--text-secondary);
    }
    .server-icon:hover { border-radius: var(--radius-lg); background: var(--accent-primary); color: #000; }
    .server-icon.active { border-radius: var(--radius-lg); background: var(--accent-gradient); color: #000; }
    .server-icon.add-server { background: transparent; border: 2px dashed var(--bg-lighter); color: var(--success); }
    .server-icon.add-server:hover { background: var(--success); border-color: var(--success); color: var(--bg-darkest); }

    .server-divider { width: 32px; height: 2px; background: var(--bg-light); border-radius: 1px; margin: 4px 0; }

    /* Channel Sidebar */
    .channel-sidebar {
      background: var(--bg-darker);
      display: flex;
      flex-direction: column;
    }

    .server-header {
      padding: 16px;
      border-bottom: 1px solid var(--bg-dark);
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
    }
    .server-header:hover { background: var(--bg-dark); }
    .server-header h2 { font-size: 15px; font-weight: 600; color: var(--accent-primary); }

    .channels-container { flex: 1; overflow-y: auto; padding: 8px 0; }

    .channel-category {
      padding: 16px 8px 4px 16px;
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
    }
    .channel-category:hover { color: var(--text-secondary); }

    .channel {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      margin: 1px 8px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      color: var(--text-muted);
      transition: all 0.15s;
    }
    .channel:hover { background: var(--bg-medium); color: var(--text-secondary); }
    .channel.active { background: var(--bg-light); color: var(--text-primary); }
    .channel-icon { font-size: 18px; opacity: 0.7; }
    .channel-name { font-size: 14px; font-weight: 500; flex: 1; }
    .channel-users { font-size: 12px; color: var(--text-muted); }
    .unread-badge { background: var(--danger); color: white; padding: 2px 6px; border-radius: 10px; font-size: 11px; font-weight: 600; }

    .voice-user {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 12px 4px 32px;
      font-size: 13px;
      color: var(--text-muted);
    }
    .voice-user-avatar {
      width: 20px;
      height: 20px;
      background: var(--bg-light);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
    }

    /* Voice Status */
    .voice-status {
      background: var(--bg-dark);
      padding: 12px;
      border-top: 1px solid var(--bg-medium);
    }

    .voice-info {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      background: rgba(92, 255, 184, 0.1);
      border-radius: var(--radius-sm);
      margin-bottom: 8px;
    }
    .voice-info .status-dot {
      width: 8px;
      height: 8px;
      background: var(--success);
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    .voice-text { font-size: 12px; color: var(--success); font-weight: 500; }
    .channel-name-small { font-size: 11px; color: var(--text-muted); }

    .voice-controls { display: flex; gap: 4px; }
    .voice-btn {
      flex: 1;
      padding: 8px;
      background: var(--bg-medium);
      border: none;
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 16px;
    }
    .voice-btn:hover { background: var(--bg-light); color: var(--text-primary); }
    .voice-btn.active { background: var(--danger); color: white; }
    .voice-btn.disconnect { background: transparent; }
    .voice-btn.disconnect:hover { background: var(--danger); color: white; }

    /* User Panel */
    .user-panel {
      background: var(--bg-darkest);
      padding: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--accent-gradient);
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
    }
    .user-avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
    .status-indicator {
      position: absolute;
      bottom: -2px;
      right: -2px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      border: 3px solid var(--bg-darkest);
    }
    .status-indicator.online { background: var(--online); }
    .status-indicator.idle { background: var(--idle); }
    .status-indicator.dnd { background: var(--dnd); }
    .status-indicator.offline { background: var(--offline); }

    .user-info { flex: 1; min-width: 0; }
    .user-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .user-tag { font-size: 11px; color: var(--text-muted); }

    .user-controls { display: flex; gap: 4px; }
    .user-btn {
      width: 32px;
      height: 32px;
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      cursor: pointer;
      font-size: 14px;
    }
    .user-btn:hover { background: var(--bg-medium); color: var(--text-primary); }

    /* Main Content */
    .main-content {
      display: flex;
      flex-direction: column;
      background: var(--bg-dark);
    }

    .channel-header {
      height: 48px;
      padding: 0 16px;
      border-bottom: 1px solid var(--bg-darker);
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .channel-header .hash { font-size: 22px; color: var(--text-muted); }
    .channel-header h3 { font-size: 15px; font-weight: 600; }
    .channel-header .divider { width: 1px; height: 24px; background: var(--bg-lighter); }
    .channel-header .description { font-size: 13px; color: var(--text-muted); flex: 1; }
    .header-actions { display: flex; gap: 8px; }
    .header-btn {
      width: 28px;
      height: 28px;
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 14px;
    }
    .header-btn:hover { color: var(--text-primary); }

    /* Messages */
    .messages-area {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .welcome-message {
      text-align: center;
      padding: 40px;
      color: var(--text-muted);
    }
    .welcome-message h2 { color: var(--text-primary); margin-bottom: 8px; }

    .message-group { display: flex; gap: 16px; }
    .message-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 16px;
    }
    .message-avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
    .message-content { flex: 1; min-width: 0; }
    .message-header { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
    .message-author { font-weight: 600; font-size: 14px; }
    .admin-badge { background: var(--accent-primary); color: #000; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; }
    .message-timestamp { font-size: 11px; color: var(--text-muted); }
    .message-text { font-size: 14px; line-height: 1.5; color: var(--text-secondary); word-wrap: break-word; }
    .message-text code { font-family: 'JetBrains Mono', monospace; background: var(--bg-darker); padding: 2px 6px; border-radius: 4px; font-size: 13px; }
    .message-text a { color: var(--accent-primary); }
    .message-text .mention { background: rgba(255, 140, 0, 0.2); color: var(--accent-primary); padding: 0 4px; border-radius: 4px; }
    .edited-tag { font-size: 11px; color: var(--text-muted); margin-left: 4px; }
    .message-image { max-width: 400px; max-height: 300px; border-radius: var(--radius-md); margin-top: 8px; cursor: pointer; }

    .reactions { display: flex; gap: 4px; margin-top: 8px; flex-wrap: wrap; }
    .reaction {
      padding: 4px 8px;
      background: var(--bg-medium);
      border: none;
      border-radius: var(--radius-sm);
      font-size: 12px;
      cursor: pointer;
    }
    .reaction:hover { background: var(--bg-light); }
    .reaction.active { background: rgba(255, 140, 0, 0.2); }

    .youtube-embed {
      background: var(--bg-medium);
      padding: 12px;
      border-radius: var(--radius-md);
      margin-top: 8px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .youtube-icon { font-size: 24px; }

    .typing-indicator {
      padding: 4px 16px;
      font-size: 12px;
      color: var(--text-muted);
    }

    /* Message Input */
    .message-input-container { padding: 0 16px 24px; }
    .message-input-wrapper {
      background: var(--bg-medium);
      border-radius: var(--radius-md);
      display: flex;
      align-items: flex-end;
      padding: 4px 4px 4px 16px;
    }
    .input-actions-left, .input-actions-right { display: flex; gap: 4px; padding-bottom: 8px; }
    .input-btn {
      width: 32px;
      height: 32px;
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      cursor: pointer;
      font-size: 14px;
    }
    .input-btn:hover { color: var(--text-primary); }
    .message-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: var(--text-primary);
      font-family: inherit;
      font-size: 14px;
      padding: 12px;
      resize: none;
      min-height: 24px;
      max-height: 200px;
    }
    .message-input::placeholder { color: var(--text-muted); }

    /* Voice Panel */
    .voice-panel {
      background: var(--bg-darker);
      border-left: 1px solid var(--bg-dark);
      display: flex;
      flex-direction: column;
    }

    .voice-panel-header {
      padding: 12px 16px;
      border-bottom: 1px solid var(--bg-dark);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .voice-panel-header h3 { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }

    .voice-panel-content { flex: 1; overflow-y: auto; padding: 12px; }

    .video-grid {
      display: grid;
      gap: 8px;
      margin-bottom: 12px;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    }
    .video-tile {
      position: relative;
      background: var(--bg-darkest);
      border-radius: var(--radius-md);
      overflow: hidden;
      aspect-ratio: 16/9;
      min-height: 150px;
    }
    .video-tile video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .video-tile .video-label {
      position: absolute;
      bottom: 8px;
      left: 8px;
      background: rgba(0,0,0,0.7);
      padding: 4px 8px;
      border-radius: var(--radius-sm);
      font-size: 12px;
      font-weight: 500;
      color: white;
    }

    .voice-participants h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 8px; }
    .participant {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px;
      border-radius: var(--radius-sm);
    }
    .participant:hover { background: var(--bg-dark); }
    .participant .avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 600;
    }
    .participant .avatar.speaking { box-shadow: 0 0 0 3px var(--success); }
    .participant .name { flex: 1; font-size: 13px; font-weight: 500; }
    .participant .status-icons { display: flex; gap: 4px; color: var(--text-muted); font-size: 12px; }
    .participant .status-icons .muted { color: var(--danger); }

    .voice-actions {
      padding: 12px;
      background: var(--bg-dark);
      border-top: 1px solid var(--bg-medium);
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }
    .action-btn {
      padding: 10px;
      background: var(--bg-medium);
      border: none;
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      font-family: inherit;
    }
    .action-btn:hover { background: var(--bg-light); color: var(--text-primary); }
    .action-btn.active { background: var(--accent-primary); color: #000; }
    .action-btn.danger { background: var(--danger); color: white; }
    .action-btn .icon { font-size: 20px; }
    .action-btn .label { font-size: 10px; font-weight: 500; }

    /* Modal */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      opacity: 0;
      visibility: hidden;
      transition: all 0.2s;
    }
    .modal-overlay.active { opacity: 1; visibility: visible; }

    .modal {
      background: var(--bg-dark);
      border-radius: var(--radius-xl);
      width: 90%;
      max-width: 500px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    }
    .modal-header { padding: 20px 24px; border-bottom: 1px solid var(--bg-medium); }
    .modal-header h2 { font-size: 20px; font-weight: 600; }
    .modal-body { padding: 20px 24px; }
    .modal-footer { padding: 16px 24px; border-top: 1px solid var(--bg-medium); display: flex; justify-content: flex-end; gap: 12px; }

    .settings-section { margin-bottom: 24px; }
    .settings-section h3 { font-size: 14px; font-weight: 600; color: var(--accent-primary); margin-bottom: 12px; }

    /* Toast */
    .toast-container {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 3000;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .toast {
      background: var(--bg-light);
      padding: 12px 20px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      gap: 12px;
      animation: slideUp 0.3s ease;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    }
    .toast.success .toast-icon { color: var(--success); }
    .toast.error .toast-icon { color: var(--danger); }
    .toast.warning .toast-icon { color: var(--warning); }
    .toast.info .toast-icon { color: var(--accent-primary); }
    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    .toast-icon { width: 20px; height: 20px; }
    .toast-message { font-size: 14px; }
  `;
  document.head.appendChild(style);
}

// Start the application
init();
