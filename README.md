<p align="center">
  <img src="client/public/logo.svg" alt="F7Lans Logo" width="150" height="150">
</p>

<h1 align="center">
  <pre>
███████╗███████╗██╗      █████╗ ███╗   ██╗███████╗
██╔════╝╚════██║██║     ██╔══██╗████╗  ██║██╔════╝
█████╗      ██╔╝██║     ███████║██╔██╗ ██║███████╗
██╔══╝     ██╔╝ ██║     ██╔══██║██║╚██╗██║╚════██║
██║        ██║  ███████╗██║  ██║██║ ╚████║███████║
╚═╝        ╚═╝  ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝
  </pre>
</h1>

<p align="center">
  <strong>The Self-Hosted Gaming Community Platform</strong><br>
  <sub>Voice, Video, Streaming, Emulators, Media Bots, File Sharing, Federation — All in One</sub>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-feature-overview">Features</a> •
  <a href="#-media-bots">Bots</a> •
  <a href="#-emulator-multiplayer">Emulators</a> •
  <a href="#-comparison">Compare</a> •
  <a href="#-documentation">Docs</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-ff8c00?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-4ecdc4?style=for-the-badge" alt="License">
  <img src="https://img.shields.io/badge/node-%3E%3D18-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node">
  <img src="https://img.shields.io/badge/docker-ready-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Windows-0078D6?style=flat-square&logo=windows&logoColor=white" alt="Windows">
  <img src="https://img.shields.io/badge/Linux-FCC624?style=flat-square&logo=linux&logoColor=black" alt="Linux">
  <img src="https://img.shields.io/badge/macOS-000000?style=flat-square&logo=apple&logoColor=white" alt="macOS">
  <img src="https://img.shields.io/badge/Web-4285F4?style=flat-square&logo=googlechrome&logoColor=white" alt="Web">
</p>

---

## What is F7Lans?

**F7Lans** is a fully-featured, self-hosted alternative to Discord built specifically for gaming communities. Run your own server, keep your data private, and enjoy features that would cost money elsewhere — completely free.

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│   Your Server          Your Data          Your Rules                 │
│        ⬇                   ⬇                  ⬇                      │
│   ┌─────────┐         ┌─────────┐        ┌─────────┐                │
│   │  Host   │         │ Private │        │  No     │                │
│   │ Locally │         │ MongoDB │        │ Nitro   │                │
│   └─────────┘         └─────────┘        └─────────┘                │
│                                                                      │
│   12 Built-in Bots • Game Together • 8K Streaming • Federation      │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

**Get running in under 5 minutes:**

### Docker (Recommended)

```bash
git clone https://github.com/yourusername/f7lans.git
cd f7lans

# Linux/macOS
./scripts/docker-start.sh

# Windows
scripts\quickstart.bat

# Or run manually:
docker-compose up -d
```

### Manual Setup (Debian 12)

```bash
# One-click setup - installs Node.js, dependencies, everything
./scripts/setup-debian.sh

# Start the server
./scripts/start-server.sh
```

### Manual Setup (Windows)

```batch
:: Run setup
scripts\setup.bat

:: Start the server
scripts\start-server.bat
```

**Open `http://localhost:3001`**
Default login: `admin` / `admin123` (change this immediately!)

---

## Feature Overview

### Communication

| Feature | Description |
|:--------|:------------|
| **Text Chat** | Real-time messaging, markdown, reactions, pins, typing indicators |
| **Voice Chat** | Crystal-clear WebRTC audio with echo/noise cancellation |
| **Video Chat** | HD video calls (720p/1080p) with grid view |
| **Screen Share** | Share screens, windows, or tabs — multiple at once |
| **Direct Messages** | Private conversations with online status |

### Gaming Integration

| Feature | Description |
|:--------|:------------|
| **Steam Integration** | OAuth verification, profile linking |
| **Game Matching** | Find common games with friends |
| **Play Suggestions** | AI recommendations based on playtime |
| **Activity Tracking** | See who's playing what, with stats |
| **Leaderboards** | Server-wide gaming statistics |

### Community Management

