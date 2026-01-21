# Bots Guide

```
███████╗███████╗██╗      █████╗ ███╗   ██╗███████╗
██╔════╝╚════██║██║     ██╔══██╗████╗  ██║██╔════╝
█████╗      ██╔╝██║     ███████║██╔██╗ ██║███████╗
██╔══╝     ██╔╝ ██║     ██╔══██║██║╚██╗██║╚════██║
██║        ██║  ███████╗██║  ██║██║ ╚████║███████║
╚═╝        ╚═╝  ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝
```

Complete documentation for all 11 built-in bots.

---

## Table of Contents

- [Overview](#overview)
- [Streaming Bots](#streaming-bots)
  - [YouTube Bot](#youtube-bot)
  - [Plex Bot](#plex-bot)
  - [Emby Bot](#emby-bot)
  - [Jellyfin Bot](#jellyfin-bot)
  - [IPTV Bot](#iptv-bot)
  - [Spotify Bot](#spotify-bot)
  - [Twitch Bot](#twitch-bot)
- [Utility Bots](#utility-bots)
  - [Chrome Bot](#chrome-bot)
  - [Image Search Bot](#image-search-bot)
  - [Activity Stats Bot](#activity-stats-bot)
  - [RPG Bot](#rpg-bot)
- [Per-Channel Bot Settings](#per-channel-bot-settings)
- [Permissions](#permissions)

---

## Overview

F7Lans includes 11 built-in bots that extend your server's functionality:

| Category | Bots | Count |
|:---------|:-----|:-----:|
| **Streaming** | YouTube, Plex, Emby, Jellyfin, IPTV, Spotify, Twitch | 7 |
| **Utility** | Chrome, Image Search, Activity Stats, RPG | 4 |
| **Total** | | **11** |

### How Bots Work

1. **Admin enables** the bot globally in admin settings
2. **Admin configures** any required API keys or connections
3. **Admin grants** bot permission to user groups
4. **Optionally**, admin can enable/disable bots per channel
5. **Users** with permission can use the bot in enabled channels

---

## Streaming Bots

### YouTube Bot

Stream YouTube videos to voice channels for watch parties.

**Admin Setup:**
1. Go to **Settings** → **Administration** → **Media Bots** → **YouTube**
2. Enable the bot
3. No additional configuration required

**User Features:**
- Paste any YouTube URL to play
- Preview video info (title, thumbnail, duration) before playing
- See currently playing video
- Stop playback
- Multiple streams in different channels simultaneously

**How It Works:**
- Uses `ytdl-core` to extract stream URLs
- Audio/video sent to all voice channel participants
- Supports videos, playlists (first video), and shorts

---

### Plex Bot

Stream media from your Plex Media Server library.

**Admin Setup:**
1. Go to **Settings** → **Administration** → **Media Bots** → **Plex**
2. Enable the bot
3. Enter your Plex server URL (e.g., `http://192.168.1.100:32400`)
4. Enter your Plex authentication token

**Getting Your Plex Token:**
1. Sign in to Plex web app
2. Open any media item
3. Open browser developer tools (F12)
4. Go to Network tab
5. Look for `X-Plex-Token` in any request

**User Features:**
- Search your entire Plex library
- Play movies, TV shows, music
- See what's currently playing
- Queue system for music

---

### Emby Bot

Stream media from Emby Media Server.

**Admin Setup:**
1. Go to **Settings** → **Administration** → **Media Bots** → **Emby**
2. Enable the bot
3. Enter Emby server URL (e.g., `http://192.168.1.100:8096`)
4. Enter API key (create in Emby: **Dashboard** → **API Keys**)

**User Features:**
- Search movies, series, music
- Thumbnail previews
- Playback in voice channels
- Episode selection for TV series

---

### Jellyfin Bot

Stream media from Jellyfin (free, open-source Plex/Emby alternative).

**Admin Setup:**
1. Go to **Settings** → **Administration** → **Media Bots** → **Jellyfin**
2. Enable the bot
3. Enter Jellyfin server URL
4. Enter API key (create in Jellyfin: **Dashboard** → **API Keys**)

**User Features:**
- Same features as Emby Bot
- Full Jellyfin API support

---

### IPTV Bot

Watch live TV together with electronic program guide (EPG).

**Admin Setup:**
1. Go to **Settings** → **Administration** → **Media Bots** → **IPTV**
2. Enable the bot
3. Enter M3U playlist URL from your IPTV provider
4. Optionally enter XMLTV EPG URL for TV guide data

**M3U Playlist Format:**
```
#EXTM3U
#EXTINF:-1 tvg-id="cnn" tvg-logo="logo.png" group-title="News",CNN
http://stream-url.com/cnn
#EXTINF:-1 tvg-id="espn" group-title="Sports",ESPN
http://stream-url.com/espn
```

**User Features:**
- Browse channels by group/category
- View TV guide (current and upcoming shows)
- Watch live channels in voice
- Change channels easily
- Schedule recordings
- Tag users on recordings

**Recording System:**
- Select a program from the EPG to record
- Recordings are tied to your account
- Tag other users to notify them
- View scheduled and completed recordings

---

### Spotify Bot

Collaborative music playback with Spotify.

**Admin Setup:**
1. Go to **Settings** → **Administration** → **Media Bots** → **Spotify**
2. Enable the bot
3. Create a Spotify Developer app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
4. Enter Client ID and Client Secret
5. Click "Connect to Spotify" to authorize via OAuth

**Requirements:**
- Spotify Premium account (for full playback)
- Spotify Developer account (free)

**User Features:**
- Search tracks, albums, playlists
- Play music in voice channels
- Add songs to queue
- Skip current track
- View queue
- Access your personal playlists

**Queue System:**
- Fair play - users take turns adding songs
- Anyone in the channel can add to queue
- Queue persists until stream stops

---

### Twitch Bot

Watch Twitch streams together with embedded player.

**Admin Setup:**
1. Go to **Settings** → **Administration** → **Media Bots** → **Twitch**
2. Enable the bot
3. Create an app at [dev.twitch.tv/console](https://dev.twitch.tv/console)
4. Enter Client ID and Client Secret

**User Features:**
- Search for live streams
- View stream info (title, game, viewers)
- Embedded Twitch player
- Embedded Twitch chat
- Watch parties for favorite streamers

---

## Utility Bots

### Chrome Bot

Shared browser sessions for collaborative browsing.

**Admin Setup:**
1. Go to **Settings** → **Administration** → **Media Bots** → **Chrome**
2. Enable the bot

**Requirements:**
- Chromium/Chrome installed on server
- Sufficient server resources for headless browser

**User Features:**
- Start a shared browser session
- Navigate to any URL
- Back/forward navigation
- Refresh page
- Transfer control between users
- Multiple users watch the same session

**Control Transfer:**
- One user has control at a time
- Controller can pass control to anyone in session
- Click "Request Control" to ask current controller

**Use Cases:**
- Watch videos together (YouTube, etc.)
- Collaborative shopping
- Demo websites to the team
- Browse documentation together

---

### Image Search Bot

Search and share images with safe search filtering.

**Admin Setup:**
1. Go to **Settings** → **Administration** → **Media Bots** → **Image Search**
2. Enable the bot
3. Get a Google API Key from [console.cloud.google.com](https://console.cloud.google.com)
4. Create a Custom Search Engine at [programmablesearchengine.google.com](https://programmablesearchengine.google.com)
5. Enter API Key and Search Engine ID
6. Set safe search level

**Safe Search Levels:**

| Level | Description |
|:------|:------------|
| `active` | Strict filtering (default, recommended) |
| `medium` | Moderate filtering |
| `off` | No filtering (admin discretion) |

**Commands:**

| Command | Description |
|:--------|:------------|
| `!image <query>` | Search for images |
| `!next` | Show next result |
| `!random` | Random result from current search |

---

### Activity Stats Bot

Server-wide gaming statistics and leaderboards.

**Admin Setup:**
1. Go to **Settings** → **Administration** → **Media Bots** → **Activity Stats**
2. Enable the bot

**Features:**
- **Leaderboards** — See who plays the most
- **Top Games** — Most popular games on your server
- **Game Stats** — Detailed stats for specific games
- **Live Updates** — See who's playing what right now

**Stats Tracked:**
- Total playtime per game
- Session count
- Last played dates
- Percentage breakdown

---

### RPG Bot

Interactive text-based tabletop adventures.

**Admin Setup:**
1. Go to **Settings** → **Administration** → **Media Bots** → **RPG**
2. Enable the bot

**Creating a Campaign:**
1. Start a campaign in any text channel
2. Choose campaign settings:
   - **Type:** Solo or Party
   - **Setting:** Fantasy, Sci-Fi, Horror, Modern, Steampunk
   - **Difficulty:** Easy, Normal, Hard, Nightmare

**Character Classes:**

| Class | Specialty |
|:------|:----------|
| Warrior | High HP, melee combat |
| Mage | Powerful spells, low HP |
| Rogue | Stealth, critical hits |
| Cleric | Healing, support |
| Ranger | Ranged attacks, tracking |
| Bard | Buffs, crowd control |

**Races:**
Human, Elf, Dwarf, Halfling, Orc, Dragonborn

**Gameplay Actions:**

| Action | Description |
|:-------|:------------|
| Explore | Investigate the area |
| Search | Look for treasure |
| Attack | Fight enemies |
| Defend | Take a defensive stance |
| Rest | Recover health |
| Flee | Escape from combat |

**Progression:**
- Gain XP from combat
- Level up to increase stats
- Find loot and gold
- Build your character over sessions

---

## Per-Channel Bot Settings

Control which bots are available in each channel.

### How It Works

1. Bots are enabled globally in admin settings
2. Admins can enable/disable bots per channel
3. By default, all bots are enabled in all channels
4. Users can only use bots enabled both globally AND in the channel

### Managing Channel Bots

1. Go to channel settings (gear icon)
2. Navigate to **Bots** tab
3. Toggle individual bots on/off
4. Changes take effect immediately

### Use Cases

| Channel Type | Recommended Bots |
|:-------------|:-----------------|
| Gaming | Activity Stats, RPG |
| Music | Spotify |
| Movies | YouTube, Plex, Emby, Jellyfin |
| Watch Party | YouTube, Twitch |
| General | All disabled or limited |

---

## Permissions

Bot access is controlled through the Groups & Permissions system.

### Available Bot Permissions

| Permission | Bot |
|:-----------|:----|
| `youtube-bot` | YouTube |
| `plex-bot` | Plex |
| `emby-bot` | Emby |
| `jellyfin-bot` | Jellyfin |
| `iptv-bot` | IPTV |
| `spotify-bot` | Spotify |
| `twitch-bot` | Twitch |
| `chrome-bot` | Chrome |
| `image-bot` | Image Search |
| `activity-bot` | Activity Stats |
| `rpg-bot` | RPG |

### Granting Permissions

1. Go to **Settings** → **Administration** → **Groups**
2. Create or edit a group
3. Enable bot permissions for that group
4. Add users to the group

### Default Groups

| Group | Bot Access |
|:------|:-----------|
| Everyone | None (base permissions only) |
| Admins | All bots |

---

## API Endpoints

All bots expose REST API endpoints for programmatic control. See [API Reference](API.md) for full documentation.

Common patterns:
- `GET /api/admin/{bot}-bot/status` — Get bot status
- `POST /api/admin/{bot}-bot/enable` — Enable/disable bot
- `POST /api/admin/{bot}-bot/play` — Start playback
- `POST /api/admin/{bot}-bot/stop` — Stop playback

---

## Troubleshooting

### Bot Won't Enable

1. Check admin settings — is the bot enabled globally?
2. Check user permissions — does the user have bot permission?
3. Check channel settings — is the bot enabled for this channel?

### Streaming Issues

1. Verify server has sufficient bandwidth
2. Check media server is accessible
3. Try lower quality preset

---

Have questions? [Open an issue](https://github.com/yourusername/f7lans/issues)!
