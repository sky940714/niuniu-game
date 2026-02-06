// backend/utils/db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

// 建立連線池
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'prestige_niu_niu',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 測試連線
pool.getConnection()
    .then(conn => {
        console.log("✅ 資料庫連線成功 (Pool Created)");
        conn.release();
    })
    .catch(err => {
        console.error("❌ 資料庫連線失敗:", err.message);
    });

module.exports = pool;