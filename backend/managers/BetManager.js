// backend/managers/BetManager.js
const { BET_LIMITS, TIMING } = require('../config/gameRules');

// 🔥 設定本局遊戲的最高賠付倍數
// 如果你的牛牛規則包含五花牛(x5)，這裡必須設為 5
// 如果最高只有牛牛(x3)，這裡設為 3
// 這是 B 模式風控的核心參數
const MAX_PAYOUT_ODDS = 5; 

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

        // --- 初始化玩家下注紀錄 (如果第一次下) ---
        // 必須先初始化，才能計算該玩家目前的總下注額
        if (!this.playerBets[player.socketId]) {
            this.playerBets[player.socketId] = { tian: 0, di: 0, xuan: 0, huang: 0 };
        }
        const currentPlayerBets = this.playerBets[player.socketId];

        // --- 計算玩家目前已下注總額 ---
        const currentTotal = Object.values(currentPlayerBets).reduce((a, b) => a + b, 0);

        // 4. 🔥 [核心修改] B 模式餘額風控檢查 🔥
        // 公式：(目前已下注 + 本次下注) * 最高賠率 <= 玩家餘額
        // 避免玩家輸了最高倍率時，餘額變成負數
        const potentialLiability = (currentTotal + amount) * MAX_PAYOUT_ODDS;

        if (potentialLiability > player.balance) {
            // 計算玩家還剩多少「安全額度」可以下注 (僅供顯示或除錯)
            const maxSafeBetTotal = Math.floor(player.balance / MAX_PAYOUT_ODDS);
            const remainingQuota = maxSafeBetTotal - currentTotal;
            
            return { 
                valid: false, 
                msg: `餘額不足以支付最高賠付 (需保留 ${MAX_PAYOUT_ODDS} 倍本金)` 
            };
        }

        // 5. 檢查單注下限
        if (amount < BET_LIMITS.MIN_BET) {
             return { valid: false, msg: `最低下注 $${BET_LIMITS.MIN_BET}` };
        }

        // 6. 檢查單門上限 (該玩家在該門的累積)
        if (currentPlayerBets[zoneName] + amount > BET_LIMITS.MAX_BET_PER_ZONE) {
            return { valid: false, msg: `單門上限 $${BET_LIMITS.MAX_BET_PER_ZONE}` };
        }

        // 7. 檢查單局總上限 (該玩家所有門的累積)
        if (currentTotal + amount > BET_LIMITS.MAX_TOTAL_BET) {
            return { valid: false, msg: `單局總上限 $${BET_LIMITS.MAX_TOTAL_BET}` };
        }

        return { valid: true, zoneName };
    }

    // ✅ 執行下注
    placeBet(socketId, zoneName, amount) {
        // 更新個人紀錄 (這裡理論上 validateBet 已經初始化過了，但為了保險起見保留檢查)
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