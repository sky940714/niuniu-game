// backend/index.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
require('dotenv').config();

const GameTable = require('./managers/GameTable');
const betManager = require('./managers/BetManager');
const UserService = require('./services/userService');
const BetRecordService = require('./services/betRecordService');
const botManager = require('./managers/BotManager');

const app = express();
app.use(express.json());
app.use(cors({
    origin: [
        "http://localhost:5173",
        "http://localhost:5174"
    ],
    methods: ["GET", "POST"],
    credentials: true
}));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const JWT_SECRET = process.env.JWT_SECRET || 'Prestige_NiuNiu_Super_Secret_2026';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'Prestige_Admin_X7k9_2026';

// === 多裝置登入防護 (db_id -> socketId) ===
const activeSessions = new Map();

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

// 🚀 初始化遊戲桌
const gameTable = new GameTable(io);
botManager.init(io, gameTable);

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
            phase: gameTable.phase,
            countdown: gameTable.countdown,
            tableBets: betManager.tableBets,
            myBets: betManager.getPlayerBet(socket.user.db_id)
        });
    }

    // 2. 註冊 (後端驗證)
    socket.on('register', async (data) => {
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
                    phase: gameTable.phase,
                    countdown: gameTable.countdown,
                    tableBets: betManager.tableBets
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

        const { zoneId, amount } = data;

        const { valid, msg, zoneName } = betManager.validateBet(socket.user, zoneId, amount, gameTable);
        if (!valid) return socket.emit('error_msg', msg);

        try {
            const success = await UserService.updateBalance(socket.user.db_id, -amount);
            if (!success) throw new Error("扣款失敗");

            socket.user.balance -= amount;
            const { newTableBet } = betManager.placeBet(socket.user.db_id, zoneName, amount);

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

    // 5. 玩家進入遊戲廳時主動要求當前局狀態（init_state 已在 lobby 階段發過，需要再發一次）
    socket.on('request_state', () => {
        if (!socket.user) return;
        socket.emit('init_state', {
            phase: gameTable.phase,
            countdown: gameTable.countdown,
            tableBets: betManager.tableBets,
            myBets: betManager.getPlayerBet(socket.user.db_id)
        });
    });

    socket.on('disconnect', () => {
        if (socket.user) {
            if (activeSessions.get(socket.user.db_id) === socket.id) {
                activeSessions.delete(socket.user.db_id);
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
// 🔐 後台管理 API - 需帶 x-admin-secret 標頭
// ==========================================

const adminAuth = (req, res, next) => {
    const secret = req.headers['x-admin-secret'];
    if (!secret || secret !== ADMIN_SECRET) {
        return res.status(401).json({ error: '未授權，請提供正確的管理金鑰' });
    }
    next();
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
    const { username, amount } = req.body;
    if (!username || amount === undefined || isNaN(Number(amount))) {
        return res.status(400).json({ error: '缺少參數 (username, amount)' });
    }
    try {
        const user = await UserService.findByUsername(username);
        if (!user) return res.status(404).json({ error: '找不到此帳號' });
        const success = await UserService.updateBalance(user.id, Number(amount));
        if (!success) return res.status(422).json({ error: '調整失敗（餘額不足）' });
        // 即時同步給在線玩家
        const existingSockId = activeSessions.get(user.id);
        if (existingSockId) {
            const sock = io.sockets.sockets.get(existingSockId);
            if (sock?.user) { sock.user.balance += Number(amount); sock.emit('update_balance', { balance: sock.user.balance }); }
        }
        const updated = await UserService.findById(user.id);
        console.log(`👨‍💻 [Admin] 調整餘額: ${username} ${amount > 0 ? '+' : ''}${amount}`);
        res.json({ success: true, newBalance: updated.balance });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── 公告推播 ──
app.post('/api/admin/announce', adminAuth, (req, res) => {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: '公告內容不能為空' });
    io.emit('announcement', { message: message.trim(), time: new Date().toISOString() });
    console.log(`📢 [Admin] 推送公告: ${message.trim()}`);
    res.json({ success: true });
});

// ── 歷史牌局 ──
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

// ==========================================

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 尊爵後端 (重構版) 運行中: http://localhost:${PORT}`);
});
