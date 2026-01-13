<p align="center">
  <img src="client/public/logo192.png" alt="F7Lans Logo" width="120" height="120">
</p>

<h1 align="center">F7Lans</h1>

<p align="center">
  <strong>Where Gamers Connect, Play, and Build Communities</strong>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-features">Features</a> •
  <a href="#-media-bots">Media Bots</a> •
  <a href="#-federation">Federation</a> •
  <a href="docs/INSTALLATION.md">Installation</a> •
  <a href="docs/API.md">API</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-orange?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/node-%3E%3D18-blue?style=flat-square" alt="Node">
  <img src="https://img.shields.io/badge/docker-ready-blue?style=flat-square" alt="Docker">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20Web-lightgrey?style=flat-square" alt="Platform">
</p>

---

## Hey, Gamers!

Tired of Discord's bloat? Want something you actually **own** and **control**?

**F7Lans** is a self-hosted gaming community platform built for gamers, by gamers. Set up your own server, invite your squad, and game together without Big Tech watching over your shoulder.

### Why F7Lans?

- **Your Server, Your Rules** — Host it yourself, keep your data private
- **Built for Gaming** — Steam integration, game matching, minimal resource usage
- **Media Streaming** — YouTube, Plex, Emby, Jellyfin, IPTV, Spotify bots built-in
- **Federation Ready** — Connect multiple servers into one mega-community
- **File Sharing** — Share folders peer-to-peer with your community
- **Actually Free** — No premium tiers, no nitro, no BS

---

## Quick Start

Get up and running in under 5 minutes:

### Option 1: Docker (Recommended)

```bash
# Clone the repo
git clone https://github.com/yourusername/f7lans.git
cd f7lans

# Windows users - just double-click:
scripts/quickstart.bat

# Or manually:
docker-compose up -d
```

### Option 2: Manual Setup

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env

# Start the server
npm start
```

**That's it!** Open `http://localhost:3001` and log in:
- **Username:** `admin`
- **Password:** `admin123`

> **First thing to do:** Change that password!

---

## Features

### Communication

| Feature | Description |
|---------|-------------|
| **Text Chat** | Real-time messaging with markdown support |
| **Voice Chat** | Crystal-clear audio with push-to-talk or voice activation |
| **Video Chat** | Face-to-face with your squad |
| **Screen Share** | Share your gameplay, multiple windows at once |
| **Direct Messages** | Private convos with friends |

### Gaming Integration

| Feature | Description |
|---------|-------------|
| **Steam Profiles** | Link your Steam account |
| **Game Matching** | See games you share with friends |
| **Play Suggestions** | AI suggests games based on shared playtime |
| **Minimal Footprint** | Sits quietly in your system tray while you game |

### Community Tools

| Feature | Description |
|---------|-------------|
| **Channels** | Organize discussions by topic |
| **Groups & Permissions** | Create groups and control feature access |
| **Email Invites** | Bring your friends aboard |
| **User Profiles** | Customizable with avatars and display names |
| **File Sharing** | Share folders with other users (P2P) |

---

## Media Bots

F7Lans includes 7 built-in media bots that admins can enable for their community:

### YouTube Bot
Stream YouTube videos in voice channels.
- Paste a URL, everyone watches together
- Video info preview before playing
- Multiple streams in different channels

### Plex Bot
Stream media from your Plex Media Server.
- Connect with your Plex token
- Search your library
- Stream movies, shows, and music to voice channels

### Emby Bot
Stream from Emby Media Server.
- API key authentication
- Search and stream your library
- Support for movies, series, and music

### Jellyfin Bot
Stream from Jellyfin (free Plex alternative).
- Same features as Emby bot
- Open-source media server support

### IPTV Bot
Watch live TV together with EPG support.
- Load M3U playlists from any IPTV provider
- XMLTV EPG (TV guide) integration
- Channel groups and categories
- Schedule recordings and tag users

### Spotify Bot
Collaborative music playback.
- OAuth connection to Spotify
- Search tracks, albums, playlists
- Queue system for fair play
- Everyone hears the same music

### Chrome Bot
Shared browser sessions.
- Start a shared Chromium instance
- Navigate together
- Transfer control between users
- Great for watching videos, browsing together

---

## Groups & Access Control

