// backend/index.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
require('dotenv').config();
const db = require('./utils/db');

const GameTable = require('./managers/GameTable');
const betManager = require('./managers/BetManager');
const bankerManager = require('./managers/BankerManager');
const UserService = require('./services/userService');
const BetRecordService = require('./services/betRecordService');
const GameRoundService = require('./services/gameRoundService');
const JackpotService = require('./services/jackpotService');
const BankerService = require('./services/bankerService');
const AdminUserService = require('./services/adminUserService');
const AgentService = require('./services/agentService');
const botManager = require('./managers/BotManager');
const { JACKPOT } = require('./config/gameRules');

const app = express();
app.use(express.json());
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ["http://localhost:5173", "http://localhost:5174"];

app.use(cors({
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST", "DELETE", "PATCH"],
    credentials: true
}));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: ALLOWED_ORIGINS, methods: ["GET", "POST", "DELETE"] }
});

const JWT_SECRET = process.env.JWT_SECRET || 'Prestige_NiuNiu_Super_Secret_2026';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'Prestige_Admin_X7k9_2026';

// === 多裝置登入防護 (db_id -> socketId) ===
const activeSessions = new Map();

// === 維護模式 ===
let isMaintenance = false;

// === 登入速率限制 (username -> { count, resetAt }) ===
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 60 * 1000;

function checkLoginRateLimit(username) {
    const now = Date.now();
    const record = loginAttempts.get(username);
    if (!record || now > record.resetAt) {
        loginAttempts.set(username, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
        return true;
    }
    if (record.count >= MAX_LOGIN_ATTEMPTS) return false;
    record.count++;
    return true;
}

function clearLoginRateLimit(username) {
    loginAttempts.delete(username);
}

// 合併真實下注與機器人視覺下注，供 init_state 傳給前端還原籌碼顯示
function mergeTableBets(realBets, botTotals) {
    const zones = ['tian', 'di', 'xuan', 'huang'];
    const merged = {};
    for (const z of zones) {
        merged[z] = (realBets[z] || 0) + (botTotals[z] || 0);
    }
    return merged;
}

// 🚀 初始化遊戲桌
const gameTable = new GameTable(io);
botManager.init(io, gameTable);
bankerManager.init(io);

// === 🛡️ Socket 驗證中間件 ===
io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next();

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await UserService.findById(decoded.id);

        if (user) {
            socket.user = {
                db_id: user.id,
                username: user.username,
                balance: parseFloat(user.balance),
                referral_code: user.referral_code,
                socketId: socket.id
            };
            next();
        } else {
            next(new Error("使用者不存在"));
        }
    } catch (err) {
        next();
    }
});

