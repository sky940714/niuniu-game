const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const gameLogic = require('./logic'); 

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// 使用你提供的 Secret
const JWT_SECRET = process.env.JWT_SECRET || 'Prestige_NiuNiu_Super_Secret_2026';

// === 🗄️ MySQL 連線設定 ===
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '', 
    database: process.env.DB_NAME || 'prestige_niu_niu',
    waitForConnections: true,
    connectionLimit: 10
});

const PHASES = {
    BETTING: 'BETTING',     
    DEALING: 'DEALING',     
    SQUEEZING: 'SQUEEZING', 
    RESULT: 'RESULT',       
};

let gameState = {
    phase: PHASES.BETTING,
    countdown: 18,     
    roundResult: null, 
};

let players = {}; 
const ZONE_MAP = { 0: 'tian', 1: 'di', 2: 'xuan', 3: 'huang' };

// === ⏱️ 伺服器心跳 ===
setInterval(async () => {
    gameState.countdown--;
    if (gameState.countdown <= 0) {
        switch (gameState.phase) {
            case PHASES.BETTING:
                try {
                    const deck = gameLogic.createDeck(); 
                    const hands = {
                        banker: deck.slice(0, 5),
                        tian:   deck.slice(5, 10),
                        di:     deck.slice(10, 15),
                        xuan:   deck.slice(15, 20),
                        huang:  deck.slice(20, 25),
                    };
                    const results = {
                        banker: gameLogic.calculateHand(hands.banker),
                        tian:   gameLogic.calculateHand(hands.tian),
                        di:     gameLogic.calculateHand(hands.di),
                        xuan:   gameLogic.calculateHand(hands.xuan),
                        huang:  gameLogic.calculateHand(hands.huang),
                    };
                    const winners = {
                        tian: gameLogic.isPlayerWin(results.tian, results.banker),
                        di:   gameLogic.isPlayerWin(results.di, results.banker),
                        xuan: gameLogic.isPlayerWin(results.xuan, results.banker),
                        huang: gameLogic.isPlayerWin(results.huang, results.banker),
                    };
                    gameState.roundResult = { hands, results, winners };
                    gameState.phase = PHASES.DEALING;
                    gameState.countdown = 8; 
                    io.emit('phase_change', gameState);
                } catch (error) {
                    console.error("發牌邏輯錯誤:", error);
                }
                break;

            case PHASES.DEALING:
                gameState.phase = PHASES.SQUEEZING;
                gameState.countdown = 10;
                io.emit('phase_change', gameState);
                break;

            case PHASES.SQUEEZING:
                gameState.phase = PHASES.RESULT;
                gameState.countdown = 5;
                io.emit('phase_change', gameState);

                for (let socketId in players) {
                    let player = players[socketId];
                    let totalWin = 0;
                    let hasBet = false;
                    for (let zoneId = 0; zoneId < 4; zoneId++) {
                        const betAmount = player.bets[zoneId];
                        if (betAmount > 0) {
                            hasBet = true;
                            const zoneName = ZONE_MAP[zoneId];
                            if (gameState.roundResult.winners[zoneName]) {
                                const multiplier = gameState.roundResult.results[zoneName].multiplier;
                                totalWin += (betAmount + (betAmount * multiplier * 0.95));
                            }
                        }
                    }

                    if (hasBet) {
                        player.balance += Math.floor(totalWin);
                        try {
                            await pool.execute('UPDATE users SET balance = ? WHERE username = ?', [player.balance, player.username]);
                        } catch (err) {
                            console.error("資料庫更新失敗:", err);
                        }
                        io.to(socketId).emit('update_balance', { 
                            balance: player.balance,
                            winAmount: Math.floor(totalWin) 
                        });
                    }
                }
                break;

            case PHASES.RESULT:
                for (let socketId in players) {
                    players[socketId].bets = {0:0, 1:0, 2:0, 3:0};
                }
                gameState.phase = PHASES.BETTING;
                gameState.countdown = 18;
                gameState.roundResult = null;
                io.emit('phase_change', gameState);
                break;
        }
    } else {
        io.emit('time_tick', { phase: gameState.phase, countdown: gameState.countdown });
    }
}, 1000);

