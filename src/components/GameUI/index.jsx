import React, { useState, useEffect, useRef } from 'react';
import { gameApp } from '../../game/app';
import { soundManager } from '../../game/SoundManager';
import { socket, connectSocket } from '../../socket';
import useGameStore from '../../stores/useGameStore';
import gsap from 'gsap';
import TrendBoard from './TrendBoard';
import RulesModal from './RulesModal';
import BetHistoryModal from './BetHistoryModal';
import LoginForm from './LoginForm';
import AnnouncementToast from '../AnnouncementToast';

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

// B 模式風控參數 (需與後端 BetManager.js MAX_PAYOUT_ODDS 一致)
const MAX_ODDS = 8;

const CHIPS = [
  { val: 100,   img: chip100Img   },
  { val: 500,   img: chip500Img   },
  { val: 1000,  img: chip1000Img  },
  { val: 5000,  img: chip5000Img  },
  { val: 10000, img: chip10000Img },
];

const ZONES = [
  { id: 0, top: '30%', left: '17%',    width: '14%', height: '48%', label: '天', color: '#64b5f6' },
  { id: 1, top: '30%', left: '33.8%',  width: '14%', height: '48%', label: '地', color: '#ffee58' },
  { id: 2, top: '30%', left: '50.6%',  width: '14%', height: '48%', label: '玄', color: '#66bb6a' },
  { id: 3, top: '30%', left: '67.25%', width: '14%', height: '48%', label: '黃', color: '#ef5350' },
];

const ZONE_KEYS = ['tian', 'di', 'xuan', 'huang'];

const PHASES = {
    BETTING:   'BETTING',
    DEALING:   'DEALING',
    SQUEEZING: 'SQUEEZING',
    RESULT:    'RESULT',
};

const getRandomPositionInZone = (zoneId) => {
    const zone = ZONES.find(z => z.id === zoneId);
    if (!zone) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const parse = (val, max) => (parseFloat(val) / 100) * max;
    const x = parse(zone.left, window.innerWidth);
    const y = parse(zone.top, window.innerHeight);
    const w = parse(zone.width, window.innerWidth);
    const h = parse(zone.height, window.innerHeight);
    const centerX = x + (w / 2);
    const centerY = y + (h / 2);
    const offsetX = (Math.random() - 0.5) * (w * 0.4);
    const offsetY = (Math.random() - 0.5) * (h * 0.5);
    return { x: centerX + offsetX, y: centerY + offsetY };
};

// ─── 小型圖示按鈕（emoji + 文字標籤）─────────────────────────
const SmallBtn = ({ emoji, label, onClick }) => (
    <div onClick={onClick} style={smallBtnStyle}>
        <span style={{ fontSize: '1.2rem', lineHeight: '1', display: 'block' }}>{emoji}</span>
        <span style={{ fontSize: '0.5rem', color: '#D4AF37', fontWeight: 'bold', display: 'block' }}>{label}</span>
    </div>
);

const smallBtnStyle = {
    width: '40px', height: '44px',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: '1px',
    background: 'rgba(0,0,0,0.6)',
    border: '1px solid rgba(212,175,55,0.3)',
    borderRadius: '6px',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'transform 0.1s',
};

