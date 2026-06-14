# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **百人妞妞 (Bǎirén Niú Niú)** multiplayer card game — a Chinese Niu Niu (Bull Bull) variant. The repo contains two separate Vite/React frontends **and a Node.js backend** (`backend/`) all in the same repo.

## Commands

### Player Client (root)
```
npm install
npm run dev       # http://localhost:5173
npm run build
npm run lint
```

### Admin Panel (`admin/`)
```
cd admin && npm install
npm run dev       # http://localhost:5174
```

### Backend (`backend/`)
```
cd backend && npm install
npm run dev       # nodemon index.js → http://localhost:3001
npm start         # node index.js (production)
```

All three must run simultaneously for full functionality.

## Architecture

### Three-App Structure
- **`/`** — Player-facing game client (Vite/React)
- **`/admin`** — Operator control panel (Vite/React), swaps hands between zones
- **`/backend`** — Node.js/Express/Socket.IO game server + MySQL

### Backend Structure (`backend/`)

```
backend/
  index.js              # Entry: Express, Socket.IO, auth middleware, API routes
  logic.js              # Pure game logic: deck creation, hand calculation, win comparison
  config/gameRules.js   # Timing constants and bet limits
  managers/
    GameTable.js        # Game loop (setInterval tick), phase transitions, settlement
    BetManager.js       # Bet validation (B-mode), per-player bet tracking
    BotManager.js       # Simulated bot players (UI only, bets not settled)
  services/
    userService.js      # DB queries: findById, findByUsername, register, updateBalance
    adminUserService.js # Admin account CRUD: getAll, create, changePassword, delete
  utils/db.js           # MySQL2 connection pool
```

**Game loop**: `GameTable` runs a 1-second `setInterval`. Phases cycle: `BETTING (18s) → DEALING (8s) → SQUEEZING (10s) → RESULT (5s) → reset`. Cards are pre-generated at the start of each BETTING phase.

**Settlement** (`GameTable.settleBets`): iterates all connected sockets with `socket.user`, looks up their bets by `db_id`, pays winners `amount + floor(amount × multiplier × 0.95)` via `UserService.updateBalance`.

### Security Model

**Socket authentication**: JWT stored in `localStorage.prestige_token`. Sent via `socket.handshake.auth.token` on connect. Middleware sets `socket.user = { db_id, username, balance, ... }`.

**Single-session enforcement**: `activeSessions` Map (`db_id → socketId`) in `index.js`. New login or token-reconnect kicks existing session with `error_msg` before connecting.

**Login rate limiting**: 5 attempts per username per 60 seconds, enforced in `index.js` via `loginAttempts` Map. Rate limit only triggers on wrong password — correct-password-but-banned attempts do NOT count. Admin unbanning a player also clears their rate limit via `clearLoginRateLimit()`.

**Admin API auth**: All `/api/admin/*` routes require JWT Bearer token (issued by `POST /api/admin/login`) OR `x-admin-secret` header. The `adminAuth` middleware decodes `req.adminUsername` for audit logging. Admin JWT has `audience: 'admin'`.

**B-mode risk control**: `MAX_PAYOUT_ODDS = 8` (matches highest hand: 五小妞 8×). Formula: `(totalBet + newAmount) × 8 ≤ balance`. Frontend mirrors this with `MAX_ODDS = 8` in `GameUI/index.jsx`.

**Player ban**: `is_banned` column on `users` table (TINYINT, default 0). Ban immediately sends `force_logout` socket event to active session then disconnects. Login blocked for banned users.

**Maintenance mode**: `isMaintenance` boolean in `index.js`. When enabled, blocks all logins/registrations and broadcasts `maintenance_mode` socket event to all clients.

### Player Client Layer Stack (room view)

Three overlapping layers at different `zIndex`:
1. **Background div** (`zIndex: 0`) — static image
2. **`<GameCanvas>`** (`zIndex: 5`) — PixiJS canvas, `pointerEvents: none` by default; toggled `auto` during dealing/squeeze
3. **`<GameUI>`** (`zIndex: 20`) — React DOM: betting zones, chips, timer, balance

During squeeze (咪牌), both canvas and parent container are raised to `zIndex: 2000`.

### State Management

**Zustand** (`src/stores/useGameStore.js`) — navigation only: `currentPage` (`login` | `lobby` | `room`), `user`, `selectedRoom`, `isMaintenance`.

**`GameUI` local state** — all real-time data: phase, countdown, bets, table chips, win zones. Driven entirely by Socket.IO events.

