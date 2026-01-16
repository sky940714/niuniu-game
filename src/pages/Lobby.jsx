import React, { useState } from 'react';
import useGameStore from '../stores/useGameStore';

const ROOMS = [
  { id: 'junior', name: '初級廳', min: 100, color: '#4caf50' }, 
  { id: 'master', name: '中級廳', min: 500, color: '#2196f3' }, 
  { id: 'vip', name: '高級廳', min: 1000, color: '#9c27b0' },   
  { id: 'king', name: '至尊廳', min: 5000, color: '#f44336' },  
];

const Lobby = () => {
  const { user, enterRoom, logout } = useGameStore(); 
  const [showRules, setShowRules] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);

  const handleDeposit = () => {
    useGameStore.setState(state => ({
      user: { ...state.user, balance: state.user.balance + 10000 }
    }));
    alert("儲值成功！獲得 $10,000");
    setShowDeposit(false);
  };

  return (
    <div style={styles.container}>
      
      {/* 跑馬燈 (背景層) */}
      <div className="marquee-container" style={{ position: 'absolute', top: 0, zIndex: 1, border: 'none', background:'rgba(0,0,0,0.4)', height: '24px' }}>
        <div className="marquee-text" style={{ fontSize: '0.8rem', lineHeight: '24px' }}>
          🔔 公告：恭喜玩家 <span>Jason888</span> 在至尊廳贏得 <span>$52,000</span>！  🎉 尊爵妞妞正式上線！
        </div>
      </div>

      {/* --- HUD 頂部區域 --- */}
      <div style={styles.hudTop}>
        {/* 左上 */}
        <div style={styles.hudLeft}>
            <div style={styles.playerFrame}>
                <div style={styles.avatar}>{user?.name?.[0]}</div>
                <div style={styles.playerText}>
                    <div style={styles.playerName}>{user?.name || 'Guest'}</div>
                    <div style={styles.playerId}>ID: 888888</div>
                </div>
            </div>

            <div style={styles.balanceFrame}>
                <div style={{fontSize:'1rem', marginRight:'5px'}}>💰</div>
                <div style={styles.balanceText}>
                    {user?.balance?.toLocaleString()}
                </div>
                <button onClick={() => setShowDeposit(true)} style={styles.addBtn}>+</button>
            </div>
        </div>

        {/* 右上 */}
        <div style={styles.hudRight}>
            <div style={styles.iconBtnWrapper}>
                <button style={styles.roundBtn} onClick={() => alert('公告系統')}>📢</button>
                <span style={styles.btnLabel}>公告</span>
            </div>
            <div style={styles.iconBtnWrapper}>
                <button style={styles.roundBtn} onClick={() => setShowRules(true)}>⚙️</button>
                <span style={styles.btnLabel}>設定</span>
            </div>
        </div>
      </div>

      {/* --- 中間：房間輪播 (垂直置中的核心) --- */}
      <div style={styles.carouselContainer}>
        <h2 style={styles.lobbyTitle}>百人妞妞大廳</h2>
        <div style={styles.carousel}>
            {ROOMS.map((room) => (
            <div key={room.id} style={styles.cardWrapper}>
                <div style={styles.card} onClick={() => enterRoom(room.id)}>
                <div style={{...styles.cardIcon, background: room.color}}>
                    {room.name[0]}
                </div>
                <h3 style={styles.cardTitle}>{room.name}</h3>
                <p style={styles.cardMin}>底注 ${room.min}</p>
                <div style={styles.cardBorderInner}></div>
                </div>
            </div>
            ))}
        </div>
      </div>

      {/* --- HUD 底部區域 --- */}
      <div style={styles.hudBottom}>
          <button style={styles.bigGoldBtn} onClick={() => alert('戰績功能')}>
             📜 戰績
          </button>

          <div style={{display:'flex', gap:'10px'}}>
              <button style={styles.bigGoldBtn} onClick={() => alert('排行榜')}>🏆 排行榜</button>
              <button style={styles.bigGoldBtn} onClick={() => alert('活動')}>📅 活動</button>
          </div>
      </div>

      {/* --- Modals --- */}
      {showRules && (
        <div style={styles.modalOverlay} onClick={() => setShowRules(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>📜 遊戲規則</h3>
            <div style={styles.ruleTable}>
                <div style={styles.ruleRow}><span>牛牛 x3</span> <span>牛七~九 x2</span></div>
                <div style={styles.ruleRow}><span>牛一~六 x1</span> <span>無牛 x1</span></div>
            </div>
            <button onClick={logout} style={{...styles.closeBtn, background:'#d32f2f', marginTop:'10px'}}>登出帳號</button>
            <button onClick={() => setShowRules(false)} style={styles.closeBtn}>關閉</button>
          </div>
        </div>
      )}

      {showDeposit && (
        <div style={styles.modalOverlay} onClick={() => setShowDeposit(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>💰 補幣中心</h3>
            <div style={{margin:'20px 0', fontSize:'2rem', color:'#f1c40f'}}>$ 10,000</div>
            <button onClick={handleDeposit} style={styles.closeBtn}>領取</button>
          </div>
        </div>
      )}

    </div>
  );
};

// --- CSS Styles (完全響應式 vh/vw 單位) ---
const styles = {
  container: {
    width: '100vw',
    height: '100dvh', // 使用 dynamic viewport height
    background: 'var(--bg-radial-black)',
    backgroundSize: 'cover',
    position: 'relative',
    overflow: 'hidden',
  },
  
  // HUD Top Layer
  hudTop: {
    position: 'absolute',
    top: '30px',  // 避開跑馬燈
    left: 0, width: '100%',
    padding: '0 20px', // 左右邊距
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    zIndex: 10, pointerEvents: 'none',
  },
  hudLeft: { display: 'flex', gap: '10px', pointerEvents: 'auto', alignItems: 'flex-start' },
  hudRight: { display: 'flex', gap: '15px', pointerEvents: 'auto' },

  // 縮小一點的玩家框 (適配手機)
  playerFrame: {
    background: 'linear-gradient(180deg, rgba(60,40,10,0.95) 0%, rgba(30,20,5,0.95) 100%)',
    border: '1px solid #d4af37', borderRadius: '8px',
    padding: '4px 10px 4px 4px',
    display: 'flex', alignItems: 'center', gap: '8px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
    height: '40px', // 固定高度避免跑版
  },
  avatar: {
    width: '32px', height: '32px', background: '#444', borderRadius: '6px',
    border: '1px solid #aaa', display: 'flex', justifyContent: 'center', alignItems: 'center',
    color: '#fff', fontWeight:'bold', fontSize: '0.9rem',
  },
  playerText: { display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  playerName: { color: '#fff', fontWeight:'bold', fontSize:'0.9rem', lineHeight: '1' },
  playerId: { color: '#aaa', fontSize:'0.7rem', lineHeight: '1', marginTop:'2px' },

  balanceFrame: {
    background: 'rgba(0,0,0,0.7)', border: '1px solid #d4af37', borderRadius: '20px',
    padding: '0 4px 0 12px',
    display: 'flex', alignItems: 'center',
    height: '40px', // 與玩家框等高
    boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
  },
  balanceText: { color:'#f1c40f', fontWeight:'bold', fontSize:'0.9rem', minWidth:'60px' },
  addBtn: {
    width: '26px', height: '26px', borderRadius: '50%',
    background: 'linear-gradient(180deg, #f1c40f 0%, #d35400 100%)',
    border: '1px solid #fff', color: '#fff', fontWeight: 'bold', cursor: 'pointer',
    display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1rem', marginLeft: '8px',
  },

  iconBtnWrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  roundBtn: {
    width: '36px', height: '36px', borderRadius: '50%', // 縮小按鈕
    background: 'linear-gradient(135deg, #444 0%, #222 100%)',
    border: '1px solid #d4af37', color: '#fff', fontSize: '1.2rem',
    cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.6)',
  },
  btnLabel: { color: '#d4af37', fontSize: '0.6rem', marginTop: '2px', fontWeight: 'bold' },

  // --- 核心修正區：Carousel (使用 vh 單位) ---
  carouselContainer: {
    position: 'absolute',
    top: '55%', left: 0, width: '100%',
    transform: 'translateY(-50%)', // 垂直置中
    zIndex: 5,
    display: 'flex', flexDirection: 'column', justifyContent: 'center',
  },
  lobbyTitle: {
    textAlign: 'center', color: '#f1c40f',
    textShadow: '0 2px 5px rgba(0,0,0,0.8)',
    marginBottom: '5px', 
    fontSize: '1.2rem', // 標題縮小
    letterSpacing: '1px',
  },
  carousel: {
    display: 'flex',
    overflowX: 'auto',
    scrollSnapType: 'x mandatory',
    gap: '15px',
    padding: '10px 40px', // 減少 padding
    alignItems: 'center',
    scrollbarWidth: 'none',
  },
  cardWrapper: {
    // 🔥 關鍵修正：卡片高度設為螢幕高度的 50%
    height: '50vh', 
    // 🔥 關鍵修正：寬度設為高度的 70% (保持長方形比例)
    minWidth: '35vh', 
    scrollSnapAlign: 'center',
    perspective: '1000px',
  },
  card: {
    width: '100%', height: '100%',
    background: 'linear-gradient(160deg, #1a4d2e 0%, #0d2615 100%)',
    border: '2px solid #d4af37', borderRadius: '12px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    position: 'relative', cursor: 'pointer',
    boxShadow: '0 5px 15px rgba(0,0,0,0.6)',
  },
  cardBorderInner: {
    position: 'absolute', inset: '4px',
    border: '1px solid rgba(212, 175, 55, 0.3)', borderRadius: '8px', pointerEvents: 'none',
  },
  cardIcon: { 
    fontSize: '2.5rem', // 圖示縮小 
    marginBottom: '5px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' 
  },
  cardTitle: { 
    color: '#f1c40f', fontSize: '1.2rem', // 字體縮小
    marginBottom: '2px', textShadow: '0 2px 4px #000' 
  },
  cardMin: { color: '#ccc', fontSize: '0.8rem' },

  // HUD Bottom Layer
  hudBottom: {
    position: 'absolute',
    bottom: '15px', left: 0, width: '100%',
    padding: '0 20px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
    pointerEvents: 'none', zIndex: 10,
  },
  bigGoldBtn: {
    pointerEvents: 'auto',
    background: 'linear-gradient(180deg, #f1c40f 0%, #b8860b 100%)',
    border: '1px solid #fff5c0', borderRadius: '10px', 
    padding: '8px 20px', // 按鈕變扁一點
    color: '#3e2723', fontWeight: 'bold', fontSize: '0.9rem',
    boxShadow: '0 4px 0 #8b6508, 0 5px 5px rgba(0,0,0,0.5)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '5px',
  },

  // Modal 樣式 (不變)
  modalOverlay: {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)',
    zIndex: 999, display: 'flex', justifyContent: 'center', alignItems: 'center',
  },
  modalContent: {
    width: '85%', maxWidth: '350px',
    background: '#222', border: '2px solid #d4af37', borderRadius: '15px',
    padding: '20px', textAlign: 'center', boxShadow: '0 0 30px rgba(212,175,55,0.2)',
  },
  modalTitle: { color: '#f1c40f', borderBottom:'1px solid #444', paddingBottom:'10px', margin:'0 0 15px 0' },
  ruleTable: { background: '#111', padding: '10px', borderRadius: '8px' },
  ruleRow: { display:'flex', justifyContent:'space-between', color:'#ccc', marginBottom:'8px', borderBottom:'1px dashed #333', paddingBottom:'4px'},
  closeBtn: {
    width: '100%', padding: '10px', marginTop: '20px',
    background: 'linear-gradient(180deg, #f1c40f 0%, #b8860b 100%)',
    border: 'none', borderRadius: '8px', color: '#3e2723', fontWeight: 'bold', cursor:'pointer'
  }
};

export default Lobby;