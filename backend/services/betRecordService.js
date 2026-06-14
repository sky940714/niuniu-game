const db = require('../utils/db');

const BetRecordService = {
    // 建表（含全欄位）＋確保新欄位存在，伺服器啟動時呼叫
    async ensureTable() {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS bet_records (
                id               INT AUTO_INCREMENT PRIMARY KEY,
                user_id          INT          NOT NULL,
                settled_at       DATETIME     NOT NULL,
                bet_tian         INT          NOT NULL DEFAULT 0,
                bet_di           INT          NOT NULL DEFAULT 0,
                bet_xuan         INT          NOT NULL DEFAULT 0,
                bet_huang        INT          NOT NULL DEFAULT 0,
                bet_total        INT          NOT NULL DEFAULT 0,
                win_amount       INT          NOT NULL DEFAULT 0,
                net              INT          NOT NULL DEFAULT 0,
                balance_after    INT          NOT NULL DEFAULT 0,
                banker_type      VARCHAR(32)  DEFAULT NULL,
                banker_cards     VARCHAR(64)  DEFAULT NULL,
                tian_type        VARCHAR(32)  DEFAULT NULL,
                tian_cards       VARCHAR(64)  DEFAULT NULL,
                tian_win         TINYINT(1)   NOT NULL DEFAULT 0,
                di_type          VARCHAR(32)  DEFAULT NULL,
                di_cards         VARCHAR(64)  DEFAULT NULL,
                di_win           TINYINT(1)   NOT NULL DEFAULT 0,
                xuan_type        VARCHAR(32)  DEFAULT NULL,
                xuan_cards       VARCHAR(64)  DEFAULT NULL,
                xuan_win         TINYINT(1)   NOT NULL DEFAULT 0,
                huang_type       VARCHAR(32)  DEFAULT NULL,
                huang_cards      VARCHAR(64)  DEFAULT NULL,
                huang_win        TINYINT(1)   NOT NULL DEFAULT 0,
                is_banker_record TINYINT(1)   NOT NULL DEFAULT 0,
                INDEX idx_user_settled (user_id, settled_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        // 舊資料庫若缺少 is_banker_record 欄位則補上（相容 MySQL 5.7）
        const [[{ cnt }]] = await db.execute(`
            SELECT COUNT(*) AS cnt
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME  = 'bet_records'
              AND COLUMN_NAME = 'is_banker_record'
        `);
        if (cnt === 0) {
            await db.execute(`
                ALTER TABLE bet_records
                ADD COLUMN is_banker_record TINYINT(1) NOT NULL DEFAULT 0
            `);
        }
    },

    async clearAll() {
        await db.execute('DELETE FROM bet_records');
    },

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
             huang_type, huang_cards, huang_win,
             is_banker_record)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            data.is_banker_record ? 1 : 0,
        ]);
    },

    async getByUserId(userId, page = 1, limit = 20) {
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
                COUNT(*)                              AS player_count,
                CAST(SUM(bet_total)    AS SIGNED)     AS total_bets,
                CAST(SUM(win_amount)   AS SIGNED)     AS total_win,
                CAST(-SUM(net)         AS SIGNED)     AS house_profit
            FROM bet_records
            WHERE COALESCE(is_banker_record, 0) = 0
            GROUP BY settled_at, banker_type, banker_cards
            ORDER BY settled_at DESC
            LIMIT ${safeLimit}
        `);
        return rows;
    },
};

module.exports = BetRecordService;
