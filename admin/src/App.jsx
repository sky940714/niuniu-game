import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css'; 

// 指向您的後端 API
const API_URL = "http://localhost:3001/api/admin";

function App() {
  const [gameState, setGameState] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [lastMessage, setLastMessage] = useState(""); 

  useEffect(() => {
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
    // 只要有牌就可以點，不用管倒數幾秒
    if (!gameState || !gameState.hands) return;

    if (!selectedZone) {
      setSelectedZone(targetZone);
    } else {
      if (selectedZone === targetZone) {
        setSelectedZone(null);
        return;
      }
      try {
        await axios.post(`${API_URL}/swap-hand`, {
          pos1: selectedZone,
          pos2: targetZone
        });
        const msg = `✅ 成功交換：${getZoneName(selectedZone)} ↔ ${getZoneName(targetZone)}`;
        setLastMessage(msg);
        alert(msg);
        setSelectedZone(null);
        fetchStatus(); 
      } catch (err) {
        alert("交換失敗");
        setSelectedZone(null);
      }
    }
  };

  // 🛠️ [翻譯機] 區域名稱中文化
  const getZoneName = (key) => {
    const map = { banker: '😈 莊家', tian: '🔵 天門', di: '🔵 地門', xuan: '🔵 玄門', huang: '🔵 黃門' };
    return map[key] || key;
  };

  // 🛠️ [翻譯機] 牌型顯示優化 (例如：♣A, ♥K)
  const getCardDisplay = (card) => {
    const suitIcons = { 's': '♠', 'h': '♥', 'd': '♦', 'c': '♣' };
    const rankMap = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
    
    // 如果後端傳來的是 user-friendly 格式 (suit, rank)
    // 假設 card = { suit: '♠', rank: 1, value: 1 }
    // 如果您的後端傳回的是代碼，請根據實際情況調整
    let suit = card.suit; // 假設後端已經給圖案，如果給的是 's'/'h' 就用 suitIcons[card.suit]
    let rank = rankMap[card.rank] || card.rank;

    return (
      <span className={`card-text ${['♥','♦'].includes(suit) ? 'red' : 'black'}`}>
        {suit}{rank}
      </span>
    );
  };

  // 🛠️ [翻譯機] 牛牛結果中文化
  const getBullResult = (result) => {
    if (!result) return "";
    // 這裡根據您的 gameLogic.js 回傳的 type 來對照
    // 假設 type 是 'NIU_7', 'NO_NIU', 'BOMB' 等
    const typeMap = {
      'NO_NIU': '無牛 🐢',
      'NIU_1': '牛一', 'NIU_2': '牛二', 'NIU_3': '牛三',
      'NIU_4': '牛四', 'NIU_5': '牛五', 'NIU_6': '牛六',
      'NIU_7': '牛七', 'NIU_8': '牛八', 'NIU_9': '牛九',
      'NIU_NIU': '🐮 牛牛',
      'FIVE_DUKES': '👑 五花牛',
      'BOMB': '💣 炸彈',
      'FIVE_SMALL': '👶 五小牛'
    };
    
    // 如果 result.type 是英文，轉成中文；如果是數字(倍率)，也可以顯示
    const name = typeMap[result.type] || result.type;
    return `${name} (x${result.multiplier})`;
  };

  if (!gameState) return <div className="loading">連線中...</div>;

  return (
    <div className="admin-container">
      <header>
        <h1>(全時段監控)</h1>
        <div className="message-log">{lastMessage}</div>
      </header>

      <div className="game-board">
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
                {/* 🔥 直接顯示牛幾 */}
                {resultData && <div className="bull-tag">{getBullResult(resultData)}</div>}
              </div>
              
              {/* 🔥 顯示中文撲克牌 */}
              <div className="cards-row-simple">
                {handData ? handData.map((c, i) => (
                  <div key={i} className="card-simple">
                    {getCardDisplay(c)}
                  </div>
                )) : <div>等待發牌...</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default App;