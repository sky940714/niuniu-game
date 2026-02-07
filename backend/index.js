// backend/index.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// 引入模組
const GameTable = require('./managers/GameTable');
const betManager = require('./managers/BetManager');
const UserService = require('./services/userService');
const botManager = require('./managers/BotManager');

const app = express();
app.use(cors({
    origin: [
        "http://localhost:5173", // 玩家前端
        "http://localhost:5174"  // 老闆後台
    ],
    methods: ["GET", "POST"],
    credentials: true
}));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const JWT_SECRET = process.env.JWT_SECRET || 'Prestige_NiuNiu_Super_Secret_2026';

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

            const bcrypt = require('bcrypt'); 
            const isMatch = await bcrypt.compare(data.password, user.password);
            
            if (isMatch) {
                const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '24h' });
                
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
            console.error(error);
            socket.emit('login_response', { success: false, message: "系統錯誤" });
        }
    });

    // 4. 下注請求 (這裡會用到新的 B 模式檢查)
    socket.on('place_bet', async (data) => {
        if (!socket.user) return socket.emit('error_msg', '請先登入');

        const { zoneId, amount } = data; // amount 需為正整數

        // 🔥 呼叫 BetManager 進行 B 模式餘額檢查
        // socket.user 已經包含最新餘額
        const { valid, msg, zoneName } = betManager.validateBet(socket.user, zoneId, amount, gameTable);

        if (!valid) {
            // 驗證失敗 (例如：餘額不足支付5倍賠付)，直接回傳錯誤
            return socket.emit('error_msg', msg);
        }

        // 驗證通過，執行扣款
        try {
            // 扣除資料庫餘額 (只扣本金)
            // 注意：B 模式只是「檢查」你要有5倍錢，但實際下注只扣「1倍」
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
            console.error("下注異常:", error);
            socket.emit('error_msg', '下注失敗，請稍後再試');
        }
    });

    socket.on('disconnect', () => {
        // 玩家斷線處理
    });
});

// ==========================================
// 🔥 [新增] 後台管理 API (Admin API)
// ==========================================

// 1. 👁️ 預覽牌局 (Preview) - 讓老闆看到還沒開的牌
app.get('/api/admin/preview', (req, res) => {
    // 只有當 gameTable 已經產生結果 (倒數 5 秒內) 才能看
    if (!gameTable.roundResult) {
        return res.json({ ready: false, message: "牌局尚未生成 (請等待倒數 5 秒)" });
    }

    // 回傳目前的牌型結構
    // 包含：hands (各家手牌), results (牛牛點數)
    res.json({
        ready: true,
        hands: gameTable.roundResult.hands,
        results: gameTable.roundResult.results
    });
});

// 2. 🔄 交換手牌 (Swap) - 上帝之手
app.post('/api/admin/swap-hand', (req, res) => {
    const { pos1, pos2 } = req.body;
    // 預期傳入: { pos1: 'banker', pos2: 'tian' }
    // pos 選項: 'banker', 'tian', 'di', 'xuan', 'huang'

    if (!pos1 || !pos2) return res.status(400).json({ error: "缺少參數" });

    // 呼叫 GameTable 的換牌方法 (稍後會在 GameTable.js 實作)
    const success = gameTable.swapHands(pos1, pos2);
    
    if (success) {
        console.log(`👨‍💻 後台換牌成功: ${pos1} <-> ${pos2}`);
        res.json({ success: true, message: `已交換 ${pos1} 與 ${pos2} 的手牌` });
    } else {
        res.status(500).json({ error: "交換失敗 (可能是牌局尚未生成)" });
    }
});

// 3. 取得即時桌況 (監控下注)
app.get('/api/admin/status', (req, res) => {
    // 簡單回傳目前狀態，讓後台知道何時倒數結束
    res.json({
        phase: gameTable.phase,
        countdown: gameTable.countdown,
        // 如果想看下注池水位，也可以加在這裡
    });
});

// ==========================================

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 尊爵後端 (重構版) 運行中: http://localhost:${PORT}`);
});