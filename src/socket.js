import { io } from "socket.io-client";

// 設定後端網址
const URL = "http://localhost:3001";

/**
 * 建立單一 Socket 實例
 * autoConnect: true 代表引入時即建立基礎連線
 * auth 留空，待後續手動填入 Token
 */
export const socket = io(URL, {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
});

/**
 * 帶有身份驗證的連線函式
 * 當玩家「手動登入」或「App 初始化」時呼叫
 */
export const connectSocket = () => {
    const token = localStorage.getItem('prestige_token');
    
    if (token) {
        console.log("🔐 正在使用 Token 建立加密連線...");
        socket.auth = { token };
    } else {
        console.warn("⚠️ 找不到 Token，將以訪客身份連線");
        socket.auth = null;
    }

    // 如果已經連線，強制斷開並重新連線以刷新身份
    if (socket.connected) {
        socket.disconnect();
    }
    socket.connect();
};

// --- 全域事件監聽 (Debug 用) ---

socket.on("connect", () => {
    console.log(`✅ Socket 連線成功! ID: ${socket.id}`);
});

socket.on("disconnect", (reason) => {
    console.warn(`❌ Socket 斷開連線: ${reason}`);
});

socket.on("connect_error", (err) => {
    console.error("❌ 連線錯誤 (可能是 Token 失效或伺服器未開啟):", err.message);
    
    // 如果是驗證錯誤，可以選擇清除本地 Token
    if (err.message === "xhr poll error" || err.message === "auth error") {
        // localStorage.removeItem('prestige_token');
    }
});

export default socket;