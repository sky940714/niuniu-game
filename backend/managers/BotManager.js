// backend/managers/BotManager.js
const names = ["旺財", "賭神高進", "小飛俠", "大富翁", "贏家", "Lucky7", "發發發", "阿土伯", "陳小刀", "包租公"];

class BotManager {
    constructor() {
        this.io = null;       // 初始為空，等待 init 注入
        this.gameTable = null; // 初始為空，等待 init 注入
        this.activeBots = [];
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
                
                // 隨機金額 (從你的籌碼列表選)
                const chips = [100, 500, 1000, 5000];
                const amount = chips[Math.floor(Math.random() * chips.length)];

                // 執行機器人下注
                this.placeBotBet(bot, zoneId, amount);

            }, delay);
        });
    }

    placeBotBet(bot, zoneId, amount) {
        const zoneKeys = ['tian', 'di', 'xuan', 'huang'];
        const zoneName = zoneKeys[zoneId];

        // 🔥 這裡發送 Socket 事件，前端收到這個就會飛籌碼！
        // 只要前端的 socket.on('update_table_bets', ...) 有寫好，畫面就會動
        if (this.io) {
            this.io.emit('update_table_bets', {
                zoneId,       // 飛去哪一門
                zoneName,     // 門的名字
                amount,       // 決定籌碼圖片
                totalAmount: 0, // 機器人下注不計入總額，避免誤導玩家
                username: bot.username, // 顯示是誰下的
                isBot: true   // 標記
            });
            
            // 除錯用，確認真的有發送
            // console.log(`🤖 ${bot.username} 下注了 ${amount} 在 ${zoneName}`);
        }
    }
}

module.exports = new BotManager();