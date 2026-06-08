// backend/config/gameRules.js

module.exports = {
    // ⏱️ 時間設定 (秒)
    TIMING: {
        BETTING_DURATION: 15, // 下注階段總時間 (10s 開放 + 5s 封盤)
        LOCK_BEFORE_END: 5,   // 結束前 N 秒鎖定下注
        DEALING_DURATION: 3,  // 發牌動畫時間（動畫約 2s，留 1s 緩衝）
        SQUEEZING_DURATION: 8, // 瞇牌時間
        RESULT_DURATION: 4    // 結算展示時間
    },

    // 💰 籌碼與限額設定 (對應 5.下注邏輯.txt)
    BET_LIMITS: {
        MIN_BET: 100,             // 單注最低
        MAX_BET_PER_ZONE: 500000, // 單門上限 (天/地/玄/黃)
        MAX_TOTAL_BET: 2000000    // 單局總下注上限
    },

    // 🎲 賠率設定 (標準牛牛賠率)
    ODDS: {
        NORMAL: 0.95, // 平倍 (贏錢抽水 5%)
        // 如果未來有牛牛翻倍規則，可以在這裡擴充，例如：
        // NIU_NIU: 1.90,
        // NIU_9: 1.45
    }
};