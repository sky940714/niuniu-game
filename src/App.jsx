import React from 'react';
import Login from './pages/Login';
import Lobby from './pages/Lobby';
import GameCanvas from './components/GameCanvas';
import GameUI from './components/GameUI';
import useGameStore from './stores/useGameStore';

function App() {
  const currentPage = useGameStore((state) => state.currentPage);

  return (
    <>
      <div className="landscape-warning">
        <h1>請旋轉手機</h1>
        <p>為了最佳體驗，請使用橫向遊玩</p>
      </div>

      <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
        
        {/* 1. 登入頁 */}
        {currentPage === 'login' && <Login />}

        {/* 2. 大廳頁 */}
        {currentPage === 'lobby' && <Lobby />}

        {/* 3. 遊戲房 (React + Pixi 混合) */}
        {currentPage === 'room' && (
          <div style={{position: 'relative', width: '100%', height: '100%'}}>
            {/* 遊戲背景：使用我們定義的深綠色漸層 */}
            <div style={{
              position: 'absolute', inset: 0, 
              background: 'var(--bg-radial-green)',
              zIndex: 0 
            }}></div>
            
            {/* Pixi 層 (透明底) */}
            <GameCanvas /> 
            
            {/* UI 層 */}
            <GameUI />
          </div>
        )}

      </div>
    </>
  );
}

export default App;