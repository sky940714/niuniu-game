import { useEffect, useRef } from 'react';
import { gameApp } from '../../game/app';

const GameCanvas = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    // 當元件掛載時，初始化 Pixi
    if (containerRef.current) {
      gameApp.init(containerRef.current);
    }

    // 當元件卸載時，清理 Pixi
    return () => {
      gameApp.destroy();
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="game-canvas-container"
      style={{ 
        position: 'fixed', // 使用 fixed 確保相對於視窗
        top: 0, 
        left: 0, 
        width: '100vw', 
        height: '100vh', 
        zIndex: 5,        // 提高層級，確保在背景圖 (通常為 0) 之上
        pointerEvents: 'none', // 預設穿透，不影響下注
        overflow: 'hidden',
        display: 'block'
      }} 
    />
  );
};

export default GameCanvas;