// === 🔌 Socket 事件處理 ===
io.on('connection', (socket) => {
    console.log(`⚡ 連線: ${socket.id}`);

    // 1. Token 自動登入與多裝置踢線
    if (socket.user) {
        const existingSocketId = activeSessions.get(socket.user.db_id);
        if (existingSocketId && existingSocketId !== socket.id) {
            const oldSocket = io.sockets.sockets.get(existingSocketId);
            if (oldSocket) {
                oldSocket.emit('error_msg', '您的帳號已在另一個裝置登入，已被強制下線');
                oldSocket.disconnect(true);
            }
        }
        activeSessions.set(socket.user.db_id, socket.id);

        socket.emit('auth_success', socket.user);
        socket.emit('init_state', {
            phase:        gameTable.phase,
            countdown:    gameTable.countdown,
            tableBets:    mergeTableBets(betManager.tableBets, botManager.getVisualTotals()),
            myBets:       betManager.getPlayerBet(socket.user.db_id),
            jackpotAmount: Math.floor(gameTable.jackpotAmount),
            bankerStatus:  bankerManager.getStatus(),
            isMaintenance,
        });
    }

    // 2. 註冊 (後端驗證)
    socket.on('register', async (data) => {
        if (isMaintenance) return socket.emit('register_response', { success: false, message: '系統維護中，暫停服務，請稍後再試' });

        const phoneRegex    = /^09\d{8}$/;
        const passwordRegex = /^(?=.*\d).{8,20}$/;   // 8-20 碼，至少含 1 個數字

        if (!data.username || !phoneRegex.test(data.username)) {
            return socket.emit('register_response', { success: false, message: '請輸入正確的手機號碼 (09 開頭，共 10 碼)' });
        }
        if (!data.password || !passwordRegex.test(data.password)) {
            return socket.emit('register_response', { success: false, message: '密碼需 8~20 位，且至少包含一個數字' });
        }

        try {
            await UserService.register(data.username, data.password, data.referralCodeInput);
            socket.emit('register_response', { success: true, message: "註冊成功！" });
        } catch (error) {
            socket.emit('register_response', { success: false, message: error.message });
        }
    });

    // 3. 登入 (速率限制 + 後端驗證)
    socket.on('login', async (data) => {
        if (isMaintenance) return socket.emit('login_response', { success: false, message: '系統維護中，暫停登入，請稍後再試' });

        if (!data.username || !data.password) {
            return socket.emit('login_response', { success: false, message: '請輸入帳號與密碼' });
        }

        if (!checkLoginRateLimit(data.username)) {
            return socket.emit('login_response', { success: false, message: '登入失敗次數過多，請 1 分鐘後再試' });
        }

        try {
            const user = await UserService.findByUsername(data.username);
            // #2 統一錯誤訊息，避免帳號枚舉攻擊
            const isMatch = user ? await bcrypt.compare(data.password, user.password) : false;

            if (user && isMatch) {
                if (user.is_banned) {
                    clearLoginRateLimit(data.username); // 密碼正確，不計入速率限制
                    return socket.emit('login_response', { success: false, message: '此帳號已被停用，請聯繫客服' });
                }
                clearLoginRateLimit(data.username);

                // 多裝置踢線
                const existingSocketId = activeSessions.get(user.id);
                if (existingSocketId && existingSocketId !== socket.id) {
                    const oldSocket = io.sockets.sockets.get(existingSocketId);
                    if (oldSocket) {
                        oldSocket.emit('error_msg', '您的帳號已在另一個裝置登入，已被強制下線');
                        oldSocket.disconnect(true);
                    }
                }

                const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '24h' });

                // #4 加入 referral_code
                socket.user = {
                    db_id: user.id,
                    username: user.username,
                    balance: parseFloat(user.balance),
                    referral_code: user.referral_code,
                    socketId: socket.id
                };

                activeSessions.set(user.id, socket.id);
                UserService.updateLoginTime(user.id).catch(console.error);

                // #4 login_response 也帶出 referral_code
                socket.emit('login_response', {
                    success: true,
                    token,
                    username: user.username,
                    balance: user.balance,
                    referral_code: user.referral_code,
                });

                socket.emit('init_state', {
                    phase:        gameTable.phase,
                    countdown:    gameTable.countdown,
                    tableBets:    mergeTableBets(betManager.tableBets, botManager.getVisualTotals()),
                    myBets:       betManager.getPlayerBet(user.id),
                    jackpotAmount: Math.floor(gameTable.jackpotAmount),
                    bankerStatus:  bankerManager.getStatus(),
                    isMaintenance,
                });
            } else {
                // 帳號不存在或密碼錯誤 → 同一訊息，防止枚舉
                socket.emit('login_response', { success: false, message: "帳號或密碼錯誤" });
            }
        } catch (error) {
            console.error(error);
            socket.emit('login_response', { success: false, message: "系統錯誤" });
        }
    });

    // 4. 下注請求
    socket.on('place_bet', async (data) => {
        if (!socket.user) return socket.emit('error_msg', '請先登入');
        if (bankerManager.getBankerUserId() === socket.user.db_id)
            return socket.emit('error_msg', '做莊期間禁止下注');

        const { zoneId, amount } = data;

        const { valid, msg, zoneName } = betManager.validateBet(socket.user, zoneId, amount, gameTable);
        if (!valid) return socket.emit('error_msg', msg);

        try {
            // 彩金池貢獻（下注額 × 0.5%），與下注額一起從餘額扣除
            const contribution = Math.ceil(amount * JACKPOT.CONTRIBUTION_RATE);
            const totalDeduct  = amount + contribution;

            const success = await UserService.updateBalance(socket.user.db_id, -totalDeduct);
            if (!success) throw new Error("扣款失敗");

            socket.user.balance -= totalDeduct;
            const { newTableBet } = betManager.placeBet(socket.user.db_id, zoneName, amount);

            // 更新彩金池（記憶體即時 + DB 非同步）
            gameTable.jackpotAmount += contribution;
            JackpotService.contribute(contribution).catch(e => console.error('彩金池更新失敗:', e.message));

            socket.emit('update_balance', { balance: socket.user.balance });

            io.emit('update_table_bets', {
                zoneId,
                zoneName,
                amount,
                totalAmount: newTableBet,
                username: socket.user.username
            });
        } catch (error) {
            console.error("下注異常:", error);
            socket.emit('error_msg', '下注失敗，請稍後再試');
        }
    });

    // 5. 玩家進入遊戲廳時主動要求當前局狀態
    socket.on('request_state', () => {
        if (!socket.user) return;
        socket.emit('init_state', {
            phase:        gameTable.phase,
            countdown:    gameTable.countdown,
            tableBets:    mergeTableBets(betManager.tableBets, botManager.getVisualTotals()),
            myBets:       betManager.getPlayerBet(socket.user.db_id),
            jackpotAmount: Math.floor(gameTable.jackpotAmount),
            bankerStatus:  bankerManager.getStatus(),
            isMaintenance,
        });
    });

    // 6. 申請上莊
    socket.on('apply_banker', async (data) => {
        if (!socket.user) return socket.emit('error_msg', '請先登入');
        const frozenAmount = Number(data?.frozenAmount) || 0;
        const result = await bankerManager.apply(socket, frozenAmount);
        socket.emit('apply_banker_result', result);
    });

    // 7. 取消排隊
    socket.on('cancel_apply', async () => {
        if (!socket.user) return socket.emit('error_msg', '請先登入');
        const result = await bankerManager.cancelApply(socket);
        socket.emit('cancel_apply_result', result);
    });

    // 8. 玩家主動下莊
    socket.on('quit_banker', async () => {
        if (!socket.user) return socket.emit('error_msg', '請先登入');
        const result = await bankerManager.playerQuit(socket.user.db_id);
        socket.emit('quit_banker_result', result);
    });

    socket.on('disconnect', async () => {
        if (socket.user) {
            if (activeSessions.get(socket.user.db_id) === socket.id) {
                activeSessions.delete(socket.user.db_id);
            }
            try {
                await bankerManager.cancelOnDisconnect(socket.user.db_id);
            } catch (err) {
                console.error(`⚠️ [Disconnect] 斷線清理異常 (user ${socket.user.db_id}):`, err.message);
            }
        }
    });
});