| Feature | Description |
|:--------|:------------|
| **Channels** | Text, voice, video, and announcement channels |
| **Groups & Permissions** | Role-based access control for every feature |
| **Per-Channel Bot Control** | Enable/disable bots per channel |
| **Email Invites** | Send invites with expiration and max uses |
| **Admin Delegation** | Grant admin access to trusted users |
| **Server Branding** | Custom server icon and name |

### Security

| Feature | Description |
|:--------|:------------|
| **Two-Factor Auth (2FA)** | TOTP with backup codes |
| **Social Account Linking** | Steam, Xbox, PlayStation, Blizzard, Reddit, Twitter |
| **Password Security** | Bcrypt hashing, secure requirements |
| **JWT Authentication** | Token-based sessions |

### Desktop App

| Feature | Description |
|:--------|:------------|
| **System Tray** | Minimize while gaming |
| **Push-to-Talk** | Configurable hotkeys |
| **Voice Activation** | Hands-free communication |
| **Multi-Server** | Connect to multiple F7Lans servers |
| **Low Resources** | Won't tank your FPS |

---

## Media Bots

F7Lans includes **12 built-in bots** plus **Game Together** — all free, no subscriptions required:

### Streaming Bots

| Bot | Description | Source |
|:----|:------------|:-------|
| **YouTube** | Stream videos to voice channels | YouTube |
| **Plex** | Stream from your Plex server | Plex Media Server |
| **Emby** | Stream from Emby | Emby Media Server |
| **Jellyfin** | Stream from Jellyfin | Jellyfin (free Plex alt) |
| **IPTV** | Live TV with EPG guide | M3U playlists |
| **Spotify** | Collaborative music with queue | Spotify Premium |
| **Twitch** | Watch streams together | Twitch |

### Utility Bots

| Bot | Description |
|:----|:------------|
| **Chrome** | Shared browser sessions with control transfer |
| **Image Search** | Google image search with NSFW filtering |
| **Activity Stats** | Server-wide gaming leaderboards |
| **RPG** | Tabletop text adventures (6 classes, 5 settings) |

### Gaming Bots

| Bot | Description |
|:----|:------------|
| **Emulator** | Play retro games together with 4 players (Xbox, Dreamcast, GameCube, PS3) |
| **Game Together** | Virtual controllers for ANY local multiplayer game |

[Full bot documentation →](docs/BOTS.md)

---

## Emulator Multiplayer

**Play classic console games together in voice chat!**

```
┌────────────────────────────────────────────────────────────────┐
│                    EMULATOR MULTIPLAYER                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│   │   XBOX   │  │DREAMCAST │  │ GAMECUBE │  │   PS3    │     │
│   │  (xemu)  │  │(flycast) │  │(Dolphin) │  │ (RPCS3)  │     │
│   │ 4 Players│  │ 4 Players│  │ 4 Players│  │ 4 Players│     │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│                                                                │
│   [P1: You]  [P2: @friend]  [P3: Empty]  [P4: Empty]         │
│                                                                │
│   Video streams to voice channel                               │
│   Controller input via Xbox gamepad on your PC                 │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Supported Emulators

| Console | Emulator | Players | ROM Formats |
|:--------|:---------|:-------:|:------------|
| **Xbox** | [xemu](https://xemu.app/) | 4 | .iso, .xiso |
| **Dreamcast** | [flycast](https://flycast.github.io/) | 4 | .gdi, .cdi, .chd |
| **GameCube/Wii** | [Dolphin](https://dolphin-emu.org/) | 4 | .iso, .gcm, .wbfs, .rvz |
| **PlayStation 3** | [RPCS3](https://rpcs3.net/) | 4 | .pkg, EBOOT.BIN |

### How It Works

1. **Join a voice channel** and click the Emulator button
2. **Select an emulator** and choose a game from your ROM library
3. **Video streams** to everyone in the voice channel via FFmpeg
4. **Up to 4 players** can join by clicking on player slots
5. **Use your Xbox controller** — input is sent at 60Hz over WebSocket

### Controller Support

Players use their local Xbox controllers (or any XInput-compatible gamepad):

| Xbox Button | Dreamcast | GameCube | PS3 |
|:------------|:----------|:---------|:----|
| A | A | A | Cross |
| B | B | B | Circle |
| X | X | X | Square |
| Y | Y | Y | Triangle |
| LB/RB | L/R | L/R | L1/R1 |
| LT/RT | Analog | Analog | L2/R2 |

---

## Federation

**Connect multiple F7Lans servers into one mega-community:**

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Server Alpha  │────│   Server Beta   │────│   Server Gamma  │
│    50 users     │     │    30 users     │     │    75 users     │
│   West Coast    │     │   East Coast    │     │     Europe      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                      │                       │
         └──────────────────────┴───────────────────────┘
                        Federated Network
                          155 total users
                     Real-time message sync
```

