import React, { useEffect } from 'react';
import Login from './pages/Login';
import Lobby from './pages/Lobby';
import GameCanvas from './components/GameCanvas';
import GameUI from './components/GameUI';
import useGameStore from './stores/useGameStore';
import { socket, connectSocket } from './socket'; // 👈 引入 connectSocket

function App() {
  const currentPage = useGameStore((state) => state.currentPage);
  const reLogin = useGameStore((state) => state.reLogin);
  const logout = useGameStore((state) => state.logout);

  // 初始連線 + 擱置分頁後重連
  useEffect(() => {
    connectSocket();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !socket.connected) {
        connectSocket();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    // --- 🆕 自動登入監聽邏輯 ---
    const handleAuthSuccess = (data) => {
      console.log("🚀 Socket 驗證成功:", data.username);
      
      // 取得最新狀態
      const currentStatus = useGameStore.getState().currentPage;

      /**
       * 🛡️ 保護邏輯：
       * 如果玩家已經在 'room' 或 'lobby'，代表已經進入遊戲流程。
       * 此時只需更新 user 資料（同步餘額等），絕對不要調用 reLogin 觸發頁面跳轉。
       */
      if (currentStatus === 'login') {
        reLogin(data); // 只有在登入頁才執行跳轉大廳
      } else {
        // 僅更新資料，不改動 currentPage
        useGameStore.setState({ 
          user: { 
            name: data.username, 
            balance: data.balance, 
            referral_code: data.referral_code 
          } 
        });
      }
    };

    // 監聽錯誤訊息
    const handleErrorMsg = (msg) => {
      console.error("⚠️ 收到伺服器錯誤:", msg);

      // 🛡️ 只有包含以下關鍵字時才強制踢下線，避免誤殺
      const fatalErrorKeywords = ['token', '登入', '驗證', '過期', '踢出', 'kicked', '使用者不存在'];
      const isFatal = fatalErrorKeywords.some(key => msg.includes(key));

      if (isFatal) {
        alert(`安全性登出: ${msg}`);
        logout(); 
      } else {
        // 一般錯誤（如：餘額不足、賠率變動）僅提示，不跳轉頁面
        alert(msg);
      }
    };

    socket.on('auth_success', handleAuthSuccess);
    socket.on('error_msg', handleErrorMsg);

    return () => {
      socket.off('auth_success', handleAuthSuccess);
      socket.off('error_msg', handleErrorMsg);
    };
  }, [reLogin, logout]);

  return (
    <>
      {/* 橫向螢幕警告 */}
      <div className="landscape-warning">
        <h1>請旋轉手機</h1>
        <p>為了最佳體驗，請使用橫向遊玩</p>
      </div>

      <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
        
        {/* 1. 登入頁 */}
        {currentPage === 'login' && <Login />}

        {/* 2. 大廳頁 */}
        {currentPage === 'lobby' && <Lobby />}

        {/* 3. 遊戲房 (React + Pixi 混合)
              position:fixed + inset:0 → 完全貼合 viewport，
              與 PixiJS canvas 同一座標系，不受 #root safe-area padding 偏移 */}
        {currentPage === 'room' && (
          <div style={{ position: 'fixed', inset: 0 }}>
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'var(--bg-radial-green)',
              zIndex: 0
            }}></div>
            <GameCanvas />
            <GameUI />
          </div>
        )}

      </div>
    </>
  );
}

export default App;