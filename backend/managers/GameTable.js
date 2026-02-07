// backend/managers/GameTable.js
const { TIMING } = require('../config/gameRules');
const gameLogic = require('../logic'); 
const betManager = require('./BetManager');
const UserService = require('../services/userService');
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
        this.isBetLocked = false;
        
        // 啟動心跳循環
        this.startGameLoop();

        // 伺服器剛啟動的第一局，先發牌並讓機器人進場
        // 這樣第一局才有牌可以看
        this.generateResult(); 
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

        // 🔥 [修改] 倒數剩 5 秒時：只做鎖定，不重新發牌
        // 因為牌在 resetGame() 時已經發好了
        if (this.phase === PHASES.BETTING && this.countdown === 5) { // 這裡建議對應 TIMING.LOCK_BEFORE_END
            this.isBetLocked = true;
            
            // 通知前端：鎖住籌碼，顯示停止下注
            this.io.emit('bet_lock', { lock: true }); 
            
            console.log("🔒 [System] 下注鎖定 (剩5秒)");
        }

        // 每秒廣播時間
        this.io.emit('time_tick', { 
            phase: this.phase, 
            countdown: this.countdown,
            tableBets: betManager.tableBets 
        });

        // 倒數結束，進入下一階段
        if (this.countdown <= 0) {
            await this.nextPhase();
        }
    }

    async nextPhase() {
        switch (this.phase) {
            case PHASES.BETTING:
                // 1. 下注結束 -> 開始發牌
                // 🔥 [修正] 這裡絕對不能再 call generateResult()
                // 因為結果早在 18 秒前就決定好了 (甚至被後台換過了)
                
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
            
            // 計算點數
            const results = {
                banker: gameLogic.calculateHand(hands.banker),
                tian:   gameLogic.calculateHand(hands.tian),
                di:     gameLogic.calculateHand(hands.di),
                xuan:   gameLogic.calculateHand(hands.xuan),
                huang:  gameLogic.calculateHand(hands.huang),
            };

            // 判斷輸贏
            const winners = {
                tian: gameLogic.isPlayerWin(results.tian, results.banker),
                di:   gameLogic.isPlayerWin(results.di, results.banker),
                xuan: gameLogic.isPlayerWin(results.xuan, results.banker),
                huang: gameLogic.isPlayerWin(results.huang, results.banker),
            };

            this.roundResult = { hands, results, winners };
            // console.log("🎴 新牌局已生成 (後台可見)");
        } catch (error) {
            console.error("發牌邏輯錯誤:", error);
        }
    }

    // 🔥 [新增] 上帝換牌功能 (給後台 API 呼叫)
    swapHands(targetA, targetB) {
        if (!this.roundResult) return false;

        const hands = this.roundResult.hands;
        
        // 1. 交換手牌陣列
        const tempHand = hands[targetA];
        hands[targetA] = hands[targetB];
        hands[targetB] = tempHand;

        // 2. 重新計算點數結果
        const results = this.roundResult.results;
        results[targetA] = gameLogic.calculateHand(hands[targetA]);
        results[targetB] = gameLogic.calculateHand(hands[targetB]);

        // 3. 重新判斷輸贏
        const winners = this.roundResult.winners;
        ['tian', 'di', 'xuan', 'huang'].forEach(zone => {
            winners[zone] = gameLogic.isPlayerWin(results[zone], results.banker);
        });

        console.log(`👨‍💻 [Admin] 上帝換牌執行：[${targetA}] <==> [${targetB}]`);
        return true;
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
        
        // 重置鎖定狀態
        this.isBetLocked = false; 
        this.io.emit('bet_lock', { lock: false });

        // 🔥 [關鍵修改] 新局一開始就先發好牌 (存給後台看，玩家還看不到)
        this.generateResult(); 
        console.log("🆕 新局開始，牌局結果已預先生成");

        betManager.reset(); 
        this.io.emit('update_table_bets', { tian: 0, di: 0, xuan: 0, huang: 0 });

        botManager.prepareBotsForRound();
        botManager.startBettingRoutine();
    }
}

module.exports = GameTable;