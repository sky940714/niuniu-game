import React, { useState, useEffect, useRef } from 'react';
import { gameApp } from '../../game/app';
import { socket, connectSocket } from '../../socket';
import gsap from 'gsap';
import TrendBoard from './TrendBoard';
import LoginForm from './LoginForm';

// === 圖片資源 ===
import bgNiuniuRoom from '../../assets/bg/bg_niuniu_room.png'; 
import chip100Img from '../../assets/chips/chip_100.png';
import chip500Img from '../../assets/chips/chip_500.png';
import chip1000Img from '../../assets/chips/chip_1000.png';
import chip5000Img from '../../assets/chips/chip_5000.png';
import chip10000Img from '../../assets/chips/chip_10000.png';

import frameDealerImg from '../../assets/ui/frame_dealer.png';
import iconJackpotImg from '../../assets/ui/icon_jackpot.png';
import btnSettingsImg from '../../assets/buttons/btn_settings.png';
import btnTrendImg from '../../assets/buttons/btn_settings.png'; 

// 🔥 B 模式風控參數 (需與後端一致)
const MAX_ODDS = 5; 

const CHIPS = [
  { val: 100, img: chip100Img },    
  { val: 500, img: chip500Img },    
  { val: 1000, img: chip1000Img },   
  { val: 5000, img: chip5000Img },   
  { val: 10000, img: chip10000Img }, 
];

const ZONES = [
  { id: 0,   top: '30%', left: '17%', width: '14%', height: '48%',  },
  { id: 1,   top: '30%', left: '33.8%', width: '14%', height: '48%', },
  { id: 2,   top: '30%', left: '50.6%', width: '14%', height: '48%',  },
  { id: 3,   top: '30%', left: '67.25%', width: '14%', height: '48%',  },
];

const PHASES = {
    BETTING: 'BETTING',     
    DEALING: 'DEALING',     
    SQUEEZING: 'SQUEEZING', 
    RESULT: 'RESULT',       
};

// 🔥 [修改] 計算「集中於中心」的隨機落點
const getRandomPositionInZone = (zoneId) => {
    const zone = ZONES.find(z => z.id === zoneId);
    if (!zone) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    // 將百分比轉為像素
    const parse = (val, max) => (parseFloat(val) / 100) * max;
    
    // 1. 取得該區域的「起始點 (左上角)」與「寬高」
    const x = parse(zone.left, window.innerWidth);
    const y = parse(zone.top, window.innerHeight);
    const w = parse(zone.width, window.innerWidth);
    const h = parse(zone.height, window.innerHeight);

    // 2. 計算出「絕對中心點」
    const centerX = x + (w / 2);
    const centerY = y + (h / 2);

    // 3. 設定「擴散範圍 (Spread)」
    // 數值越小，籌碼堆得越像一座小山；數值越大，籌碼越分散
    // 0.4 代表籌碼只會散落在寬度的 40% 範圍內 (中間)
    const spreadFactorX = 0.4; 
    const spreadFactorY = 0.5; 

    // 4. 計算隨機偏移 (Math.random() - 0.5 會產生 -0.5 到 0.5 的值)
    const offsetX = (Math.random() - 0.5) * (w * spreadFactorX);
    const offsetY = (Math.random() - 0.5) * (h * spreadFactorY);

    return {
        x: centerX + offsetX,
        y: centerY + offsetY
    };
};

