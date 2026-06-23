# Handoff: Ember — community platform (f7lans redesign)

## Overview
**Ember** is a redesign of **f7lans**, a self-hosted, Discord-style platform for gaming
communities: text / voice / video channels, screen share, watch-together media bots,
encrypted DMs, and server federation. This package covers a **unified desktop/web
interface** and a **matching mobile app**, spanning all seven core screens.

The visual direction is **dark-first, gamer night-mode** — orange embers glowing on a warm
near-black — with an **IRC-flavored** information layer (bracketed monospace timestamps,
`@`/`+` user modes, monospace channel names with user counts, terminal-style server
addresses).

> **Name:** "Ember" — a glowing coal on near-black is literally the aesthetic, and it maps
> to the product idea: *self-hosted = light your own server*; *federation = a constellation
> of embers*. Wordmark is lowercase `ember`; the logo mark is a radial-gradient glowing coal.

## About the Design Files
The files in this bundle are **design references created in HTML** — a prototype showing the
intended look and behavior, **not production code to copy directly**. The single source file
(`Ember.dc.html`) is a self-contained component that renders every screen behind an in-canvas
Platform (Desktop/Mobile) toggle and a Screen selector; `support.js` is just the tiny runtime
that drives it.

The task is to **recreate these designs in the target codebase's existing environment**
(React/Vue/Electron for desktop+web, React Native/Swift/Kotlin for mobile) using its
established patterns, component library, and state management. If no environment exists yet,
choose the most appropriate stack — a shared React + TypeScript core (web + Electron) with
React Native for mobile is a natural fit given the parity requirement. **Do not ship the HTML
directly.**

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, and interaction states are all
specified below and present in the file. Recreate the UI pixel-perfectly using the codebase's
libraries. Exact hex values, font stacks, and sizes are given in **Design Tokens**.

---

## Global Layout

### Desktop / Web (unified — one responsive layout; desktop adds window chrome)
A single app window, `max-width: 1340px`, `border-radius: 16px`, on a radial near-black stage.
Top-to-bottom:

1. **Window titlebar** (desktop-only chrome) — 40px tall, `#0E0D0B`. Left: 3 traffic-light
   dots (`#3a352e`). Center: `Ember — <Server> · <address>` in mono. Right: **push-to-talk
   indicator** (`PTT: SPACE`, orange square + label) and a **Tray ⌄** affordance. These two
   are the "desktop gets extras" items — omit on web.
2. **App body** — a horizontal row of up to four columns:
   - **Server rail** (74px) — network switcher (see below)
   - **Channel sidebar** (248px) — channel list, or DM conversation list, or settings nav
   - **Main content** (flex) — the active screen
   - **Members panel** (240px, toggleable, chat only)

Login and Settings take over the full app body (no rail/sidebar split of the normal kind;
Settings has its own nav rail).

### Mobile
A phone frame, `aspect-ratio: 392/836`, `border-radius: 48px`, dynamic-island notch.
Status bar (9:41, signal/wifi/battery) → screen content → **bottom tab bar**
(Chat · Voice · Watch · Network · DMs). Voice, Watch, and Login hide the tab bar and use a
back chevron instead. Each screen is a focused single-column version of its desktop counterpart.

---

## Screens / Views

### 1. Login / Server Picker
- **Purpose:** Connect to a self-hosted server (this is the entry point; it's a *server
  address*, not an email login — reinforcing self-hosted).
- **Desktop layout:** Two columns. Left **hero** (flex, radial orange glow at 28%/32%):
  glowing-coal mark (60px) + `ember` wordmark (42px), headline "Your community. Your server.
  Your rules." (Space Grotesk 34/700), a 15px muted paragraph, a row of mono feature chips,
  and a mono footer `ember v1.0.0 · MIT · self-hosted`. Right **connect panel** (452px,
  `#13110E`): "Connect to a server", a terminal address field
  (`ssl://` muted prefix + `ember.lan:3001` + blinking caret, orange-bordered), a full-width
  **Connect →** button (`#FF6A2B`), a "recent servers" divider, then recent-server rows
  (tag tile, name, mono address, green `● <n>` online), and a dashed **+ Host a new server**.
