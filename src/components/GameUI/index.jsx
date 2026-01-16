import React, { useState, useEffect, useRef } from 'react';
import { gameApp } from '../../game/app';
import gsap from 'gsap';
import TrendBoard from './TrendBoard';

const CHIPS = [
  { val: 100, color: '#d32f2f', border: '#ef9a9a' },   
  { val: 500, color: '#0288d1', border: '#81d4fa' },   
  { val: 1000, color: '#1565c0', border: '#90caf9' },  
  { val: 5000, color: '#7b1fa2', border: '#ce93d8' },  
  { val: 10000, color: '#fbc02d', border: '#fff59d' }, 
];

const ZONES = [
  { id: 0, label: '天', color: '#e91e63' },
  { id: 1, label: '地', color: '#2196f3' },
  { id: 2, label: '玄', color: '#ff9800' },
  { id: 3, label: '黃', color: '#9c27b0' },
];

const GameUI = () => {
  const [balance, setBalance] = useState(10000);
  const [currentBets, setCurrentBets] = useState({ 0:0, 1:0, 2:0, 3:0 }); 
  const [isGaming, setIsGaming] = useState(false);
  const [isSqueezing, setIsSqueezing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [winZones, setWinZones] = useState([]); 
  const [tableChips, setTableChips] = useState([]); 
  const chipsRowRef = useRef(null);
  const [selectedChipVal, setSelectedChipVal] = useState(100); 
  const [showTrend, setShowTrend] = useState(false);
  const [history, setHistory] = useState([]); 
  
  const [countdown, setCountdown] = useState(18);
  const [isBetLocked, setIsBetLocked] = useState(false);
  const [squeezeCountdown, setSqueezeCountdown] = useState(0);
  
  // 🔥 新增：清場倒數 (顯示 "下一局: X")
  const [clearingCountdown, setClearingCountdown] = useState(0);

  useEffect(() => {
    setHistory(gameApp.history);

    gameApp.onBalanceChange = (amount) => {
      setBalance(prev => prev + amount);
      setIsGaming(false); 
      setIsSqueezing(false); 
      setIsClearing(true); 
      setSqueezeCountdown(0);
      
      // 🔥 設定清場倒數 4 秒
      let clearTime = 4;
      setClearingCountdown(clearTime);

      const clearTimer = setInterval(() => {
          clearTime--;
          setClearingCountdown(clearTime);

          if (clearTime <= 0) {
              clearInterval(clearTimer);
              
              // 時間到：清空所有東西
              setTableChips([]);
              setCurrentBets({ 0:0, 1:0, 2:0, 3:0 });
              setWinZones([]); 
              
              // 🔥 呼叫 Pixi 清空桌面
              gameApp.resetTable();
              
              setIsClearing(false); 
              setIsBetLocked(false);
          }
      }, 1000);
    };

    gameApp.onHistoryChange = (newHistory) => {
        setHistory(newHistory);
    };

    gameApp.onWinZones = (zones) => {
        setWinZones(zones);
    };

    gameApp.onSqueezeStateChange = (state, seconds = 0) => {
        setIsSqueezing(state);
        if(state && seconds > 0) {
            setSqueezeCountdown(seconds);
        }
    };

    gameApp.onSqueezeTick = (sec) => {
        setSqueezeCountdown(sec);
    }

  }, []);

  useEffect(() => {
      if (isGaming) return; 

      if (countdown > 0) {
          if (countdown <= 5 && !isBetLocked) {
              setIsBetLocked(true);
          }
          const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
          return () => clearTimeout(timer);
      } else {
          handleAutoStart();
      }
  }, [countdown, isGaming, isBetLocked]);

  const handleAutoStart = () => {
      setCountdown(18);
      setIsBetLocked(false);
      setIsGaming(true);
      gameApp.startGame(currentBets);
  };

  const handleStart = () => {
      if (isGaming) return;
      setCountdown(18);
      setIsBetLocked(false);
      setIsGaming(true);
      gameApp.startGame(currentBets); 
  };

  const handleBetZone = (zoneId) => {
    if (isGaming || isBetLocked) return; 
    
    if (balance < selectedChipVal) {
        alert("餘額不足！");
        return;
    }

    setBalance(prev => prev - selectedChipVal); 

    setCurrentBets(prev => ({
        ...prev,
        [zoneId]: prev[zoneId] + selectedChipVal
    }));

    const randomOffset = () => (Math.random() - 0.5) * 40;
    const chipIndex = CHIPS.findIndex(c => c.val === selectedChipVal);
    const startRect = chipsRowRef.current?.children[chipIndex]?.getBoundingClientRect();

    const newChip = {
        id: Date.now(),
        val: selectedChipVal,
        color: CHIPS.find(c => c.val === selectedChipVal).color,
        border: CHIPS.find(c => c.val === selectedChipVal).border,
        startX: startRect ? startRect.left : window.innerWidth / 2,
        startY: startRect ? startRect.top : window.innerHeight,
        targetZoneId: zoneId,
        offsetX: randomOffset(),
        offsetY: randomOffset(),
    };

    setTableChips(prev => [...prev, newChip]);
  };

  const handleSelectChip = (val) => {
      if (isGaming) return;
      setSelectedChipVal(val);
  };

  const handleBackToLobby = () => {
      if (isGaming) {
          alert("遊戲進行中，請等待本局結束再離開！");
          return;
      }
      if(confirm("確定要返回大廳嗎？")) {
          alert("正在返回大廳...");
      }
  };

  return (
    <div style={styles.container}>
      
      <div style={styles.topBar}>
          <div style={styles.dashboardGroup}>
              <div style={styles.jackpotContainer}>
                <div style={styles.jackpotTitle}>💰 彩金池</div>
                <div style={styles.jackpotNum}>349,005</div>
              </div>
              <div style={styles.dealerFrame}>
                 <div style={styles.dealerIcon}>莊</div>
                 <div style={styles.dealerLabel}>Dealer</div>
              </div>
          </div>
          <div style={styles.topRightBtns}>
             <button style={styles.roundBtn} onClick={handleBackToLobby}>⚙️</button>
             <div style={styles.btnLabel}>設定</div>
             <button style={{...styles.roundBtn, marginTop: '10px'}} onClick={() => setShowTrend(true)}>📈</button>
             <div style={styles.btnLabel}>走勢</div>
          </div>
      </div>

      {/* 下注倒數 / 鎖定提示 / 咪牌倒數 / 清場倒數 */}
      
      {/* 1. 下注階段 */}
      {!isGaming && !isClearing && (
          <div style={styles.timerOverlay}>
              <div style={{...styles.timerCircle, borderColor: isBetLocked ? '#f44336' : '#f1c40f'}}>
                  <div style={{...styles.timerNum, color: isBetLocked ? '#f44336' : '#f1c40f'}}>
                      {countdown}
                  </div>
                  <div style={styles.timerLabel}>
                      {isBetLocked ? '停止下注' : '請下注'}
                  </div>
              </div>
          </div>
      )}

      {/* 2. 咪牌階段 */}
      {isSqueezing && squeezeCountdown > 0 && (
          <div style={styles.timerOverlay}>
               <div style={{...styles.timerCircle, borderColor: '#00e676'}}>
                  <div style={{...styles.timerNum, color: '#00e676'}}>{squeezeCountdown}</div>
                  <div style={styles.timerLabel}>請咪牌</div>
               </div>
          </div>
      )}

      {/* 3. 🔥 清場階段 (新增) */}
      {isClearing && clearingCountdown > 0 && (
           <div style={styles.timerOverlay}>
               <div style={{...styles.timerCircle, borderColor: '#fff', backgroundColor: 'rgba(0,0,0,0.8)'}}>
                  <div style={{...styles.timerNum, color: '#fff'}}>{clearingCountdown}</div>
                  <div style={styles.timerLabel}>下一局</div>
               </div>
           </div>
      )}

      <div style={{
          ...styles.tableCenterArea,
          opacity: isSqueezing ? 1 : 1, 
          zIndex: isSqueezing ? 0 : 1, 
      }}>
          {ZONES.map((zone) => {
              const isWinner = winZones.includes(zone.id);
              return (
                  <div 
                    key={zone.id} 
                    style={{
                        ...styles.bettingZone, 
                        borderColor: isWinner ? '#ffd700' : (currentBets[zone.id] > 0 ? '#f1c40f' : 'rgba(255,255,255,0.1)'),
                        backgroundColor: isWinner ? 'rgba(255, 215, 0, 0.2)' : (isBetLocked ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.15)'),
                        boxShadow: isWinner ? '0 0 20px rgba(255, 215, 0, 0.6), inset 0 0 20px rgba(255, 215, 0, 0.3)' : 'none',
                        pointerEvents: (isGaming || isBetLocked) ? 'none' : 'auto', 
                        opacity: (isBetLocked && !isGaming) ? 0.7 : 1, 
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

      {!isGaming && !isBetLocked && Object.values(currentBets).some(v=>v>0) && (
          <button style={styles.startBtn} onClick={handleStart}>
              發 牌
          </button>
      )}
      
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
              opacity: isBetLocked ? 0.5 : 1, 
              pointerEvents: isBetLocked ? 'none' : 'auto'
          }} ref={chipsRowRef}>
              {CHIPS.map((chip, index) => (
                  <div 
                    key={chip.val}
                    style={{
                        ...styles.chip, 
                        background: `radial-gradient(circle at 30% 30%, ${chip.color}, #000)`,
                        border: `2px dashed ${chip.border}`,
                        transform: selectedChipVal === chip.val ? 'scale(1.1) translateY(-10px)' : 'scale(1)',
                        boxShadow: selectedChipVal === chip.val ? '0 10px 20px rgba(0,0,0,0.8)' : '0 4px 5px rgba(0,0,0,0.6)',
                        filter: (isGaming || isBetLocked) ? 'grayscale(0.8)' : 'none',
                    }}
                    onClick={() => handleSelectChip(chip.val)}
                  >
                      <div style={styles.chipInner}>
                        {chip.val >= 1000 ? `${chip.val/1000}k` : chip.val}
                      </div>
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
        gsap.fromTo(elRef.current, { y: 300, opacity: 0, scale: 1.5 }, { x: chip.offsetX, y: chip.offsetY, scale: 0.6, opacity: 1, duration: 0.4, ease: "back.out(1.2)" });
    }, []);
    return (
        <div ref={elRef} style={{ ...styles.chip, position: 'absolute', left: '50%', top: '80%', width: '36px', height: '36px', marginLeft: '-18px', marginTop: '-18px', background: `radial-gradient(circle at 30% 30%, ${chip.color}, #000)`, border: `2px dashed ${chip.border}`, zIndex: index, boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
            <div style={{...styles.chipInner, width:'24px', height:'24px', fontSize:'0.5rem'}}>{chip.val >= 1000 ? `${chip.val/1000}k` : chip.val}</div>
        </div>
    );
};

const styles = {
  container: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 20, pointerEvents: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '10px', background: 'transparent' },
  topBar: { 
      display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start',
      pointerEvents: 'auto', paddingTop: '10px', zIndex: 30,
      height: '15%', position: 'relative' 
  },
  dashboardGroup: {
      position: 'absolute',
      top: '10px', right: '50%', marginRight: '50px', 
      display: 'flex', alignItems: 'center', gap: '100px',
  },
  dealerFrame: { width: '120px', height: '45px', background: 'linear-gradient(180deg, #e6b800 0%, #b8860b 100%)', border: '3px solid #fff8e1', borderRadius: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' },
  dealerIcon: { fontSize: '1.5rem', fontWeight:'bold', color: '#3e2723', marginRight:'5px' },
  dealerLabel: { fontSize: '0.8rem', color:'#5d4037', fontWeight:'bold' },
  topRightBtns: { display:'flex', flexDirection:'column', alignItems:'center', gap:'2px' },
  roundBtn: { width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(180deg, #f1c40f 0%, #ff8f00 100%)', border: '2px solid #fff', fontSize: '1.2rem', cursor:'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.5)', display:'flex', justifyContent:'center', alignItems:'center' },
  btnLabel: { color: '#f1c40f', fontSize: '0.7rem', fontWeight:'bold', textShadow:'0 1px 2px #000' },
  
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
  startBtn: { position: 'absolute', bottom: '130px', left: '50%', transform: 'translateX(-50%)', padding: '10px 40px', fontSize: '1.5rem', fontWeight:'bold', background: 'linear-gradient(180deg, #f1c40f 0%, #ff8f00 100%)', border: '3px solid #fff', borderRadius: '50px', color: '#3e2723', boxShadow: '0 5px 15px rgba(0,0,0,0.8)', pointerEvents: 'auto', cursor:'pointer', zIndex: 50, animation: 'pulse 1s infinite' },
  jackpotContainer: { background: 'linear-gradient(180deg, #ff6f00 0%, #bf360c 100%)', padding: '8px 12px', borderRadius: '15px', border: '2px solid #ffcc80', textAlign: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.6)' },
  jackpotTitle: { color: '#ffe0b2', fontSize: '0.7rem', fontWeight:'bold', marginBottom:'0' },
  jackpotNum: { color: '#fff', fontSize: '1rem', fontWeight:'bold', textShadow:'0 2px 2px #bf360c' },
  bottomBar: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', pointerEvents: 'auto', paddingBottom: '10px', gap: '10px', zIndex: 30 },
  bottomLeftGroup: { display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' },
  balanceBox: { background: 'linear-gradient(180deg, #f1c40f 0%, #f57f17 100%)', border: '2px solid #fffde7', borderRadius: '8px', padding: '5px 15px', minWidth: '120px', boxShadow: '0 4px 0 #bf360c, 0 6px 6px rgba(0,0,0,0.5)' },
  betBox: { background: 'linear-gradient(180deg, #29b6f6 0%, #0288d1 100%)', border: '2px solid #e1f5fe', borderRadius: '8px', padding: '5px 15px', minWidth: '120px', boxShadow: '0 4px 0 #01579b, 0 6px 6px rgba(0,0,0,0.5)' },
  balanceLabel: { fontSize: '0.7rem', color: '#3e2723', fontWeight:'bold' },
  balanceNum: { fontSize: '1.1rem', color: '#3e2723', fontWeight:'bold' },
  chipsRow: { display: 'flex', gap: '10px', alignItems: 'flex-end', paddingBottom: '5px', overflowX: 'auto', paddingLeft: '10px' },
  chip: { width: '56px', height: '56px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0, boxShadow: '0 4px 5px rgba(0,0,0,0.6), inset 0 2px 5px rgba(255,255,255,0.3)', transition: 'all 0.2s', position: 'relative' },
  chipInner: { width: '42px', height: '42px', borderRadius: '50%', border: '2px dashed rgba(255,255,255,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#fff', fontWeight: 'bold', fontSize: '0.85rem', textShadow: '0 1px 2px #000' },
  winBadge: { position: 'absolute', top: '-15px', background: 'linear-gradient(180deg, #ffd700 0%, #ff8f00 100%)', color: '#3e2723', fontSize: '0.8rem', fontWeight: 'bold', padding: '2px 10px', borderRadius: '20px', border: '2px solid #fff', boxShadow: '0 0 10px #ffd700', zIndex: 10 },
};

export default GameUI;