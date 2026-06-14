const db = require('../utils/db');

async function ensureTable() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS error_logs (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            source     VARCHAR(20)  NOT NULL DEFAULT 'backend',
            level      VARCHAR(10)  NOT NULL DEFAULT 'error',
            message    TEXT         NOT NULL,
            stack      TEXT,
            user_id    INT,
            username   VARCHAR(100),
            context    TEXT,
            user_agent VARCHAR(500),
            ip         VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_created_at (created_at),
            INDEX idx_level      (level),
            INDEX idx_source     (source)
        )
    `);
}

async function insert({ source = 'backend', level = 'error', message, stack, user_id, username, context, user_agent, ip } = {}) {
    try {
        const ctxStr = context
            ? (typeof context === 'string' ? context : JSON.stringify(context))
            : null;
        await db.execute(
            `INSERT INTO error_logs (source, level, message, stack, user_id, username, context, user_agent, ip)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                source,
                level,
                String(message || '').slice(0, 2000),
                stack  ? String(stack).slice(0, 5000) : null,
                user_id  || null,
                username || null,
                ctxStr,
                user_agent ? String(user_agent).slice(0, 500) : null,
                ip || null,
            ]
        );
    } catch (e) {
        console.error('[ErrorLog] 寫入失敗:', e.message);
    }
}

async function getList({ limit = 50, offset = 0, level, source } = {}) {
    const conds = [];
    const params = [];
    if (level  && level  !== 'all') { conds.push('level = ?');  params.push(level); }
    if (source && source !== 'all') { conds.push('source = ?'); params.push(source); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const [rows] = await db.execute(
        `SELECT * FROM error_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...params, parseInt(limit), parseInt(offset)]
    );
    return rows;
}

async function getCount({ level, source } = {}) {
    const conds = [];
    const params = [];
    if (level  && level  !== 'all') { conds.push('level = ?');  params.push(level); }
    if (source && source !== 'all') { conds.push('source = ?'); params.push(source); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const [[row]] = await db.execute(
        `SELECT COUNT(*) as cnt FROM error_logs ${where}`,
        params
    );
    return row.cnt;
}

module.exports = { ensureTable, insert, getList, getCount };
