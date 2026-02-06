// backend/index.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// 引入新模組
const GameTable = require('./managers/GameTable');
const betManager = require('./managers/BetManager');
const UserService = require('./services/userService');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const JWT_SECRET = process.env.JWT_SECRET || 'Prestige_NiuNiu_Super_Secret_2026';

// 🚀 初始化遊戲桌
const gameTable = new GameTable(io);

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
                balance: parseFloat(user.balance), // 確保是數字
                referral_code: user.referral_code,
                socketId: socket.id 
            };
            next();
        } else {
            next(new Error("使用者不存在"));
        }
    } catch (err) {
        next(); // Token 無效則當作遊客
    }
});

// === 🔌 Socket 事件處理 ===
io.on('connection', (socket) => {
    console.log(`⚡ 連線: ${socket.id}`);

    // 1. 自動登入與狀態同步
    if (socket.user) {
        socket.emit('auth_success', socket.user);
        // 傳送當前遊戲狀態
        socket.emit('init_state', {
            phase: gameTable.phase,
            countdown: gameTable.countdown,
            tableBets: betManager.tableBets, // 同步桌面籌碼
            myBets: betManager.getPlayerBet(socket.id) // 同步自己已下的注 (斷線重連用)
        });
    }

    // 2. 註冊
    socket.on('register', async (data) => {
        try {
            await UserService.register(data.username, data.password, data.referralCodeInput);
            socket.emit('register_response', { success: true, message: "註冊成功！" });
        } catch (error) {
            socket.emit('register_response', { success: false, message: error.message });
        }
    });

    // 3. 登入
    socket.on('login', async (data) => {
        try {
            const user = await UserService.findByUsername(data.username);
            if (!user) return socket.emit('login_response', { success: false, message: "帳號不存在" });

            const bcrypt = require('bcrypt'); // 這裡臨時引用一下，或是移到 UserService 驗證密碼
            const isMatch = await bcrypt.compare(data.password, user.password);
            
            if (isMatch) {
                const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '24h' });
                
                // 踢除舊連線邏輯可在此實作...

                socket.user = { 
                    db_id: user.id, 
                    username: user.username, 
                    balance: parseFloat(user.balance),
                    socketId: socket.id
                };

                // 更新最後登入時間
                UserService.updateLoginTime(user.id).catch(console.error);

                socket.emit('login_response', { 
                    success: true, 
                    token, 
                    username: user.username, 
                    balance: user.balance 
                });
                
                // 同步狀態
                socket.emit('init_state', {
                    phase: gameTable.phase,
                    countdown: gameTable.countdown,
                    tableBets: betManager.tableBets
                });
            } else {
                socket.emit('login_response', { success: false, message: "密碼錯誤" });
            }
        } catch (error) {
            socket.emit('login_response', { success: false, message: "系統錯誤" });
        }
    });

    // 4. 下注請求
    socket.on('place_bet', async (data) => {
        if (!socket.user) return socket.emit('error_msg', '請先登入');

        const { zoneId, amount } = data; // amount 需為正整數
        const { valid, msg, zoneName } = betManager.validateBet(socket.user, zoneId, amount, gameTable);

        if (!valid) {
            return socket.emit('error_msg', msg);
        }

        // 驗證通過，執行扣款
        try {
            // 扣除資料庫餘額
            const success = await UserService.updateBalance(socket.user.db_id, -amount);
            if (!success) throw new Error("扣款失敗");

            // 更新記憶體狀態
            socket.user.balance -= amount;
            const { newTableBet } = betManager.placeBet(socket.id, zoneName, amount);

            // 回傳成功給自己
            socket.emit('update_balance', { balance: socket.user.balance });

            // 廣播給所有人 (更新桌面籌碼動畫)
            io.emit('update_table_bets', {
                zoneId,       // 0, 1, 2, 3
                zoneName,     // 'tian'...
                amount,       // 本次新增金額 (前端做飛籌碼動畫)
                totalAmount: newTableBet, // 該門總金額
                username: socket.user.username // 顯示誰下注 (可選)
            });

        } catch (error) {
            console.error(error);
            socket.emit('error_msg', '下注失敗，請稍後再試');
        }
    });

    socket.on('disconnect', () => {
        // 玩家斷線，但在本局結束前，betManager 裡的注單還是有效的，結算時依然會派彩到 DB
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 尊爵後端 (重構版) 運行中: http://localhost:${PORT}`);
});