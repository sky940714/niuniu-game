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
  utils/db.js           # MySQL2 connection pool
```

**Game loop**: `GameTable` runs a 1-second `setInterval`. Phases cycle: `BETTING (18s) → DEALING (8s) → SQUEEZING (10s) → RESULT (5s) → reset`. Cards are pre-generated at the start of each BETTING phase.

**Settlement** (`GameTable.settleBets`): iterates all connected sockets with `socket.user`, looks up their bets by `db_id`, pays winners `amount + floor(amount × multiplier × 0.95)` via `UserService.updateBalance`.

### Security Model

**Socket authentication**: JWT stored in `localStorage.prestige_token`. Sent via `socket.handshake.auth.token` on connect. Middleware sets `socket.user = { db_id, username, balance, ... }`.

**Single-session enforcement**: `activeSessions` Map (`db_id → socketId`) in `index.js`. New login or token-reconnect kicks existing session with `error_msg` before connecting.

**Login rate limiting**: 5 attempts per username per 60 seconds, enforced in `index.js` via `loginAttempts` Map.

**Admin API auth**: All `/api/admin/*` routes require `x-admin-secret` header matching `process.env.ADMIN_SECRET` (set in `backend/.env`). The admin frontend sends this via `adminHeaders` constant in `admin/src/App.jsx`.

**B-mode risk control**: `MAX_PAYOUT_ODDS = 8` (matches highest hand: 五小妞 8×). Formula: `(totalBet + newAmount) × 8 ≤ balance`. Frontend mirrors this with `MAX_ODDS = 8` in `GameUI/index.jsx`.

### Player Client Layer Stack (room view)

Three overlapping layers at different `zIndex`:
1. **Background div** (`zIndex: 0`) — static image
2. **`<GameCanvas>`** (`zIndex: 5`) — PixiJS canvas, `pointerEvents: none` by default; toggled `auto` during dealing/squeeze
3. **`<GameUI>`** (`zIndex: 20`) — React DOM: betting zones, chips, timer, balance

During squeeze (咪牌), both canvas and parent container are raised to `zIndex: 2000`.

### State Management

**Zustand** (`src/stores/useGameStore.js`) — navigation only: `currentPage` (`login` | `lobby` | `room`), `user`, `selectedRoom`.

**`GameUI` local state** — all real-time data: phase, countdown, bets, table chips, win zones. Driven entirely by Socket.IO events.

### Socket.IO Events

Key inbound (server → client):
- `auth_success` — `{ username, balance, referral_code }`
- `time_tick` — `{ phase, countdown, tableBets }`
- `phase_change` — `{ phase, countdown, roundResult? }`
- `update_balance` — `{ balance, winAmount? }`
- `update_table_bets` — chip animation broadcast (includes `isBot` flag for bot bets)
- `error_msg` — fatal errors trigger logout; non-fatal show alert

Key outbound (client → server):
- `login` — `{ username, password }`
- `register` — `{ username, password, referralCodeInput }`
- `place_bet` — `{ zoneId: 0–3, amount }`

### PixiJS Game Engine (`src/game/`)

`gameApp` is a **singleton**. Initialized in `<GameCanvas>` on mount, destroyed on unmount.

- **`app.js`** — `GameApp`: Pixi `Application` with three stage containers (`bgLayer`, `cardContainer`, `uiLayer`). Deals cards via GSAP animations, renders settlement text.
- **`SqueezeController.js`** — Mesh-deform for 5th card. Pixi v8 `PlaneGeometry` (20×20 verts), drag threshold = 30% of visual card height to reveal.
- **`Effects.js`** — `CoinRain`: 100 GSAP-animated `Graphics` circles on win.
- **`logic.js`** (frontend) — `calculateNiu()`, `compareHands()`, `getCardValue()`. Used for frontend display only; authoritative results come from backend.

Card asset naming: `card_{suit}_{rank}.png`, suit ∈ `{spades, hearts, diamonds, clubs}`, rank ∈ `{A, 02–09, 10, J, Q, K}`. Loaded via `import.meta.glob`.

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

Polls `GET /api/admin/preview` (requires `x-admin-secret` header) every 1 second. Two-click swap: click zone A → click zone B → confirm → `POST /api/admin/swap-hand { pos1, pos2 }`. Zones: `banker | tian | di | xuan | huang`.

## Environment Variables (`backend/.env`)

```
PORT=3001
DB_HOST=localhost
DB_USER=root
DB_PASS=...
DB_NAME=prestige_niu_niu
JWT_SECRET=...
ADMIN_SECRET=...     # Required for admin API access
```

## Backend URL

Hardcoded to `http://localhost:3001` in `src/socket.js` and `admin/src/App.jsx`. Use `import.meta.env.VITE_API_URL` when deploying.
