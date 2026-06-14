// backend/managers/BotManager.js
const names = ["旺財", "賭神高進", "小飛俠", "大富翁", "贏家", "Lucky7", "發發發", "阿土伯", "陳小刀", "包租公"];
const bankerManager = require('./BankerManager');

class BotManager {
    constructor() {
        this.io = null;
        this.gameTable = null;
        this.activeBots = [];
        this.botBets = {}; // 真人上莊時記錄機器人下注 { botId: { tian, di, xuan, huang } }
        this.visualTotals = { tian: 0, di: 0, xuan: 0, huang: 0 }; // 每輪視覺籌碼累計，供重連還原
    }

    // 🔥 [關鍵修改] 這裡接收 io 和 gameTable
    init(io, gameTable) {
        this.io = io; 
        this.gameTable = gameTable;
        console.log("🤖 機器人管理器已啟動，等待開局...");
    }

    // 每局開始時，決定這局要派幾個機器人
    prepareBotsForRound() {
        this.activeBots = [];
        this.botBets = {};
        this.visualTotals = { tian: 0, di: 0, xuan: 0, huang: 0 };
        const botCount = Math.floor(Math.random() * 5) + 3; // 隨機 3~7 個機器人

        for (let i = 0; i < botCount; i++) {
            this.activeBots.push({
                id: `BOT_${Date.now()}_${i}`,
                username: names[Math.floor(Math.random() * names.length)],
                balance: Math.floor(Math.random() * 50000) + 10000, // 假餘額
                avatar: Math.floor(Math.random() * 10) // 假頭像ID
            });
        }
        console.log(`🤖 本局派出 ${botCount} 個機器人進場`);
    }

    // 在下注期間，隨機時間觸發下注
    startBettingRoutine() {
        // 安全檢查：如果 io 或 gameTable 沒設定好，就不執行
        if (!this.io || !this.gameTable) {
            console.error("❌ BotManager 尚未初始化 (缺少 io 或 gameTable)");
            return;
        }

        if (this.gameTable.phase !== 'BETTING') return;

        this.activeBots.forEach(bot => {
            // 每個機器人隨機延遲 0.5 ~ 8秒 下注 (稍微縮短時間，確保在封盤前下完)
            const delay = Math.random() * 8000; 
            
            setTimeout(() => {
                // 再次檢查是否還在下注期 (防止封盤後還下)
                if (this.gameTable.phase !== 'BETTING') return;

                // 隨機選門 (0:天, 1:地, 2:玄, 3:黃)
                const zoneId = Math.floor(Math.random() * 4);
                
                // 真人上莊時用小籌碼，避免機器人注碼過大影響莊家
                const hasBanker = bankerManager.isActive();
                const perZoneCap = bankerManager.getPerZoneCap();
                const baseChips = hasBanker ? [100, 500] : [100, 500, 1000, 5000];
                const validChips = perZoneCap
                    ? baseChips.filter(c => c <= perZoneCap)
                    : baseChips;
                const chipPool = validChips.length > 0 ? validChips : [100];
                const amount = chipPool[Math.floor(Math.random() * chipPool.length)];

                // 執行機器人下注
                this.placeBotBet(bot, zoneId, amount);

            }, delay);
        });
    }

    placeBotBet(bot, zoneId, amount) {
        const zoneKeys = ['tian', 'di', 'xuan', 'huang'];
        const zoneName = zoneKeys[zoneId];
        const hasBanker = bankerManager.isActive();

        // 永遠累計視覺總量，供重連時還原籌碼顯示
        this.visualTotals[zoneName] += amount;

        // 真人上莊時：記錄機器人下注，供結算使用
        if (hasBanker) {
            if (!this.botBets[bot.id]) {
                this.botBets[bot.id] = { tian: 0, di: 0, xuan: 0, huang: 0 };
            }
            this.botBets[bot.id][zoneName] += amount;
        }

        if (this.io) {
            this.io.emit('update_table_bets', {
                zoneId,
                zoneName,
                amount,
                totalAmount: hasBanker ? amount : 0,
                username: bot.username,
                isBot: true
            });
        }
    }

    // 取得所有機器人本局下注（供 GameTable.settleBets 使用）
    getActiveBotBets() {
        return Object.entries(this.botBets).map(([botId, bets]) => ({ botId, bets }));
    }

    // 取得本輪機器人視覺下注總量（供 init_state 重連還原籌碼）
    getVisualTotals() {
        return { ...this.visualTotals };
    }
}

module.exports = new BotManager();