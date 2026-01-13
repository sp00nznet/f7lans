# Features Guide

```
███████╗███████╗██╗      █████╗ ███╗   ██╗███████╗
██╔════╝╚════██║██║     ██╔══██╗████╗  ██║██╔════╝
█████╗      ██╔╝██║     ███████║██╔██╗ ██║███████╗
██╔══╝     ██╔╝ ██║     ██╔══██║██║╚██╗██║╚════██║
██║        ██║  ███████╗██║  ██║██║ ╚████║███████║
╚═╝        ╚═╝  ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝
```

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
- [Multi-Server Support](#multi-server-support)
- [Theming](#theming)
- [Federation](#federation)
- [Activity Tracking](#activity-tracking)
- [Activity Stats Bot](#activity-stats-bot)
- [Tabletop RPG Bot](#tabletop-rpg-bot)
- [Social Account Linking](#social-account-linking)
- [Two-Factor Authentication](#two-factor-authentication)
- [Server Settings](#server-settings)

---

## Communication

### Text Channels

Create topic-based text channels for your community.

**Features:**
- Real-time message delivery via WebSocket
- Markdown formatting support
- File attachments (images, documents)
- **Drag & drop image/GIF sharing**
- Message editing and deletion
- Reply threading
- Emoji reactions
- Message pinning
- Typing indicators
- Read receipts
- Message history (persistent)

**Image Sharing:**
- Drag and drop images directly into chat
- Multiple images at once (up to 5)
- Supported formats: JPEG, PNG, GIF, WebP
- Max file size: 10MB per image
- Preview before sending
- Images display inline in chat

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
- **Join/leave notifications** (soft audio tones)

**Voice Notifications:**
- Rising tone when someone joins
- Falling tone when someone leaves
- Configurable in user settings
- Non-intrusive audio feedback

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

F7Lans includes 12 built-in bots. Admins enable bots globally and can control which bots are available in each channel. Users with permission can use enabled bots.

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

### Twitch Bot

Watch Twitch streams together.

**Admin Setup:**
1. Go to Settings → Administration → Media Bots → Twitch
2. Enable the bot
3. Enter Twitch Client ID and Client Secret (from Twitch Developer Console)

**User Features:**
- Search for live streams
- View stream info (title, game, viewer count)
- Embedded Twitch player and chat
- Watch parties for favorite streamers

### Image Search Bot

Search and share images with safe search filtering.

**Admin Setup:**
1. Go to Settings → Administration → Media Bots → Image Search
2. Enable the bot
3. Enter Google API Key and Custom Search Engine ID
4. Set safe search level (active/medium/off)

**User Features:**
- Search for images: `!image <query>`
- Get next result: `!next`
- Get random from results: `!random`
- NSFW content filtered by default

**Safe Search Levels:**
| Level | Description |
|-------|-------------|
| active | Strict filtering (default) |
| medium | Moderate filtering |
| off | No filtering (admin only) |

### Star Citizen Bot

Helpful tips for Star Citizen players.

**Admin Setup:**
1. Go to Settings → Administration → Media Bots → Star Citizen
2. Enable the bot
3. Select channels to monitor

**Features:**
- Automatic tips when players are gaming
- Category-specific hints
- Location information
- Server status checks

**Commands:**
| Command | Description |
|---------|-------------|
| `!sc [topic]` | Get a tip (topics: combat, mining, trading, exploration, ships, newPlayer) |
| `!schelp` | Show available commands |
| `!sclocation <place>` | Get info about a location |
| `!scstatus` | Check server status |

**Tip Categories:**
- General gameplay
- Combat and dogfighting
- Mining operations
- Trading and cargo
- Exploration and caves
- Ships and navigation
- New player guidance

---

## Per-Channel Bot Settings

Control which bots are available in each channel.

### How It Works

1. Bots are enabled globally in admin settings
2. Admins can then enable/disable bots per channel
3. By default, all bots are enabled in all channels
4. Users can only use bots enabled both globally AND in the channel

### Managing Channel Bots

1. Go to channel settings (gear icon on channel)
2. Toggle individual bots on/off
3. Changes take effect immediately

### Use Cases

- **Gaming channels**: Enable only Activity Stats and RPG bots
- **Music channels**: Enable only Spotify bot
- **Watch party channels**: Enable YouTube, Plex, Twitch bots
- **General channels**: Disable media bots to keep focus on chat

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
| `twitch-bot` | Use Twitch bot |
| `image-bot` | Use Image Search bot |
| `sc-bot` | Use Star Citizen bot |
| `activity-bot` | Use Activity Stats bot |
| `rpg-bot` | Use RPG bot |
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

### Admin Panel Access Delegation

Grant trusted users access to admin features without full admin role.

**How It Works:**
1. Go to Settings → Administration → Users
2. Select a user
3. Toggle "Admin Panel Access"
4. User can now access admin features

**Use Cases:**
- Let moderators access specific admin panels
- Grant bot configuration access
- Delegate server management

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
- **Grant/revoke admin panel access**

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

## Multi-Server Support

Connect to multiple F7Lans communities from a single client.

### Overview

The desktop client supports connecting to multiple F7Lans servers simultaneously, allowing you to be part of multiple gaming communities without switching applications.

### Adding Servers

1. Click the **+** button in the server list
2. Enter the server URL (e.g., `https://friends-server.example.com`)
3. Enter your credentials or register a new account
4. Server appears in your server list

### Switching Servers

- Click any server icon in the sidebar to switch
- Current server is highlighted
- Each server maintains its own:
  - Connection state
  - Channel selection
  - Voice/video sessions

### Managing Servers

**Remove a Server:**
1. Right-click the server icon
2. Select "Disconnect"
3. Confirm removal

**Server Status:**
| Icon | Status |
|------|--------|
| 🟢 | Connected |
| 🟡 | Connecting |
| 🔴 | Disconnected |

### Standalone Client

For users who only connect to remote servers:

```bash
# Windows
scripts/build-client-standalone.bat

# Linux
./scripts/build-client-standalone.sh
```

The standalone client has no embedded server, resulting in a smaller download and lower resource usage.

---

## Theming

Customize the look of your F7Lans client.

### Available Themes

| Theme | Description |
|-------|-------------|
| **Dark** | Default dark theme with purple accents |
| **Midnight Blue** | Deep blue color scheme |
| **Forest** | Green nature-inspired theme |
| **Crimson** | Red and dark color scheme |
| **Light** | Light background for daytime use |

### Changing Your Theme

1. Go to **Settings** → **Appearance**
2. Select your preferred theme from the dropdown
3. Theme applies immediately

### Theme Preview

```
┌────────────────────────────────────────┐
│ Dark (Default)                         │
├────────────────────────────────────────┤
│ Background: Deep purple-grey (#1a1a2e) │
│ Accent: Orange (#f77f00)               │
│ Text: Light grey (#e0e0e0)             │
└────────────────────────────────────────┘
```

### Server Default Theme

Admins can set a default theme for their server:

1. Go to **Settings** → **Administration** → **Appearance**
2. Select the default theme
3. New users will start with this theme
4. Users can still override with their preference

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

## Activity Tracking

Track what games and activities users are engaged in.

### How It Works

F7Lans automatically detects and displays user activities:

1. Desktop client detects running games/applications
2. Activity is displayed on user's profile
3. Statistics are tracked over time
4. Compare activities with friends

### Activity Display

```
┌─────────────────────────────────────┐
│ @username                           │
│ 🎮 Playing Counter-Strike 2         │
│    for 2h 15m                       │
└─────────────────────────────────────┘
```

### Activity Statistics

View your gaming history:

- Total time played per game
- Percentage breakdown
- Session count
- Last played dates

### Common Activities

Find games to play with friends:

1. View another user's profile
2. See "Common Activities" section
3. Games you both play are highlighted
4. Sorted by combined playtime

---

## Activity Stats Bot

Server-wide gaming statistics bot.

### Admin Setup

1. Go to **Settings** → **Administration** → **Media Bots** → **Activity Stats**
2. Enable the bot

### Features

- **Leaderboards**: See who plays the most
- **Top Games**: Most popular games on your server
- **Game Stats**: Detailed stats for specific games
- **Live Updates**: See who's playing what right now

### Commands

| Command | Description |
|---------|-------------|
| View Stats | See server-wide statistics |
| Leaderboard | Top players by playtime |
| Game Search | Stats for a specific game |

---

## Tabletop RPG Bot

Interactive text-based adventures with your community.

### Overview

The RPG Bot acts as a game master, creating and running adventures for solo players or groups.

### Creating a Campaign

1. Enable the bot in **Settings** → **Administration** → **Media Bots** → **RPG**
2. Start a campaign in any text channel
3. Choose your settings:
   - **Type**: Solo or Party
   - **Setting**: Fantasy, Sci-Fi, Horror, Modern, Steampunk
   - **Difficulty**: Easy, Normal, Hard, Nightmare

### Character Creation

Choose your class and race:

**Classes:**
| Class | Specialty |
|-------|-----------|
| Warrior | High HP, melee combat |
| Mage | Powerful spells, low HP |
| Rogue | Stealth, critical hits |
| Cleric | Healing, support |
| Ranger | Ranged attacks, tracking |
| Bard | Buffs, crowd control |

**Races:**
Human, Elf, Dwarf, Halfling, Orc, Dragonborn

### Gameplay

Take actions during your adventure:

- **Explore**: Investigate the area
- **Search**: Look for treasure
- **Attack**: Fight enemies
- **Defend**: Take a defensive stance
- **Rest**: Recover health
- **Flee**: Escape from combat

### Progression

- Gain experience from combat
- Level up to increase stats
- Find loot and gold
- Build your character

---

## Social Account Linking

Connect your gaming profiles to your F7Lans account.

### Supported Platforms

| Platform | ID Type |
|----------|---------|
| Steam | Steam ID (verified via OAuth) |
| Reddit | Username |
| Twitter/X | @username |
| Xbox | Gamertag |
| PlayStation | PSN ID |
| Blizzard | BattleTag |

### Linking Accounts

1. Go to **Settings** → **Profile** → **Linked Accounts**
2. Click "Link" next to the platform
3. Follow verification steps
4. Account appears on your profile

### Steam Verification

Steam uses secure OAuth verification:

1. Click "Link Steam Account"
2. Redirect to Steam login
3. Authorize F7Lans
4. Account verified automatically

### Other Platform Verification

For platforms without OAuth:

1. Enter your username
2. Receive a verification code
3. Post the code on the platform (profile bio, tweet, etc.)
4. Click "Verify" in F7Lans
5. F7Lans confirms verification

### Profile Display

Linked accounts appear on your profile with verification badges.

---

## Two-Factor Authentication

Secure your account with 2FA.

### Setting Up 2FA

1. Go to **Settings** → **Security** → **Two-Factor Authentication**
2. Click "Enable 2FA"
3. Scan the QR code with an authenticator app:
   - Google Authenticator
   - Authy
   - Microsoft Authenticator
   - Any TOTP-compatible app
4. Enter the 6-digit code from your app
5. Save your backup codes

### Backup Codes

When you enable 2FA, you receive 10 backup codes:

- Each code can only be used once
- Use them if you lose access to your authenticator
- Store them securely (password manager, printed copy)
- Regenerate codes anytime in settings

### Logging In with 2FA

1. Enter username and password
2. Enter the 6-digit code from your authenticator
3. Alternatively, use a backup code

### Disabling 2FA

1. Go to **Settings** → **Security** → **Two-Factor Authentication**
2. Click "Disable 2FA"
3. Enter your password
4. Enter a 2FA code to confirm

---

## Server Settings

### Server Branding

Customize your server's appearance.

**Server Icon:**
1. Go to **Settings** → **Administration** → **Server Settings**
2. Click "Upload Icon"
3. Select an image file (PNG, JPG, GIF, SVG, or WebP)
4. Max size: 2MB
5. Icon appears in the server sidebar

**Server Name & Description:**
- Customize the server name displayed to users
- Add a description for your community

### Video Streaming Defaults

Admins can set default language preferences for video bots:

1. Go to **Settings** → **Administration** → **Server Settings** → **Video**
2. Set default audio language
3. Set default subtitle language
4. Choose default video quality

Users can still override these preferences individually.

### Supported Languages

20+ languages supported including:
English, Spanish, French, German, Italian, Portuguese, Russian, Japanese, Korean, Chinese, and more.

---

## Coming Soon

Features in development:

- [ ] OAuth providers (Discord, Google)
- [ ] Mobile applications (iOS, Android)
- [ ] Voice channel permissions
- [ ] Custom emojis
- [ ] Server templates
- [ ] Audit logs
- [ ] Webhooks/integrations

---

Have feature requests? [Open an issue](https://github.com/yourusername/f7lans/issues)!