// ==========================================
// 👤 玩家 REST API - 需帶 Authorization: Bearer <token>
// ==========================================

const jwtRestAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: '請先登入' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.id;
        next();
    } catch (_) {
        res.status(401).json({ error: 'Token 已過期，請重新登入' });
    }
};

app.get('/api/bet-records', jwtRestAuth, async (req, res) => {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    try {
        const result = await BetRecordService.getByUserId(req.userId, page, limit);
        res.json(result);
    } catch (err) {
        console.error('查詢投注紀錄失敗:', err);
        res.status(500).json({ error: '查詢失敗' });
    }
});

// ==========================================
// 🔐 後台管理 API
// ==========================================

// 管理員登入（不需要 adminAuth）
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password)
            return res.status(400).json({ error: '請填寫帳號與密碼' });

        const user = await AdminUserService.findByUsername(username);
        if (!user) return res.status(401).json({ error: '帳號或密碼錯誤' });

        const ok = await AdminUserService.verifyPassword(password, user.password_hash);
        if (!ok) return res.status(401).json({ error: '帳號或密碼錯誤' });

        const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'unknown';

        // 單裝置：清除此帳號舊的 refresh token
        await db.execute('DELETE FROM admin_refresh_tokens WHERE username = ?', [username]);

        // 產生 refresh token（7天）
        const rawRefresh = crypto.randomBytes(48).toString('hex');
        const hashRefresh = crypto.createHash('sha256').update(rawRefresh).digest('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await db.execute(
            'INSERT INTO admin_refresh_tokens (username, token_hash, ip, created_at, expires_at) VALUES (?, ?, ?, NOW(), ?)',
            [username, hashRefresh, ip, expiresAt]
        );

        // 登入記錄
        await db.execute(
            'INSERT INTO admin_login_logs (username, ip, logged_in_at) VALUES (?, ?, NOW())',
            [username, ip]
        );

        // Access token 15 分鐘
        const accessToken = jwt.sign(
            { username: user.username, role: 'admin' },
            JWT_SECRET,
            { expiresIn: '15m', audience: 'admin' }
        );

        console.log(`🔐 [Admin] ${username} 登入成功 (IP: ${ip})`);
        res.json({ token: accessToken, refreshToken: rawRefresh });
    } catch (e) {
        console.error('Admin login error:', e.message);
        res.status(500).json({ error: '伺服器錯誤' });
    }
});

