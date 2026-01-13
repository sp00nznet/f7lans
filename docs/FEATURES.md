# Features Guide

Detailed overview of everything F7Lans can do.

---

## Table of Contents

- [Communication](#communication)
- [User System](#user-system)
- [Gaming Integration](#gaming-integration)
- [Administration](#administration)
- [Desktop Client](#desktop-client)
- [Federation](#federation)

---

## Communication

### Text Channels

Create topic-based text channels for your community.

**Features:**
- Real-time message delivery via WebSocket
- Markdown formatting support
- File attachments (images, documents)
- Message editing and deletion
- Reply threading
- Emoji reactions
- Message pinning
- Typing indicators
- Read receipts
- Message history (persistent)

**Channel Types:**
| Type | Description | Icon |
|------|-------------|------|
| Text | General discussion | # |
| Announcement | Admin-only posting | 📢 |
| Voice | Voice chat enabled | 🔊 |
| Video | Video/screen share enabled | 📹 |

### Voice Chat

High-quality voice communication using WebRTC.

**Features:**
- Low-latency peer-to-peer audio
- Echo cancellation
- Noise suppression
- Automatic gain control
- Per-user volume control
- Mute/unmute toggle
- Deafen toggle (mute incoming audio)
- Speaking indicators
- Voice activation detection

**Audio Quality:**
- Sample rate: 48kHz
- Mono channel (optimized for voice)
- Opus codec
- Adaptive bitrate

### Video Chat

Face-to-face communication when voice isn't enough.

**Features:**
- HD video (720p default, 1080p supported)
- Multiple video streams
- Grid view for group calls
- Video on/off toggle
- Camera selection
- Bandwidth adaptation

### Screen Sharing

Share your gameplay, presentations, or applications.

**Features:**
- Share entire screen
- Share specific window
- Share browser tab
- Multiple simultaneous shares
- Audio sharing (system audio)
- Quality presets (720p, 1080p, source)

### Direct Messages

Private one-on-one conversations.

**Features:**
- End-to-end privacy
- Message history
- Online status visibility
- Typing indicators
- Read receipts
- Block users
- Message search

---

## User System

### Registration & Authentication

**Registration Options:**
- Username/password
- Email verification (optional)
- Invite code requirement (configurable)

**Security:**
- Passwords hashed with bcrypt (12 rounds)
- JWT tokens for sessions
- Token expiration (configurable, default 7 days)
- Secure password requirements

### User Profiles

Personalize your presence.

**Profile Fields:**
| Field | Description | Public |
|-------|-------------|--------|
| Username | Login name (unique) | Yes |
| Display Name | Customizable name | Yes |
| Avatar | Profile picture | Yes |
| Status | online/away/busy/offline | Yes |
| Steam ID | Gaming profile link | Yes |
| Email | Contact info | No |

**Status Options:**
- 🟢 Online - Available
- 🟡 Away - Idle/AFK
- 🔴 Busy - Do not disturb
- ⚫ Offline - Disconnected

### Friends System

Connect with other users.

**Features:**
- Send friend requests
- Accept/decline requests
- Remove friends
- Block users
- See friends' online status
- Quick access to DM friends

### User Settings

Customize your experience.

**Appearance:**
- Theme (dark/light)
- Font size
- Compact mode

**Audio:**
- Input device selection
- Output device selection
- Input volume (microphone)
- Output volume (speakers)
- Push-to-talk toggle
- Push-to-talk key binding
- Voice activation sensitivity

**Notifications:**
- Desktop notifications
- Sound alerts
- Mention highlights
- DM notifications

---

## Gaming Integration

### Steam Profile Integration

Connect your Steam account.

**Setup:**
1. Go to Profile Settings
2. Enter your Steam ID (64-bit or vanity URL)
3. Profile must be public for game data

**Features:**
- Steam profile link in your F7Lans profile
- Others can view your Steam profile
- Game library comparison

### Game Matching

Find games to play together.

**How It Works:**
1. Both users must have Steam IDs configured
2. View another user's profile
3. See "Common Games" section
4. Games sorted by combined playtime

**Display:**
```
┌─────────────────────────────────────────┐
│ Common Games with @friend               │
├─────────────────────────────────────────┤
│ 🎮 Counter-Strike 2                     │
│    You: 1,500 hrs | Them: 2,000 hrs    │
│    [Play Together]                      │
├─────────────────────────────────────────┤
│ 🎮 Rust                                 │
│    You: 800 hrs | Them: 1,200 hrs      │
│    [Play Together]                      │
└─────────────────────────────────────────┘
```

### Play Suggestions

AI-powered game recommendations.

**Algorithm:**
1. Find games both users own
2. Weight by combined playtime
3. Prioritize recently played
4. Suggest multiplayer-focused titles

---

## Administration

### Role System

Hierarchical permission system.

**Roles:**
| Role | Permissions |
|------|-------------|
| User | Basic access, messaging |
| Moderator | Delete messages, kick users |
| Admin | Manage channels, ban users |
| Super Admin | Full control, manage admins |

### User Management

Control your community.

**Features:**
- View all users
- Search users
- Change user roles
- Ban/unban users
- View user activity
- Reset user passwords (super admin)

### Channel Management

Organize your server.

**Features:**
- Create channels
- Edit channel settings
- Delete channels
- Reorder channels
- Set channel permissions
- Create categories

### Invite System

Controlled growth.

**Features:**
- Generate invite codes
- Set max uses per invite
- Set expiration dates
- Email invites directly
- Track invite usage
- Revoke invites

### Server Statistics

Monitor your community.

**Metrics:**
- Total users
- Online users
- New users (daily/weekly)
- Total messages
- Messages per day
- Active channels
- Peak usage times

---

## Desktop Client

### Windows Application

Native Windows experience.

**System Requirements:**
- Windows 10/11
- 4GB RAM
- 200MB disk space

### System Tray

Minimal footprint while gaming.

**Features:**
- Minimize to tray (close button = tray)
- Tray icon status indicator
- Right-click menu
  - Open F7Lans
  - Status (Online/Away/Busy)
  - Mute
  - Quit
- Click to restore
- Notification badges

### Push-to-Talk

Control when you transmit.

**Configuration:**
1. Settings > Audio > Push-to-Talk
2. Enable toggle
3. Click "Set Key"
4. Press desired key (e.g., V, Mouse4)

**Supported Keys:**
- All keyboard keys
- Mouse buttons (4, 5)
- Modifier combinations

### Voice Activation

Hands-free communication.

**Configuration:**
1. Settings > Audio > Voice Activation
2. Enable toggle
3. Set sensitivity threshold
4. Speak to test (meter shows input level)

**Tips:**
- Lower sensitivity = more sensitive
- Test in quiet environment
- Adjust if picking up background noise

### Multi-Screen Support

Share any screen or window.

**Screen Sharing:**
1. Join a video-enabled channel
2. Click "Share Screen"
3. Select:
   - Entire Screen
   - Application Window
   - Browser Tab
4. Choose quality preset
5. Start sharing

**Multiple Shares:**
- Share multiple windows simultaneously
- Each appears as separate stream
- Others can choose which to view

### Notifications

Stay informed.

**Types:**
- New message mentions
- Direct messages
- Friend requests
- Voice channel activity

**Settings:**
- Enable/disable per type
- Sound on/off
- Focus assist integration

---

## Federation

### What is Federation?

Connect multiple F7Lans servers together.

**Use Cases:**
- Gaming clan alliances
- Regional servers connecting
- Event coordination
- Scaling beyond single server

### How It Works

```
Your Server ──────► Target Server
    │                    │
    │ 1. Request         │
    │ ─────────────────► │
    │                    │
    │ 2. Review          │
    │ ◄───────────────── │
    │                    │
    │ 3. Approval        │
    │ ◄═══════════════► │
    │                    │
    │ 4. Connected!      │
    │ ◄═══════════════► │
```

### Channel Sync

Share channels across servers.

**Process:**
1. Federation established
2. Channels analyzed for conflicts
3. Conflicts resolved (rename smaller server's channels)
4. Channels synced in real-time
5. Messages relay between servers

**Federated Messages:**
```
┌─────────────────────────────────────┐
│ #general (Federated)                │
├─────────────────────────────────────┤
│ [Local User] Hello!                 │
│ [User@Partner Server] Hi there!     │
│ [Local User] Anyone want to play?   │
│ [User@Partner Server] Sure!         │
└─────────────────────────────────────┘
```

### Conflict Resolution

Smart handling of duplicate channel names.

**Rules:**
1. Server with more users keeps original name
2. Smaller server's channel is renamed
3. Suggested format: `channelname-federated`
4. Admins can customize names

**Example:**
```
Server A (100 users):  #general → stays #general
Server B (50 users):   #general → becomes #general-federated
```

### Security

Server-to-server authentication.

**Mechanism:**
- Shared secret per server pair
- HMAC-SHA256 signed requests
- Timestamp validation (5-min window)
- TLS encryption required

### Managing Federation

Admin controls.

**Actions:**
- View connected servers
- Monitor connection status
- Adjust sync settings
- Temporarily disconnect
- Permanently remove federation

---

## Upcoming Features

Features planned for future releases:

- [ ] OAuth providers (Discord, Steam, Google)
- [ ] YouTube bot for music/video playback
- [ ] Mobile applications (iOS, Android)
- [ ] File sharing improvements
- [ ] Voice channel permissions
- [ ] Custom emojis
- [ ] Server templates
- [ ] Audit logs
- [ ] Webhooks/integrations
- [ ] Two-factor authentication

---

Have feature requests? [Open an issue](https://github.com/yourusername/f7lans/issues)!
