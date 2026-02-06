// backend/managers/GameTable.js
const { TIMING } = require('../config/gameRules');
const gameLogic = require('../logic'); // 引用你原本的 logic.js
const betManager = require('./BetManager');
const UserService = require('../services/userService');

const PHASES = {
    BETTING: 'BETTING',
    DEALING: 'DEALING',
    SQUEEZING: 'SQUEEZING',
    RESULT: 'RESULT'
};

class GameTable {
    constructor(io) {
        this.io = io;
        this.phase = PHASES.BETTING;
        this.countdown = TIMING.BETTING_DURATION;
        this.roundResult = null; // 儲存開牌結果
        
        // 啟動心跳循環
        this.startGameLoop();
    }

    startGameLoop() {
        setInterval(() => {
            this.tick();
        }, 1000);
    }

    async tick() {
        this.countdown--;

        // 每秒廣播時間 (讓前端同步)
        // 優化：只在倒數關鍵時刻或整數秒廣播，節省流量，但這裡先每秒廣播確保同步
        this.io.emit('time_tick', { 
            phase: this.phase, 
            countdown: this.countdown,
            tableBets: betManager.tableBets // 順便廣播桌面籌碼，防止前端沒收到下注事件
        });

        if (this.countdown <= 0) {
            await this.nextPhase();
        }
    }

    async nextPhase() {
        switch (this.phase) {
            case PHASES.BETTING:
                // 1. 下注結束 -> 開始發牌
                this.generateResult();
                this.phase = PHASES.DEALING;
                this.countdown = TIMING.DEALING_DURATION;
                break;

            case PHASES.DEALING:
                // 2. 發牌結束 -> 開始瞇牌
                this.phase = PHASES.SQUEEZING;
                this.countdown = TIMING.SQUEEZING_DURATION;
                break;

            case PHASES.SQUEEZING:
                // 3. 瞇牌結束 -> 展示結果並派彩
                this.phase = PHASES.RESULT;
                this.countdown = TIMING.RESULT_DURATION;
                await this.settleBets(); // 結算派彩
                break;

            case PHASES.RESULT:
                // 4. 展示結束 -> 新局開始
                this.resetGame();
                break;
        }

        // 廣播階段變更
        this.io.emit('phase_change', {
            phase: this.phase,
            countdown: this.countdown,
            roundResult: this.roundResult // 如果是 DEALING 階段，前端會收到牌資料
        });
    }

    // 🎴 產生牌局結果 (呼叫 logic.js)
    generateResult() {
        try {
            const deck = gameLogic.createDeck();
            const hands = {
                banker: deck.slice(0, 5),
                tian:   deck.slice(5, 10),
                di:     deck.slice(10, 15),
                xuan:   deck.slice(15, 20),
                huang:  deck.slice(20, 25),
            };
            
            // 計算點數 (這裡假設 logic.js 有這些 function)
            const results = {
                banker: gameLogic.calculateHand(hands.banker),
                tian:   gameLogic.calculateHand(hands.tian),
                di:     gameLogic.calculateHand(hands.di),
                xuan:   gameLogic.calculateHand(hands.xuan),
                huang:  gameLogic.calculateHand(hands.huang),
            };

            // 比牌 (閒家 vs 莊家)
            const winners = {
                tian: gameLogic.isPlayerWin(results.tian, results.banker),
                di:   gameLogic.isPlayerWin(results.di, results.banker),
                xuan: gameLogic.isPlayerWin(results.xuan, results.banker),
                huang: gameLogic.isPlayerWin(results.huang, results.banker),
            };

            this.roundResult = { hands, results, winners };
        } catch (error) {
            console.error("發牌邏輯錯誤:", error);
        }
    }

    // 💰 結算派彩
    async settleBets() {
        // 遍歷所有在線 Socket
        const sockets = await this.io.fetchSockets();
        
        for (const socket of sockets) {
            if (!socket.user) continue;

            const bets = betManager.getPlayerBet(socket.id);
            let totalWin = 0;
            let hasBet = false;

            // 檢查每一門 (tian, di, xuan, huang)
            for (const [zone, amount] of Object.entries(bets)) {
                if (amount > 0) {
                    hasBet = true;
                    // 如果該門贏了
                    if (this.roundResult.winners[zone]) {
                        const multiplier = this.roundResult.results[zone].multiplier;
                        // 本金 + (本金 * 倍率 * 0.95)
                        const profit = Math.floor(amount * multiplier * 0.95);
                        totalWin += (amount + profit);
                    }
                }
            }

            if (hasBet && totalWin > 0) {
                // 更新資料庫餘額
                await UserService.updateBalance(socket.user.db_id, totalWin);
                
                // 更新記憶體中的餘額 (讓下一局驗證正確)
                socket.user.balance += totalWin;

                // 通知前端中獎
                socket.emit('update_balance', { 
                    balance: socket.user.balance,
                    winAmount: totalWin
                });
            }
        }
    }

    // 🔄 重置遊戲
    resetGame() {
        this.phase = PHASES.BETTING;
        this.countdown = TIMING.BETTING_DURATION;
        this.roundResult = null;
        betManager.reset(); // 清空下注管理器
        
        // 廣播清空桌面的事件
        this.io.emit('update_table_bets', { tian: 0, di: 0, xuan: 0, huang: 0 });
    }
}

module.exports = GameTable;