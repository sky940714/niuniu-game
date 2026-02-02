const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
require('dotenv').config();

// 👇 引入規則書
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

// 定義遊戲階段
const PHASES = {
    BETTING: 'BETTING',     
    DEALING: 'DEALING',     
    SQUEEZING: 'SQUEEZING', 
    RESULT: 'RESULT',       
};

// 遊戲全域狀態
let gameState = {
    phase: PHASES.BETTING,
    countdown: 18,     
    roundResult: null, 
};

// === 💰 玩家資料庫 (暫存在記憶體) ===
// 結構: { "socket_id": { balance: 10000, bets: {0:0, 1:0, 2:0, 3:0} } }
let players = {};

// 區域對照表 (前端 ID -> 後端屬性名)
const ZONE_MAP = { 0: 'tian', 1: 'di', 2: 'xuan', 3: 'huang' };

// === ⏱️ 伺服器心跳 (每秒執行一次) ===
setInterval(() => {
    gameState.countdown--;

    // 狀態切換邏輯
    if (gameState.countdown <= 0) {
        switch (gameState.phase) {
            case PHASES.BETTING:
                console.log("🛑 停止下注 -> 開始發牌");
                
                // === 🔥 核心邏輯：後端發牌與運算 ===
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

                // === 💰 結算派彩邏輯 (後端算錢) ===
                console.log("🏆 進行結算派彩...");
                
                // 遍歷所有在線玩家
                for (let socketId in players) {
                    let player = players[socketId];
                    let totalWin = 0;
                    let hasBet = false;

                    // 檢查 4 個區域
                    for (let zoneId = 0; zoneId < 4; zoneId++) {
                        const betAmount = player.bets[zoneId];
                        if (betAmount > 0) {
                            hasBet = true;
                            const zoneName = ZONE_MAP[zoneId]; // tian, di...
                            const isWin = gameState.roundResult.winners[zoneName];
                            
                            if (isWin) {
                                // 贏家拿回：本金 + (本金 * 倍率 * 0.95)
                                const multiplier = gameState.roundResult.results[zoneName].multiplier;
                                const profit = betAmount * multiplier * 0.95;
                                totalWin += (betAmount + profit);
                            }
                            // 如果輸了，本金已經在下注時扣除，這裡不需要動作
                        }
                    }

                    // 如果有贏錢，加回餘額
                    if (totalWin > 0) {
                        player.balance += Math.floor(totalWin);
                    }

                    // 🔥 重要：私下告訴這位玩家他的最新餘額
                    if (hasBet) {
                        io.to(socketId).emit('update_balance', { 
                            balance: player.balance,
                            winAmount: Math.floor(totalWin) 
                        });
                        console.log(`玩家 ${socketId} 結算後餘額: ${player.balance}`);
                    }
                }
                break;

            case PHASES.RESULT:
                console.log("🔄 新局開始，清空下注");
                
                // 清空所有玩家的下注紀錄
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
        io.emit('time_tick', {
            phase: gameState.phase,
            countdown: gameState.countdown
        });
    }
}, 1000);

// === 🔌 連線與通訊邏輯 ===
io.on('connection', (socket) => {
    console.log(`⚡ 玩家連線: ${socket.id}`);

    // 1. 初始化新玩家 (給 10000 分)
    if (!players[socket.id]) {
        players[socket.id] = {
            id: socket.id,
            balance: 10000, // 初始發財金
            bets: { 0: 0, 1: 0, 2: 0, 3: 0 }
        };
    }

    // 2. 馬上告訴前端：當前狀態 + 你的餘額
    socket.emit('init_state', gameState);
    socket.emit('update_balance', { balance: players[socket.id].balance });

    // 3. 監聽：玩家下注
    socket.on('place_bet', (data) => {
        // data 格式: { zoneId: 0, amount: 100 }
        
        // 安全檢查：非下注時間不能下注
        if (gameState.phase !== PHASES.BETTING) return;

        const player = players[socket.id];
        const { zoneId, amount } = data;

        // 安全檢查：餘額不足
        if (player.balance < amount) {
            socket.emit('error_msg', '餘額不足！');
            return;
        }

        // ✅ 扣款並紀錄
        player.balance -= amount;
        player.bets[zoneId] += amount;

        console.log(`玩家 ${socket.id} 下注 ${amount} 在區域 ${zoneId}, 剩餘 ${player.balance}`);

        // 回傳最新餘額給前端
        socket.emit('update_balance', { balance: player.balance });
    });

    // 4. 斷線處理
    socket.on('disconnect', () => {
        console.log(`👋 玩家斷線: ${socket.id}`);
        // 選擇性：斷線後是否要刪除資料？
        // delete players[socket.id]; 
        // 為了讓玩家重整網頁後錢還在，暫時保留記憶體中的資料
    });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
    console.log(`🚀 後端伺服器運行中: http://localhost:${PORT}`);
});