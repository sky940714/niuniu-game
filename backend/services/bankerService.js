// backend/services/bankerService.js
const db = require('../utils/db');

const BankerService = {
    // ── 排隊 ──────────────────────────────────────────────────────
    async addToQueue(userId, username, frozenAmount) {
        const [result] = await db.execute(
            'INSERT INTO banker_queue (user_id, username, frozen_amount, status) VALUES (?,?,?,?)',
            [userId, username, frozenAmount, 'waiting']
        );
        return result.insertId;
    },

    async setQueueStatus(id, status) {
        await db.execute('UPDATE banker_queue SET status=? WHERE id=?', [status, id]);
    },

    // ── 場次 ──────────────────────────────────────────────────────
    async createSession(userId, username, initialFrozen) {
        const [result] = await db.execute(
            `INSERT INTO banker_sessions
             (user_id, username, initial_frozen, started_at)
             VALUES (?,?,?,NOW())`,
            [userId, username, initialFrozen]
        );
        return result.insertId;
    },

    async endSession(id, finalFrozen, netPnl, roundsPlayed, forceQuit) {
        await db.execute(
            `UPDATE banker_sessions
             SET final_frozen=?, net_pnl=?, rounds_played=?, force_quit=?, ended_at=NOW()
             WHERE id=?`,
            [finalFrozen, netPnl, roundsPlayed, forceQuit ? 1 : 0, id]
        );
    },

    async getHistory(page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        const [rows] = await db.execute(
            `SELECT * FROM banker_sessions ORDER BY started_at DESC LIMIT ? OFFSET ?`,
            [limit, offset]
        );
        const [[{ total }]] = await db.execute('SELECT COUNT(*) as total FROM banker_sessions');
        return { rows, total: Number(total) };
    },
};

module.exports = BankerService;