### Socket.IO Events

Key inbound (server → client):
- `auth_success` — `{ username, balance, referral_code }`
- `time_tick` — `{ phase, countdown, tableBets }`
- `phase_change` — `{ phase, countdown, roundResult? }`
- `update_balance` — `{ balance, winAmount? }`
- `update_table_bets` — chip animation broadcast (includes `isBot` flag for bot bets)
- `error_msg` — fatal errors trigger logout; non-fatal show alert
- `force_logout` — `{ message }` — always triggers `logout()` (used for ban)
- `maintenance_mode` — `{ enabled, message? }` — toggles `isMaintenance` in store; if enabled and in room, calls `exitRoom()`
- `init_state` — includes `isMaintenance` field to sync client state on connect

Key outbound (client → server):
- `login` — `{ username, password }`
- `register` — `{ username, password, referralCodeInput }`
- `place_bet` — `{ zoneId: 0–3, amount }`

### PixiJS Game Engine (`src/game/`)

`gameApp` is a **singleton**. Initialized in `<GameCanvas>` on mount, destroyed on unmount.

- **`app.js`** — `GameApp`: Pixi `Application` with three stage containers (`bgLayer`, `cardContainer`, `uiLayer`). Deals cards via GSAP animations, renders settlement text/effects.
- **`SqueezeController.js`** — Ticker-based state machine for 5th card squeeze (咪牌). Uses plain `Sprite` (NOT Mesh) to eliminate blur. Upward swipe only; 75% height threshold OR flick velocity (`< -1.2 px/ms`) triggers auto-reveal. Spring physics on release (`k=0.13, damp=0.70`). Permission gate: only allows squeeze for zones where `playerBetZones[zoneIdx] === true`.
- **`Effects.js`** — `CoinRain`: 100 GSAP-animated `Graphics` circles on win. `HighHandEffect`: plays PNG image + particle burst per zone for 7 special hand types; images loaded from `public/images/effects/`, positioned at zone card center, scale = `screen.width × 0.22 / 1024`, bounce-in + fade-out via GSAP.
- **`SoundManager.js`** — `soundManager` singleton. BGM: HTML Audio with autoplay-retry (click/touchstart/keydown listeners on policy block), falls back to Web Audio synthesized loop if file missing. `placeBetAnnounce()`: plays `sfx_announce.mp3` buffer first, falls back to Web Speech API TTS (zh-TW female voice, pre-loaded via `_initVoice()`). SFX buffers loaded at init: `deal`, `flip`, `announce`.
- **`logic.js`** (frontend) — `calculateNiu()`, `compareHands()`, `getCardValue()`. Used for frontend display only; authoritative results come from backend.

Card asset naming: `card_{suit}_{rank}.png`, suit ∈ `{spades, hearts, diamonds, clubs}`, rank ∈ `{A, 02–09, 10, J, Q, K}`. Loaded via `import.meta.glob`.

### Sound & Effect Assets (place manually in `public/`)

```
public/
  sounds/
    bgm_lobby.mp3       ← lobby background music (loops)
    bgm_game.mp3        ← game room background music (loops)
    sfx_deal.mp3        ← card deal sound
    sfx_flip.mp3        ← card flip sound
    sfx_announce.mp3    ← female voice "請下注" audio clip
  images/effects/
    effect_niuniu.png        ← 牛牛 (1024×1024 transparent PNG)
    effect_wulong.png        ← 五龍妞
    effect_yinhua.png        ← 銀花妞
    effect_tonghuashun.png   ← 同花順妞
    effect_hulu.png          ← 葫蘆妞
    effect_tiezhi.png        ← 鐵支妞
    effect_wuxiao.png        ← 五小妞
```

All audio files are optional — fallback to Web Audio synthesized sound when missing. Effect PNGs are optional — `HighHandEffect.play()` silently skips if asset not loaded.

### Settlement Display Logic (`app.js` → `settleAll()`)

Special hands → `HighHandEffect` image at zone card center (staggered delay += 0.35s per zone). Non-special hands (牛1–牛9, 無牛) → Pixi `Text` label at zone position.

Hand type strings from backend: `FIVE_SMALL`, `BOMB`, `FULL_HOUSE`, `STRAIGHT_FLUSH`, `FIVE_KNIGHTS`, `SILVER_NIU`, `NIU_NIU`. Non-special: `NIU_1`–`NIU_7`, `NO_NIU`.

### Hand Types & Multipliers (`backend/logic.js`)

