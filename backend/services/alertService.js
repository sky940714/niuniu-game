const ErrorLogService = require('./errorLogService');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

// 同一事件 60 秒內只發一次，避免洗板
const cooldowns = new Map();

async function _sendTelegram(text) {
    if (!BOT_TOKEN || !CHAT_ID) return;
    try {
        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' }),
        });
        if (!res.ok) console.error('[Alert] Telegram 回應異常:', res.status);
    } catch (e) {
        console.error('[Alert] Telegram 發送失敗:', e.message);
    }
}

// 嚴重錯誤：寫 DB + 發 Telegram
async function critical(event, detail = {}) {
    const key = event;
    const now = Date.now();
    if (cooldowns.has(key) && now - cooldowns.get(key) < 60_000) {
        // 冷卻中：只寫 DB，不重複發 Telegram
        await ErrorLogService.insert({ source: 'backend', level: 'error', message: event, context: detail });
        return;
    }
    cooldowns.set(key, now);

    const time = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    const detailLines = Object.entries(detail).map(([k, v]) => `${k}：${String(v).slice(0, 200)}`);
    const text = [`🚨 <b>[妞妞系統告警]</b>`, `事件：<b>${event}</b>`, `時間：${time}`, ...detailLines].join('\n');

    await _sendTelegram(text);
    await ErrorLogService.insert({ source: 'backend', level: 'error', message: event, context: detail });
    console.error(`🚨 [CRITICAL] ${event}`, detail);
}

// 警告：只寫 DB
async function warn(event, detail = {}) {
    await ErrorLogService.insert({ source: 'backend', level: 'warn', message: event, context: detail });
    console.warn(`⚠️ [WARN] ${event}`, detail);
}

module.exports = { critical, warn };
