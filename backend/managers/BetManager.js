// backend/managers/BetManager.js
const { BET_LIMITS, TIMING } = require('../config/gameRules');

class BetManager {
    constructor() {
        // 記錄整張桌子的總注碼 (天、地、玄、黃)
        this.tableBets = { tian: 0, di: 0, xuan: 0, huang: 0 };
        // 記錄每位玩家的詳細下注 (用於結算)
        // 格式: { socketId: { tian: 100, di: 0... } }
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

        // 2. 檢查封盤時間 (Time Lock)
        if (gameState.countdown <= TIMING.LOCK_BEFORE_END) {
            return { valid: false, msg: "已封盤，停止下注" };
        }

        // 3. 檢查金額格式
        if (!Number.isInteger(amount) || amount <= 0) {
            return { valid: false, msg: "金額錯誤" };
        }

        // 4. 檢查餘額
        if (player.balance < amount) {
            return { valid: false, msg: "餘額不足" };
        }

        // 初始化玩家下注紀錄 (如果第一次下)
        if (!this.playerBets[player.socketId]) {
            this.playerBets[player.socketId] = { tian: 0, di: 0, xuan: 0, huang: 0 };
        }
        const currentPlayerBets = this.playerBets[player.socketId];

        // 5. 檢查單注下限
        if (amount < BET_LIMITS.MIN_BET) {
             return { valid: false, msg: `最低下注 $${BET_LIMITS.MIN_BET}` };
        }

        // 6. 檢查單門上限 (該玩家在該門的累積)
        if (currentPlayerBets[zoneName] + amount > BET_LIMITS.MAX_BET_PER_ZONE) {
            return { valid: false, msg: `單門上限 $${BET_LIMITS.MAX_BET_PER_ZONE}` };
        }

        // 7. 檢查單局總上限 (該玩家所有門的累積)
        const currentTotal = Object.values(currentPlayerBets).reduce((a, b) => a + b, 0);
        if (currentTotal + amount > BET_LIMITS.MAX_TOTAL_BET) {
            return { valid: false, msg: `單局總上限 $${BET_LIMITS.MAX_TOTAL_BET}` };
        }

        return { valid: true, zoneName };
    }

    // ✅ 執行下注
    placeBet(socketId, zoneName, amount) {
        // 更新個人紀錄
        if (!this.playerBets[socketId]) {
            this.playerBets[socketId] = { tian: 0, di: 0, xuan: 0, huang: 0 };
        }
        this.playerBets[socketId][zoneName] += amount;

        // 更新桌面總紀錄
        this.tableBets[zoneName] += amount;

        return {
            newPlayerBet: this.playerBets[socketId][zoneName], // 玩家該門新總額
            newTableBet: this.tableBets[zoneName]              // 桌子該門新總額
        };
    }

    // 🔄 重置新局
    reset() {
        this.tableBets = { tian: 0, di: 0, xuan: 0, huang: 0 };
        this.playerBets = {};
    }

    // 取得指定玩家的下注內容 (結算用)
    getPlayerBet(socketId) {
        return this.playerBets[socketId] || { tian: 0, di: 0, xuan: 0, huang: 0 };
    }
}

module.exports = new BetManager();