const GameUI = () => {
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

  // 🔥 計算目前已下注總額
  const totalCurrentBet = Object.values(currentBets).reduce((a,b)=>a+b, 0);

  // 🔥 B 模式核心：計算玩家還能下多少錢
  // 公式：(餘額 / 5) - 已下注總額
  const maxAffordableBet = Math.floor(balance / MAX_ODDS) - totalCurrentBet;

  useEffect(() => {
      connectSocket();
  }, []);

useEffect(() => {
    const onTimeTick = (data) => {
        setCountdown(data.countdown);
        setGameState(data.phase);
    };

    const onPhaseChange = (data) => {
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

    const onLoginResponse = (data) => {
        if (data.success) {
            localStorage.setItem('prestige_token', data.token);
            setIsLoggedIn(true);
            setUsername(data.username);
            setBalance(data.balance);
        } else {
            alert(data.message);
        }
    };

    const onAuthSuccess = (data) => {
        setIsLoggedIn(true);
        setUsername(data.username);
        setBalance(data.balance);
    };

    // 🔥 [修改] 處理來自伺服器的下注廣播
    const onUpdateTableBets = (data) => {
        if (data.username === username) return;

        if (data.zoneId !== undefined && data.amount) {
             setCurrentBets(prev => ({
                 ...prev,
                 [data.zoneId]: (prev[data.zoneId] || 0) + data.amount
             }));
        }

        // 計算精準落點
        const targetPos = getRandomPositionInZone(data.zoneId);
        
        // 隨機起點 (模擬從畫面下方不同位置丟出)
        const randomStartX = Math.random() * window.innerWidth;
        const startY = window.innerHeight + 100;

        const chipData = CHIPS.find(c => c.val === data.amount) || CHIPS[0];

        const newChip = {
            id: `bot_chip_${Date.now()}_${Math.random()}`,
            val: data.amount,
            img: chipData.img,
            startX: randomStartX, // 起點 X
            startY: startY,       // 起點 Y (螢幕下方)
            targetX: targetPos.x, // 🔥 終點 X (框框內)
            targetY: targetPos.y, // 🔥 終點 Y (框框內)
            targetZoneId: data.zoneId,
        };

        setTableChips(prev => [...prev, newChip]);
    };

    socket.on('time_tick', onTimeTick);
    socket.on('phase_change', onPhaseChange);
    socket.on('init_state', onInitState);
    socket.on('update_balance', onUpdateBalance);
    socket.on('error_msg', onErrorMsg);
    socket.on('login_response', onLoginResponse);
    socket.on('auth_success', onAuthSuccess);
    
    // 🔥 [新增] 註冊監聽
    socket.on('update_table_bets', onUpdateTableBets);

    return () => {
        socket.off('time_tick', onTimeTick);
        socket.off('phase_change', onPhaseChange);
        socket.off('init_state', onInitState);
        socket.off('update_balance', onUpdateBalance);
        socket.off('error_msg', onErrorMsg);
        socket.off('login_response', onLoginResponse);
        socket.off('auth_success', onAuthSuccess);
        
        // 🔥 [新增] 移除監聽
        socket.off('update_table_bets', onUpdateTableBets);
    };
  }, [username]); // 🔥 注意：這裡要依賴 username，這樣才能正確過濾掉自己的下注

  useEffect(() => {
    setHistory(gameApp.history);
    gameApp.onHistoryChange = (newHistory) => {
        setHistory(newHistory);
    };
  }, []);

 // 🔥 [修改] 玩家自己下注
  const handleBetZone = (zoneId) => {
    if (!isBettingPhase || !isLoggedIn) return;
    
    if (selectedChipVal > maxAffordableBet) {
        alert(`餘額不足以支付最高賠付 (需保留 ${MAX_ODDS} 倍本金)`);
        return;
    }
    
    socket.emit('place_bet', { zoneId, amount: selectedChipVal });
    
    setCurrentBets(prev => ({ ...prev, [zoneId]: prev[zoneId] + selectedChipVal }));

    // 計算精準落點
    const targetPos = getRandomPositionInZone(zoneId);

    // 取得籌碼按鈕的位置作為起點
    const chipIndex = CHIPS.findIndex(c => c.val === selectedChipVal);
    const startRect = chipsRowRef.current?.children[chipIndex]?.getBoundingClientRect();
    
    const chipData = CHIPS.find(c => c.val === selectedChipVal);

    const newChip = {
        id: Date.now(),
        val: selectedChipVal,
        img: chipData.img, 
        startX: startRect ? startRect.left : window.innerWidth / 2, // 起點 X (按鈕)
        startY: startRect ? startRect.top : window.innerHeight,     // 起點 Y (按鈕)
        targetX: targetPos.x, // 🔥 終點 X (框框內)
        targetY: targetPos.y, // 🔥 終點 Y (框框內)
        targetZoneId: zoneId,
    };
    setTableChips(prev => [...prev, newChip]);
  };

  const handleSelectChip = (val) => {
      // 只有買得起的時候才能切換
      if (val <= maxAffordableBet || !isLoggedIn) {
          setSelectedChipVal(val);
      }
  };

  const handleBackToLobby = () => {
      if(confirm("確定要登出嗎？")) {
          localStorage.removeItem('prestige_token');
          window.location.reload(); 
      }
  };

  const getTimerStyle = () => {
      if (gameState === PHASES.BETTING) return { color: '#f1c40f', text: '請下注', borderColor: '#f1c40f' };
      if (gameState === PHASES.DEALING) return { color: '#00e676', text: '發牌中', borderColor: '#00e676' };
      if (gameState === PHASES.SQUEEZING) return { color: '#00e676', text: '咪牌中', borderColor: '#00e676' };
      return { color: '#fff', text: '結算中', borderColor: '#fff' };
  };
  const timerStyle = getTimerStyle();

  if (!isLoggedIn) return <LoginForm />;

  return (
    <>
      <div style={styles.backgroundLayer} />

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
                  <img src={btnSettingsImg} style={styles.iconBtnImg} alt="登出" />
               </div>
               <div onClick={() => setShowTrend(true)} style={{...styles.iconBtnWrapper, marginTop: '5px'}}>
                  <img src={btnTrendImg} style={styles.iconBtnImg} alt="走勢" />
               </div>
            </div>
        </div>

        {/* Countdown Timer */}
        <div style={styles.timerOverlay}>
            <div style={{...styles.timerCircle, borderColor: timerStyle.borderColor}}>
                <div style={{...styles.timerNum, color: timerStyle.color}}>{countdown}</div>
                <div style={styles.timerLabel}>{timerStyle.text}</div>
            </div>
        </div>

        {/* Betting Zones */}
        <div style={styles.tableCenterArea}>
            {ZONES.map((zone) => {
                const isWinner = winZones.includes(zone.id);
                return (
                    <div 
                      key={zone.id} 
                      style={{
                          ...styles.bettingZone, 
                          position: 'absolute',
                          top: zone.top,
                          left: zone.left,
                          width: zone.width,
                          height: zone.height,
                          borderColor: isWinner ? '#ffd700' : (currentBets[zone.id] > 0 ? '#f1c40f' : 'rgba(255,255,255,0.1)'),
                          backgroundColor: isWinner 
                            ? 'rgba(255, 215, 0, 0.4)' 
                            : 'rgba(0, 0, 0, 0.05)',
                          boxShadow: isWinner ? '0 0 20px rgba(255, 215, 0, 0.6), inset 0 0 20px rgba(255, 215, 0, 0.3)' : 'none',
                          
                          // 🔥 關鍵修正：非下注期讓點擊穿透，這樣才能咪牌
                          pointerEvents: isBettingPhase ? 'auto' : 'none', 
                          
                          opacity: (!isBettingPhase) ? 0.7 : 1, 
                      }}
                      onClick={() => handleBetZone(zone.id)}
                    >
                        <div style={{...styles.zoneLabel, color: zone.color}}>{zone.label}</div>
                        <div style={styles.zoneRate}>1 : 0.95</div>
                        {currentBets[zone.id] > 0 && (
                            <div style={styles.zoneTotalBet}>${currentBets[zone.id]}</div>
                        )}                      
                        {isWinner && <div style={styles.winBadge}>WIN</div>}
                    </div>
                );
            })}
        </div>

        {/* 🔥 [新增] 全螢幕籌碼層 (放在這裡！) */}
        <div style={styles.globalChipsLayer}>
            {tableChips.map((chip, i) => (
                <ChipOnTable key={chip.id} chip={chip} index={i} />
            ))}
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
                  <div style={styles.balanceNum}>$ {totalCurrentBet.toLocaleString()}</div>
              </div>
            </div>

            <div style={{
                ...styles.chipsRow,
                opacity: (isBettingPhase && isLoggedIn) ? 1 : 0.5, 
            }} ref={chipsRowRef}>
                {CHIPS.map((chip) => {
                    // 🔥 判斷這顆籌碼是否買得起
                    const canAfford = chip.val <= maxAffordableBet;
                    
                    return (
                        <div 
                          key={chip.val}
                          style={{
                              ...styles.chipWrapper, 
                              transform: selectedChipVal === chip.val ? 'scale(1.15) translateY(-10px)' : 'scale(1)',
                              
                              // 🔥 買不起就變灰 + 半透明
                              filter: (!isBettingPhase || !canAfford) ? 'grayscale(1) opacity(0.5)' : 'none',
                              cursor: (isBettingPhase && canAfford) ? 'pointer' : 'not-allowed',
                          }}
                          onClick={() => handleSelectChip(chip.val)}
                        >
                            <img src={chip.img} alt={chip.val} style={styles.chipImg} />
                        </div>
                    );
                })}
            </div>
        </div>

        {showTrend && <TrendBoard history={history} onClose={() => setShowTrend(false)} />}
      </div>
    </>
  );
};

// 🔥 [修改] 籌碼動畫元件
const ChipOnTable = ({ chip, index }) => {
    const elRef = useRef(null);
    useEffect(() => {
        // 使用 GSAP 從 startX/Y 飛到 targetX/Y
        gsap.fromTo(elRef.current, 
            { x: chip.startX, y: chip.startY, opacity: 0, scale: 1.5 }, 
            { x: chip.targetX, y: chip.targetY, scale: 0.5, opacity: 1, duration: 0.5, ease: "power2.out" }
        );
    }, []);

    return (
        <div 
            ref={elRef}
            style={{
                position: 'absolute', 
                left: 0, 
                top: 0, 
                // 這裡控制桌上籌碼的大小，建議 40px ~ 50px
                width: '110px', 
                height: '110px', 
                // 為了讓籌碼中心對準座標，這裡要扣掉寬高的一半
                marginLeft: '-22.5px', 
                marginTop: '-22.5px',
                zIndex: index, 
                filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))'
            }}
        >
            <img src={chip.img} alt={chip.val} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
    );
};