// 管理員 Refresh Token 換新 Access Token
app.post('/api/admin/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) return res.status(401).json({ error: '請重新登入' });

        const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        const [[row]] = await db.execute(
            'SELECT * FROM admin_refresh_tokens WHERE token_hash = ? AND expires_at > NOW()',
            [hash]
        );
        if (!row) return res.status(401).json({ error: '登入已過期，請重新登入' });

        // 輪換：刪舊發新
        await db.execute('DELETE FROM admin_refresh_tokens WHERE id = ?', [row.id]);
        const newRaw = crypto.randomBytes(48).toString('hex');
        const newHash = crypto.createHash('sha256').update(newRaw).digest('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await db.execute(
            'INSERT INTO admin_refresh_tokens (username, token_hash, ip, created_at, expires_at) VALUES (?, ?, ?, NOW(), ?)',
            [row.username, newHash, row.ip, expiresAt]
        );

        const accessToken = jwt.sign(
            { username: row.username, role: 'admin' },
            JWT_SECRET,
            { expiresIn: '15m', audience: 'admin' }
        );
        res.json({ token: accessToken, refreshToken: newRaw });
    } catch (e) {
        console.error('Admin refresh error:', e.message);
        res.status(500).json({ error: '伺服器錯誤' });
    }
});

// 管理員登出：撤銷 refresh token
app.post('/api/admin/logout', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (refreshToken) {
            const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
            await db.execute('DELETE FROM admin_refresh_tokens WHERE token_hash = ?', [hash]);
        }
        res.json({ success: true });
    } catch {
        res.json({ success: true });
    }
});

// adminAuth：接受 15 分鐘 Bearer JWT，並將解出的 username 掛到 req.adminUsername
const adminAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET, { audience: 'admin' });
            req.adminUsername = decoded.username;
            return next();
        } catch {
            return res.status(401).json({ error: 'Token 已過期，請重新登入' });
        }
    }
    // 向下相容舊版 x-admin-secret
    const secret = req.headers['x-admin-secret'];
    if (secret && secret === ADMIN_SECRET) { req.adminUsername = 'system'; return next(); }
    return res.status(401).json({ error: '未授權，請重新登入' });
};

app.get('/api/admin/preview', adminAuth, (req, res) => {
    const tableBets = betManager.tableBets;
    const isPaused  = gameTable.isPaused;

    if (!gameTable.roundResult) {
        return res.json({ ready: false, message: '牌局尚未生成 (請等待倒數 5 秒)', tableBets, isPaused });
    }

    const { hands, results, winners } = gameTable.roundResult;

    // 理論莊家盈虧（以當前押注計算）
    let theoreticalPnl = 0;
    ['tian','di','xuan','huang'].forEach(z => {
        const bet = tableBets[z] || 0;
        if (winners[z]) theoreticalPnl -= Math.floor(bet * (results[z]?.multiplier || 1) * 0.95);
        else            theoreticalPnl += bet;
    });

    res.json({
        ready: true,
        status:   gameTable.phase,
        countdown: gameTable.countdown,
        isPaused,
        hands, results, winners,
        tableBets,
        theoreticalPnl,
    });
});

app.post('/api/admin/swap-hand', adminAuth, (req, res) => {
    const { pos1, pos2 } = req.body;
    if (!pos1 || !pos2) return res.status(400).json({ error: "缺少參數" });

    const success = gameTable.swapHands(pos1, pos2);
    if (success) {
        console.log(`👨‍💻 後台換牌成功: ${pos1} <-> ${pos2}`);
        res.json({ success: true, message: `已交換 ${pos1} 與 ${pos2} 的手牌` });
    } else {
        res.status(500).json({ error: "交換失敗 (可能是牌局尚未生成)" });
    }
});

app.post('/api/admin/force-hand', adminAuth, (req, res) => {
    const { zone, handType } = req.body;
    const validZones = ['banker','tian','di','xuan','huang'];
    const validTypes = [
        'FIVE_SMALL','BOMB','FULL_HOUSE','STRAIGHT_FLUSH','FIVE_KNIGHTS','SILVER_NIU',
        'NIU_NIU','NIU_9','NIU_8','NIU_7','NIU_6','NIU_5','NIU_4','NIU_3','NIU_2','NIU_1','NO_NIU'
    ];
    if (!zone || !validZones.includes(zone))   return res.status(400).json({ error: '無效的區域' });
    if (!handType || !validTypes.includes(handType)) return res.status(400).json({ error: '無效的牌型' });

    const result = gameTable.forceHand(zone, handType);
    if (result.success) {
        console.log(`👨‍💻 後台指定牌型成功: ${zone} → ${handType}`);
        res.json({ success: true });
    } else {
        res.status(422).json({ error: result.error });
    }
});

app.get('/api/admin/status', adminAuth, (req, res) => {
    res.json({ phase: gameTable.phase, countdown: gameTable.countdown, isPaused: gameTable.isPaused });
});

// ── 遊戲流程控制 ──
app.post('/api/admin/control', adminAuth, (req, res) => {
    const { action, seconds } = req.body;
    if (action === 'pause')  return res.json(gameTable.pause());
    if (action === 'resume') return res.json(gameTable.resume());
    if (action === 'extend') return res.json(gameTable.extendCountdown(seconds || 30));
    res.status(400).json({ error: '無效的操作' });
});

