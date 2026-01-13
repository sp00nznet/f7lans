# Features Guide

Detailed overview of everything F7Lans can do.

---

## Table of Contents

- [Communication](#communication)
- [User System](#user-system)
- [Gaming Integration](#gaming-integration)
- [Media Bots](#media-bots)
- [Groups & Access Control](#groups--access-control)
- [File Sharing](#file-sharing)
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

## Media Bots

F7Lans includes 7 built-in media bots. Admins enable bots, and users with permission can use them.

### YouTube Bot

Stream YouTube videos to voice channels.

**Admin Setup:**
1. Go to Settings → Administration → Media Bots → YouTube
2. Enable the bot
3. (No external configuration required)

**User Features:**
- Paste YouTube URL to play
- Preview video info before playing
- See active streams
- Stop streams

**How It Works:**
- Uses ytdl-core to extract stream URLs
- Audio/video sent to voice channel participants
- Multiple streams in different channels

### Plex Bot

Stream media from Plex Media Server.

**Admin Setup:**
1. Go to Settings → Administration → Media Bots → Plex
2. Enable the bot
3. Enter Plex server URL and authentication token

**Getting Plex Token:**
1. Sign in to Plex web app
2. Open browser developer tools (F12)
3. Look for `X-Plex-Token` in network requests

**User Features:**
- Search Plex library
- Play movies, shows, music
- See what's currently playing
- Stop streams

### Emby Bot

Stream media from Emby Media Server.

**Admin Setup:**
1. Go to Settings → Administration → Media Bots → Emby
2. Enable the bot
3. Enter Emby server URL
4. Enter API key (Settings → API Keys in Emby)

**User Features:**
- Search library (movies, series, music)
- Play media in voice channels
- Thumbnail previews
- Stop streams

### Jellyfin Bot

Stream media from Jellyfin (open-source Emby alternative).

**Admin Setup:**
1. Go to Settings → Administration → Media Bots → Jellyfin
2. Enable the bot
3. Enter Jellyfin server URL
4. Enter API key (Dashboard → API Keys in Jellyfin)

**User Features:**
- Same as Emby bot
- Full Jellyfin API support

### IPTV Bot

Watch live TV together with electronic program guide (EPG).

**Admin Setup:**
1. Go to Settings → Administration → Media Bots → IPTV
2. Enable the bot
3. Enter M3U playlist URL (from your IPTV provider)
4. Optionally enter XMLTV EPG URL for TV guide data

**M3U Playlist:**
Standard format from most IPTV providers:
```
#EXTM3U
#EXTINF:-1 tvg-id="channel1" tvg-logo="..." group-title="News",CNN
http://stream-url.com/cnn
#EXTINF:-1 tvg-id="channel2" group-title="Sports",ESPN
http://stream-url.com/espn
```

**User Features:**
- Browse channels by group/category
- See TV guide (current and upcoming shows)
- Watch channels in voice channels
- Change channels
- Schedule recordings
- Tag other users on recordings

**Recording System:**
- Schedule recording by selecting a program
- Recordings tied to user account
- Tag other users to notify them
- View scheduled and completed recordings

### Spotify Bot

Collaborative music playback with Spotify.

**Admin Setup:**
1. Go to Settings → Administration → Media Bots → Spotify
2. Enable the bot
3. Create a Spotify Developer app at https://developer.spotify.com/dashboard
4. Enter Client ID and Client Secret
5. Click "Connect to Spotify" to authorize

**Note:** Requires Spotify Premium for full playback features.

**User Features:**
- Search tracks, albums, playlists
- Play music in voice channels
- Add songs to queue
- Skip current track
- View queue
- See user's playlists

**Queue System:**
- Fair play - users take turns
- Anyone can add to queue
- Queue persists until stream stops

### Chrome Bot

Shared browser sessions for collaborative browsing.

**Admin Setup:**
1. Go to Settings → Administration → Media Bots → Chrome
2. Enable the bot

**User Features:**
- Start a shared browser session
- Navigate to any URL
- Back/forward navigation
- Refresh page
- Transfer control to other users
- Multiple users watch the same session

**Control Transfer:**
- One user has control at a time
- Controller can transfer to anyone in session
- Great for demos, tutorials, watching videos together

**Use Cases:**
- Watch YouTube/Twitch together
- Collaborative shopping
- Demo websites
- Browse together in voice chat

---

## Groups & Access Control

Fine-grained permission control for your community.

### Understanding Groups

Groups are collections of users with shared permissions. Users can belong to multiple groups, and their effective permissions are the union of all group permissions.

### Default Groups

**Everyone**
- All users automatically belong to this group
- Cannot be deleted
- Default permissions: voice/text channels

**Admins**
- Users with admin/superadmin role
- Full access to all features
- Cannot be deleted

### Creating Groups

1. Go to Settings → Administration → Groups
2. Click "Create" button
3. Enter group name and description
4. Set initial permissions
5. Add users to the group

### Group Permissions

| Permission | Description |
|------------|-------------|
| `voice-channels` | Join and use voice channels |
| `text-channels` | Send messages in text channels |
| `screen-share` | Share screen in voice channels |
| `youtube-bot` | Use YouTube bot |
| `plex-bot` | Use Plex bot |
| `emby-bot` | Use Emby bot |
| `jellyfin-bot` | Use Jellyfin bot |
| `chrome-bot` | Use Chrome bot |
| `iptv-bot` | Use IPTV bot |
| `spotify-bot` | Use Spotify bot |
| `file-share` | Share and access shared files |
| `admin-panel` | Access admin settings |

### Managing Group Membership

**Adding Users:**
1. Open Groups modal
2. Click "Members" on target group
3. Select user from dropdown
4. Click "Add"

**Removing Users:**
1. Open group members
2. Click "Remove" next to user
3. User loses group permissions immediately

### Best Practices

- Create role-based groups ("Moderators", "Trusted Members", "New Users")
- Use "Everyone" for base permissions
- Create specific groups for bot access ("Music Lovers" for Spotify)
- Review group membership regularly

---

## File Sharing

Peer-to-peer file sharing between community members.

### How It Works

1. Admin enables file sharing globally
2. Users with `file-share` permission can participate
3. Users mark local folders as "shared"
4. Other users browse and download files
5. Files transfer directly between users (P2P)

### Admin Setup

1. Go to Settings → Administration → Features → File Sharing
2. Toggle "Enable" to turn on file sharing
3. Grant `file-share` permission to appropriate groups

### Sharing Folders

**Desktop Client:**
1. Click the 📁 button in the user panel
2. Click "Share a Folder"
3. Select folder using native file picker
4. Folder appears in your shared list

**Web Client:**
1. Open file sharing modal
2. Enter folder path manually
3. Enter display name for the folder

### Browsing Shared Files

1. Open file sharing (📁 button)
2. See "Browse Shared Files" section
3. Click "Browse" on any folder
4. Navigate through directories
5. Click "Download" on files

### Important Notes

- Files only available when owner is online
- Downloads are peer-to-peer (direct between users)
- Shared folder paths are visible to others
- Choose what you share carefully

### Security Considerations

- Only share folders you intend to be public
- Don't share sensitive documents
- File paths are visible to users with access
- Consider creating a dedicated "shared" folder

---

## Administration

### Role System

Hierarchical permission system.

**Roles:**
| Role | Permissions |
|------|-------------|
| User | Basic access, messaging |
| Moderator | Delete messages, kick users |
| Admin | Manage channels, ban users, configure bots |
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
- Assign users to groups

### Channel Management

Organize your server.

**Features:**
- Create channels
- Edit channel settings
- Delete channels
- Reorder channels
- Set channel permissions
- Create categories
- Kick users from voice channels

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

### Linux Application

Native Linux support.

**Formats:**
- AppImage (portable)
- .deb (Debian/Ubuntu)

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

### File Sharing Integration

Native folder selection.

**Features:**
- Click 📁 button in user panel
- Native folder picker dialog
- Seamless sharing experience

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

## Coming Soon

Features in development:

- [ ] OAuth providers (Discord, Steam, Google)
- [ ] Mobile applications (iOS, Android)
- [ ] Voice channel permissions
- [ ] Custom emojis
- [ ] Server templates
- [ ] Audit logs
- [ ] Webhooks/integrations
- [ ] Two-factor authentication

---

Have feature requests? [Open an issue](https://github.com/yourusername/f7lans/issues)!
