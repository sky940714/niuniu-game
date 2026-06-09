// backend/managers/GameTable.js
const { TIMING, JACKPOT } = require('../config/gameRules');
const gameLogic = require('../logic');
const betManager = require('./BetManager');
const bankerManager = require('./BankerManager');
const UserService = require('../services/userService');
const BetRecordService = require('../services/betRecordService');
const JackpotService = require('../services/jackpotService');
const botManager = require('./BotManager');

const ZONE_LABEL = { tian: '天', di: '地', xuan: '玄', huang: '黃' };
const TYPE_NAME  = {
    FIVE_SMALL: '五小妞', BOMB: '鐵支妞', FULL_HOUSE: '葫蘆妞',
    STRAIGHT_FLUSH: '同花順', FIVE_KNIGHTS: '五龍妞', SILVER_NIU: '銀花妞',
    NIU_NIU: '妞妞', NIU_9: '妞9', NIU_8: '妞8', NIU_7: '妞7',
    NIU_6: '妞6', NIU_5: '妞5', NIU_4: '妞4', NIU_3: '妞3',
    NIU_2: '妞2', NIU_1: '妞1', NO_NIU: '沒妞',
};

// ── 共用工具函數（避免在 generateResult / forceHand / swapHands 中重複定義）
const SUIT_CH = { s:'♠', h:'♥', d:'♦', c:'♣' };
const RANK_CH = { 1:'A', 11:'J', 12:'Q', 13:'K' };
function toChineseCards(hand) {
    return hand.map(c => `${SUIT_CH[c.suit]}${RANK_CH[c.rank] || c.rank}`);
}
function getTypeName(res) {
    if (res.type === 'NIU_NIU')        return '妞妞';
    if (res.type === 'FIVE_SMALL')     return '五小妞';
    if (res.type === 'BOMB')           return '鐵支妞';
    if (res.type === 'FULL_HOUSE')     return '葫蘆妞';
    if (res.type === 'STRAIGHT_FLUSH') return '同花順';
    if (res.type === 'FIVE_KNIGHTS')   return '五龍妞';
    if (res.type === 'SILVER_NIU')     return '銀花妞';
    if (res.niu > 0) return `妞${res.niu}`;
    return '沒妞';
}

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
        this.bannedHandTypes = new Set(); // 禁止出現的牌型
        this.jackpotAmount = JACKPOT.SEED_AMOUNT; // 彩金池（記憶體，啟動時從 DB 同步）

        // 啟動心跳循環
        this.startGameLoop();
        this._loadJackpot();

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

    // ── 彩金池初始化 ──────────────────────────────────────────────
    async _loadJackpot() {
        try {
            const p = await JackpotService.getPool();
            this.jackpotAmount = parseFloat(p.current_amount);
            console.log(`💰 [Jackpot] 彩金池載入：$${this.jackpotAmount.toLocaleString()}`);
        } catch (e) {
            console.error('彩金池載入失敗，使用種子金額:', e.message);
        }
    }

    // ── 時段判斷 ─────────────────────────────────────────────────
    _isPeakHour() {
        const hour = new Date().getHours();
        return hour >= 20 || hour < 2; // 熱門時段 20:00 ~ 02:00
    }

    // ── 禁牌設定 ─────────────────────────────────────────────────
    setBannedTypes(types) {
        this.bannedHandTypes = new Set(Array.isArray(types) ? types : []);
        console.log(`⚙️ [Admin] 禁止牌型更新: [${[...this.bannedHandTypes].join(', ') || '無'}]`);
        return { success: true };
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
                phase:        this.phase,
                countdown:    this.countdown,
                tableBets:    betManager.tableBets,
                jackpotAmount: Math.floor(this.jackpotAmount),
                bankerStatus: bankerManager.getStatus(),
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
                await this.resetGame();
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
            const isPeak  = this._isPeakHour();
            const winRate = isPeak ? 0.69 : 0.60;
            const timeTag = isPeak ? '🔴熱門' : '🟢離峰';

            const excludedCards = [];
            const hands   = {};
            const results = {};

            // ── 1. 莊家隨機發牌（若牌型被禁止則重試，最多 10 次）──
            let bankerHand = null;
            for (let i = 0; i < 10; i++) {
                const h = gameLogic.generateRandomHand(excludedCards);
                if (!h) break;
                const res = gameLogic.calculateHand(h);
                if (!this.bannedHandTypes.has(gameLogic.getHandTypeKey(res))) {
                    bankerHand = h;
                    break;
                }
            }
            if (!bankerHand) bankerHand = gameLogic.createDeck().slice(0, 5);

            hands.banker = bankerHand;
            excludedCards.push(...bankerHand);
            results.banker = gameLogic.calculateHand(bankerHand);

            // ── 2. 每門獨立精確控制勝率 ──────────────────────────
            let failedReleases = 0;

            for (const zone of ['tian', 'di', 'xuan', 'huang']) {
                const bankerShouldWin = Math.random() < winRate;
                let hand = null;

                if (bankerShouldWin) {
                    // 生成比莊弱的牌 → 莊贏
                    hand = gameLogic.generateWeakerHand(results.banker, excludedCards, this.bannedHandTypes);
                } else {
                    // 生成比莊強的牌 → 玩家贏（放水）
                    hand = gameLogic.generateStrongerHand(results.banker, excludedCards, this.bannedHandTypes);
                    if (!hand) failedReleases++;
                }

                // fallback：隨機發牌（結果不保證符合目標，記入 log）
                if (!hand) hand = gameLogic.generateRandomHand(excludedCards);
                if (!hand) {
                    // 最後保底：從剩餘牌堆取前 5 張，確保不與已發牌重複
                    const remaining = gameLogic.createDeck().filter(
                        c => !excludedCards.some(e => e.suit === c.suit && e.rank === c.rank)
                    );
                    hand = remaining.length >= 5 ? remaining.slice(0, 5) : gameLogic.createDeck().slice(0, 5);
                    console.warn(`⚠️ [RNG] ${zone} 門最終 fallback，使用剩餘牌堆`);
                }

                hands[zone] = hand;
                excludedCards.push(...hand);
                results[zone] = gameLogic.calculateHand(hand);
            }

            // ── 3. 轉換顯示格式 ──────────────────────────────────
            Object.keys(results).forEach(key => {
                results[key].chineseHand = toChineseCards(hands[key]);
                results[key].typeName    = getTypeName(results[key]);
            });

            const winners = {
                tian:  gameLogic.isPlayerWin(results.tian,  results.banker),
                di:    gameLogic.isPlayerWin(results.di,    results.banker),
                xuan:  gameLogic.isPlayerWin(results.xuan,  results.banker),
                huang: gameLogic.isPlayerWin(results.huang, results.banker),
            };

            this.roundResult = { hands, results, winners };

            const bankerWinCount = Object.values(winners).filter(w => !w).length;
            const failNote = failedReleases > 0 ? ` ⚠️ ${failedReleases}門因禁牌無法放水` : '';
            console.log(`🎯 [RNG] ${timeTag} | 目標勝率:${(winRate*100).toFixed(0)}% | 莊家牌型:${results.banker.typeName} | 莊贏${bankerWinCount}/4門${failNote}`);

        } catch (error) {
            console.error('發牌邏輯錯誤:', error);
        }
    }

    forceHand(zone, handType) {
        if (!this.roundResult) return { success: false, error: '牌局尚未生成' };
        if (this.phase !== PHASES.BETTING) return { success: false, error: '僅下注階段可指定牌型' };

        const allZones = ['banker','tian','di','xuan','huang'];
        if (!allZones.includes(zone)) return { success: false, error: '無效的區域' };

        // 禁止牌型不可手動指定
        const typeKey = gameLogic.getHandTypeKey({ type: handType, niu: parseInt(handType.replace('NIU_','')) || 0 });
        if (this.bannedHandTypes.has(handType) || this.bannedHandTypes.has(typeKey)) {
            return { success: false, error: `牌型 ${handType} 已在禁止清單中，無法指定` };
        }

        const { hands, results, winners } = this.roundResult;

        // Cards from every other zone are excluded
        const excludedCards = allZones.filter(z => z !== zone).flatMap(z => hands[z] || []);
        const newHand = gameLogic.generateHandOfType(handType, excludedCards);

        if (!newHand) return { success: false, error: `無法從可用牌堆生成 ${handType}，請嘗試其他牌型` };

        hands[zone] = newHand;
        results[zone] = gameLogic.calculateHand(newHand);

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

        // 真人莊家結算累計
        let bankerPays     = 0; // 莊家實際支出（獲利部分，不含玩家自身本金）
        let bankerReceives = 0; // 莊家實際收入（玩家輸掉的本金 + 追賠）
        const hasBanker    = bankerManager.isActive();

        for (const socket of sockets) {
            if (!socket.user) continue;
            const bets = betManager.getPlayerBet(socket.user.db_id);

            let totalBet        = 0;
            let totalWin        = 0;
            let totalWinProfit  = 0; // 莊家實際支付的獲利（不含玩家本金）
            let totalExtraLoss  = 0;
            let totalLostBets   = 0;

            for (const [zone, amount] of Object.entries(bets)) {
                if (amount <= 0) continue;
                totalBet += amount;

                if (w[zone]) {
                    // ✅ 玩家贏：退回本金 + 閒家牌型倍率獲利（扣 5% 手續費）
                    const profit = Math.floor(amount * r[zone].multiplier * 0.95);
                    totalWin       += (amount + profit);
                    totalWinProfit += profit; // 莊家只需支付獲利，本金是玩家自己的
                } else {
                    // ❌ 玩家輸：本金下注時已扣，此處按莊家倍率追加賠付
                    const extraLoss = Math.floor(amount * (r.banker.multiplier - 1));
                    totalExtraLoss += extraLoss;
                    totalLostBets  += amount;
                }
            }

            if (totalBet === 0) continue;

            // 累計莊家金流（正確計算：贏家只扣獲利，輸家收全額本金+追賠）
            if (hasBanker) {
                bankerPays     += totalWinProfit;
                bankerReceives += totalLostBets + totalExtraLoss;
            }

            // 先退還勝利部分
            if (totalWin > 0) {
                await UserService.updateBalance(socket.user.db_id, totalWin);
                socket.user.balance += totalWin;
            }

            // 再扣除輸掉的追加賠付（本金已在 place_bet 時扣過）
            if (totalExtraLoss > 0) {
                await UserService.updateBalance(socket.user.db_id, -totalExtraLoss);
                socket.user.balance -= totalExtraLoss;
            }

            const netChange = totalWin - totalBet - totalExtraLoss;
            socket.emit('update_balance', {
                balance:   socket.user.balance,
                winAmount: totalWin > 0 ? totalWin : 0,
                netChange,
                extraLoss: totalExtraLoss,
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
                    net:          totalWin - totalBet - totalExtraLoss,
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

        // ── 真人莊家結算 ──
        if (hasBanker) {
            await bankerManager.settleRound(bankerPays, bankerReceives);
            betManager.bankerPerZoneCap = bankerManager.getPerZoneCap();
        }

        // ── 彩金池觸發結算 ──
        await this._settleJackpot(sockets);
    }

    async _settleJackpot(sockets) {
        try {
            const config = await JackpotService.getConfig();
            if (config.length === 0 || this.jackpotAmount <= 0) return;

            const r = this.roundResult.results;

            // 找出所有觸發的門與對應賠率
            let triggerZones  = [];
            let maxPayoutRate = 0;
            let triggerHandType = null;

            for (const zone of ['tian', 'di', 'xuan', 'huang']) {
                const typeKey = gameLogic.getHandTypeKey(r[zone]);
                const cfg = config.find(c => c.hand_type === typeKey);
                // 該門有玩家押注且牌型符合設定
                if (cfg && betManager.tableBets[zone] > 0) {
                    triggerZones.push(zone);
                    if (parseFloat(cfg.payout_rate) > maxPayoutRate) {
                        maxPayoutRate   = parseFloat(cfg.payout_rate);
                        triggerHandType = typeKey;
                    }
                }
            }

            if (triggerZones.length === 0) return;

            const jackpotBefore = Math.floor(this.jackpotAmount);
            const jackpotPaid   = Math.floor(jackpotBefore * maxPayoutRate);
            if (jackpotPaid <= 0) return;

            // 收集所有押注觸發門的玩家
            const bettors = []; // { socket, zone, betAmount }
            let totalTriggerBet = 0;

            for (const socket of sockets) {
                if (!socket.user) continue;
                const bets = betManager.getPlayerBet(socket.user.db_id);
                for (const zone of triggerZones) {
                    if (bets[zone] > 0) {
                        bettors.push({ socket, zone, betAmount: bets[zone] });
                        totalTriggerBet += bets[zone];
                    }
                }
            }

            if (totalTriggerBet <= 0) return;

            // 按比例分配彩金（最後一位贏家拿走舍入剩餘，確保總額不消失）
            const winnersDetail = [];
            let distributed = 0;
            for (let idx = 0; idx < bettors.length; idx++) {
                const { socket, zone, betAmount } = bettors[idx];
                const isLast = idx === bettors.length - 1;
                const share = isLast
                    ? jackpotPaid - distributed  // 剩餘全給最後一人
                    : Math.floor(jackpotPaid * (betAmount / totalTriggerBet));
                if (share <= 0) continue;
                distributed += share;
                await UserService.updateBalance(socket.user.db_id, share);
                socket.user.balance += share;
                socket.emit('update_balance', { balance: socket.user.balance });
                winnersDetail.push({
                    user_id:    socket.user.db_id,
                    username:   socket.user.username,
                    zone,
                    betAmount,
                    jackpotWon: share,
                });
            }

            // 更新 DB + 重置池
            const newAmount = await JackpotService.payout({
                jackpotBefore,
                jackpotPaid,
                seedAmount:     JACKPOT.SEED_AMOUNT,
                triggerHandType,
                triggerZones,
                winnersDetail,
            });
            this.jackpotAmount = newAmount;

            // 廣播彩金得獎事件
            this.io.emit('jackpot_won', {
                jackpotPaid,
                handType:     triggerHandType,
                handTypeName: TYPE_NAME[triggerHandType] || triggerHandType,
                zones:        triggerZones.map(z => ZONE_LABEL[z]),
                winners:      winnersDetail.map(w => ({
                    username:   w.username,
                    zone:       ZONE_LABEL[w.zone],
                    betAmount:  w.betAmount,
                    jackpotWon: w.jackpotWon,
                })),
            });

            console.log(`💰 [Jackpot] 觸發！牌型:${triggerHandType} | 門:${triggerZones.join('+')} | 賠出:$${jackpotPaid.toLocaleString()} | 得獎:${winnersDetail.length}人`);
        } catch (e) {
            console.error('⚠️ 彩金結算失敗:', e.message);
        }
    }

    async resetGame() {
        this.phase = PHASES.BETTING;
        this.countdown = TIMING.BETTING_DURATION;
        this.isBetLocked = false;
        this.io.emit('bet_lock', { lock: false });
        this.generateResult();
        console.log("🆕 新局開始，牌局結果已預先生成");
        betManager.reset();
        // 真人莊家：新局開始才接班或重算每門上限
        await bankerManager.onNewRound();
        betManager.bankerPerZoneCap = bankerManager.getPerZoneCap();
        // 不在此處廣播 update_table_bets；前端在收到 phase_change(BETTING) 時已 setTableChips([]) 清空
        botManager.prepareBotsForRound();
        botManager.startBettingRoutine();
    }
}

module.exports = GameTable;