import React, { useState, useEffect, useRef } from 'react';
import { gameApp } from '../../game/app';
import { socket } from '../../socket';
import gsap from 'gsap';
import TrendBoard from './TrendBoard';
import LoginForm from './LoginForm'; // 👈 引入剛剛建立的登入視窗

// === 圖片資源 ===
import chip100Img from '../../assets/chips/chip_100.png';
import chip500Img from '../../assets/chips/chip_500.png';
import chip1000Img from '../../assets/chips/chip_1000.png';
import chip5000Img from '../../assets/chips/chip_5000.png';
import chip10000Img from '../../assets/chips/chip_10000.png';

import frameDealerImg from '../../assets/ui/frame_dealer.png';
import iconJackpotImg from '../../assets/ui/icon_jackpot.png';
import btnSettingsImg from '../../assets/buttons/btn_settings.png';
import btnTrendImg from '../../assets/buttons/btn_settings.png'; 

const CHIPS = [
  { val: 100, img: chip100Img },   
  { val: 500, img: chip500Img },   
  { val: 1000, img: chip1000Img },  
  { val: 5000, img: chip5000Img },  
  { val: 10000, img: chip10000Img }, 
];

const ZONES = [
  { id: 0, label: '天', color: '#e91e63' },
  { id: 1, label: '地', color: '#2196f3' },
  { id: 2, label: '玄', color: '#ff9800' },
  { id: 3, label: '黃', color: '#9c27b0' },
];

const PHASES = {
    BETTING: 'BETTING',     
    DEALING: 'DEALING',     
    SQUEEZING: 'SQUEEZING', 
    RESULT: 'RESULT',       
};

