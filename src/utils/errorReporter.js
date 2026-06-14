const API_BASE = import.meta.env.VITE_API_URL || '';
let sessionErrCount = 0;
const MAX_PER_SESSION = 30;

function send(level, message, stack, context = {}) {
    if (sessionErrCount >= MAX_PER_SESSION) return;
    sessionErrCount++;
    // 不等回應，也不讓回報失敗影響主程式
    fetch(`${API_BASE}/api/log/client-error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            level,
            message:   String(message || '').slice(0, 1000),
            stack:     stack ? String(stack).slice(0, 3000) : undefined,
            context,
            userAgent: navigator.userAgent.slice(0, 300),
        }),
    }).catch(() => {});
}

export function initErrorReporter() {
    // 全域未攔截 JS 錯誤
    window.onerror = (msg, src, line, col, err) => {
        send('error',
            `${msg} (${src}:${line}:${col})`,
            err?.stack,
            { type: 'onerror' }
        );
        return false; // 不阻止預設行為
    };

    // 未攔截的 Promise rejection
    window.addEventListener('unhandledrejection', e => {
        const reason = e.reason;
        send('error',
            `Unhandled Promise: ${reason?.message || String(reason)}`,
            reason?.stack,
            { type: 'unhandledrejection' }
        );
    });
}

// 在 try/catch 中手動呼叫
export function reportError(message, context = {}) {
    send('error', message, new Error().stack, context);
}

export function reportWarn(message, context = {}) {
    send('warn', message, null, context);
}
