// backend/managers/BetManager.js
const { BET_LIMITS, TIMING } = require('../config/gameRules');

// 最高賠付倍數需與 logic.js 中最高牌型倍率一致 (五小妞 8x)
const MAX_PAYOUT_ODDS = 8;

class BetManager {
    constructor() {
        this.tableBets = { tian: 0, di: 0, xuan: 0, huang: 0 };
        this.playerBets = {};
        this.bankerPerZoneCap = null; // 真人莊家時的每門桌面上限（null = 使用預設）
    }

    // 🛑 驗證下注是否合法
    validateBet(player, zoneId, amount, gameState) {
        const zoneKeys = ['tian', 'di', 'xuan', 'huang'];
        if (!Number.isInteger(zoneId) || zoneId < 0 || zoneId > 3) {
            return { valid: false, msg: '無效的下注門' };
        }
        const zoneName = zoneKeys[zoneId];

        // 1. 檢查遊戲階段
        if (gameState.phase !== 'BETTING') {
            return { valid: false, msg: "非下注時間" };
        }

        // 2. 檢查封盤時間
        if (gameState.countdown <= TIMING.LOCK_BEFORE_END) {
            return { valid: false, msg: "已封盤，停止下注" };
        }

        // 3. 檢查金額格式
        if (!Number.isInteger(amount) || amount <= 0) {
            return { valid: false, msg: "金額錯誤" };
        }

        // 4. 初始化玩家紀錄 (以 db_id 為 key)
        const playerId = player.db_id;
        if (!this.playerBets[playerId]) {
            this.playerBets[playerId] = { tian: 0, di: 0, xuan: 0, huang: 0 };
        }
        const currentPlayerBets = this.playerBets[playerId];
        const currentTotal = Object.values(currentPlayerBets).reduce((a, b) => a + b, 0);

        // 5. 餘額風控：若輸掉，最壞情況按莊家 8 倍賠付
        // 玩家下注後已扣本金，追加賠付最多為 totalBet × (8-1) = totalBet × 7
        const newTotal = currentTotal + amount;
        const maxExtraLoss = newTotal * (MAX_PAYOUT_ODDS - 1); // 超出本金的最大賠付
        if (maxExtraLoss > player.balance - amount) {
            return {
                valid: false,
                msg: `餘額不足以支付最高賠付 (莊家最高 ${MAX_PAYOUT_ODDS} 倍，需保留足夠餘額)`
            };
        }

        // 6. 最低下注
        if (amount < BET_LIMITS.MIN_BET) {
            return { valid: false, msg: `最低下注 $${BET_LIMITS.MIN_BET}` };
        }

        // 7. 單門上限
        if (currentPlayerBets[zoneName] + amount > BET_LIMITS.MAX_BET_PER_ZONE) {
            return { valid: false, msg: `單門上限 $${BET_LIMITS.MAX_BET_PER_ZONE}` };
        }

        // 8. 單局總上限
        if (currentTotal + amount > BET_LIMITS.MAX_TOTAL_BET) {
            return { valid: false, msg: `單局總上限 $${BET_LIMITS.MAX_TOTAL_BET}` };
        }

        // 9. 真人莊家：每門桌面總上限（所有玩家合計）
        if (this.bankerPerZoneCap !== null) {
            if (this.tableBets[zoneName] + amount > this.bankerPerZoneCap) {
                return { valid: false, msg: `莊家承擔上限：每門最多 $${this.bankerPerZoneCap.toLocaleString()}` };
            }
        }

        return { valid: true, zoneName };
    }

    // ✅ 執行下注 (以 db_id 為 key)
    placeBet(playerId, zoneName, amount) {
        if (!this.playerBets[playerId]) {
            this.playerBets[playerId] = { tian: 0, di: 0, xuan: 0, huang: 0 };
        }
        this.playerBets[playerId][zoneName] += amount;
        this.tableBets[zoneName] += amount;

        return {
            newPlayerBet: this.playerBets[playerId][zoneName],
            newTableBet: this.tableBets[zoneName]
        };
    }

    // 🔄 重置新局（保留 bankerPerZoneCap，由 GameTable 在局開始時設定）
    reset() {
        this.tableBets = { tian: 0, di: 0, xuan: 0, huang: 0 };
        this.playerBets = {};
    }

    // 取得指定玩家的下注內容 (以 db_id 查詢)
    getPlayerBet(playerId) {
        return this.playerBets[playerId] || { tian: 0, di: 0, xuan: 0, huang: 0 };
    }
}

module.exports = new BetManager();
