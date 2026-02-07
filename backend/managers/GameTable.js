// backend/managers/GameTable.js
const { TIMING } = require('../config/gameRules');
const gameLogic = require('../logic'); 
const betManager = require('./BetManager');
const UserService = require('../services/userService');

// 🔥 [新增] 1. 引入 BotManager
const botManager = require('./BotManager');

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
        this.roundResult = null; 
        
        // 啟動心跳循環
        this.startGameLoop();

        // 🔥 [新增] 2. 伺服器剛啟動的第一局，讓機器人進場
        // 這樣不用等下一局，馬上就有機器人開始下注
        botManager.prepareBotsForRound();
        botManager.startBettingRoutine();
    }

    startGameLoop() {
        setInterval(() => {
            this.tick();
        }, 1000);
    }

    async tick() {
        this.countdown--;

        // 每秒廣播時間
        this.io.emit('time_tick', { 
            phase: this.phase, 
            countdown: this.countdown,
            tableBets: betManager.tableBets 
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
            roundResult: this.roundResult 
        });
    }

    // 🎴 產生牌局結果
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

            this.roundResult = { hands, results, winners };
        } catch (error) {
            console.error("發牌邏輯錯誤:", error);
        }
    }

    // 💰 結算派彩
    async settleBets() {
        const sockets = await this.io.fetchSockets();
        
        for (const socket of sockets) {
            if (!socket.user) continue;

            const bets = betManager.getPlayerBet(socket.id);
            let totalWin = 0;
            let hasBet = false;

            for (const [zone, amount] of Object.entries(bets)) {
                if (amount > 0) {
                    hasBet = true;
                    if (this.roundResult.winners[zone]) {
                        const multiplier = this.roundResult.results[zone].multiplier;
                        const profit = Math.floor(amount * multiplier * 0.95);
                        totalWin += (amount + profit);
                    }
                }
            }

            if (hasBet && totalWin > 0) {
                await UserService.updateBalance(socket.user.db_id, totalWin);
                
                socket.user.balance += totalWin;

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
        betManager.reset(); 
        
        this.io.emit('update_table_bets', { tian: 0, di: 0, xuan: 0, huang: 0 });

        // 🔥 [新增] 3. 新局開始，叫機器人出來上班
        botManager.prepareBotsForRound();
        botManager.startBettingRoutine();
    }
}

module.exports = GameTable;