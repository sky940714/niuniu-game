import React from 'react';
import useGameStore from '../stores/useGameStore';

// === 1. 引入圖片資源 ===
import bannerNiuniu from '../assets/buttons/banner_game_niuniu.png';
import btnNotice from '../assets/buttons/btn_notice.png';
import btnActivity from '../assets/buttons/btn_activity.png';
import btnRank from '../assets/buttons/btn_rank.png';
import btnSettings from '../assets/buttons/btn_settings.png';

// 匯入大廳背景圖
import bgLobby from '../assets/bg/bg_lobby.png';

const Lobby = () => {
  // 從 Store 取得使用者資料與切換頁面功能
  const { user, setCurrentPage } = useGameStore();

  // 進入遊戲房
  const handleEnterGame = () => {
      setCurrentPage('room'); 
  };

  return (
    <div style={styles.container}>
      
      {/* === 1. 用戶資訊 (絕對定位：左上角) === */}
      <div style={{ ...styles.absContainer, top: '20px', left: '20px' }}>
        <div style={styles.userInfo}>
            <div style={styles.avatar}>
                {user?.name ? user.name[0].toUpperCase() : 'G'}
            </div>
            <div style={styles.userText}>
                <div style={styles.username}>{user?.name || 'Guest_888'}</div>
                <div style={styles.balance}>$ {user?.balance?.toLocaleString() || '10,000'}</div>
            </div>
            <div style={styles.addBtn}>+</div>
        </div>
      </div>

      {/* === 2. 功能按鈕組 (絕對定位：自由移動區) === */}
      
      {/* 公告按鈕 */}
      <div 
        style={{ ...styles.iconBtn, top: '18px', right: '130px' }} 
        onClick={() => alert("公告系統建置中...")}
      >
          <img src={btnNotice} alt="公告" style={styles.imgFit} />
      </div>

      {/* 活動按鈕 */}
      <div 
        style={{ ...styles.iconBtn, top: '305px', right: '150px' }} 
        onClick={() => alert("活動系統建置中...")}
      >
          <img src={btnActivity} alt="活動" style={styles.imgFit} />
      </div>

      {/* 排行榜按鈕 */}
      <div 
        style={{ ...styles.iconBtn, top: '300px', right: '30px' }} 
        onClick={() => alert("排行榜建置中...")}
      >
          <img src={btnRank} alt="排行" style={styles.imgFit} />
      </div>

      {/* 設定按鈕 */}
      <div 
        style={{ ...styles.iconBtn, top: '15px', right: '12px' }} 
        onClick={() => alert("設定選單")}
      >
          <img src={btnSettings} alt="設定" style={styles.imgFit} />
      </div>

      {/* === 3. 中間遊戲列表區 (保持 Flex 居中) === */}
      <div style={styles.gameListArea}>
        <div style={styles.scrollContainer}>
            
            {/* 核心：百人妞妞入口 */}
            <div 
                style={styles.gameCard} 
                onClick={handleEnterGame}
            >
                <img src={bannerNiuniu} alt="百人妞妞" style={styles.gameBanner} />
                <div style={styles.glowEffect}></div>
            </div>

            {/* 佔位符：敬請期待 */}
            <div style={{...styles.gameCard, ...styles.comingSoonCard}}>
                <div style={styles.comingSoonText}>
                    <span>🚀 更多遊戲<br/>Coming Soon</span>
                </div>
            </div>

        </div>
      </div>

      {/* 底部跑馬燈 */}
      <div style={styles.marqueeBar}>
          📢 恭喜玩家 <span>Jason888</span> 在百人妞妞贏得 <span>$52,000</span>！ 🎉 祝您遊戲愉快！
      </div>

    </div>
  );
};

// === CSS Styles ===
const styles = {
  container: {
    width: '100vw',
    height: '100vh',
    // --- 修改背景為圖片 ---
    backgroundImage: `url(${bgLobby})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    // ------------------
    display: 'flex',
    flexDirection: 'column',
    position: 'relative', 
    overflow: 'hidden',
  },

  absContainer: {
    position: 'absolute',
    zIndex: 20,
  },

  iconBtn: {
    position: 'absolute', 
    width: '100px',
    height: '110px',
    cursor: 'pointer',
    zIndex: 20,
    transition: 'transform 0.1s',
    filter: 'drop-shadow(0 4px 5px rgba(0,0,0,0.5))',
  },

  userInfo: {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(0,0,0,0.6)',
    padding: '5px 12px',
    borderRadius: '30px',
    border: '1px solid #ffd700',
    gap: '10px',
    boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
  },

  avatar: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #ffd700 0%, #ff8f00 100%)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: '1.2rem',
    fontWeight: 'bold',
    color: '#3e2723',
    border: '2px solid #fff',
  },

  userText: { display: 'flex', flexDirection: 'column' },
  username: { color: '#ccc', fontSize: '0.75rem', lineHeight:'1.2' },
  balance: { color: '#ffd700', fontSize: '1.1rem', fontWeight: 'bold', lineHeight:'1.2' },
  
  addBtn: {
    width: '24px', height: '24px', borderRadius: '50%',
    background: '#00c853', color:'#fff', fontWeight:'bold',
    display:'flex', justifyContent:'center', alignItems:'center',
    cursor:'pointer', fontSize:'1.2rem', marginLeft:'5px'
  },

  imgFit: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },

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
    overflowX: 'auto',
    width: '100%',
    justifyContent: 'center',
  },
  
  gameCard: {
    position: 'relative',
    width: '300px',
    height: '160px',
    borderRadius: '15px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },

  gameBanner: {
    width: '100%',
    height: '100%',
    objectFit: 'contain', 
    filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.6))',
  },

  glowEffect: {
    position: 'absolute',
    inset: -5,
    borderRadius: '20px',
    border: '2px solid rgba(255, 215, 0, 0)',
    transition: 'all 0.3s',
  },
  
  comingSoonCard: {
    opacity: 0.6,
    cursor: 'not-allowed',
    width: '140px',
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

  marqueeBar: {
    height: '30px',
    background: 'rgba(0,0,0,0.5)',
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    color: '#fff', 
    fontSize: '0.8rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    borderTop: '1px solid #333',
  }
};

export default Lobby;