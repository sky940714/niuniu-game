require('dotenv').config();
const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');

(async () => {
    const conn = await mysql.createConnection({
        host:     process.env.DB_HOST,
        user:     process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        multipleStatements: true,
    });

    const sql = fs.readFileSync(
        path.join(__dirname, '001_create_bet_records.sql'),
        'utf8'
    );

    try {
        await conn.query(sql);
        console.log('✅ bet_records 資料表建立成功');
    } catch (e) {
        console.error('❌ 建立失敗:', e.message);
    }

    await conn.end();
})();
