// backend/services/gameSettingsService.js
const db = require('../utils/db');

async function ensureTable() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS game_settings (
            \`key\` VARCHAR(64) PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);
}

async function get(key) {
    const [rows] = await db.execute('SELECT value FROM game_settings WHERE `key` = ?', [key]);
    return rows.length > 0 ? rows[0].value : null;
}

async function set(key, value) {
    await db.execute(
        'INSERT INTO game_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()',
        [key, value, value]
    );
}

module.exports = { ensureTable, get, set };
