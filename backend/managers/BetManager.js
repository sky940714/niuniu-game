// backend/managers/BetManager.js
const { BET_LIMITS, TIMING } = require('../config/gameRules');

// 最高賠付倍數需與 logic.js 中最高牌型倍率一致 (五小妞 8x)
const MAX_PAYOUT_ODDS = 8;

class BetManager {
    constructor() {
        this.tableBets = { tian: 0, di: 0, xuan: 0, huang: 0 };
        // key 改為 db_id，避免斷線重連後下注紀錄遺失
        this.playerBets = {};
    }

    // 🛑 驗證下注是否合法
    validateBet(player, zoneId, amount, gameState) {
        const zoneKeys = ['tian', 'di', 'xuan', 'huang'];
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

        // 5. B 模式餘額風控：含五小妞最高 8 倍
        const potentialLiability = (currentTotal + amount) * MAX_PAYOUT_ODDS;
        if (potentialLiability > player.balance) {
            return {
                valid: false,
                msg: `餘額不足以支付最高賠付 (需保留 ${MAX_PAYOUT_ODDS} 倍本金)`
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

    // 🔄 重置新局
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
