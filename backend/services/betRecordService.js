const db = require('../utils/db');

const BetRecordService = {
    async insert(data) {
        const sql = `
            INSERT INTO bet_records
            (user_id, settled_at,
             bet_tian, bet_di, bet_xuan, bet_huang, bet_total,
             win_amount, net, balance_after,
             banker_type, banker_cards,
             tian_type,  tian_cards,  tian_win,
             di_type,    di_cards,    di_win,
             xuan_type,  xuan_cards,  xuan_win,
             huang_type, huang_cards, huang_win)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await db.execute(sql, [
            data.user_id,
            data.settled_at || new Date(),
            data.bet_tian  || 0,
            data.bet_di    || 0,
            data.bet_xuan  || 0,
            data.bet_huang || 0,
            data.bet_total || 0,
            data.win_amount || 0,
            data.net        || 0,
            data.balance_after || 0,
            data.banker_type  || null,
            data.banker_cards || null,
            data.tian_type    || null,
            data.tian_cards   || null,
            data.tian_win ? 1 : 0,
            data.di_type      || null,
            data.di_cards     || null,
            data.di_win  ? 1 : 0,
            data.xuan_type    || null,
            data.xuan_cards   || null,
            data.xuan_win ? 1 : 0,
            data.huang_type   || null,
            data.huang_cards  || null,
            data.huang_win ? 1 : 0,
        ]);
    },

    async getByUserId(userId, page = 1, limit = 20) {
        // LIMIT/OFFSET 直接嵌入 SQL（已在呼叫端限制為整數），避免 mysql2 prepared statement 型別問題
        const safeLimit  = parseInt(limit,  10);
        const safeOffset = parseInt((page - 1) * limit, 10);
        const [rows] = await db.execute(
            `SELECT * FROM bet_records WHERE user_id = ? ORDER BY settled_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`,
            [userId]
        );
        const [[{ total }]] = await db.execute(
            `SELECT COUNT(*) AS total FROM bet_records WHERE user_id = ?`,
            [userId]
        );
        return { rows, total: Number(total), page, limit };
    },
    async getRoundHistory(limit = 20) {
        const safeLimit = parseInt(limit, 10);
        const [rows] = await db.execute(`
            SELECT
                settled_at,
                banker_type, banker_cards,
                COUNT(*)                           AS player_count,
                CAST(SUM(bet_total)  AS SIGNED)    AS total_bets,
                CAST(SUM(win_amount) AS SIGNED)     AS total_win,
                CAST(SUM(bet_total) - SUM(win_amount) AS SIGNED) AS house_profit
            FROM bet_records
            GROUP BY settled_at, banker_type, banker_cards
            ORDER BY settled_at DESC
            LIMIT ${safeLimit}
        `);
        return rows;
    },
};

module.exports = BetRecordService;
