// backend/services/gameRoundService.js
//
// 建表 SQL（在 MySQL 執行一次）:
// CREATE TABLE IF NOT EXISTS game_rounds (
//   id               INT AUTO_INCREMENT PRIMARY KEY,
//   settled_at       DATETIME NOT NULL,
//   target_win_rate  DECIMAL(5,4) NOT NULL,
//   banker_type      VARCHAR(30),
//   banker_cards     VARCHAR(60),
//   tian_type        VARCHAR(30), tian_win  TINYINT(1),
//   di_type          VARCHAR(30), di_win    TINYINT(1),
//   xuan_type        VARCHAR(30), xuan_win  TINYINT(1),
//   huang_type       VARCHAR(30), huang_win TINYINT(1),
//   banker_win_count TINYINT DEFAULT 0,
//   had_swap         TINYINT(1) DEFAULT 0,
//   had_force        TINYINT(1) DEFAULT 0,
//   failed_releases  TINYINT DEFAULT 0,
//   total_bet        DECIMAL(14,2) DEFAULT 0,
//   house_profit     DECIMAL(14,2) DEFAULT 0,
//   INDEX idx_settled_at (settled_at)
// );

const db = require('../utils/db');

const GameRoundService = {

    // 自動建表（後端啟動時呼叫）
    async ensureTable() {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS game_rounds (
                id               INT AUTO_INCREMENT PRIMARY KEY,
                settled_at       DATETIME NOT NULL,
                target_win_rate  DECIMAL(5,4) NOT NULL,
                banker_type      VARCHAR(30),
                banker_cards     VARCHAR(60),
                tian_type        VARCHAR(30), tian_win  TINYINT(1),
                di_type          VARCHAR(30), di_win    TINYINT(1),
                xuan_type        VARCHAR(30), xuan_win  TINYINT(1),
                huang_type       VARCHAR(30), huang_win TINYINT(1),
                banker_win_count TINYINT DEFAULT 0,
                had_swap         TINYINT(1) DEFAULT 0,
                had_force        TINYINT(1) DEFAULT 0,
                failed_releases  TINYINT DEFAULT 0,
                total_bet        DECIMAL(14,2) DEFAULT 0,
                house_profit     DECIMAL(14,2) DEFAULT 0,
                INDEX idx_settled_at (settled_at)
            )
        `);
    },

    async insert(data) {
        await db.execute(`
            INSERT INTO game_rounds
            (settled_at, target_win_rate,
             banker_type, banker_cards,
             tian_type, tian_win, di_type, di_win,
             xuan_type, xuan_win, huang_type, huang_win,
             banker_win_count, had_swap, had_force,
             failed_releases, total_bet, house_profit)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            data.settled_at || new Date(),
            data.target_win_rate,
            data.banker_type  || null,
            data.banker_cards || null,
            data.tian_type    || null, data.tian_win  ? 1 : 0,
            data.di_type      || null, data.di_win    ? 1 : 0,
            data.xuan_type    || null, data.xuan_win  ? 1 : 0,
            data.huang_type   || null, data.huang_win ? 1 : 0,
            data.banker_win_count || 0,
            data.had_swap    ? 1 : 0,
            data.had_force   ? 1 : 0,
            data.failed_releases || 0,
            data.total_bet   || 0,
            data.house_profit || 0,
        ]);
    },

    async getHistory(page = 1, limit = 30) {
        const safeLimit  = parseInt(limit, 10);
        const safeOffset = parseInt((page - 1) * limit, 10);
        const [rows] = await db.execute(
            `SELECT * FROM game_rounds ORDER BY settled_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`
        );
        const [[{ total }]] = await db.execute(
            `SELECT COUNT(*) AS total FROM game_rounds`
        );
        return { rows, total: Number(total), page, limit };
    },

    // 統計近 N 局的實際莊家勝率
    async getStats(recentCount = 100) {
        const safe = parseInt(recentCount, 10);
        const [[stats]] = await db.execute(`
            SELECT
                COUNT(*)                                        AS total_rounds,
                ROUND(AVG(banker_win_count) / 4 * 100, 1)      AS actual_win_rate_pct,
                ROUND(AVG(target_win_rate)  * 100, 1)          AS target_win_rate_pct,
                SUM(had_swap)                                   AS swap_count,
                SUM(had_force)                                  AS force_count,
                SUM(failed_releases)                            AS total_failed_releases,
                CAST(SUM(total_bet)     AS SIGNED)              AS total_bet,
                CAST(SUM(house_profit)  AS SIGNED)              AS house_profit
            FROM (
                SELECT * FROM game_rounds ORDER BY settled_at DESC LIMIT ${safe}
            ) sub
        `);
        return stats;
    },
};

module.exports = GameRoundService;