const styles = {
  backgroundLayer: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundImage: `url(${bgNiuniuRoom})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    zIndex: 1, 
    pointerEvents: 'none', // 確保背景不擋事件
  },
  container: { 
      position: 'absolute', 
      top: 0, 
      left: 0, 
      width: '100%', 
      height: '100%', 
      zIndex: 20, 
      pointerEvents: 'none', 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'space-between', 
      padding: '10px', 
  },
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
  timerCircle: { width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: '2px solid #f1c40f', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 0 20px rgba(241, 196, 15, 0.4)' },
  timerNum: { fontSize: '2rem', color: '#f1c40f', fontWeight: 'bold', lineHeight: '1' },
  timerLabel: { fontSize: '0.7rem', color: '#fff', marginTop: '2px' },
  
  tableCenterArea: { 
      position: 'absolute', 
      top: 0, 
      left: 0, 
      width: '100%', 
      height: '100%', 
      pointerEvents: 'none', 
      zIndex: 1 
  },

  // 🔥 [新增] 全螢幕籌碼層樣式
  globalChipsLayer: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none', // 讓點擊穿透，不會擋住按鈕
      zIndex: 50, 
  },
  
  bettingZone: { 
      border: '1px solid rgba(255,255,255,0.2)', 
      borderRadius: '10px', 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'flex-start', 
      alignItems: 'center', 
      position: 'relative', 
      cursor: 'pointer', 
      paddingTop: '5px', 
  },
  zoneLabel: { fontSize: '1.8rem', fontWeight: 'bold', fontFamily: 'serif', marginBottom: '2px', textShadow:'0 2px 4px #000' },
  zoneRate: { color: '#aaa', fontSize: '0.7rem', border: '1px solid #555', padding: '2px 4px', borderRadius: '6px' },
  zoneTotalBet: { marginTop: 'auto', marginBottom: '5px', color: '#f1c40f', fontWeight: 'bold', fontSize: '0.9rem', background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: '4px' },
  
  // 原本的 chipsStackLayer 已被移除
  
  winBadge: { position: 'absolute', top: '-15px', background: 'linear-gradient(180deg, #ffd700 0%, #ff8f00 100%)', color: '#3e2723', fontSize: '0.8rem', fontWeight: 'bold', padding: '2px 10px', borderRadius: '20px', border: '2px solid #fff', zIndex: 10 },
  
  bottomBar: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', pointerEvents: 'auto', paddingBottom: '10px', gap: '10px', zIndex: 30 },
  bottomLeftGroup: { display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' },
  balanceBox: { background: 'linear-gradient(180deg, #f1c40f 0%, #f57f17 100%)', border: '2px solid #fffde7', borderRadius: '8px', padding: '5px 15px', minWidth: '120px', boxShadow: '0 4px 0 #bf360c' },
  betBox: { background: 'linear-gradient(180deg, #29b6f6 0%, #0288d1 100%)', border: '2px solid #e1f5fe', borderRadius: '8px', padding: '5px 15px', minWidth: '120px', boxShadow: '0 4px 0 #01579b' },
  balanceLabel: { fontSize: '0.7rem', color: '#3e2723', fontWeight:'bold' },
  balanceNum: { fontSize: '1.1rem', color: '#3e2723', fontWeight:'bold' },
  chipsRow: { display: 'flex', gap: '15px', alignItems: 'flex-end', paddingBottom: '5px', overflowX: 'auto', paddingLeft: '10px', pointerEvents: 'auto' },
  chipWrapper: { width: '56px', height: '56px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0, transition: 'all 0.2s', position: 'relative' },
  chipImg: { width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.6))' },
};

export default GameUI;