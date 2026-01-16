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
      style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%', 
        zIndex: 1 // Pixi 在底層
      }} 
    />
  );
};

export default GameCanvas;