// === 🛡️ Socket.io 中間件：統一驗證與玩家初始化 ===
io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    
    if (!token) {
        return next(); // 允許連線進入，但此時 socket.user 為 undefined
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const [rows] = await pool.execute(
            'SELECT id, username, balance, referral_code FROM users WHERE id = ?', 
            [decoded.id]
        );

        if (rows.length > 0) {
            const user = rows[0];
            // 將玩家資料掛載到 socket 物件上供後續使用
            socket.user = {
                db_id: user.id,
                username: user.username,
                balance: user.balance,
                referral_code: user.referral_code
            };
            next();
        } else {
            next(new Error("使用者不存在"));
        }
    } catch (err) {
        console.error("Token 驗證失敗:", err.message);
        // 如果 Token 過期但不影響連線，可以用 next()，若要強制登入則 next(err)
        next(); 
    }
});

// === 🔌 Socket 通訊邏輯 ===
io.on('connection', (socket) => {
    console.log(`⚡ 連線成功: ${socket.id}`);

    // 如果中間件驗證成功，初始化玩家狀態
    if (socket.user) {
        players[socket.id] = {
            ...socket.user,
            bets: { 0: 0, 1: 0, 2: 0, 3: 0 }
        };
        
        socket.emit('auth_success', {
            username: socket.user.username,
            balance: socket.user.balance,
            referral_code: socket.user.referral_code
        });
        socket.emit('init_state', gameState);
        console.log(`✨ 玩家 ${socket.user.username} 自動登入成功`);
    }

    // --- 1. 註冊邏輯 ---
    socket.on('register', async (data) => {
        try {
            const { username, password, referralCodeInput } = data;
            const phoneRegex = /^09\d{8}$/;
            if (!phoneRegex.test(username)) {
                return socket.emit('register_response', { success: false, message: "手機格式錯誤" });
            }

            let referrerId = null;
            if (referralCodeInput) {
                const [refRows] = await pool.execute('SELECT id FROM users WHERE referral_code = ?', [referralCodeInput]);
                if (refRows.length > 0) referrerId = refRows[0].id;
                else return socket.emit('register_response', { success: false, message: "無效的推薦碼" });
            }

            const myReferralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            const hashedPassword = await bcrypt.hash(password, 10);

            await pool.execute(
                'INSERT INTO users (username, password, referral_code, referrer_id, balance) VALUES (?, ?, ?, ?, ?)',
                [username, hashedPassword, myReferralCode, referrerId, 10000]
            );
            socket.emit('register_response', { success: true, message: "註冊成功！" });
        } catch (error) {
            socket.emit('register_response', { success: false, message: "號碼已被註冊" });
        }
    });

    // --- 2. 登入邏輯 ---
    socket.on('login', async (data) => {
        try {
            const { username, password } = data;
            const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);

            if (rows.length === 0) return socket.emit('login_response', { success: false, message: "帳號不存在" });

            const user = rows[0];
            const isMatch = await bcrypt.compare(password, user.password);

            if (isMatch) {
                const token = jwt.sign(
                    { id: user.id, username: user.username },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );

                // 踢掉同帳號的舊連接
                for (let sid in players) {
                    if (players[sid].username === user.username) {
                        io.to(sid).emit('error_msg', '帳號已在其他地方登入');
                        io.sockets.sockets.get(sid)?.disconnect();
                    }
                }

                players[socket.id] = {
                    db_id: user.id,
                    username: user.username,
                    balance: user.balance,
                    bets: { 0: 0, 1: 0, 2: 0, 3: 0 }
                };

                await pool.execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

                socket.emit('login_response', { 
                    success: true, 
                    token: token,
                    username: user.username, 
                    balance: user.balance,
                    referral_code: user.referral_code
                });
                socket.emit('init_state', gameState);
            } else {
                socket.emit('login_response', { success: false, message: "密碼錯誤" });
            }
        } catch (error) {
            socket.emit('login_response', { success: false, message: "伺服器錯誤" });
        }
    });

    // --- 3. 下注邏輯 ---
    socket.on('place_bet', async (data) => {
        if (gameState.phase !== PHASES.BETTING) return;
        const player = players[socket.id];
        if (!player) return;

        const { zoneId, amount } = data;
        if (player.balance < amount) return socket.emit('error_msg', '餘額不足！');

        player.balance -= amount;
        player.bets[zoneId] += amount;

        try {
            await pool.execute('UPDATE users SET balance = ? WHERE username = ?', [player.balance, player.username]);
            socket.emit('update_balance', { balance: player.balance });
        } catch (err) {
            console.error("扣款失敗:", err);
        }
    });

    socket.on('disconnect', () => {
        console.log(`❌ 斷開連線: ${socket.id}`);
        delete players[socket.id];
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 尊爵後端運行中: http://localhost:${PORT}`);
});