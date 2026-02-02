import { io } from "socket.io-client";

// 設定後端網址 (注意：這裡是 3001，不是前端的 5173)
const URL = "http://localhost:3001";

// 建立連線
export const socket = io(URL, {
    autoConnect: true, // 自動連線
});

// 監聽連線成功 (Debug 用)
socket.on("connect", () => {
    console.log(`✅ 前端已連線到後端！ID: ${socket.id}`);
});

// 監聽連線失敗
socket.on("connect_error", (err) => {
    console.error("❌ 連線失敗，請檢查後端是否開啟:", err.message);
});