// ─── GameUI ────────────────────────────────────────────────────
const GameUI = () => {
  const storeUser = useGameStore((state) => state.user);
  const [isLoggedIn, setIsLoggedIn] = useState(!!storeUser);
  const [username, setUsername] = useState(storeUser?.name || '');
  const [balance, setBalance] = useState(storeUser?.balance || 0);
  const [currentBets, setCurrentBets] = useState({ 0:0, 1:0, 2:0, 3:0 });

  const [gameState, setGameState] = useState(PHASES.BETTING);
  const [countdown, setCountdown] = useState(0);
  const [winZones, setWinZones] = useState([]);
  const [isBetLocked, setIsBetLocked] = useState(false);

  const [tableChips, setTableChips] = useState([]);
  const chipsRowRef = useRef(null);
  const [selectedChipVal, setSelectedChipVal] = useState(100);
  const [history, setHistory] = useState([]);

  // ── Modal visibility ──
  const [showTrend, setShowTrend] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showMidRoundNotice, setShowMidRoundNotice] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showBetHistory, setShowBetHistory] = useState(false);

  // ── Sound ──
  const [soundEnabled, setSoundEnabled] = useState(soundManager.enabled);

  // ── 本局輸贏彈窗 ──
  const [roundResultPopup, setRoundResultPopup] = useState(null);

  // ── 投注紀錄（本次進入房間後的 session-only，離開後清空） ──
  const [betHistory, setBetHistory] = useState([]);

  // ── Refs：追蹤本局下注（不觸發 re-render） ──
  const roundBetTotalRef = useRef(0);
  const roundWinAmountRef = useRef(0);
  const roundBetsRef = useRef({ tian: 0, di: 0, xuan: 0, huang: 0 });
  const roundCountRef = useRef(0);
  const resultPopupTimerRef = useRef(null);

  const isBettingPhase = gameState === PHASES.BETTING;

  // gameState ref 供 visibilitychange 閉包讀最新值
  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  const totalCurrentBet = Object.values(currentBets).reduce((a, b) => a + b, 0);
  const maxAffordableBet = Math.floor(balance / MAX_ODDS) - totalCurrentBet;

  // ── 斷線重連 & 切換視窗 ─────────────────────────────────────
  useEffect(() => {
      const handleReconnect = () => {
          setTableChips([]);
          setWinZones([]);
          setCurrentBets({ 0:0, 1:0, 2:0, 3:0 });
          gameApp.resetTable();
      };

      const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
              gameApp.coinRain?.stop();
              gsap.killTweensOf("*");
              if (gameStateRef.current === PHASES.BETTING) {
                  gameApp.resetTable();
              }
              if (!socket.connected) connectSocket();
          }
      };

      socket.on('connect', handleReconnect);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
          socket.off('connect', handleReconnect);
          document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
  }, []);

  // ── Socket 事件 ──────────────────────────────────────────────
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
            soundManager.newRound();
            setIsBetLocked(false);
            setShowMidRoundNotice(false);
            setWinZones([]);
            setCurrentBets({ 0:0, 1:0, 2:0, 3:0 });
            setTableChips([]);
            gameApp.resetTable();
            // 重置本局追蹤
            roundBetTotalRef.current = 0;
            roundWinAmountRef.current = 0;
            roundBetsRef.current = { tian: 0, di: 0, xuan: 0, huang: 0 };
            clearTimeout(resultPopupTimerRef.current);
            setRoundResultPopup(null);
        }

        if (data.phase === PHASES.RESULT && data.roundResult) {
            const { winners } = data.roundResult;
            const winZoneIds = [];
            if (winners.tian)  winZoneIds.push(0);
            if (winners.di)    winZoneIds.push(1);
            if (winners.xuan)  winZoneIds.push(2);
            if (winners.huang) winZoneIds.push(3);
            setWinZones(winZoneIds);
            gameApp.revealAllRemaining();

            // 顯示本局輸贏彈窗（延遲 1.5s，讓發牌動畫先跑）
            if (roundBetTotalRef.current > 0) {
                const betTotal   = roundBetTotalRef.current;
                const winAmount  = roundWinAmountRef.current; // 若全輸則為 0
                const net        = winAmount - betTotal;

                // 儲存投注紀錄
                roundCountRef.current += 1;
                const entry = {
                    round:     roundCountRef.current,
                    betTotal,
                    winAmount,
                    net,
                    bets: { ...roundBetsRef.current },
                };
                setBetHistory(prev => [...prev, entry].slice(-30));

                clearTimeout(resultPopupTimerRef.current);
                resultPopupTimerRef.current = setTimeout(() => {
                    setRoundResultPopup({ betTotal, winAmount, net });
                    if (net > 0) soundManager.win();
                    else         soundManager.lose();
                }, 1500);
            }
        }
    };

    const onInitState = (data) => {
        setGameState(data.phase);
        setCountdown(data.countdown);
        if (data.myBets) {
            setCurrentBets({
                0: data.myBets.tian  || 0,
                1: data.myBets.di    || 0,
                2: data.myBets.xuan  || 0,
                3: data.myBets.huang || 0,
            });
        }
        if (data.phase !== PHASES.BETTING) {
            const hasBets = data.myBets && Object.values(data.myBets).some(v => v > 0);
            if (!hasBets) setShowMidRoundNotice(true);
        }
    };

    const onUpdateBalance = (data) => {
        setBalance(data.balance);
        // 捕捉本局贏回金額（settleBets 在 phase_change(RESULT) 之前發送）
        if (data.winAmount) {
            roundWinAmountRef.current = data.winAmount;
        }
    };

    const onErrorMsg = (msg) => { alert(msg); };

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

    const onUpdateTableBets = (data) => {
        if (data.username === username) return;
        if (!data.isBot && data.zoneId !== undefined && data.amount) {
            setCurrentBets(prev => ({
                ...prev,
                [data.zoneId]: (prev[data.zoneId] || 0) + data.amount
            }));
        }
        const targetPos = getRandomPositionInZone(data.zoneId);
        const chipData = CHIPS.find(c => c.val === data.amount) || CHIPS[0];
        const newChip = {
            id: `bot_chip_${Date.now()}_${Math.random()}`,
            val: data.amount, img: chipData.img,
            startX: Math.random() * window.innerWidth,
            startY: window.innerHeight + 100,
            targetX: targetPos.x, targetY: targetPos.y,
            targetZoneId: data.zoneId,
        };
        setTableChips(prev => [...prev, newChip]);
    };

    const onBetLock = (data) => { setIsBetLocked(data.lock); };

    socket.on('time_tick',        onTimeTick);
    socket.on('phase_change',     onPhaseChange);
    socket.on('init_state',       onInitState);
    socket.on('update_balance',   onUpdateBalance);
    socket.on('error_msg',        onErrorMsg);
    socket.on('login_response',   onLoginResponse);
    socket.on('auth_success',     onAuthSuccess);
    socket.on('update_table_bets', onUpdateTableBets);
    socket.on('bet_lock',         onBetLock);

    if (socket.connected) socket.emit('request_state');

    return () => {
        socket.off('time_tick',        onTimeTick);
        socket.off('phase_change',     onPhaseChange);
        socket.off('init_state',       onInitState);
        socket.off('update_balance',   onUpdateBalance);
        socket.off('error_msg',        onErrorMsg);
        socket.off('login_response',   onLoginResponse);
        socket.off('auth_success',     onAuthSuccess);
        socket.off('update_table_bets', onUpdateTableBets);
        socket.off('bet_lock',         onBetLock);
        clearTimeout(resultPopupTimerRef.current);
    };
  }, [username]);

  useEffect(() => {
    setHistory(gameApp.history);
    gameApp.onHistoryChange = (newHistory) => setHistory(newHistory);
  }, []);

  // ── 下注 ─────────────────────────────────────────────────────
  const handleBetZone = (zoneId) => {
    if (!isBettingPhase || !isLoggedIn || isBetLocked) return;
    if (selectedChipVal > maxAffordableBet) {
        alert(`餘額不足以支付最高賠付 (需保留 ${MAX_ODDS} 倍本金)`);
        return;
    }

    socket.emit('place_bet', { zoneId, amount: selectedChipVal });
    soundManager.chip();

    // 追蹤本局下注（用於輸贏彈窗與投注紀錄）
    roundBetTotalRef.current += selectedChipVal;
    roundBetsRef.current[ZONE_KEYS[zoneId]] = (roundBetsRef.current[ZONE_KEYS[zoneId]] || 0) + selectedChipVal;

    setCurrentBets(prev => ({ ...prev, [zoneId]: prev[zoneId] + selectedChipVal }));

    const targetPos  = getRandomPositionInZone(zoneId);
    const chipIndex  = CHIPS.findIndex(c => c.val === selectedChipVal);
    const startRect  = chipsRowRef.current?.children[chipIndex]?.getBoundingClientRect();
    const chipData   = CHIPS.find(c => c.val === selectedChipVal);

    const newChip = {
        id: Date.now(),
        val: selectedChipVal, img: chipData.img,
        startX: startRect ? startRect.left : window.innerWidth / 2,
        startY: startRect ? startRect.top  : window.innerHeight,
        targetX: targetPos.x, targetY: targetPos.y,
        targetZoneId: zoneId,
    };
    setTableChips(prev => [...prev, newChip]);
  };

  const handleSelectChip = (val) => {
      if (val <= maxAffordableBet || !isLoggedIn) setSelectedChipVal(val);
  };

  const logout  = useGameStore((state) => state.logout);
  const exitRoom = useGameStore((state) => state.exitRoom);
  const handleBackToLobby = () => setShowSettingsModal(true);

  const getTimerStyle = () => {
      if (gameState === PHASES.BETTING) {
          if (isBetLocked) return { color: '#e74c3c', text: '封盤中', borderColor: '#e74c3c' };
          return { color: '#f1c40f', text: '請下注', borderColor: '#f1c40f' };
      }
      if (gameState === PHASES.DEALING)   return { color: '#00e676', text: '發牌中', borderColor: '#00e676' };
      if (gameState === PHASES.SQUEEZING) return { color: '#00e676', text: '咪牌中', borderColor: '#00e676' };
      return { color: '#fff', text: '結算中', borderColor: '#fff' };
  };
  const timerStyle = getTimerStyle();

  const getMidRoundInfo = () => {
      if (gameState === PHASES.DEALING)   return { icon: '🃏', phase: '發牌中', msg: '本局正在發牌，請稍候' };
      if (gameState === PHASES.SQUEEZING) return { icon: '👁',  phase: '咪牌中', msg: '玩家正在咪牌，請稍候' };
      if (gameState === PHASES.RESULT)    return { icon: '💰', phase: '結算中', msg: '即將開始新局' };
      return { icon: '🎴', phase: '進行中', msg: '請稍候' };
  };

  if (!isLoggedIn) return <LoginForm />;

  return (
    <>
      <AnnouncementToast />
      <div style={styles.backgroundLayer} />

      <div style={styles.container}>
        {/* Top Bar - 僅保留儀表板資訊，按鈕群已移到 fixed panel 脫離 stacking context */}
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
                          top: zone.top, left: zone.left,
                          width: zone.width, height: zone.height,
                          borderColor: isWinner ? '#ffd700' : (currentBets[zone.id] > 0 ? '#f1c40f' : 'rgba(255,255,255,0.1)'),
                          backgroundColor: isWinner ? 'rgba(255,215,0,0.4)' : 'rgba(0,0,0,0.05)',
                          boxShadow: isWinner ? '0 0 20px rgba(255,215,0,0.6), inset 0 0 20px rgba(255,215,0,0.3)' : 'none',
                          pointerEvents: (isBettingPhase && !isBetLocked) ? 'auto' : 'none',
                          opacity: (!isBettingPhase || isBetLocked) ? 0.6 : 1,
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

        {/* 全螢幕籌碼層 */}
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
                opacity: (isBettingPhase && isLoggedIn && !isBetLocked) ? 1 : 0.5,
            }} ref={chipsRowRef}>
                {CHIPS.map((chip) => {
                    const canAfford = chip.val <= maxAffordableBet;
                    return (
                        <div
                          key={chip.val}
                          style={{
                              ...styles.chipWrapper,
                              transform: selectedChipVal === chip.val ? 'scale(1.15) translateY(-10px)' : 'scale(1)',
                              filter: (!isBettingPhase || !canAfford || isBetLocked) ? 'grayscale(1) opacity(0.5)' : 'none',
                              cursor: (isBettingPhase && canAfford && !isBetLocked) ? 'pointer' : 'not-allowed',
                          }}
                          onClick={() => handleSelectChip(chip.val)}
                        >
                            <img src={chip.img} alt={chip.val} style={styles.chipImg} />
                        </div>
                    );
                })}
            </div>
        </div>
      </div>

      {/* 限紅顯示（固定於下方，不擋操作） */}
      <div style={styles.betLimitBar}>
          最低 $100 ／ 單門 $500,000 ／ 每局 $2,000,000
      </div>

      {/* ── 右側固定按鈕群 ──────────────────────────────────────────────
          position:fixed + zIndex:9997 → 完全脫離 container (zIndex:20) 與
          Pixi canvas parent (發牌時升至 zIndex:55) 的 stacking context，
          任何遊戲階段都可點擊                                              */}
      <div style={styles.fixedBtns}>
          <div onClick={handleBackToLobby} style={styles.iconBtnWrapper}>
              <img src={btnSettingsImg} style={styles.iconBtnImg} alt="設定" />
          </div>
          <div onClick={() => setShowTrend(true)} style={styles.trendBtn}>
              <span style={{ fontSize: '1.5rem', lineHeight: '1', display: 'block' }}>📊</span>
              <span style={{ fontSize: '0.6rem', color: '#D4AF37', fontWeight: 'bold', lineHeight: '1', display: 'block' }}>走勢</span>
          </div>
          <SmallBtn emoji="📜" label="紀錄" onClick={() => setShowBetHistory(true)} />
      </div>

      {/* ↓ 以下所有 overlay 必須在 container 外，否則被 zIndex:20 stacking context 鎖住 */}

      {showTrend && <TrendBoard history={history} onClose={() => setShowTrend(false)} />}

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      {showBetHistory && <BetHistoryModal history={betHistory} onClose={() => setShowBetHistory(false)} />}

      {showSettingsModal && (
          <div style={styles.modalOverlay} onClick={() => setShowSettingsModal(false)}>
              <div style={styles.modalPanel} onClick={e => e.stopPropagation()}>
                  <div style={styles.modalTitle}>設定</div>

                  {/* 音效切換 */}
                  <div style={styles.settingRow} onClick={() => setSoundEnabled(soundManager.toggle())}>
                      <span style={styles.settingLabel}>{soundEnabled ? '🔊' : '🔇'} 音效</span>
                      <div style={{...styles.toggleTrack, background: soundEnabled ? '#4caf50' : '#555'}}>
                          <div style={{...styles.toggleKnob, left: soundEnabled ? '22px' : '2px'}} />
                      </div>
                  </div>

                  {/* 規則與賠率 */}
                  <button style={styles.modalBtnInfo} onClick={() => { setShowSettingsModal(false); setShowRules(true); }}>
                      📖 規則與賠率
                  </button>

                  <div style={styles.modalDivider} />

                  <button style={styles.modalBtnLobby}  onClick={() => { exitRoom(); setShowSettingsModal(false); }}>🏠 回到大廳</button>
                  <button style={styles.modalBtnLogout} onClick={() => { logout();   setShowSettingsModal(false); }}>🚪 登出</button>
                  <button style={styles.modalBtnCancel} onClick={() => setShowSettingsModal(false)}>取消</button>
              </div>
          </div>
      )}

      {/* 本局輸贏彈窗 */}
      {roundResultPopup && (
          <div
              style={styles.resultPopupWrap}
              onClick={() => { clearTimeout(resultPopupTimerRef.current); setRoundResultPopup(null); }}
          >
              <div style={styles.resultPopupCard}>
                  <div style={styles.resultPopupTitle}>本局結算</div>
                  <div style={styles.resultRows}>
                      <div style={styles.resultRow}>
                          <span>下注</span>
                          <span>${roundResultPopup.betTotal.toLocaleString()}</span>
                      </div>
                      <div style={styles.resultRow}>
                          <span>獲得</span>
                          <span>${roundResultPopup.winAmount.toLocaleString()}</span>
                      </div>
                      <div style={styles.resultDivider} />
                  </div>
                  <div style={{
                      ...styles.resultNet,
                      color: roundResultPopup.net >= 0 ? '#4caf50' : '#ef5350',
                  }}>
                      {roundResultPopup.net >= 0 ? '+' : ''}{roundResultPopup.net.toLocaleString()}
                  </div>
                  <div style={styles.resultHint}>點擊關閉</div>
              </div>
          </div>
      )}

      {showMidRoundNotice && (() => {
          const info = getMidRoundInfo();
          return (
              <div style={styles.midRoundOverlay}>
                  <div style={styles.midRoundCard}>
                      <div style={styles.midRoundIconWrap}>{info.icon}</div>
                      <div style={styles.midRoundTitle2}>遊戲進行中</div>
                      <div style={styles.midRoundPhaseRow}>
                          <span style={{
                              ...styles.midRoundPhaseBadge,
                              background: timerStyle.color + '22',
                              border: `1px solid ${timerStyle.color}`,
                              color: timerStyle.color,
                          }}>{info.phase}</span>
                          <span style={{...styles.midRoundCd, color: timerStyle.color}}>
                              {countdown}<span style={styles.midRoundCdUnit}>s</span>
                          </span>
                      </div>
                      <div style={styles.midRoundDivider}/>
                      <div style={styles.midRoundMsg}>{info.msg}</div>
                      <div style={styles.midRoundSub}>下注將於新局開放</div>
                      <div style={styles.midRoundDots}>
                          <span className="mid-round-dot">●</span>
                          <span className="mid-round-dot">●</span>
                          <span className="mid-round-dot">●</span>
                      </div>
                  </div>
              </div>
          );
      })()}
    </>
  );
};

