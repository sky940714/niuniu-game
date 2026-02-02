import React from 'react';
import useGameStore from '../stores/useGameStore';

// === 1. 引入圖片資源 (確保路徑正確) ===
import bannerNiuniu from '../assets/buttons/banner_game_niuniu.png';
import btnNotice from '../assets/buttons/btn_notice.png';
import btnActivity from '../assets/buttons/btn_activity.png';
import btnRank from '../assets/buttons/btn_rank.png';
import btnSettings from '../assets/buttons/btn_settings.png';

// 如果您有大廳背景圖，可以引入；這裡預設使用高級漸層
// import bgLobby from '../../assets/bg/bg_lobby.png'; 

const Lobby = () => {
  // 從 Store 取得使用者資料與切換頁面功能
  const { user, setCurrentPage } = useGameStore();

  // 進入遊戲房
  const handleEnterGame = () => {
      // 這裡可以加入音效
      setCurrentPage('room'); 
  };

  return (
    <div style={styles.container}>
      
      {/* === 頂部導航欄 === */}
      <div style={styles.topBar}>
        
        {/* 左側：用戶資訊 */}
        <div style={styles.userInfo}>
            <div style={styles.avatar}>
                {/* 顯示用戶名字的第一個字，或預設頭像 */}
                {user?.name ? user.name[0].toUpperCase() : 'G'}
            </div>
            <div style={styles.userText}>
                <div style={styles.username}>{user?.name || 'Guest_888'}</div>
                {/* toLocaleString() 讓數字有千分位逗號 */}
                <div style={styles.balance}>$ {user?.balance?.toLocaleString() || '10,000'}</div>
            </div>
            <div style={styles.addBtn}>+</div>
        </div>

        {/* 右側：功能按鈕組 (使用圖片) */}
        <div style={styles.topBtnGroup}>
            <div style={styles.iconBtn} onClick={() => alert("公告系統建置中...")}>
                <img src={btnNotice} alt="公告" style={styles.imgFit} />
            </div>
            <div style={styles.iconBtn} onClick={() => alert("活動系統建置中...")}>
                <img src={btnActivity} alt="活動" style={styles.imgFit} />
            </div>
            <div style={styles.iconBtn} onClick={() => alert("排行榜建置中...")}>
                <img src={btnRank} alt="排行" style={styles.imgFit} />
            </div>
            <div style={styles.iconBtn} onClick={() => alert("設定選單")}>
                <img src={btnSettings} alt="設定" style={styles.imgFit} />
            </div>
        </div>
      </div>

      {/* === 中間遊戲列表區 === */}
      <div style={styles.gameListArea}>
        <div style={styles.scrollContainer}>
            
            {/* 核心：百人妞妞入口 */}
            <div 
                style={styles.gameCard} 
                onClick={handleEnterGame}
            >
                <img src={bannerNiuniu} alt="百人妞妞" style={styles.gameBanner} />
                {/* 光暈特效框 */}
                <div style={styles.glowEffect}></div>
            </div>

            {/* 佔位符：敬請期待 (讓畫面不那麼空) */}
            <div style={{...styles.gameCard, ...styles.comingSoonCard}}>
                <div style={styles.comingSoonText}>
                    <span>🚀 更多遊戲<br/>Coming Soon</span>
                </div>
            </div>

        </div>
      </div>

      {/* 底部跑馬燈 (選配) */}
      <div style={styles.marqueeBar}>
          📢 恭喜玩家 <span>Jason888</span> 在百人妞妞贏得 <span>$52,000</span>！ 🎉 祝您遊戲愉快！
      </div>

    </div>
  );
};

// === CSS Styles (RWD) ===
const styles = {
  container: {
    width: '100vw',
    height: '100vh',
    // 深綠色高級背景漸層 (模擬賭桌氛圍)
    background: 'radial-gradient(circle at 50% -20%, #1b5e20 0%, #000000 100%)',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
  },
  topBar: {
    height: '80px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 20px', // 手機版左右留白
    background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)',
    zIndex: 10,
  },
  
  // 用戶資訊區塊
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(0,0,0,0.6)', // 半透明黑底
    padding: '5px 12px',
    borderRadius: '30px',
    border: '1px solid #ffd700', // 金框
    gap: '10px',
    boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
  },
  avatar: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #ffd700 0%, #ff8f00 100%)', // 金色頭像底
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: '1.2rem',
    fontWeight: 'bold',
    color: '#3e2723',
    border: '2px solid #fff',
  },
  userText: {
    display: 'flex',
    flexDirection: 'column',
  },
  username: { color: '#ccc', fontSize: '0.75rem', lineHeight:'1.2' },
  balance: { color: '#ffd700', fontSize: '1.1rem', fontWeight: 'bold', lineHeight:'1.2' },
  addBtn: {
    width: '24px', height: '24px', borderRadius: '50%',
    background: '#00c853', color:'#fff', fontWeight:'bold',
    display:'flex', justifyContent:'center', alignItems:'center',
    cursor:'pointer', fontSize:'1.2rem', marginLeft:'5px'
  },
  
  // 右上按鈕群
  topBtnGroup: {
    display: 'flex',
    gap: '12px',
  },
  iconBtn: {
    width: '42px', // 按鈕大小
    height: '42px',
    cursor: 'pointer',
    transition: 'transform 0.1s',
    filter: 'drop-shadow(0 4px 5px rgba(0,0,0,0.5))', // 陰影讓按鈕立體
  },
  imgFit: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },

  // 中間捲動區
  gameListArea: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center', 
    paddingBottom: '20px',
  },
  scrollContainer: {
    display: 'flex',
    gap: '30px',
    alignItems: 'center',
    padding: '20px',
    overflowX: 'auto', // 支援橫向滑動
    width: '100%',
    justifyContent: 'center',
  },
  
  // 遊戲卡片 (Banner)
  gameCard: {
    position: 'relative',
    width: '300px', // Banner 寬度
    height: '160px', // Banner 高度
    borderRadius: '15px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  gameBanner: {
    width: '100%',
    height: '100%',
    objectFit: 'contain', 
    filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.6))', // 讓 Banner 浮起來
  },
  glowEffect: {
    position: 'absolute',
    inset: -5,
    borderRadius: '20px',
    border: '2px solid rgba(255, 215, 0, 0)', // 預設透明
    transition: 'all 0.3s',
  },
  
  // Coming Soon 卡片樣式
  comingSoonCard: {
    opacity: 0.6,
    cursor: 'not-allowed',
    width: '140px', // 比較小一點
    height: '140px',
  },
  comingSoonText: {
    width: '100%',
    height: '100%',
    background: 'rgba(0,0,0,0.3)',
    borderRadius: '15px',
    border: '2px dashed #666',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    color: '#aaa',
    textAlign: 'center',
    fontSize: '0.9rem',
    fontWeight: 'bold',
  },

  // 底部跑馬燈
  marqueeBar: {
    height: '30px',
    background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: '0.8rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    borderTop: '1px solid #333',
  }
};

export default Lobby;