const GameUI = () => {
  // === 🔥 新增：登入狀態控制 ===
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');

  const [balance, setBalance] = useState(0); 
  const [currentBets, setCurrentBets] = useState({ 0:0, 1:0, 2:0, 3:0 }); 
  
  const [gameState, setGameState] = useState(PHASES.BETTING); 
  const [countdown, setCountdown] = useState(0);              
  const [winZones, setWinZones] = useState([]);               
  
  const [tableChips, setTableChips] = useState([]); 
  const chipsRowRef = useRef(null);
  const [selectedChipVal, setSelectedChipVal] = useState(100); 
  const [showTrend, setShowTrend] = useState(false);
  const [history, setHistory] = useState([]); 
  
  const isBettingPhase = gameState === PHASES.BETTING;

  // === 監聽後端訊號 ===
  useEffect(() => {
    const onTimeTick = (data) => {
        setCountdown(data.countdown);
        setGameState(data.phase);
    };

    const onPhaseChange = (data) => {
        // console.log("⚡ 收到狀態改變:", data); // Debug用
        setGameState(data.phase);
        setCountdown(data.countdown);

        if (data.phase === PHASES.DEALING && data.roundResult) {
            gameApp.startRoundWithData(data.roundResult);
        }
        if (data.phase === PHASES.BETTING) {
            setWinZones([]);
            setCurrentBets({ 0:0, 1:0, 2:0, 3:0 });
            setTableChips([]);
            gameApp.resetTable();
        }
        if (data.phase === PHASES.RESULT && data.roundResult) {
             const { winners } = data.roundResult;
             const winZoneIds = [];
             if(winners.tian) winZoneIds.push(0);
             if(winners.di)   winZoneIds.push(1);
             if(winners.xuan) winZoneIds.push(2);
             if(winners.huang) winZoneIds.push(3);
             setWinZones(winZoneIds);
             gameApp.revealAllRemaining();
        }
    };

    const onInitState = (data) => {
        setGameState(data.phase);
        setCountdown(data.countdown);
    };

    const onUpdateBalance = (data) => {
        setBalance(data.balance);
    };

    const onErrorMsg = (msg) => {
        alert(msg);
    };

    // === 🔥 新增：監聽登入成功 ===
    const onLoginSuccess = (data) => {
        console.log("✅ 登入成功:", data);
        setIsLoggedIn(true);        // 隱藏登入框
        setUsername(data.username); // 紀錄名字
        setBalance(data.balance);   // 更新錢包
    };

    socket.on('time_tick', onTimeTick);
    socket.on('phase_change', onPhaseChange);
    socket.on('init_state', onInitState);
    socket.on('update_balance', onUpdateBalance);
    socket.on('error_msg', onErrorMsg);
    socket.on('login_success', onLoginSuccess); // 👈 綁定

    return () => {
        socket.off('time_tick', onTimeTick);
        socket.off('phase_change', onPhaseChange);
        socket.off('init_state', onInitState);
        socket.off('update_balance', onUpdateBalance);
        socket.off('error_msg', onErrorMsg);
        socket.off('login_success', onLoginSuccess);
    };
  }, []);

  useEffect(() => {
    setHistory(gameApp.history);
    gameApp.onHistoryChange = (newHistory) => {
        setHistory(newHistory);
    };
  }, []);

  const handleBetZone = (zoneId) => {
    if (!isBettingPhase) return; 
    
    // 如果沒登入，理論上畫面會被擋住，但多做一層檢查
    if (!isLoggedIn) return;

    if (balance < selectedChipVal) {
        alert("餘額不足！");
        return;
    }
    socket.emit('place_bet', { zoneId, amount: selectedChipVal });

    setCurrentBets(prev => ({
        ...prev,
        [zoneId]: prev[zoneId] + selectedChipVal
    }));

    const randomOffset = () => (Math.random() - 0.5) * 40;
    const chipData = CHIPS.find(c => c.val === selectedChipVal);
    const chipIndex = CHIPS.findIndex(c => c.val === selectedChipVal);
    const startRect = chipsRowRef.current?.children[chipIndex]?.getBoundingClientRect();

    const newChip = {
        id: Date.now(),
        val: selectedChipVal,
        img: chipData.img, 
        startX: startRect ? startRect.left : window.innerWidth / 2,
        startY: startRect ? startRect.top : window.innerHeight,
        targetZoneId: zoneId,
        offsetX: randomOffset(),
        offsetY: randomOffset(),
    };

    setTableChips(prev => [...prev, newChip]);
  };

  const handleSelectChip = (val) => {
      setSelectedChipVal(val);
  };

  const handleBackToLobby = () => {
      if(confirm("確定要登出嗎？")) {
          // 這裡可以做登出邏輯 (例如重整網頁)
          window.location.reload(); 
      }
  };

  const getTimerStyle = () => {
      if (gameState === PHASES.BETTING) {
          return { color: '#f1c40f', text: '請下注', borderColor: '#f1c40f' };
      } else if (gameState === PHASES.DEALING) {
          return { color: '#00e676', text: '發牌中', borderColor: '#00e676' };
      } else if (gameState === PHASES.SQUEEZING) {
          return { color: '#00e676', text: '咪牌中', borderColor: '#00e676' };
      } else {
          return { color: '#fff', text: '結算中', borderColor: '#fff' };
      }
  };
  const timerStyle = getTimerStyle();

  if (!isLoggedIn) {
      return <LoginForm />;
  }

  return (
    <div style={styles.container}>

      {/* Top Bar */}
      <div style={styles.topBar}>
          <div style={styles.dashboardGroup}>
              <div style={styles.jackpotContainer}>
                <img src={iconJackpotImg} alt="Jackpot" style={styles.jackpotIcon} />
                <div style={styles.jackpotTextCol}>
                    <div style={styles.jackpotTitle}>User: {username || 'Guest'}</div>
                    <div style={styles.jackpotNum}>Online</div>
                </div>
              </div>
              <div style={styles.dealerWrapper}>
                 <img src={frameDealerImg} alt="Dealer Frame" style={styles.dealerBg} />
                 <div style={styles.dealerText}>莊 Dealer</div>
              </div>
          </div>
          <div style={styles.topRightBtns}>
             <div onClick={handleBackToLobby} style={styles.iconBtnWrapper}>
                <img src={btnSettingsImg} style={styles.iconBtnImg} alt="設定" />
             </div>
             <div onClick={() => setShowTrend(true)} style={{...styles.iconBtnWrapper, marginTop: '5px'}}>
                <img src={btnTrendImg} style={styles.iconBtnImg} alt="走勢" />
             </div>
          </div>
      </div>

      {/* Countdown Timer */}
      <div style={styles.timerOverlay}>
          <div style={{...styles.timerCircle, borderColor: timerStyle.borderColor}}>
              <div style={{...styles.timerNum, color: timerStyle.color}}>
                  {countdown}
              </div>
              <div style={styles.timerLabel}>
                  {timerStyle.text}
              </div>
          </div>
      </div>

      {/* Betting Zones */}
      <div style={{
          ...styles.tableCenterArea,
          opacity: 1, 
          zIndex: 1, 
      }}>
          {ZONES.map((zone) => {
              const isWinner = winZones.includes(zone.id);
              return (
                  <div 
                    key={zone.id} 
                    style={{
                        ...styles.bettingZone, 
                        borderColor: isWinner ? '#ffd700' : (currentBets[zone.id] > 0 ? '#f1c40f' : 'rgba(255,255,255,0.1)'),
                        backgroundColor: isWinner ? 'rgba(255, 215, 0, 0.2)' : (!isBettingPhase ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.15)'),
                        boxShadow: isWinner ? '0 0 20px rgba(255, 215, 0, 0.6), inset 0 0 20px rgba(255, 215, 0, 0.3)' : 'none',
                        pointerEvents: (isBettingPhase && isLoggedIn) ? 'auto' : 'none', 
                        opacity: (!isBettingPhase) ? 0.7 : 1, 
                        zIndex: 1,
                        transition: 'all 0.3s ease-in-out'
                    }}
                    onClick={(e) => handleBetZone(zone.id)}
                  >
                      <div style={{...styles.zoneLabel, color: zone.color}}>{zone.label}</div>
                      <div style={styles.zoneRate}>1 : 0.95</div>
                      {currentBets[zone.id] > 0 && (
                          <div style={styles.zoneTotalBet}>${currentBets[zone.id]}</div>
                      )}
                      <div style={styles.chipsStackLayer}>
                          {tableChips.filter(c => c.targetZoneId === zone.id).map((chip, i) => (
                              <ChipOnTable key={chip.id} chip={chip} index={i} />
                          ))}
                      </div>
                      {isWinner && <div style={styles.winBadge}>WIN</div>}
                  </div>
              );
          })}
      </div>
      
      {/* Bottom Bar */}
      <div style={styles.bottomBar}>
          <div style={styles.bottomLeftGroup}>
            <div style={styles.balanceBox}>
                <div style={styles.balanceLabel}>💰 餘額</div>
                <div style={styles.balanceNum}>$ {balance.toLocaleString()}</div>
            </div>
            <div style={styles.betBox}>
                <div style={styles.balanceLabel}>🎯 總下注</div>
                <div style={styles.balanceNum}>$ {Object.values(currentBets).reduce((a,b)=>a+b, 0).toLocaleString()}</div>
            </div>
          </div>

          <div style={{
              ...styles.chipsRow,
              opacity: (isBettingPhase && isLoggedIn) ? 1 : 0.5, 
              pointerEvents: (isBettingPhase && isLoggedIn) ? 'auto' : 'none'
          }} ref={chipsRowRef}>
              {CHIPS.map((chip, index) => (
                  <div 
                    key={chip.val}
                    style={{
                        ...styles.chipWrapper, 
                        transform: selectedChipVal === chip.val ? 'scale(1.15) translateY(-10px)' : 'scale(1)',
                        filter: (!isBettingPhase) ? 'grayscale(0.8)' : 'none',
                    }}
                    onClick={() => handleSelectChip(chip.val)}
                  >
                      <img src={chip.img} alt={chip.val} style={styles.chipImg} />
                  </div>
              ))}
          </div>
      </div>

      {showTrend && <TrendBoard history={history} onClose={() => setShowTrend(false)} />}
    </div>
  );
};

