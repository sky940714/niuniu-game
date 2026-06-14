const db = require('../utils/db');

const AgentService = {

    async ensureTable() {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS agents (
                id            INT AUTO_INCREMENT PRIMARY KEY,
                name          VARCHAR(64)   NOT NULL,
                referral_code VARCHAR(32)   NOT NULL UNIQUE,
                contact       VARCHAR(100)  DEFAULT NULL,
                credit_limit  DECIMAL(15,2) NOT NULL DEFAULT 0,
                created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_code (referral_code)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        // 確保 users 表有 agent_id 欄位
        const [[{ cnt }]] = await db.execute(`
            SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME   = 'users'
              AND COLUMN_NAME  = 'agent_id'
        `);
        if (cnt === 0) {
            await db.execute(`ALTER TABLE users ADD COLUMN agent_id INT NULL`);
        }
    },

    async findByReferralCode(code) {
        const [[row]] = await db.execute(
            'SELECT * FROM agents WHERE referral_code = ?',
            [code.toUpperCase()]
        );
        return row || null;
    },

    // 代理列表 + 統計（玩家數、現有總餘額）
    async getAll() {
        const [rows] = await db.execute(`
            SELECT
                a.id, a.name, a.referral_code, a.contact,
                a.credit_limit, a.created_at,
                COUNT(u.id)              AS player_count,
                COALESCE(SUM(u.balance), 0) AS total_balance
            FROM agents a
            LEFT JOIN users u ON u.agent_id = a.id
            GROUP BY a.id
            ORDER BY a.created_at DESC
        `);
        return rows;
    },

    async create({ name, referral_code, contact, credit_limit }) {
        const [result] = await db.execute(
            'INSERT INTO agents (name, referral_code, contact, credit_limit) VALUES (?, ?, ?, ?)',
            [name, referral_code.toUpperCase(), contact || null, Number(credit_limit) || 0]
        );
        return result.insertId;
    },

    async update(id, { name, contact, credit_limit }) {
        await db.execute(
            'UPDATE agents SET name = ?, contact = ?, credit_limit = ? WHERE id = ?',
            [name, contact || null, Number(credit_limit) || 0, id]
        );
    },

    async delete(id) {
        const [[{ cnt }]] = await db.execute(
            'SELECT COUNT(*) AS cnt FROM users WHERE agent_id = ?', [id]
        );
        if (Number(cnt) > 0) throw new Error(`此代理底下尚有 ${cnt} 位玩家，無法刪除`);
        await db.execute('DELETE FROM agents WHERE id = ?', [id]);
    },

    // 代理底下的玩家清單
    async getPlayers(agentId) {
        const [rows] = await db.execute(`
            SELECT
                u.id, u.username, u.balance, u.created_at, u.last_login_at,
                COALESCE(SUM(br.bet_total),  0) AS total_bet,
                COALESCE(SUM(br.win_amount), 0) AS total_win,
                COALESCE(SUM(br.net),        0) AS total_net
            FROM users u
            LEFT JOIN bet_records br ON br.user_id = u.id
            WHERE u.agent_id = ?
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `, [agentId]);
        return rows;
    },

    // 結算報表：指定時間區間內的盈虧
    async getSettlement(agentId, from, to) {
        const [[agent]] = await db.execute('SELECT * FROM agents WHERE id = ?', [agentId]);
        if (!agent) throw new Error('代理不存在');

        const [players] = await db.execute(`
            SELECT
                u.id, u.username, u.balance,
                COALESCE(SUM(br.bet_total),  0) AS period_bet,
                COALESCE(SUM(br.win_amount), 0) AS period_win,
                COALESCE(SUM(br.net),        0) AS period_net
            FROM users u
            LEFT JOIN bet_records br
                ON br.user_id = u.id
               AND br.settled_at >= ?
               AND br.settled_at <= ?
            WHERE u.agent_id = ?
            GROUP BY u.id
            ORDER BY period_bet DESC
        `, [from, to + ' 23:59:59', agentId]);

        const totalBet = players.reduce((s, p) => s + Number(p.period_bet), 0);
        const totalNet = players.reduce((s, p) => s + Number(p.period_net), 0);

        return { agent, players, totalBet, totalNet };
    },
};

module.exports = AgentService;
