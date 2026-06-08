// backend/managers/GameTable.js
const { TIMING } = require('../config/gameRules');
const gameLogic = require('../logic');
const betManager = require('./BetManager');
const UserService = require('../services/userService');
const BetRecordService = require('../services/betRecordService');
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
        this.isProcessing = false;
        this.isPaused = false;

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

    pause() {
        this.isPaused = true;
        console.log('⏸️ [Admin] 遊戲已暫停');
        return { success: true };
    }

    resume() {
        this.isPaused = false;
        console.log('▶️ [Admin] 遊戲已恢復');
        return { success: true };
    }

    extendCountdown(seconds = 30) {
        this.countdown += parseInt(seconds) || 30;
        console.log(`⏰ [Admin] 倒數延長 ${seconds}s，剩餘 ${this.countdown}s`);
        return { success: true, countdown: this.countdown };
    }

    // ── 勝率控制（方法 B）────────────────────────────────────────
    _isPeakHour() {
        const hour = new Date().getHours();
        return hour >= 20 || hour < 2; // 熱門時段 20:00 ~ 02:00
    }

    _shouldBankerWin() {
        const rate = this._isPeakHour() ? 0.69 : 0.60;
        return Math.random() < rate;
    }

    _pickBankerHandType(shouldWin) {
        if (shouldWin) {
            // 強牌：混合強度讓實際勝率貼近目標 69%
            const pool = ['NIU_NIU', 'NIU_NIU', 'NIU_9', 'NIU_9', 'NIU_8', 'FULL_HOUSE'];
            return pool[Math.floor(Math.random() * pool.length)];
        } else {
            // 弱牌：讓莊家大概率輸（NO_NIU 只贏約 10% 的隨機對手）
            const pool = ['NO_NIU', 'NO_NIU', 'NO_NIU', 'NIU_1', 'NIU_2', 'NIU_3'];
            return pool[Math.floor(Math.random() * pool.length)];
        }
    }

    async tick() {
        // 暫停時仍發心跳讓客戶端看到凍結的倒數
        if (this.isPaused) {
            this.io.emit('time_tick', { phase: this.phase, countdown: this.countdown, tableBets: betManager.tableBets });
            return;
        }
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            this.countdown--;

            if (this.phase === PHASES.BETTING && this.countdown === 5) {
                this.isBetLocked = true;
                this.io.emit('bet_lock', { lock: true });
                console.log("🔒 [System] 下注鎖定 (剩5秒)");
            }

            this.io.emit('time_tick', {
                phase: this.phase,
                countdown: this.countdown,
                tableBets: betManager.tableBets
            });

            if (this.countdown <= 0) {
                await this.nextPhase();
            }
        } finally {
            this.isProcessing = false;
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

    generateResult() {
        try {
            // ── 方法 B 勝率控制 ──────────────────────────────────
            const shouldBankerWin = this._shouldBankerWin();
            const bankerType      = this._pickBankerHandType(shouldBankerWin);
            const timeTag         = this._isPeakHour() ? '🔴熱門' : '🟢離峰';

            let excludedCards = [];
            const hands = {};

            // 1. 生成莊家手牌（目標牌型）
            const bankerHand = gameLogic.generateHandOfType(bankerType, excludedCards);
            if (bankerHand) {
                hands.banker  = bankerHand;
                excludedCards = [...bankerHand];
            } else {
                // 無法湊出目標牌型時退回純隨機
                const deck   = gameLogic.createDeck();
                hands.banker  = deck.slice(0, 5);
                excludedCards = [...hands.banker];
            }

            // 2. 各閒門隨機發牌（排除已使用的牌）
            for (const zone of ['tian', 'di', 'xuan', 'huang']) {
                const hand = gameLogic.generateRandomHand(excludedCards);
                if (hand) {
                    hands[zone]   = hand;
                    excludedCards = [...excludedCards, ...hand];
                } else {
                    const deck  = gameLogic.createDeck();
                    hands[zone]  = deck.slice(0, 5);
                }
            }
            
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

            // 記錄本局模式
            const winCount = Object.values(winners).filter(w => !w).length; // 莊家贏幾門
            console.log(`🎯 [RNG] ${timeTag} | 目標:${shouldBankerWin ? '莊贏' : '放水'} | 莊家牌型:${results.banker.typeName} | 莊贏${winCount}/4門`);

        } catch (error) {
            console.error("發牌邏輯錯誤:", error);
        }
    }

    forceHand(zone, handType) {
        if (!this.roundResult) return { success: false, error: '牌局尚未生成' };
        if (this.phase !== PHASES.BETTING) return { success: false, error: '僅下注階段可指定牌型' };

        const allZones = ['banker','tian','di','xuan','huang'];
        if (!allZones.includes(zone)) return { success: false, error: '無效的區域' };

        const { hands, results, winners } = this.roundResult;

        // Cards from every other zone are excluded
        const excludedCards = allZones.filter(z => z !== zone).flatMap(z => hands[z] || []);
        const newHand = gameLogic.generateHandOfType(handType, excludedCards);

        if (!newHand) return { success: false, error: `無法從可用牌堆生成 ${handType}，請嘗試其他牌型` };

        hands[zone] = newHand;
        results[zone] = gameLogic.calculateHand(newHand);

        const toChineseCards = (hand) => {
            const sm = { s:'♠', h:'♥', d:'♦', c:'♣' };
            const rm = { 1:'A', 11:'J', 12:'Q', 13:'K' };
            return hand.map(c => `${sm[c.suit]}${rm[c.rank] || c.rank}`);
        };
        const getTypeName = (res) => {
            if (res.type === 'NIU_NIU')    return '妞妞';
            if (res.type === 'FIVE_SMALL') return '五小妞';
            if (res.type === 'BOMB')       return '鐵支妞';
            if (res.type === 'FULL_HOUSE') return '葫蘆妞';
            if (res.niu > 0) return `妞${res.niu}`;
            return '沒妞';
        };

        results[zone].chineseHand = toChineseCards(newHand);
        results[zone].typeName    = getTypeName(results[zone]);

        allZones.filter(z => z !== 'banker').forEach(z => {
            winners[z] = gameLogic.isPlayerWin(results[z], results.banker);
        });

        console.log(`👨‍💻 [Admin] 指定牌型：[${zone}] → ${results[zone].typeName}`);
        return { success: true };
    }

   swapHands(targetA, targetB) {
        if (!this.roundResult || !this.roundResult.hands[targetA] || !this.roundResult.hands[targetB]) {
            return false;
        }
        if (this.phase !== PHASES.BETTING) return false;

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
        return true;
    }

    async settleBets() {
        const sockets = await this.io.fetchSockets();
        const settledAt = new Date();
        const r = this.roundResult.results;
        const w = this.roundResult.winners;

        for (const socket of sockets) {
            if (!socket.user) continue;
            const bets = betManager.getPlayerBet(socket.user.db_id);

            let totalBet = 0;
            let totalWin = 0;
            for (const [zone, amount] of Object.entries(bets)) {
                if (amount > 0) {
                    totalBet += amount;
                    if (w[zone]) {
                        const multiplier = r[zone].multiplier;
                        const profit = Math.floor(amount * multiplier * 0.95);
                        totalWin += (amount + profit);
                    }
                }
            }

            if (totalBet === 0) continue;

            if (totalWin > 0) {
                await UserService.updateBalance(socket.user.db_id, totalWin);
                socket.user.balance += totalWin;
            }

            socket.emit('update_balance', {
                balance: socket.user.balance,
                winAmount: totalWin > 0 ? totalWin : 0
            });

            // 寫入投注紀錄
            try {
                await BetRecordService.insert({
                    user_id:      socket.user.db_id,
                    settled_at:   settledAt,
                    bet_tian:     bets.tian  || 0,
                    bet_di:       bets.di    || 0,
                    bet_xuan:     bets.xuan  || 0,
                    bet_huang:    bets.huang || 0,
                    bet_total:    totalBet,
                    win_amount:   totalWin,
                    net:          totalWin - totalBet,
                    balance_after: socket.user.balance,
                    banker_type:  r.banker.typeName,
                    banker_cards: r.banker.chineseHand?.join(' '),
                    tian_type:    r.tian.typeName,
                    tian_cards:   r.tian.chineseHand?.join(' '),
                    tian_win:     w.tian,
                    di_type:      r.di.typeName,
                    di_cards:     r.di.chineseHand?.join(' '),
                    di_win:       w.di,
                    xuan_type:    r.xuan.typeName,
                    xuan_cards:   r.xuan.chineseHand?.join(' '),
                    xuan_win:     w.xuan,
                    huang_type:   r.huang.typeName,
                    huang_cards:  r.huang.chineseHand?.join(' '),
                    huang_win:    w.huang,
                });
            } catch (err) {
                console.error('⚠️ 寫入投注紀錄失敗:', err.message);
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