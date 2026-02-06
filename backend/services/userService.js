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
        // 1. 檢查是否有推薦人
        let referrerId = null;
        if (referralCodeInput) {
            const [refRows] = await pool.execute('SELECT id FROM users WHERE referral_code = ?', [referralCodeInput]);
            if (refRows.length > 0) referrerId = refRows[0].id;
            else throw new Error("無效的推薦碼");
        }

        // 2. 產生自己的推薦碼與密碼雜湊
        const myReferralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const hashedPassword = await bcrypt.hash(password, 10);

        // 3. 寫入資料庫 (這裡假設你已經補上了 referral_code 等欄位)
        // 如果你的資料庫還沒補欄位，請暫時移除 referral_code 相關的部分
        try {
            await pool.execute(
                'INSERT INTO users (username, password, referral_code, referrer_id, balance) VALUES (?, ?, ?, ?, ?)',
                [username, hashedPassword, myReferralCode, referrerId, 10000] // 註冊送 10000
            );
            return true;
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') throw new Error("該手機號碼已被註冊");
            throw error;
        }
    }

    // 💰 更新餘額 (原子性操作，最安全的寫法)
    static async updateBalance(userId, amount) {
        // amount 為正數代表加錢，負數代表扣錢
        const [result] = await pool.execute(
            'UPDATE users SET balance = balance + ? WHERE id = ?',
            [amount, userId]
        );
        return result.affectedRows > 0;
    }
    
    // 🕒 更新最後登入時間
    static async updateLoginTime(userId) {
        // 如果資料庫沒有 last_login_at 欄位，這行會報錯，請確保欄位存在
        await pool.execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [userId]);
    }
}

module.exports = UserService;