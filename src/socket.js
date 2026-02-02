import { io } from "socket.io-client";

// 設定後端網址 (建議之後可以改為 import.meta.env.VITE_API_URL)
const URL = "http://localhost:3001";

/**
 * 建立單一 Socket 實例
 * autoConnect: false 讓我們在頁面載入後，先檢查 localStorage 再決定連線參數
 */
export const socket = io(URL, {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 10, // 增加重連嘗試次數
    reconnectionDelay: 2000,   // 重連間隔稍微拉長，避免對伺服器造成負擔
    transports: ["websocket"], // 強制使用 WebSocket，避免 Long Polling 延遲
});

/**
 * 帶有身份驗證的連線函式
 * 適用場景：網頁初始化 (App.jsx) 或 登入成功時 (Login.jsx)
 */
export const connectSocket = () => {
    const token = localStorage.getItem('prestige_token');
    
    // 設定認證資訊，這會對應到後端的 socket.handshake.auth
    socket.auth = token ? { token } : null;

    if (token) {
        console.log("🔐 正在使用 Token 建立加密連線...");
    } else {
        console.warn("⚠️ 找不到 Token，將以訪客身份連線");
    }

    // 如果已經連線，必須先完全斷開以套用新的 auth 資訊
    if (socket.connected) {
        socket.disconnect();
    }
    
    // 執行連線
    socket.connect();
};

// --- 全域事件監聽 (幫助開發偵錯) ---

socket.on("connect", () => {
    console.log(`%c ✅ Socket 連線成功! ID: ${socket.id}`, "color: #4CAF50; font-weight: bold");
});

socket.on("disconnect", (reason) => {
    console.warn(`❌ Socket 斷開連線: ${reason}`);
    // 如果是伺服器強制斷線 (例如被踢下線)，可以在這裡做額外處理
    if (reason === "io server disconnect") {
        // socket.connect(); // 如果需要可以自動重連
    }
});

socket.on("connect_error", (err) => {
    console.error("%c ❌ 連線錯誤:", "color: #FF5252", err.message);
    
    // 根據後端 io.use 傳回的錯誤訊息處理
    if (err.message === "使用者不存在" || err.message.includes("token")) {
        console.warn("身份驗證失敗，清除失效的 Token");
        localStorage.removeItem('prestige_token');
        // 可在此觸發跳轉回登入頁面
    }
});

// 監聽後端傳來的錯誤訊息 (例如：餘額不足、帳號已在它處登入)
socket.on("error_msg", (msg) => {
    alert(msg); // 簡單彈窗，建議之後改用 UI 套件
});

export default socket;