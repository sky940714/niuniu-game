// backend/services/userService.js
const pool = require('../utils/db');
const bcrypt = require('bcrypt');

class UserService {
    // 🔍 透過 ID 尋找用戶
    static async findById(id) {
        const [rows] = await pool.execute(
            'SELECT id, username, balance, referral_code FROM users WHERE id = ?', 
            [id]
        );
        return rows[0];
    }

    // 🔍 透過帳號尋找 (登入用)
    static async findByUsername(username) {
        const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
        return rows[0];
    }

    // 📝 註冊新用戶
    static async register(username, password, referralCodeInput) {
        // 1. 推薦碼查代理表；未填則自動綁系統代理 NIU612
        const AgentService = require('./agentService');
        let agentId = null;
        const codeToLookup = referralCodeInput ? referralCodeInput : 'NIU612';
        const agent = await AgentService.findByReferralCode(codeToLookup);
        if (referralCodeInput && !agent) throw new Error("無效的推薦碼");
        if (agent) agentId = agent.id;

        // 2. 產生自己的推薦碼與密碼雜湊
        const myReferralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const hashedPassword = await bcrypt.hash(password, 10);

        // 3. 寫入資料庫
        try {
            await pool.execute(
                'INSERT INTO users (username, password, referral_code, agent_id, balance) VALUES (?, ?, ?, ?, ?)',
                [username, hashedPassword, myReferralCode, agentId, 0]
            );
            return true;
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') throw new Error("該手機號碼已被註冊");
            throw error;
        }
    }

    // 💰 更新餘額 (原子性操作；扣款時 DB 層確保不會低於 0)
    static async updateBalance(userId, amount) {
        const [result] = await pool.execute(
            'UPDATE users SET balance = balance + ? WHERE id = ? AND balance + ? >= 0',
            [amount, userId, amount]
        );
        // affectedRows=0 代表餘額不足（或使用者不存在）
        return result.affectedRows > 0;
    }
    
    // 🕒 更新最後登入時間
    static async updateLoginTime(userId) {
        // 如果資料庫沒有 last_login_at 欄位，這行會報錯，請確保欄位存在
        await pool.execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [userId]);
    }
}

module.exports = UserService;