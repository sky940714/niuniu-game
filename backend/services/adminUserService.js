const db     = require('../utils/db');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

module.exports = {
    async ensureTable() {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS admin_users (
                id            INT AUTO_INCREMENT PRIMARY KEY,
                username      VARCHAR(64)  NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    },

    async seedDefaultAdmin(username, password) {
        const [rows] = await db.execute(
            'SELECT id FROM admin_users WHERE username = ?', [username]
        );
        if (rows.length > 0) return;
        const hash = await bcrypt.hash(password, SALT_ROUNDS);
        await db.execute(
            'INSERT INTO admin_users (username, password_hash) VALUES (?, ?)',
            [username, hash]
        );
        console.log(`🔐 [Admin] 預設管理員帳號已建立：${username}`);
    },

    async findByUsername(username) {
        const [rows] = await db.execute(
            'SELECT * FROM admin_users WHERE username = ?', [username]
        );
        return rows[0] || null;
    },

    async verifyPassword(plain, hash) {
        return bcrypt.compare(plain, hash);
    },

    async getAll() {
        const [rows] = await db.execute(
            'SELECT id, username, created_at FROM admin_users ORDER BY created_at ASC'
        );
        return rows;
    },

    async create(username, password) {
        const hash = await bcrypt.hash(password, SALT_ROUNDS);
        await db.execute(
            'INSERT INTO admin_users (username, password_hash) VALUES (?, ?)',
            [username, hash]
        );
    },

    async changePassword(id, newPassword) {
        const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await db.execute(
            'UPDATE admin_users SET password_hash = ? WHERE id = ?',
            [hash, id]
        );
    },

    async delete(id) {
        await db.execute('DELETE FROM admin_users WHERE id = ?', [id]);
    },
};