| 牌型 | 條件 | 倍率 |
|------|------|------|
| 五小妞 | 全 5 張 rank ≤ 5 且總和 ≤ 10 | 8× |
| 鐵支妞 | 四條 | 6× |
| 葫蘆妞 | 葫蘆 | 6× |
| 同花順 | 同花順 | 6× |
| 五龍妞 | 全 JQK | 5× |
| 銀花妞 | 一張 10 + 四張 JQK | 5× |
| 牛牛 | 餘數 10 | 3× |
| 牛8/牛9 | 餘數 8–9 | 2× |
| 牛1–牛7 | 餘數 1–7 | 1× |
| 無牛 | 無法湊三張 10 的倍數 | 1× |

### Admin Panel

#### 功能頁籤
- **玩家管理** — 搜尋/列出玩家，點擊查看詳情（餘額、開分紀錄、封鎖狀態）
- **開分紀錄** — `balance_logs` 資料表，記錄每次手動調整（操作者、前後餘額、備注）
- **牌局紀錄** — 歷史牌局查詢
- **🔐 系統管理** — 維護模式開關 + 管理員帳號 CRUD

#### Admin 登入
- `POST /api/admin/login` — `{ username, password }` → 返回 JWT（audience: 'admin'）
- Admin panel 將 JWT 存在 `localStorage.admin_token`，每次 API 呼叫帶 `Authorization: Bearer <token>`

#### 手牌換位（原功能）
Polls `GET /api/admin/preview` every 1 second. Two-click swap: click zone A → click zone B → confirm → `POST /api/admin/swap-hand { pos1, pos2 }`. Zones: `banker | tian | di | xuan | huang`.

### DB Tables

- `users` — 玩家帳號，含 `is_banned TINYINT(1) DEFAULT 0`
- `balance_logs` — 開分紀錄：`user_id, username, admin_username, amount, balance_before, balance_after, note, created_at`
- `admins` — 管理員帳號：`id, username, password_hash, created_at`
- `game_rounds` / `round_bets` — 牌局紀錄（由 GameTable 寫入）

**MySQL 5.7 compatibility**: `ALTER TABLE ADD COLUMN IF NOT EXISTS` is NOT supported. Use INFORMATION_SCHEMA check before adding columns.

## Environment Variables (`backend/.env`)

```
PORT=3001
DB_HOST=localhost
DB_USER=root
DB_PASS=...
DB_NAME=prestige_niu_niu
JWT_SECRET=...
ADMIN_SECRET=...     # Fallback for admin API access (legacy x-admin-secret header)
```

## Backend URL

`src/socket.js` and `admin/src/App.jsx` read from `import.meta.env.VITE_API_URL`. Set this in `.env.production` / `admin/.env.production` (both git-ignored — create manually on each machine).

## Production Server

**Vultr VPS**: `207.148.98.43` (Tokyo)

### Server Directory Structure

```
/var/www/
  game/       ← player frontend built files (dist/)
  admin/      ← admin panel built files (admin/dist/)
  backend/    ← Node.js backend source files
  html/       ← nginx default
```

The server has **no git repo**. Deployment is done by building locally and uploading with SCP.

### One-Click Deploy

Run from project root (Windows PowerShell):

```
! .\deploy.ps1
```

The script does:
1. `npm run build` — builds player frontend → `dist/`
2. `cd admin && npm run build` — builds admin panel → `admin/dist/`
3. `scp -r dist/. root@207.148.98.43:/var/www/game/`
4. `scp -r admin/dist/. root@207.148.98.43:/var/www/admin/`
5. `ssh` chmod 755 on both directories

**Note**: Backend (`/var/www/backend/`) is NOT updated by this script. Backend changes require manual SCP of individual `backend/` files and `pm2 restart niu-niu` on the server.

### Environment Files (git-ignored, create manually)

`.env.production` (root):
```
VITE_API_URL=http://207.148.98.43:3001
```

`admin/.env.production`:
```
VITE_API_URL=http://207.148.98.43:3001
VITE_ADMIN_SECRET=<secret>
```

### Mobile UI Notes

- Game room uses `position: fixed, inset: 0` to escape `#root` safe-area padding (PixiJS canvas alignment)
- Lobby also uses `position: fixed, inset: 0`; safe-area applied per-element (header, bottomNav, main)
- Bet zones named 頭/初/川/尾 (previously 天/地/玄/黃)
- Chip animations pop in-place within zone using `getBoundingClientRect()`