**Features:**
- Automatic channel synchronization
- Real-time message relay
- Smart conflict resolution
- HMAC-SHA256 server authentication
- User presence across all servers

[Federation guide →](docs/FEDERATION.md)

---

## Comparison

### F7Lans vs Discord

| Feature | F7Lans | Discord Free | Discord Nitro |
|:--------|:------:|:------------:|:-------------:|
| **Self-Hosted** | Yes | No | No |
| **Voice Chat** | Unlimited | Unlimited | Unlimited |
| **Video Chat** | Yes | Yes | Yes |
| **Screen Share** | Up to 8K@30 / 4K@60 | 720p 30fps | 1080p 60fps |
| **Multiple Screens** | Yes | No | Yes |
| **File Upload Limit** | Unlimited* | 25MB | 500MB |
| **Custom Server Icon** | Yes | Yes | Yes |
| **YouTube Bot** | Built-in | No | No |
| **Plex/Emby/Jellyfin** | Built-in | No | No |
| **IPTV (Live TV)** | Built-in | No | No |
| **Spotify Bot** | Built-in | No | No |
| **Shared Browser** | Built-in | No | No |
| **Emulator (4-player)** | Built-in | No | No |
| **P2P File Sharing** | Built-in | No | No |
| **RPG Bot** | Built-in | No | No |
| **Federation** | Yes | No | No |
| **Steam Integration** | OAuth | Limited | Limited |
| **Two-Factor Auth** | Yes | Yes | Yes |
| **Custom Themes** | 5 built-in | No | No |
| **Data Privacy** | Your server | Discord's servers | Discord's servers |
| **Price** | **Free** | Free | $9.99/mo |

<sub>* Limited by your server's disk space</sub>

### Why Choose F7Lans?

| You Want... | F7Lans Delivers |
|:------------|:----------------|
| Privacy | Your data stays on YOUR server |
| Media streaming | 7 streaming bots built-in |
| Retro gaming | 4 emulators with multiplayer |
| Live TV | IPTV with EPG guide |
| File sharing | P2P folder sharing |
| Multiple servers | Federation support |
| No monthly fees | Everything free, forever |

---

## Tech Stack

| Layer | Technology |
|:------|:-----------|
| **Backend** | Node.js, Express, Socket.IO |
| **Database** | MongoDB |
| **Frontend** | React |
| **Desktop** | Electron |
| **Voice/Video** | WebRTC |
| **Video Capture** | FFmpeg |
| **Container** | Docker |

---

## Documentation

| Document | Description |
|:---------|:------------|
| [Installation Guide](docs/INSTALLATION.md) | Docker, manual, and production setup |
| [Features Guide](docs/FEATURES.md) | Complete feature documentation |
| [Bots Guide](docs/BOTS.md) | All 13 bots with setup instructions |
| [Federation Guide](docs/FEDERATION.md) | Multi-server networking |
| [API Reference](docs/API.md) | REST & WebSocket endpoints |
| [Architecture](docs/ARCHITECTURE.md) | System design & components |
| [Development Guide](docs/DEVELOPMENT.md) | Contributing & building |

---

## Admin Quick Reference

### Setting Up Bots

1. Go to **Settings** → **Administration** → **Media Bots**
2. Enable the bot and configure settings
3. Grant permissions via **Groups**
4. Optionally disable per-channel in channel settings