// ─── 籌碼動畫元件 ─────────────────────────────────────────────
const ChipOnTable = ({ chip, index }) => {
    const elRef = useRef(null);
    useEffect(() => {
        gsap.fromTo(elRef.current,
            { x: chip.startX, y: chip.startY, opacity: 0, scale: 1.5 },
            { x: chip.targetX, y: chip.targetY, scale: 0.5, opacity: 1, duration: 0.5, ease: "power2.out" }
        );
    }, []);
    return (
        <div ref={elRef} style={{
            position: 'absolute', left: 0, top: 0,
            width: '110px', height: '110px',
            marginLeft: '-55px', marginTop: '-55px',
            zIndex: index,
            filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))',
        }}>
            <img src={chip.img} alt={chip.val} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
    );
};

// ─── Styles ───────────────────────────────────────────────────
const styles = {
  backgroundLayer: {
    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
    backgroundImage: `url(${bgNiuniuRoom})`,
    backgroundSize: 'cover', backgroundPosition: 'center',
    zIndex: 1, pointerEvents: 'none',
  },
  container: {
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      zIndex: 20, pointerEvents: 'none',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: '10px',
  },
  topBar: {
      pointerEvents: 'none', paddingTop: '10px', zIndex: 30, position: 'relative', height: '15%',
  },
  // 右側固定按鈕群：position:fixed 脫離所有 stacking context
  fixedBtns: {
      position: 'fixed',
      top: '10px',
      right: '10px',
      zIndex: 9997,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '5px',
      pointerEvents: 'auto',
  },
  dashboardGroup: {
      position: 'absolute', top: '5px', left: '50%', transform: 'translateX(-50%)',
      display: 'flex', alignItems: 'center', gap: '30px',
  },
  jackpotContainer: {
      display: 'flex', alignItems: 'center',
      background: 'rgba(0,0,0,0.5)', padding: '2px 10px 2px 5px',
      borderRadius: '20px', border: '1px solid #ffca28',
  },
  jackpotIcon: { width: '30px', marginRight: '5px' },
  jackpotTextCol: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' },
  jackpotTitle: { color: '#ffecb3', fontSize: '0.6rem', lineHeight: '1' },
  jackpotNum:   { color: '#fff', fontSize: '0.9rem', fontWeight: 'bold', lineHeight: '1.2' },
  dealerWrapper: {
      position: 'relative', width: '140px', height: '50px',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
  },
  dealerBg:   { position: 'absolute', width: '100%', height: '100%', objectFit: 'contain' },
  dealerText: { position: 'relative', zIndex: 1, color: '#3e2723', fontWeight: 'bold', fontSize: '0.9rem', marginTop: '-2px' },
  topRightBtns: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' },
  iconBtnWrapper: { width: '45px', height: '45px', cursor: 'pointer', transition: 'transform 0.1s' },
  iconBtnImg: { width: '100%', height: '100%', objectFit: 'contain' },
  trendBtn: {
      width: '52px', height: '52px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '2px',
      background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(212,175,55,0.5)',
      borderRadius: '8px', cursor: 'pointer', transition: 'transform 0.1s', flexShrink: 0,
  },
  miniBtnsRow: { display: 'flex', gap: '4px' },
  timerOverlay: {
      position: 'fixed', top: '20%', left: '74%',
      transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 9997,
  },
  timerCircle: {
      width: '80px', height: '80px', borderRadius: '50%',
      background: 'rgba(0,0,0,0.6)', border: '2px solid #f1c40f',
      display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
      boxShadow: '0 0 20px rgba(241,196,15,0.4)',
  },
  timerNum:   { fontSize: '2rem', color: '#f1c40f', fontWeight: 'bold', lineHeight: '1' },
  timerLabel: { fontSize: '0.7rem', color: '#fff', marginTop: '2px' },
  tableCenterArea: {
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: 1,
  },
  globalChipsLayer: {
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: 50,
  },
  bettingZone: {
      border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px',
      display: 'flex', flexDirection: 'column',
      justifyContent: 'flex-start', alignItems: 'center',
      position: 'relative', cursor: 'pointer', paddingTop: '5px',
  },
  zoneLabel:    { fontSize: '1.8rem', fontWeight: 'bold', fontFamily: 'serif', marginBottom: '2px', textShadow: '0 2px 4px #000' },
  zoneRate:     { color: '#aaa', fontSize: '0.7rem', border: '1px solid #555', padding: '2px 4px', borderRadius: '6px' },
  zoneTotalBet: { marginTop: 'auto', marginBottom: '5px', color: '#f1c40f', fontWeight: 'bold', fontSize: '0.9rem', background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: '4px' },
  winBadge: {
      position: 'absolute', top: '-15px',
      background: 'linear-gradient(180deg, #ffd700 0%, #ff8f00 100%)',
      color: '#3e2723', fontSize: '0.8rem', fontWeight: 'bold',
      padding: '2px 10px', borderRadius: '20px', border: '2px solid #fff', zIndex: 10,
  },
  bottomBar: {
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      pointerEvents: 'auto', paddingBottom: '10px', gap: '10px', zIndex: 30,
  },
  bottomLeftGroup: { display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' },
  balanceBox: {
      background: 'linear-gradient(180deg, #f1c40f 0%, #f57f17 100%)',
      border: '2px solid #fffde7', borderRadius: '8px',
      padding: '5px 15px', minWidth: '120px', boxShadow: '0 4px 0 #bf360c',
  },
  betBox: {
      background: 'linear-gradient(180deg, #29b6f6 0%, #0288d1 100%)',
      border: '2px solid #e1f5fe', borderRadius: '8px',
      padding: '5px 15px', minWidth: '120px', boxShadow: '0 4px 0 #01579b',
  },
  balanceLabel: { fontSize: '0.7rem', color: '#3e2723', fontWeight: 'bold' },
  balanceNum:   { fontSize: '1.1rem', color: '#3e2723', fontWeight: 'bold' },
  chipsRow: {
      display: 'flex', gap: '15px', alignItems: 'flex-end',
      paddingBottom: '5px', overflowX: 'auto', paddingLeft: '10px', pointerEvents: 'auto',
  },
  chipWrapper: {
      width: '56px', height: '56px',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      flexShrink: 0, transition: 'all 0.2s', position: 'relative',
  },
  chipImg: { width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.6))' },

  // 限紅顯示
  betLimitBar: {
      position: 'fixed', bottom: '80px', left: '50%',
      transform: 'translateX(-50%)',
      fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)',
      background: 'rgba(0,0,0,0.35)', padding: '3px 14px',
      borderRadius: '10px', whiteSpace: 'nowrap',
      pointerEvents: 'none', zIndex: 25,
  },

  // 本局輸贏彈窗
  resultPopupWrap: {
      position: 'fixed', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9996, pointerEvents: 'auto',
      background: 'rgba(0,0,0,0.35)',
  },
  resultPopupCard: {
      background: 'rgba(8,10,22,0.97)',
      border: '1px solid rgba(212,175,55,0.55)', borderRadius: '20px',
      padding: '28px 40px', textAlign: 'center',
      boxShadow: '0 0 50px rgba(0,0,0,0.9)',
      minWidth: '230px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
  },
  resultPopupTitle: {
      color: '#D4AF37', fontSize: '1rem', fontWeight: 'bold',
      letterSpacing: '0.1em', marginBottom: '2px',
  },
  resultRows: { width: '100%', display: 'flex', flexDirection: 'column', gap: '4px' },
  resultRow: {
      display: 'flex', justifyContent: 'space-between',
      color: 'rgba(255,255,255,0.65)', fontSize: '0.9rem',
      padding: '2px 0',
  },
  resultDivider: { width: '100%', height: '1px', background: 'rgba(212,175,55,0.2)', margin: '4px 0' },
  resultNet: { fontSize: '2.8rem', fontWeight: 'bold', lineHeight: '1', letterSpacing: '-0.02em' },
  resultHint: { color: 'rgba(255,255,255,0.25)', fontSize: '0.68rem', marginTop: '4px' },

  // 設定 Modal
  modalOverlay: {
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.75)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(6px)', pointerEvents: 'auto',
  },
  modalPanel: {
      background: 'rgba(15,17,30,0.97)',
      border: '1px solid rgba(212,175,55,0.4)', borderRadius: '20px',
      padding: '28px 32px', width: '260px',
      display: 'flex', flexDirection: 'column', gap: '12px',
      boxShadow: '0 8px 40px rgba(0,0,0,0.9)', pointerEvents: 'auto',
  },
  modalTitle: {
      color: '#D4AF37', fontSize: '1.2rem', fontWeight: 'bold',
      textAlign: 'center', marginBottom: '4px', letterSpacing: '0.1em',
  },
  modalBtnLobby: {
      background: 'linear-gradient(135deg, #D4AF37 0%, #b8860b 100%)',
      color: '#1a1000', border: 'none', borderRadius: '12px',
      padding: '14px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit',
  },
  modalBtnLogout: {
      background: 'rgba(255,255,255,0.07)', color: '#e74c3c',
      border: '1px solid rgba(231,76,60,0.3)', borderRadius: '12px',
      padding: '14px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit',
  },
  modalBtnCancel: {
      background: 'transparent', color: 'rgba(255,255,255,0.4)', border: 'none',
      borderRadius: '12px', padding: '10px', fontSize: '0.9rem',
      cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
  },
  // 設定列（音效開關）
  settingRow: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 4px', cursor: 'pointer', userSelect: 'none',
  },
  settingLabel: { color: 'rgba(255,255,255,0.85)', fontSize: '1rem' },
  toggleTrack: {
      width: '46px', height: '24px', borderRadius: '12px',
      position: 'relative', transition: 'background 0.25s', flexShrink: 0,
  },
  toggleKnob: {
      position: 'absolute', top: '3px',
      width: '18px', height: '18px', borderRadius: '50%',
      background: '#fff', transition: 'left 0.25s',
  },
  modalBtnInfo: {
      background: 'rgba(255,255,255,0.06)',
      color: 'rgba(255,255,255,0.85)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '12px', padding: '13px',
      fontSize: '0.95rem', fontWeight: 'bold',
      cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
      width: '100%',
  },
  modalDivider: { height: '1px', background: 'rgba(255,255,255,0.08)', margin: '2px 0' },

  // 中途進入提示
  midRoundOverlay: {
      position: 'fixed', inset: 0, zIndex: 9000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(4,6,15,0.78)', backdropFilter: 'blur(4px)',
      pointerEvents: 'none',
  },
  midRoundCard: {
      background: 'rgba(14,16,28,0.96)', border: '1px solid rgba(212,175,55,0.45)',
      borderRadius: '22px', padding: '28px 36px', textAlign: 'center',
      boxShadow: '0 0 60px rgba(212,175,55,0.12), 0 12px 40px rgba(0,0,0,0.8)',
      minWidth: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
  },
  midRoundIconWrap: { fontSize: '2.8rem', lineHeight: '1', marginBottom: '2px', filter: 'drop-shadow(0 0 12px rgba(212,175,55,0.5))' },
  midRoundTitle2: { color: '#D4AF37', fontSize: '1.3rem', fontWeight: 'bold', letterSpacing: '0.08em' },
  midRoundPhaseRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', margin: '4px 0' },
  midRoundPhaseBadge: { padding: '4px 14px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold', letterSpacing: '0.05em' },
  midRoundCd:     { fontSize: '2.2rem', fontWeight: 'bold', lineHeight: '1' },
  midRoundCdUnit: { fontSize: '0.9rem', marginLeft: '2px', opacity: 0.7 },
  midRoundDivider: { width: '100%', height: '1px', background: 'rgba(212,175,55,0.2)', margin: '2px 0' },
  midRoundMsg:  { color: 'rgba(255,255,255,0.85)', fontSize: '0.95rem', fontWeight: '500' },
  midRoundSub:  { color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem', letterSpacing: '0.05em' },
  midRoundDots: { display: 'flex', gap: '8px', justifyContent: 'center', color: '#D4AF37', fontSize: '0.9rem', marginTop: '4px' },
};

export default GameUI;
