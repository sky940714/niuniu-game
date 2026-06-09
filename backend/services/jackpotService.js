// backend/services/jackpotService.js
const pool = require('../utils/db');

const VALID_HAND_TYPES = [
    'FIVE_SMALL','BOMB','FULL_HOUSE','STRAIGHT_FLUSH','FIVE_KNIGHTS','SILVER_NIU',
    'NIU_NIU','NIU_9','NIU_8','NIU_7','NIU_6','NIU_5','NIU_4','NIU_3','NIU_2','NIU_1','NO_NIU'
];

const JackpotService = {

    async getPool() {
        const [[row]] = await pool.query('SELECT * FROM jackpot_pool WHERE id = 1');
        return row;
    },

    // 下注時：累加貢獻金額（從下注額抽 0.5%）
    async contribute(amount) {
        if (amount <= 0) return;
        await pool.query(
            'UPDATE jackpot_pool SET current_amount = current_amount + ?, total_contributed = total_contributed + ? WHERE id = 1',
            [amount, amount]
        );
    },

    // 取得目前啟用的觸發設定
    async getConfig() {
        const [rows] = await pool.query(
            'SELECT hand_type, payout_rate FROM jackpot_config WHERE is_enabled = 1'
        );
        return rows;
    },

    // 取得全部設定（後台用）
    async getAllConfig() {
        const [rows] = await pool.query(
            'SELECT hand_type, payout_rate, is_enabled FROM jackpot_config ORDER BY id'
        );
        return rows;
    },

    // 儲存後台設定（全量覆寫）
    async setConfig(configs) {
        const valid = configs.filter(c => VALID_HAND_TYPES.includes(c.hand_type));
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            await conn.query('DELETE FROM jackpot_config');
            if (valid.length > 0) {
                const values = valid.map(c => [c.hand_type, parseFloat(c.payout_rate), c.is_enabled ? 1 : 0]);
                await conn.query(
                    'INSERT INTO jackpot_config (hand_type, payout_rate, is_enabled) VALUES ?',
                    [values]
                );
            }
            await conn.commit();
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    },

    // 彩金賠出 + 寫歷史紀錄（原子操作）
    async payout({ jackpotBefore, jackpotPaid, seedAmount, triggerHandType, triggerZones, winnersDetail }) {
        const jackpotAfter = seedAmount;
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            await conn.query(
                'UPDATE jackpot_pool SET current_amount = ?, total_paid_out = total_paid_out + ? WHERE id = 1',
                [jackpotAfter, jackpotPaid]
            );
            await conn.query(
                `INSERT INTO jackpot_history
                 (won_at, trigger_hand_type, trigger_zones, jackpot_before, jackpot_paid, jackpot_after, winners_detail)
                 VALUES (NOW(), ?, ?, ?, ?, ?, ?)`,
                [
                    triggerHandType,
                    Array.isArray(triggerZones) ? triggerZones.join(',') : triggerZones,
                    jackpotBefore,
                    jackpotPaid,
                    jackpotAfter,
                    JSON.stringify(winnersDetail)
                ]
            );
            await conn.commit();
            return jackpotAfter;
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    },

    // 取得歷史（後台用，分頁）
    async getHistory(page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        const [rows] = await pool.query(
            'SELECT * FROM jackpot_history ORDER BY won_at DESC LIMIT ? OFFSET ?',
            [limit, offset]
        );
        const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM jackpot_history');
        return { rows, total };
    },

    // 手動調整池金額（後台用）
    async adjust(delta) {
        await pool.query(
            'UPDATE jackpot_pool SET current_amount = GREATEST(0, current_amount + ?) WHERE id = 1',
            [delta]
        );
        return await this.getPool();
    }
};

module.exports = JackpotService;