### Setting Up Groups

1. Go to **Settings** → **Administration** → **Groups**
2. Create groups (e.g., "Trusted Members", "Music Lovers")
3. Set permissions for each group
4. Add users to groups

### Enabling Emulators

1. Install emulators on your server:
   - [xemu](https://xemu.app/) (Xbox)
   - [flycast](https://flycast.github.io/) (Dreamcast)
   - [Dolphin](https://dolphin-emu.org/) (GameCube/Wii)
   - [RPCS3](https://rpcs3.net/) (PS3)
2. Configure ROM paths in admin settings
3. Enable the Emulator Bot
4. Users can start sessions from voice channels

### Enabling Federation

1. Go to **Settings** → **Administration** → **Federation**
2. Click "Add Server" and enter partner server URL
3. Exchange authentication tokens
4. Channels sync automatically

---

## Build Scripts

F7Lans includes one-click build scripts for all platforms:

### Server & Setup

| Script | Platform | Description |
|:-------|:---------|:------------|
| `scripts/setup-debian.sh` | Linux | Complete Debian 12 setup (Node.js, deps, env) |
| `scripts/setup.bat` | Windows | Complete Windows setup |
| `scripts/start-server.sh` | Linux | Start server directly |
| `scripts/start-server.bat` | Windows | Start server directly |

### Docker

| Script | Platform | Description |
|:-------|:---------|:------------|
| `scripts/docker-build.sh` | Linux | Build Docker containers |
| `scripts/docker-start.sh` | Linux | Start containers (auto-builds if needed) |
| `scripts/docker-stop.sh` | Linux | Stop all containers |
| `scripts/docker-build.bat` | Windows | Build Docker containers |
| `scripts/docker-start.bat` | Windows | Start containers |
| `scripts/docker-stop.bat` | Windows | Stop containers |
| `scripts/build-webclient.sh` | Linux | Build containerized web client |

### Desktop Client (Electron)

| Script | Platform | Output |
|:-------|:---------|:-------|
| `scripts/build-electron.ps1` | Windows | One-click build (auto-installs Node.js via winget/choco) |
| `scripts/build-electron.bat` | Windows | Build NSIS installer + portable exe |
| `scripts/build-electron.sh` | Linux | Build AppImage + .deb package |

**Windows (PowerShell - Recommended):**
```powershell
# One-click: installs Node.js if needed, builds everything
powershell -ExecutionPolicy Bypass -File scripts\build-electron.ps1
```

**Linux (Debian):**
```bash
# One-click: installs deps if needed, builds AppImage + .deb
./scripts/build-electron.sh
```

Installers are output to `electron-client/dist/`

---

## Project Structure

```
f7lans/
├── server/                 # Node.js backend
│   ├── services/           # Bot services (13 bots)
│   ├── controllers/        # API controllers
│   ├── models/             # MongoDB schemas
│   ├── socket/             # WebSocket handlers
│   └── routes/             # REST API routes
├── client/                 # Web client (React)
├── electron-client/        # Desktop client (Electron)
│   ├── main.js             # Electron main process
│   └── renderer/           # UI code
├── mobile/                 # Mobile app (Capacitor)
├── docs/                   # Documentation
└── scripts/                # Build scripts
```

---

## Contributing

We welcome contributions!

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/awesome-thing`)
3. Commit your changes (`git commit -m 'Add awesome thing'`)
4. Push to the branch (`git push origin feature/awesome-thing`)
5. Open a Pull Request

See [Development Guide](docs/DEVELOPMENT.md) for setup instructions.

---

## Community

- **Issues** — [Report bugs](https://github.com/yourusername/f7lans/issues)
- **Discussions** — [Ideas & questions](https://github.com/yourusername/f7lans/discussions)

---

## License

MIT License — Do whatever you want with it.

---

<p align="center">
  <strong>Built with coffee and late-night gaming sessions</strong><br>
  <sub>F7Lans — Because your community deserves better</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/made%20with-%E2%9D%A4-ff6b6b?style=for-the-badge" alt="Made with love">
</p>