- **Mobile:** Single centered column — coal mark, wordmark, tagline, address field, Connect
  button, recent-server list. No tab bar.
- **Behavior:** Connect / any recent server / host → navigates to Chat.

### 2. Chat (default screen)
- **Purpose:** The main text channel. IRC-styled message log.
- **Server rail (network switcher):** 74px, `#0A0908`. Top: **home button** = glowing coal
  in a 46px squared tile → opens DMs. Divider, then a mono `NET` label. Then **server tiles**:
  46px, `border-radius: 11px`, `#15130F`, 1px border, **monospace 2-letter tag in the server's
  own color** (EM orange, HD blue, RL green, RT purple). Active server: `#1A140E` bg, 1.5px
  border in server color, outer glow, **plus a colored gutter tick** (4px×22px bar, glowing,
  pinned at `left:-9px`). Unread server shows an orange count badge top-right (e.g. HD = 3).
  Below tiles: dashed **+** (add server). Pinned bottom: **⌖** explore. (This rail deliberately
  reads as a *terminal/IRC network list*, not Discord's pill rail.)
- **Channel sidebar:** Header = server name (Space Grotesk 15/600) + `⌄`. Search pill.
  Sections (mono uppercase labels): **Information** (welcome, announcements — muted),
  **Text Channels** (`#general 42`, `#lfg [9+ badge]`, `#helldivers 18`, `#clips 7`,
  `#off-topic 23` — names in **JetBrains Mono 13px**, `#` dimmed, right-aligned user counts),
  **Voice & Watch** (🔊 Squad Comms · 3, 🔊 Chill Lounge, ▶ Movie Night · 5, 💤 AFK). Active
  channel: `rgba(255,106,43,0.14)` bg, `#FFB489` text. Bottom **user panel** (56px): avatar
  with green presence dot, `spoonz`, orange "Playing Helldivers 2", mic + gear (gear → Settings).
- **Header (50px):** `#` + `general` + topic line `topic: Squad up… · helldive @ 18:30` +
  a federation pill (`◈ 3 servers · 155`) → Directory + members toggle `☰`.
- **Message log (IRC layout):** Each message is a 3-column grid
  `[58px time] [140px nick] [1fr body]`. Time is mono `[18:02]` right-aligned & dimmed.
  Nick column is mono, right-aligned: optional **mode prefix** (`@` orange for ops, `+` green
  for voiced) + colored nick + optional role tag (`op`/`admin`/`bot`). Body has a 2px left
  border rule (the IRC "gutter") and 14px text. Bots render rich embeds:
  - **GIF** — 260×150 placeholder card.
  - **YouTube bot** — red left-border card: `YOUTUBE BOT` label, thumbnail w/ play button,
    title, "Synced to 🔊 Squad Comms · 4 watching", red progress bar.
  - **Reactions** — pill chips; "hot" reactions get an orange highlight.
  Channel intro block sits above the first message (big `#` tile + welcome copy).
- **Composer:** Typing indicator (`maya is typing…` with 3 bouncing dots). Input row: `+`
  circle, mono `[#general]` prefix, placeholder, `/ GIF ☺` affordances, orange send button.
- **Members panel (240px, toggleable):** Mono uppercase group labels grouped by IRC mode —
  **Ops** (`@`), **Voiced** (`+`), **Online**, **Offline**. Rows: avatar + presence dot
  (green/idle amber/dnd red/offline grey), mono nick (with mode prefix), small activity line
  (orange when "hot"/streaming). Offline members are dimmed.
- **Mobile:** Header (`☰`, `#general`, 42 online + topic, 🔊 button) → stacked messages
  (nick line then gutter-bordered body, embeds full-width) → composer → tab bar.

### 3. Voice / Video + Screen Share
- **Purpose:** Active voice room with a featured screen share and participant tiles.
- **Layout:** Header (🔊 Squad Comms, "Helldive Op" pill, connection quality `Excellent · 24ms`
  with signal bars). **Featured share** (flex, 2px orange border + glow, hatched placeholder):
  "screen share · 1920×1080 @ 4K60", sharer caption pill (avatar + `spoonz` + pulsing `● LIVE`),
  `⛶ Fullscreen`. **Participant tiles** (4-col grid, 132px): avatar, mic/mute chip
  (green mic / red muted), name; speaking tiles get an orange ring; streaming tiles get a `CAM`
  badge. **Control bar (80px):** mic, deafen, camera (active=orange), **🖥 Share Screen**
  (orange primary), soundboard, leave (red). Pinned right: **PUSH-TO-TALK · SPACE** chip
  (desktop extra).
- **Mobile:** Back chevron + title + quality line; featured share on top; 2-col participant
  grid; 4-button control bar (mic, camera, share, leave). No tab bar.

### 4. Watch-Together (media bots)
- **Purpose:** Synced media playback from any of the 8 media bots (Plex shown).
- **Layout:** Two columns. **Player column:** header (▶ Movie Night, `PLEX BOT` amber pill,
  stacked watcher avatars + "5 watching"); video stage (hatched placeholder, big orange pause
  button, `SYNCED · all 5 in sync` badge); transport bar (title `Dune: Part Two · 2024 · 2h 46m`,
  scrubber `42:18 / 2:46:00` with orange fill + glowing knob, play/prev/next/volume, "Host
  controls playback" note, fullscreen). **Queue sidebar (300px):** "Up Next · 3", source tabs
  (**Plex active**, YouTube, Jellyfin, IPTV, Twitch), queue rows (duration thumb, title, source
  + "added by"), and a "+ Paste a link or search Plex…" input.
- **Mobile:** Back + title; video stage; title + scrubber; "Up next" list. No tab bar.

### 5. Directory / Federation
- **Purpose:** View linked servers across the Ember network + members network-wide.
- **Layout:** Header (◈ Federation, "Ember Network · 3 servers linked", **+ Link a server**).
  **Federation nodes** — a row of server cards (Ember West / East / EU) connected by glowing
  orange links with a floating node dot. Each card: color tag tile, name, region, status pill
  (`synced` green / `syncing` amber), and a stat row (online / latency [green<50ms, amber≥80ms]
  / channels). A trust line: "Real-time message sync · HMAC-SHA256 authenticated · smart
  conflict resolution". **Members across the network** — responsive card grid: avatar +
  presence dot, nick (with `@`/`+` mode), server chip (colored square + server name), and an
  activity pill (orange when hot).
- **Mobile:** Stacked federation cards, then a members list. Tab label is **Network**.

### 6. Settings & Admin (ten panels)
- **Purpose:** Full-takeover settings area covering user prefs and server administration. A
  left **nav (236px)** with two groups switches the right-hand panel (`settingsTab` state); the
  breadcrumb (`<group> / <title>`) and `✕`-to-Chat update per panel. Active nav item is
  orange-tinted. Pinned **Log out** (red). The right side is a scroll area with content capped
  at `max-width: 820px`. Shared primitives across panels: **toggle switch** (on = orange + glow,
  knob right; off = grey, knob left), **field** (mono uppercase label over a `#0C0B0A` value
  box), **dropdown** (same + `⌄`), **segmented control** (active segment orange), **section
  card** (`#15130F`, 1px border, 14px radius, rows divided by hairlines), **danger card**
  (red-tinted border). The ten panels:
  - **Account** — identity card (avatar + handle `@spoonz#0001` + Edit profile), Email/Username
    fields, **Security** card (Password / 2FA `● Enabled` / Active sessions, each with a
    secondary button), **Danger zone** (Disable / Delete account).
  - **Profile** — two columns: form (display name, pronouns, About me, custom status) + a **live
    profile-preview card** (banner, avatar, name, handle, status). Below: **Connections** grid
    (Steam ●, Twitch ●, Xbox/PlayStation "Link").
  - **Voice & Video** — device dropdowns (Input/Output/Camera), **Mic test** meter + Input/Output
    volume sliders, **Input mode** segmented (Voice activity / Push to talk) with `SPACE` keybind
    chip, **Processing** toggles (echo cancel, Krisp noise suppression, AGC, advanced VAD).
  - **Notifications** — "Notify me about" toggle list (DMs, @mentions, all messages [off], voice
    activity, server events [off], bot embeds) + "Delivery" toggles (desktop, sounds, mobile
    push, quiet hours [off]).
  - **Appearance** — **Theme** cards (Ember Dark [active] / Midnight / AMOLED, each a mini
    preview), **Accent color** swatches (orange variants, first ringed), **Message density**
    segmented (Cozy / **Compact** = IRC, active), **Display** toggles (24-hour timestamps [on],
    show avatars [on], reduce motion [off], underline links [off]).
  - **Media Bots** — heading "8 built-in bots · no subscriptions / 6 enabled", **2-col card
    grid**, one card per bot: color tag tile + 2-letter mono, name, mono category, toggle,
    description, status (`● enabled` / `○ disabled`) + "Configure →". Enabled cards get a faint
    orange border. The 8 bots: **YouTube, Plex, Jellyfin, Emby(off), IPTV, Twitch, Chrome(off),
    Game Together.**
  - **Groups & Roles** — two columns: **role list** (Admin/Moderator/Streamer/Member, color dot
    + member count + drag handle, click to select; `roleTab` state) + **permission matrix** for
    the selected role (grouped General / Membership / Text / Voice & Media toggle rows; toggle
    on-states differ per role), role header with color + count + Delete role, **+ New role**.
  - **Federation** — **Linked servers** card (Ember West "this server" / East "synced" + Unlink /
    EU "syncing" + Unlink), add-server field + **Link server**, **Trust & sync** (Federation key
    HMAC masked + Regenerate; toggles: auto-accept sync, share presence, federated voice [off];
    Conflict resolution dropdown "Smart merge").
  - **Channels** — categories (Information / Text / Voice & Watch) each with a `+`, rows = drag
    handle + type icon + mono channel name + meta (online count / slowmode / etc.) + gear,
    **+ Create channel**.
  - **Server Settings** — identity card (EM tile, name, address, Change icon), Server name +
    Region fields, **Invites** card (invite link + Copy, expiry / max-uses dropdowns),
    **Verification level** segmented (Medium active), **Maintenance** (version `v1.0.0`, Export
    backup, Restart), **Danger zone** (Transfer ownership / Delete server).
- **State:** `settingsTab` selects the panel; `roleTab` selects the role in Groups & Roles. The
  nav `onClick` sets `settingsTab`; role rows set `roleTab` (permission toggle on-states recompute
  per role).
- **Mobile:** Back + breadcrumb; the **Media Bots** panel is shown as single-column compact bot
  rows (tag, name, one-line desc, toggle). The other nine panels are desktop-designed; on mobile,
  reuse the same content in a single-column scroll with the section-card pattern.

### 7. Direct Messages (E2E encrypted)
- **Purpose:** Private 1:1 conversations; the channel sidebar swaps to a conversation list.
- **Layout:** Sidebar header becomes "Direct Messages"; a **Friends** button; then **Direct
  Messages** list — rows with avatar + presence dot, name, last-message preview, mono timestamp,
  and an orange unread badge (nova = 2). **Main conversation:** header (avatar + presence,
  `maya`, "Streaming · Rocket League", green **● E2E ENCRYPTED** mono badge, call + video
  buttons [video → Voice]); intro block ("…encrypted direct messages… Even admins can't read
  these."); IRC-style message grid (`[58px time][100px nick][1fr body]`); composer with mono
  `[@maya]` prefix.
- **Mobile:** Back + recipient header (avatar, name, E2E badge, call/video) → messages →
  composer. No channel list (full-screen thread).

---

## Interactions & Behavior
- **Platform toggle** (Desktop/Mobile) and **Screen selector** are *prototype harness controls*
  in the top review bar — **not part of the product UI**. Don't reproduce them; they exist only
  to preview all states in one file.
- **Navigation:** server tiles → Chat (set active server); channels → their target screen
  (text→Chat, 🔊→Voice, ▶→Watch); header federation pill → Directory; user-panel gear → Settings;
  home coal / `✦` → DMs; Settings `✕` and "Log out" → Chat; Login Connect/recent → Chat; DM
  video / Voice leave → Voice/Chat respectively. Mobile bottom tabs switch primary screens.
- **Members panel** toggles via the chat header `☰`.
- **DM sidebar swap:** when screen === DMs, the channel sidebar shows the conversation list
  instead of channels (`showChannelList = screen !== 'dms'`).
- **Animations (CSS):** `emberGlow` (logo coal, 3.2s pulse), `recPulse` (LIVE dot / caret,
  1.1–1.4s), `typeDot` (typing dots, 1.2s staggered), `floatY` (federation link node, 2s).
  Toggle/active transitions are subtle (~.15s).
- **Presence states:** online `#4FCB6B`, idle `#FFB454`, dnd `#F2554D`, offline `#4a453e`
  (avatar dimmed to 0.4).
- **Responsive:** mobile hides PTT/tray chrome, members panel, and the multi-column splits;
  Voice/Watch/Login hide the bottom tab bar.

## State Management
Single source of truth (see `Component` class in `Ember.dc.html`):
- `platform`: `'desktop' | 'mobile'` *(harness-only)*
- `screen`: `'login' | 'chat' | 'voice' | 'watch' | 'directory' | 'settings' | 'dms'`
- `activeServer`: `'ember' | 'hll' | 'rl' | 'rt'`
- `activeChannel`: channel id (e.g. `'general'`)
- `showMembers`: boolean (members panel)
- `settingsTab`: which settings panel is open (`'account' | 'profile' | 'voice' | 'notifications' | 'appearance' | 'bots' | 'groups' | 'federation' | 'channels' | 'server'`)
- `roleTab`: selected role in Groups & Roles (`'admin' | 'mod' | 'streamer' | 'member'`)
Derived: `isShell = !['login','settings'].includes(screen)`,
`showMembersPanel = showMembers && screen==='chat'`, `showChannelList = screen!=='dms'`,
`showMobileTabs = !['login','voice','watch'].includes(screen)`.
In a real app, also wire: auth/connection to server, websocket message stream, WebRTC for
voice/video/screen-share, per-bot config, federation sync status, unread counts.

## Design Tokens

### Colors
| Token | Hex | Use |
|---|---|---|
| Ember (primary) | `#FF6A2B` | accents, primary buttons, active states, glow |
| Ember light | `#FF8A3D` | hover text, secondary accent |
| Ember deep | `#E8551F` | gradient end of the coal |
| Coal highlight | `#FFD3A6` | gradient start of the coal mark |
| BG base (stage) | `#0C0B0A` | app background |
| BG rail | `#0A0908` / `#0B0A09` | server rail |
| BG window | `#100E0C` | main content |
| BG sidebar/cards | `#13110E` / `#15130F` | sidebar, cards |
| BG input | `#1B1916` | composer, fields |
| Surface alt | `#1A1714` / `#2A2621` | buttons, chips |
| Text primary | `#F4EFE8` | headings/body |
| Text body | `#D7D0C6` | message text |
| Text muted | `#9A938A` | secondary |
| Text dim | `#7E766B` | tertiary/labels |
| Text faint | `#5a544c` | placeholders, `#` glyphs |
| Border | `rgba(255,255,255,0.05–0.08)` | hairlines |
| Presence online | `#4FCB6B` | online / sync OK / E2E |
| Presence idle | `#FFB454` | idle / syncing / mid latency |
| Presence dnd | `#F2554D` | dnd / leave / errors |
| Server: Ember | `#FF6A2B` · **HD** `#3D7BFF` · **RL** `#19C37D` · **RT** `#B86BFF` | server identity colors |
| User colors | kato `#3D7BFF`, maya `#19C37D`, nova `#B86BFF`, byte `#E8A33D`, spoonz `#FF6A2B` | nick colors |
| YouTube | `#FF3D3D` · Plex `#E8A33D` · Jellyfin `#7B5CFF` · Twitch `#B86BFF` | bot identity |

### Typography
- **Display / headings:** `Space Grotesk` (400–700) — wordmark, screen titles, big numbers.
- **UI / body:** `Hanken Grotesk` (400–800) — buttons, labels, message body.
- **Mono:** `JetBrains Mono` (400–600) — timestamps, nicks, channel names, server addresses,
  latency, section labels, status badges. (The mono layer *is* the IRC flavor.)
- Scale: titlebar/labels 10–12px · body 13–14px · channel/nick mono 12.5–13px · headers 15px ·
  screen headlines 20–24px · hero 34–42px. Letter-spacing: mono labels `0.05–0.16em` uppercase;
  display headings `-0.02 to -0.03em`.

### Spacing / Radius / Shadow
- Column widths: rail 74 · channel sidebar 248 · members 240 · settings nav 236 · queue 300 ·
  connect panel 452. Header heights 40 (titlebar) / 50–54. Padding mostly 12–24px; gaps 6–18px.
- Radius: tiles/buttons 8–14px · cards 13–16px · window 16px · phone 48px · pills 6–9px ·
  avatars 50%.
- Glow shadow pattern: `0 0 <12–30>px rgba(255,106,43,0.25–0.7)` for ember glow;
  `0 40px 100px rgba(0,0,0,0.6)` for the window/phone drop shadow.

### Toggle switch
40×23px track, radius 12. On: `#FF6A2B` + glow, 17px knob at `left:20px` (knob `#100E0C`).
Off: `#2A2621`, knob `#7E766B` at `left:3px`.

## Assets
- **No external image assets.** The logo is a pure CSS radial-gradient "coal"
  (`radial-gradient(circle at 34% 28%, #FFD3A6, #FF6A2B 46%, #E8551F 100%)` + glow) — reproduce
  as an SVG/component, no PNG needed. Media/video/screen-share surfaces are intentional hatched
  placeholders; replace with real `<video>`/thumbnail sources.
- **Fonts:** Google Fonts — Space Grotesk, Hanken Grotesk, JetBrains Mono. Self-host or use
  your app's font pipeline.
- **Icons:** currently emoji/glyph placeholders (🎙 🔊 ▶ ◈ ⌖ ☰ ⛶ etc.). Swap for the
  codebase's icon set (e.g. Lucide/Phosphor) — keep them monoline and neutral-grey at rest,
  ember on active.

## Files
- `Ember.dc.html` — the complete design reference (all 7 screens incl. 10 settings panels,
  desktop + mobile). Open in a browser; use the top **Desktop/Mobile** toggle and the **screen
  chips** to view every state; inside Admin, the left nav switches all ten settings panels.
  Markup is inline-styled; the `Component` class at the bottom holds all data + navigation.
- `support.js` — minimal runtime that renders the component (no app logic of interest; included
  only so the HTML opens standalone).
- `screenshots/` — reference PNGs of the key desktop screens, the settings panels, and mobile.

> Implementation note: the harness top bar (logo + REDESIGN tag + Desktop/Mobile + screen chips
> + `ember.lan:3001 · synced`) is **not** part of the product — ignore it when recreating.
