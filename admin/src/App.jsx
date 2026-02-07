import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css'; 

// 指向您的後端 API
const API_URL = "http://localhost:3001/api/admin";

function App() {
  const [gameState, setGameState] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [lastMessage, setLastMessage] = useState("系統就緒"); 

  useEffect(() => {
    // 每秒輪詢一次後端狀態
    const interval = setInterval(fetchStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await axios.get(`${API_URL}/preview`);
      setGameState(res.data);
    } catch (err) {
      console.error("連線失敗", err);
    }
  };

  const handleZoneClick = async (targetZone) => {
    // 如果該區域還沒發牌，則不允許選取
    if (!gameState || !gameState.hands || !gameState.hands[targetZone]) return;

    if (!selectedZone) {
      // 選取第一個區域
      setSelectedZone(targetZone);
    } else {
      // 如果點擊同一個區域，則取消選取
      if (selectedZone === targetZone) {
        setSelectedZone(null);
        return;
      }
      
      // 執行交換邏輯
      const confirmSwap = window.confirm(`確定要交換 【${getZoneName(selectedZone)}】 與 【${getZoneName(targetZone)}】 的手牌嗎？`);
      
      if (confirmSwap) {
        try {
          await axios.post(`${API_URL}/swap-hand`, {
            pos1: selectedZone,
            pos2: targetZone
          });
          const msg = `✅ 已執行交換：${getZoneName(selectedZone)} ↔ ${getZoneName(targetZone)}`;
          setLastMessage(msg);
          setSelectedZone(null);
          // 立即更新畫面
          fetchStatus(); 
        } catch (err) {
          alert("交換失敗，請檢查後端連線");
          setSelectedZone(null);
        }
      } else {
        setSelectedZone(null);
      }
    }
  };

  // 🛠️ [翻譯機] 區域名稱中文化
  const getZoneName = (key) => {
    const map = { 
      banker: '😈 莊家', 
      tian: '🔵 天門', 
      di: '🟡 地門', 
      xuan: '🟢 玄門', 
      huang: '🔴 黃門' 
    };
    return map[key] || key;
  };

  // 🛠️ [翻譯機] 牌面顯示優化 (轉換 logic.js 的格式)
  const renderCard = (card) => {
    if (!card) return null;
    const suitMap = { 's': '♠', 'h': '♥', 'd': '♦', 'c': '♣' };
    const suitNameMap = { 's': '黑桃', 'h': '紅心', 'd': '方塊', 'c': '梅花' };
    const rankMap = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
    
    const isRed = ['h', 'd'].includes(card.suit);
    const displayRank = rankMap[card.rank] || card.rank;

    return (
      <div className={`card-simple ${isRed ? 'red' : 'black'}`}>
        <div className="card-suit">{suitMap[card.suit]}</div>
        <div className="card-rank">{displayRank}</div>
        <div className="card-label-small">{suitNameMap[card.suit]}{displayRank}</div>
      </div>
    );
  };

  // 🛠️ [翻譯機] 牌型結果顯示 (直接抓取 logic.js 回傳的 label)
  const getResultDisplay = (result) => {
    if (!result) return "計算中...";
    // 直接顯示 logic.js 產生的 "五小妞", "牛七", "鐵支妞" 等
    return (
      <div className="result-info">
        <span className="type-label">{result.label}</span>
        <span className="multiplier">({result.multiplier}倍)</span>
      </div>
    );
  };

  if (!gameState) return <div className="loading">⏳ 正在與遊戲伺服器連線...</div>;

  return (
    <div className="admin-container">
      <header className="admin-header">
        <div className="header-top">
          <h1>妞妞後台控制中心 <small>(全時段監控)</small></h1>
          <div className={`status-badge ${gameState.status}`}>{gameState.status}</div>
        </div>
        <div className="system-msg">系統訊息：{lastMessage}</div>
        {selectedZone && (
          <div className="action-hint">
            💡 請點擊另一個區域以進行 <b>手牌交換</b> (正在選取: {getZoneName(selectedZone)})
          </div>
        )}
      </header>

      <div className="game-board">
        {/* 顯示所有位置：莊、天、地、玄、黃 */}
        {['banker', 'tian', 'di', 'xuan', 'huang'].map(zone => {
          const isSelected = selectedZone === zone;
          const handData = gameState.hands ? gameState.hands[zone] : null;
          const resultData = gameState.results ? gameState.results[zone] : null;
          
          return (
            <div 
              key={zone} 
              className={`zone-box ${isSelected ? 'selected' : ''} ${zone === 'banker' ? 'banker-box' : ''}`}
              onClick={() => handleZoneClick(zone)}
            >
              <div className="zone-header">
                <h3>{getZoneName(zone)}</h3>
                {resultData && <div className="bull-tag">{getResultDisplay(resultData)}</div>}
              </div>
              
              <div className="cards-display-area">
                {handData ? (
                  <div className="cards-row">
                    {handData.map((c, i) => <React.Fragment key={i}>{renderCard(c)}</React.Fragment>)}
                  </div>
                ) : (
                  <div className="waiting-text">等待發牌...</div>
                )}
              </div>

              {/* 選取中的遮罩效果 */}
              {isSelected && <div className="selection-overlay">選取中，請點擊目標對象</div>}
            </div>
          );
        })}
      </div>
      
      <footer className="admin-footer">
        <p>提示：下注階段即可看到牌型並執行交換。最終勝負以結算數據為準。</p>
      </footer>
    </div>
  );
}

export default App;