// ── 在線玩家 ──
app.get('/api/admin/online-players', adminAuth, async (req, res) => {
    const sockets = await io.fetchSockets();
    const players = sockets
        .filter(s => s.user)
        .map(s => ({ socketId: s.id, db_id: s.user.db_id, username: s.user.username, balance: s.user.balance }));
    res.json(players);
});

// ── 踢除玩家 ──
app.post('/api/admin/kick-player', adminAuth, (req, res) => {
    const { socketId } = req.body;
    const target = io.sockets.sockets.get(socketId);
    if (!target) return res.status(404).json({ error: '玩家不在線或已離線' });
    target.emit('error_msg', '您已被管理員強制下線');
    target.disconnect(true);
    console.log(`👨‍💻 [Admin] 踢除玩家: ${socketId}`);
    res.json({ success: true });
});

// ── 調整餘額 ──
app.post('/api/admin/adjust-balance', adminAuth, async (req, res) => {
    const { username, amount, note } = req.body;
    if (!username || amount === undefined || isNaN(Number(amount))) {
        return res.status(400).json({ error: '缺少參數 (username, amount)' });
    }
    try {
        const user = await UserService.findByUsername(username);
        if (!user) return res.status(404).json({ error: '找不到此帳號' });
        const balanceBefore = parseFloat(user.balance);
        const success = await UserService.updateBalance(user.id, Number(amount));
        if (!success) return res.status(422).json({ error: '調整失敗（餘額不足）' });
        const updated = await UserService.findById(user.id);
        const balanceAfter = parseFloat(updated.balance);
        // 記錄開分紀錄
        await db.execute(
            'INSERT INTO balance_logs (user_id, username, admin_username, amount, balance_before, balance_after, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [user.id, username, req.adminUsername || 'system', Number(amount), balanceBefore, balanceAfter, note || null]
        );
        // 即時同步給在線玩家
        const existingSockId = activeSessions.get(user.id);
        if (existingSockId) {
            const sock = io.sockets.sockets.get(existingSockId);
            if (sock?.user) { sock.user.balance += Number(amount); sock.emit('update_balance', { balance: sock.user.balance }); }
        }
        console.log(`👨‍💻 [Admin:${req.adminUsername}] 調整餘額: ${username} ${amount > 0 ? '+' : ''}${amount}`);
        res.json({ success: true, newBalance: balanceAfter });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── 玩家列表（分頁 + 篩選）──
app.get('/api/admin/players', adminAuth, async (req, res) => {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const { agentId, search } = req.query;

    let where = '1=1';
    const params = [];
    if (agentId) { where += ' AND u.agent_id = ?'; params.push(agentId); }
    if (search)  { where += ' AND u.username LIKE ?'; params.push(`%${search}%`); }

    try {
        const [rows] = await db.execute(`
            SELECT u.id, u.username, u.balance, u.created_at, u.last_login_at, u.agent_id,
                   u.is_banned,
                   a.name AS agent_name,
                   COALESCE(SUM(br.bet_total), 0) AS total_bet,
                   COALESCE(SUM(br.net),       0) AS total_net
            FROM users u
            LEFT JOIN agents a ON a.id = u.agent_id
            LEFT JOIN bet_records br ON br.user_id = u.id
            WHERE ${where}
            GROUP BY u.id
            ORDER BY u.created_at DESC
            LIMIT ${limit} OFFSET ${offset}
        `, params);
        const [[{ total }]] = await db.execute(
            `SELECT COUNT(*) AS total FROM users u WHERE ${where}`, params
        );
        res.json({ rows, total: Number(total), page, limit });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 玩家詳情 ──
app.get('/api/admin/players/:id/detail', adminAuth, async (req, res) => {
    try {
        const [[user]] = await db.execute(`
            SELECT u.id, u.username, u.balance, u.created_at, u.last_login_at, u.agent_id,
                   u.is_banned,
                   a.name AS agent_name,
                   COALESCE(SUM(br.bet_total),  0) AS total_bet,
                   COALESCE(SUM(br.win_amount), 0) AS total_win,
                   COALESCE(SUM(br.net),        0) AS total_net,
                   COUNT(br.id)                    AS bet_count
            FROM users u
            LEFT JOIN agents a ON a.id = u.agent_id
            LEFT JOIN bet_records br ON br.user_id = u.id
            WHERE u.id = ?
            GROUP BY u.id
        `, [req.params.id]);
        if (!user) return res.status(404).json({ error: '玩家不存在' });

        const [recentBets] = await db.execute(`
            SELECT settled_at, bet_total, win_amount, net,
                   banker_type, tian_win, di_win, xuan_win, huang_win,
                   bet_tian, bet_di, bet_xuan, bet_huang
            FROM bet_records WHERE user_id = ?
            ORDER BY settled_at DESC LIMIT 10
        `, [req.params.id]);

        res.json({ user, recentBets });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 玩家搜尋（含代理資訊）──
app.get('/api/admin/player-search', adminAuth, async (req, res) => {
    const { q } = req.query;
    if (!q?.trim()) return res.status(400).json({ error: '請輸入搜尋關鍵字' });
    try {
        const keyword = `%${q.trim()}%`;
        const [rows] = await db.execute(`
            SELECT u.id, u.username, u.balance, u.created_at, u.last_login_at, u.agent_id,
                   a.name AS agent_name, a.referral_code AS agent_code,
                   COALESCE(SUM(br.bet_total),  0) AS total_bet,
                   COALESCE(SUM(br.net),        0) AS total_net
            FROM users u
            LEFT JOIN agents a ON a.id = u.agent_id
            LEFT JOIN bet_records br ON br.user_id = u.id
            WHERE u.username LIKE ?
            GROUP BY u.id
            ORDER BY u.created_at DESC
            LIMIT 20
        `, [keyword]);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 指定玩家代理 ──
app.patch('/api/admin/users/:id/agent', adminAuth, async (req, res) => {
    const { agentId } = req.body;
    try {
        await db.execute('UPDATE users SET agent_id = ? WHERE id = ?', [agentId || null, req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 未綁定代理的玩家列表 ──
app.get('/api/admin/unbound-players', adminAuth, async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT id, username, balance, created_at, last_login_at
            FROM users WHERE agent_id IS NULL
            ORDER BY created_at DESC
        `);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 公告推播 ──
app.post('/api/admin/announce', adminAuth, (req, res) => {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: '公告內容不能為空' });
    io.emit('announcement', { message: message.trim(), time: new Date().toISOString() });
    console.log(`📢 [Admin] 推送公告: ${message.trim()}`);
    res.json({ success: true });
});

// ── 禁止牌型設定 ──
app.get('/api/admin/banned-types', adminAuth, (req, res) => {
    res.json({ bannedTypes: [...gameTable.bannedHandTypes] });
});

app.post('/api/admin/set-banned-types', adminAuth, (req, res) => {
    const { types } = req.body;
    if (!Array.isArray(types)) return res.status(400).json({ error: 'types 必須是陣列' });
    const validTypes = [
        'FIVE_SMALL','BOMB','FULL_HOUSE','STRAIGHT_FLUSH','FIVE_KNIGHTS','SILVER_NIU',
        'NIU_NIU','NIU_9','NIU_8','NIU_7','NIU_6','NIU_5','NIU_4','NIU_3','NIU_2','NIU_1','NO_NIU'
    ];
    const filtered = types.filter(t => validTypes.includes(t));
    res.json(gameTable.setBannedTypes(filtered));
});

// ── 彩金池 ──
app.get('/api/admin/jackpot/status', adminAuth, async (req, res) => {
    try {
        const pool = await JackpotService.getPool();
        res.json({ ...pool, live_amount: Math.floor(gameTable.jackpotAmount) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/jackpot/config', adminAuth, async (req, res) => {
    try { res.json(await JackpotService.getAllConfig()); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/jackpot/config', adminAuth, async (req, res) => {
    const { configs } = req.body;
    if (!Array.isArray(configs)) return res.status(400).json({ error: 'configs 必須是陣列' });
    try {
        await JackpotService.setConfig(configs);
        console.log(`👨‍💻 [Admin] 彩金設定已更新，${configs.filter(c=>c.is_enabled).length} 種觸發牌型`);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/jackpot/history', adminAuth, async (req, res) => {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    try { res.json(await JackpotService.getHistory(page, limit)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/jackpot/adjust', adminAuth, async (req, res) => {
    const { delta } = req.body;
    if (delta === undefined || isNaN(Number(delta))) return res.status(400).json({ error: '缺少 delta 參數' });
    try {
        const updated = await JackpotService.adjust(Number(delta));
        gameTable.jackpotAmount = parseFloat(updated.current_amount);
        console.log(`👨‍💻 [Admin] 彩金池手動調整 ${delta > 0 ? '+' : ''}${delta}，目前：$${gameTable.jackpotAmount.toLocaleString()}`);
        res.json({ success: true, newAmount: Math.floor(gameTable.jackpotAmount) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 歷史牌局（舊，保留相容） ──
app.get('/api/admin/round-history', adminAuth, async (req, res) => {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    try {
        const rows = await BetRecordService.getRoundHistory(limit);
        res.json(rows);
    } catch (err) {
        console.error('歷史記錄查詢失敗:', err);
        res.status(500).json({ error: '查詢失敗' });
    }
});

// ── 牌局紀錄（完整版）──
app.get('/api/admin/game-rounds', adminAuth, async (req, res) => {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 30));
    try { res.json(await GameRoundService.getHistory(page, limit)); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/game-rounds/stats', adminAuth, async (req, res) => {
    const n = Math.min(10000, Math.max(10, parseInt(req.query.n) || 100));
    try { res.json(await GameRoundService.getStats(n)); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// 👑 莊家管理 API
// ==========================================

app.get('/api/admin/banker/status', adminAuth, (req, res) => {
    res.json(bankerManager.getStatus());
});

app.post('/api/admin/banker/kick', adminAuth, async (req, res) => {
    const result = await bankerManager.adminKick();
    if (result.success) console.log('👨‍💻 [Admin] 強制踢除莊家');
    res.json(result);
});

app.get('/api/admin/banker/history', adminAuth, async (req, res) => {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    try { res.json(await BankerService.getHistory(page, limit)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 代理管理 ──
app.get('/api/admin/agents', adminAuth, async (req, res) => {
    try { res.json(await AgentService.getAll()); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/agents', adminAuth, async (req, res) => {
    try {
        const id = await AgentService.create(req.body);
        console.log(`🤝 [Admin] 新增代理: ${req.body.name} (${req.body.referral_code})`);
        res.json({ success: true, id });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/admin/agents/:id', adminAuth, async (req, res) => {
    try {
        await AgentService.update(req.params.id, req.body);
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/admin/agents/:id', adminAuth, async (req, res) => {
    try {
        await AgentService.delete(req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/admin/agents/:id/players', adminAuth, async (req, res) => {
    try { res.json(await AgentService.getPlayers(req.params.id)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/agents/:id/settlement', adminAuth, async (req, res) => {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: '請提供 from 與 to 日期' });
    try { res.json(await AgentService.getSettlement(req.params.id, from, to)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 開分紀錄 ──
app.get('/api/admin/balance-logs', adminAuth, async (req, res) => {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 30));
    const offset = (page - 1) * limit;
    const { userId } = req.query;

    let where = '1=1';
    const params = [];
    if (userId) { where += ' AND user_id = ?'; params.push(userId); }

    try {
        const [rows] = await db.execute(
            `SELECT * FROM balance_logs WHERE ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
            params
        );
        const [[{ total }]] = await db.execute(
            `SELECT COUNT(*) AS total FROM balance_logs WHERE ${where}`, params
        );
        res.json({ rows, total: Number(total), page, limit });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 玩家封鎖 / 解鎖 ──
app.patch('/api/admin/players/:id/ban', adminAuth, async (req, res) => {
    try {
        await db.execute('UPDATE users SET is_banned = 1 WHERE id = ?', [req.params.id]);
        // 強制踢除在線玩家
        const [[u]] = await db.execute('SELECT id FROM users WHERE id = ?', [req.params.id]);
        if (u) {
            const sid = activeSessions.get(u.id);
            if (sid) {
                const s = io.sockets.sockets.get(sid);
                if (s) {
                    s.emit('force_logout', { message: '您的帳號已被停用，請聯繫客服' });
                    setTimeout(() => s.disconnect(true), 200);
                }
            }
        }
        console.log(`👨‍💻 [Admin:${req.adminUsername}] 封鎖玩家 #${req.params.id}`);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/admin/players/:id/unban', adminAuth, async (req, res) => {
    try {
        await db.execute('UPDATE users SET is_banned = 0 WHERE id = ?', [req.params.id]);
        // 解鎖時同步清除速率限制，讓玩家可以立即登入
        const [[u]] = await db.execute('SELECT username FROM users WHERE id = ?', [req.params.id]);
        if (u?.username) clearLoginRateLimit(u.username);
        console.log(`👨‍💻 [Admin:${req.adminUsername}] 解鎖玩家 #${req.params.id}`);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 管理員帳號管理 ──
app.get('/api/admin/admins', adminAuth, async (req, res) => {
    try { res.json(await AdminUserService.getAll()); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/admins', adminAuth, async (req, res) => {
    const { username, password } = req.body;
    if (!username?.trim() || !password || password.length < 6)
        return res.status(400).json({ error: '帳號不能為空，密碼至少 6 碼' });
    try {
        await AdminUserService.create(username.trim(), password);
        console.log(`👨‍💻 [Admin:${req.adminUsername}] 新增管理員: ${username}`);
        res.json({ success: true });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: '此帳號已存在' });
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/admin/admins/:id/password', adminAuth, async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
        return res.status(400).json({ error: '新密碼至少 6 碼' });
    try {
        await AdminUserService.changePassword(req.params.id, newPassword);
        console.log(`👨‍💻 [Admin:${req.adminUsername}] 修改管理員 #${req.params.id} 密碼`);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/admins/:id', adminAuth, async (req, res) => {
    try {
        const all = await AdminUserService.getAll();
        if (all.length <= 1) return res.status(422).json({ error: '至少需要保留一個管理員帳號' });
        await AdminUserService.delete(req.params.id);
        console.log(`👨‍💻 [Admin:${req.adminUsername}] 刪除管理員 #${req.params.id}`);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 維護模式 ──
app.get('/api/admin/maintenance', adminAuth, (req, res) => {
    res.json({ isMaintenance });
});

app.post('/api/admin/maintenance', adminAuth, (req, res) => {
    const { enabled } = req.body;
    isMaintenance = !!enabled;
    if (isMaintenance) {
        io.emit('maintenance_mode', { enabled: true, message: '系統正在進行維護，請稍後再回來。' });
        console.log(`👨‍💻 [Admin:${req.adminUsername}] 開啟維護模式`);
    } else {
        io.emit('maintenance_mode', { enabled: false });
        console.log(`👨‍💻 [Admin:${req.adminUsername}] 關閉維護模式`);
    }
    res.json({ success: true, isMaintenance });
});

// ── 清除測試資料 ──
app.delete('/api/admin/clear-data', adminAuth, async (req, res) => {
    try {
        await GameRoundService.clearAll();
        await BetRecordService.clearAll();
        console.log('🗑️ [Admin] 已清除所有牌局與投注紀錄');
        res.json({ success: true, message: '已清除 game_rounds 及 bet_records' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================

const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
    console.log(`🚀 尊爵後端 (重構版) 運行中: http://localhost:${PORT}`);
    try {
        await AdminUserService.ensureTable();
        await AdminUserService.seedDefaultAdmin('qwer16395', 'asdf16395');
    } catch (e) {
        console.error('管理員帳號初始化失敗:', e.message);
    }
    try {
        await AgentService.ensureTable();
        console.log('✅ [Agent] 代理資料表確認完成');
    } catch (e) { console.error('代理資料表初始化失敗:', e.message); }
    // balance_logs 資料表
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS balance_logs (
                id            INT AUTO_INCREMENT PRIMARY KEY,
                user_id       INT          NOT NULL,
                username      VARCHAR(64)  NOT NULL,
                admin_username VARCHAR(64) NOT NULL,
                amount        DECIMAL(12,2) NOT NULL,
                balance_before DECIMAL(12,2) NOT NULL,
                balance_after  DECIMAL(12,2) NOT NULL,
                note          VARCHAR(255),
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user_id (user_id),
                INDEX idx_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('✅ [Balance] 開分紀錄資料表確認完成');
    } catch (e) { console.error('balance_logs 初始化失敗:', e.message); }

    // is_banned 欄位（相容 MySQL 5.7：先檢查 INFORMATION_SCHEMA 再 ALTER）
    try {
        const [[{ cnt }]] = await db.execute(`
            SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_banned'
        `);
        if (Number(cnt) === 0) {
            await db.execute(`ALTER TABLE users ADD COLUMN is_banned TINYINT(1) NOT NULL DEFAULT 0`);
            console.log('✅ [Users] is_banned 欄位已新增');
        } else {
            console.log('✅ [Users] is_banned 欄位已存在');
        }
    } catch (e) { console.error('is_banned 欄位初始化失敗:', e.message); }

    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS admin_refresh_tokens (
                id         INT AUTO_INCREMENT PRIMARY KEY,
                username   VARCHAR(64)  NOT NULL,
                token_hash CHAR(64)     NOT NULL,
                ip         VARCHAR(45),
                created_at DATETIME     NOT NULL,
                expires_at DATETIME     NOT NULL,
                INDEX idx_hash (token_hash),
                INDEX idx_user (username)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        await db.execute(`
            CREATE TABLE IF NOT EXISTS admin_login_logs (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                username     VARCHAR(64) NOT NULL,
                ip           VARCHAR(45),
                logged_in_at DATETIME    NOT NULL,
                INDEX idx_user_time (username, logged_in_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('✅ [Admin] 安全資料表確認完成');
    } catch (e) {
        console.error('安全資料表初始化失敗:', e.message);
    }
});
