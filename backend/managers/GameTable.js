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

        // [修改] 倒數剩 5 秒時：只做鎖定，不重新發牌
        if (this.phase === PHASES.BETTING && this.countdown === 5) { 
            this.isBetLocked = true;
            this.io.emit('bet_lock', { lock: true }); 
            console.log("🔒 [System] 下注鎖定 (剩5秒)");
        }

        // --- 修改點 3：在下注過程中，將牌局結果發送到 'admin_update'，讓莊家後台即時可見 ---
        // 判斷如果是下注階段，則額外發送資訊給後台
        if (this.phase === PHASES.BETTING) {
            this.io.emit('admin_update', {
                roundResult: this.roundResult // 這裡包含了預先產生的牌型與點數
            });
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
                this.phase = PHASES.DEALING;
                this.countdown = TIMING.DEALING_DURATION;
                break;

            case PHASES.DEALING:
                this.phase = PHASES.SQUEEZING;
                this.countdown = TIMING.SQUEEZING_DURATION;
                break;

            case PHASES.SQUEEZING:
                this.phase = PHASES.RESULT;
                this.countdown = TIMING.RESULT_DURATION;
                await this.settleBets(); 
                break;

            case PHASES.RESULT:
                this.resetGame();
                break;
        }

        this.io.emit('phase_change', {
            phase: this.phase,
            countdown: this.countdown,
            roundResult: this.roundResult 
        });
    }

    // --- 修改點 1 & 2：在產生結果時，處理中文花色與牌型名稱 ---
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

            // [修正] 配合 logic.js 的 s,h,d,c 與 rank 1-13
            const toChineseCards = (hand) => {
                const suitMap = { 's': '♠', 'h': '♥', 'd': '♦', 'c': '♣' }; 
                const rankMap = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
                return hand.map(card => {
                    const rankStr = rankMap[card.rank] || card.rank;
                    return `${suitMap[card.suit] || card.suit}${rankStr}`;
                });
            };

            // [修正] 配合 logic.js 的 type 與 niu 屬性
            const getTypeName = (res) => {
                if (res.type === 'NIU_NIU') return "妞妞";
                if (res.type === 'FIVE_SMALL') return "五小妞";
                if (res.type === 'BOMB') return "鐵支妞";
                if (res.type === 'FULL_HOUSE') return "葫蘆妞";
                if (res.niu > 0) return `妞${res.niu}`;
                return "沒妞";
            };

            // 擴充結果資訊供後台直接顯示
            Object.keys(results).forEach(key => {
                results[key].chineseHand = toChineseCards(hands[key]);
                results[key].typeName = getTypeName(results[key]);
            });

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

   swapHands(targetA, targetB) {
        // [新增] 安全檢查，防止崩潰
        if (!this.roundResult || !this.roundResult.hands[targetA] || !this.roundResult.hands[targetB]) {
            return false;
        }

        const hands = this.roundResult.hands;
        const tempHand = hands[targetA];
        hands[targetA] = hands[targetB];
        hands[targetB] = tempHand;

        const results = this.roundResult.results;
        results[targetA] = gameLogic.calculateHand(hands[targetA]);
        results[targetB] = gameLogic.calculateHand(hands[targetB]);

        // [修正] 同步更新中文 (邏輯同 generateResult)
        const toChineseCards = (hand) => {
            const suitMap = { 's': '♠', 'h': '♥', 'd': '♦', 'c': '♣' };
            const rankMap = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
            return hand.map(c => `${suitMap[c.suit] || c.suit}${rankMap[c.rank] || c.rank}`);
        };

        const getTypeName = (res) => {
            if (res.type === 'NIU_NIU') return "妞妞";
            if (res.type === 'FIVE_SMALL') return "五小妞";
            if (res.type === 'BOMB') return "鐵支妞";
            if (res.type === 'FULL_HOUSE') return "葫蘆妞";
            if (res.niu > 0) return `妞${res.niu}`;
            return "沒妞";
        };
        
        [targetA, targetB].forEach(key => {
            results[key].chineseHand = toChineseCards(hands[key]);
            results[key].typeName = getTypeName(results[key]);
        });

        const winners = this.roundResult.winners;
        ['tian', 'di', 'xuan', 'huang'].forEach(zone => {
            winners[zone] = gameLogic.isPlayerWin(results[zone], results.banker);
        });

        console.log(`👨‍💻 [Admin] 上帝換牌執行：[${targetA}] <==> [${targetB}]`);
        
        // [新增] 立即推播
        this.io.emit('admin_update', { roundResult: this.roundResult });

        return true;
    }

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

    resetGame() {
        this.phase = PHASES.BETTING;
        this.countdown = TIMING.BETTING_DURATION;
        this.isBetLocked = false; 
        this.io.emit('bet_lock', { lock: false });
        this.generateResult(); 
        console.log("🆕 新局開始，牌局結果已預先生成");
        betManager.reset(); 
        this.io.emit('update_table_bets', { tian: 0, di: 0, xuan: 0, huang: 0 });
        botManager.prepareBotsForRound();
        botManager.startBettingRoutine();
    }
}

module.exports = GameTable;