Control who can use what features:

### How It Works
1. **Admin creates groups** (e.g., "Trusted Members", "Music Lovers")
2. **Assign permissions** to each group (which bots, file sharing, etc.)
3. **Add users** to groups
4. **Users inherit permissions** from all their groups

### Available Permissions
- Voice/text channels, screen sharing
- Each media bot (YouTube, Plex, Emby, Jellyfin, IPTV, Spotify, Chrome)
- File sharing
- Admin panel access

### Default Groups
- **Everyone** — All users, basic permissions
- **Admins** — Full access to everything

---

## File Sharing

Share folders peer-to-peer with your community:

### How It Works
1. Admin enables file sharing
2. Users with permission can mark local folders as "shared"
3. Other users browse and download files
4. Files transfer directly between users (P2P)

### Features
- Native folder picker (Electron client)
- Browse folder contents in-app
- Download files from online users
- Privacy control — only share what you want

---

## Desktop App

The desktop client is built for gamers who need performance:

- **System Tray** — Minimize and forget, notifications when you need them
- **Push-to-Talk** — Configurable hotkeys
- **Voice Activation** — Hands-free when you want it
- **Multi-Monitor** — Share any screen or window
- **Low Resources** — Won't tank your FPS
- **File Sharing** — Native folder selection dialog

### Building the Desktop Client

```bash
# Windows
scripts/build-electron.bat

# Linux
cd electron-client
npm install
npm run build:linux

# Or manually
cd electron-client
npm install
npm run build
```

Find your installer in `electron-client/dist/`

---

## Federation

Run multiple F7Lans servers? Connect them together!

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Server A   │────│  Server B   │────│  Server C   │
│  50 users   │     │  30 users   │     │  75 users   │
└─────────────┘     └─────────────┘     └─────────────┘
        │                   │                   │
        └───────────────────┴───────────────────┘
                    Federated Network
                      155 users
```

**How it works:**
1. Admin initiates federation from Server A to Server B
2. Servers exchange authentication tokens
3. Channels sync automatically (conflicts are resolved smartly)
4. Messages flow between servers in real-time

[Learn more about Federation →](docs/FEDERATION.md)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Node.js, Express, Socket.IO |
| **Database** | MongoDB |
| **Frontend** | React |
| **Desktop** | Electron |
| **Voice/Video** | WebRTC |
| **Container** | Docker |

---

## Documentation

| Document | Description |
|----------|-------------|
| [Installation Guide](docs/INSTALLATION.md) | Detailed setup instructions |
| [Features Guide](docs/FEATURES.md) | Complete feature documentation |
| [Federation Guide](docs/FEDERATION.md) | Multi-server networking |
| [API Reference](docs/API.md) | REST & WebSocket endpoints |
| [Architecture](docs/ARCHITECTURE.md) | System design & components |
| [Development Guide](docs/DEVELOPMENT.md) | Contributing & building |

---

## Admin Quick Reference

### Setting Up Media Bots

1. Go to **Settings** → **Administration** → **Media Bots**
2. Click the bot you want to configure
3. Enable the bot and configure connection settings
4. Users with permission can now use it

### Setting Up Groups

1. Go to **Settings** → **Administration** → **Groups**
2. Create new groups or edit existing ones
3. Set permissions for each group
4. Add users to groups

### Enabling File Sharing

1. Go to **Settings** → **Administration** → **Features** → **File Sharing**
2. Enable file sharing globally
3. Grant "file-share" permission to appropriate groups
4. Users can now share folders

---

## Contributing

We'd love your help making F7Lans better!

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/awesome-thing`)
3. Commit your changes (`git commit -m 'Add awesome thing'`)
4. Push to the branch (`git push origin feature/awesome-thing`)
5. Open a Pull Request

---

## Community

- **Issues** — Found a bug? [Let us know](https://github.com/yourusername/f7lans/issues)
- **Discussions** — Ideas? Questions? [Start a discussion](https://github.com/yourusername/f7lans/discussions)

---

## License

MIT License — Do whatever you want with it. Just don't blame us if something breaks.

---

<p align="center">
  <strong>Built with coffee and late-night gaming sessions</strong><br>
  <sub>F7Lans — Because your community deserves better</sub>
</p>