const ChipOnTable = ({ chip, index }) => {
    const elRef = useRef(null);
    useEffect(() => {
        gsap.fromTo(elRef.current, { y: 300, opacity: 0, scale: 1.5 }, { x: chip.offsetX, y: chip.offsetY, scale: 0.5, opacity: 1, duration: 0.4, ease: "back.out(1.2)" });
    }, []);
    return (
        <div 
            ref={elRef}
            style={{
                position: 'absolute', left: '50%', top: '80%', 
                width: '40px', height: '40px', marginLeft: '-20px', marginTop: '-20px',
                zIndex: index, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.5))'
            }}
        >
            <img src={chip.img} alt={chip.val} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
    );
};

const styles = {
  container: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 20, pointerEvents: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '10px', background: 'transparent' },
  topBar: { display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', pointerEvents: 'auto', paddingTop: '10px', zIndex: 30, height: '15%', position: 'relative' },
  dashboardGroup: { position: 'absolute', top: '5px', right: '50%', marginRight: '60px', display: 'flex', alignItems: 'center', gap: '30px' },
  jackpotContainer: { display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.5)', padding: '2px 10px 2px 5px', borderRadius: '20px', border: '1px solid #ffca28' },
  jackpotIcon: { width: '30px', marginRight: '5px' },
  jackpotTextCol: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' },
  jackpotTitle: { color: '#ffecb3', fontSize: '0.6rem', lineHeight: '1' },
  jackpotNum: { color: '#fff', fontSize: '0.9rem', fontWeight: 'bold', lineHeight: '1.2' },
  dealerWrapper: { position: 'relative', width: '140px', height: '50px', display: 'flex', justifyContent: 'center', alignItems: 'center' },
  dealerBg: { position: 'absolute', width: '100%', height: '100%', objectFit: 'contain' },
  dealerText: { position: 'relative', zIndex: 1, color: '#3e2723', fontWeight: 'bold', fontSize: '0.9rem', marginTop: '-2px' },
  topRightBtns: { display:'flex', flexDirection:'column', alignItems:'center', gap:'5px' },
  iconBtnWrapper: { width: '45px', height: '45px', cursor: 'pointer', transition: 'transform 0.1s' },
  iconBtnImg: { width: '100%', height: '100%', objectFit: 'contain' },
  timerOverlay: { position: 'absolute', top: '25%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 50 },
  timerCircle: { width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: '2px solid #f1c40f', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 0 20px rgba(241, 196, 15, 0.4)', animation: 'pulse 1s infinite', transition: 'all 0.3s' },
  timerNum: { fontSize: '2rem', color: '#f1c40f', fontWeight: 'bold', lineHeight: '1' },
  timerLabel: { fontSize: '0.7rem', color: '#fff', marginTop: '2px' },
  tableCenterArea: { position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%, -50%)', width: '98%', display: 'flex', justifyContent: 'center', gap: '5px', pointerEvents: 'none', zIndex: 1 },
  bettingZone: { flex: 1, height: '220px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', position: 'relative', cursor: 'pointer', paddingTop: '5px', transition: 'all 0.2s' },
  zoneLabel: { fontSize: '1.8rem', fontWeight: 'bold', fontFamily: 'serif', marginBottom: '2px', textShadow:'0 2px 4px #000' },
  zoneRate: { color: '#aaa', fontSize: '0.7rem', border: '1px solid #555', padding: '2px 4px', borderRadius: '6px' },
  zoneTotalBet: { marginTop: 'auto', marginBottom: '5px', color: '#f1c40f', fontWeight: 'bold', fontSize: '0.9rem', background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: '4px' },
  chipsStackLayer: { position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow:'hidden' },
  bottomBar: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', pointerEvents: 'auto', paddingBottom: '10px', gap: '10px', zIndex: 30 },
  bottomLeftGroup: { display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' },
  balanceBox: { background: 'linear-gradient(180deg, #f1c40f 0%, #f57f17 100%)', border: '2px solid #fffde7', borderRadius: '8px', padding: '5px 15px', minWidth: '120px', boxShadow: '0 4px 0 #bf360c, 0 6px 6px rgba(0,0,0,0.5)' },
  betBox: { background: 'linear-gradient(180deg, #29b6f6 0%, #0288d1 100%)', border: '2px solid #e1f5fe', borderRadius: '8px', padding: '5px 15px', minWidth: '120px', boxShadow: '0 4px 0 #01579b, 0 6px 6px rgba(0,0,0,0.5)' },
  balanceLabel: { fontSize: '0.7rem', color: '#3e2723', fontWeight:'bold' },
  balanceNum: { fontSize: '1.1rem', color: '#3e2723', fontWeight:'bold' },
  chipsRow: { display: 'flex', gap: '15px', alignItems: 'flex-end', paddingBottom: '5px', overflowX: 'auto', paddingLeft: '10px' },
  chipWrapper: { width: '56px', height: '56px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0, transition: 'all 0.2s', position: 'relative', cursor: 'pointer' },
  chipImg: { width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.6))' },
  winBadge: { position: 'absolute', top: '-15px', background: 'linear-gradient(180deg, #ffd700 0%, #ff8f00 100%)', color: '#3e2723', fontSize: '0.8rem', fontWeight: 'bold', padding: '2px 10px', borderRadius: '20px', border: '2px solid #fff', boxShadow: '0 0 10px #ffd700', zIndex: 10 },
};

export default GameUI;