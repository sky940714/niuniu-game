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

import btnSettingsImg from '../../assets/buttons/btn_settings.png';

// B 模式風控參數 (需與後端 BetManager.js MAX_PAYOUT_ODDS 一致)
const MAX_ODDS = 8;
// 彩金池貢獻比例（需與後端 JACKPOT.CONTRIBUTION_RATE 一致）
const JACKPOT_RATE = 0.005;

const CHIPS = [
  { val: 100,   img: chip100Img   },
  { val: 500,   img: chip500Img   },
  { val: 1000,  img: chip1000Img  },
  { val: 5000,  img: chip5000Img  },
  { val: 10000, img: chip10000Img },
];

const ZONES = [
  { id: 0, top: '30%', left: '13%',  width: '14%', height: '48%', label: '頭', color: '#64b5f6' },
  { id: 1, top: '30%', left: '33%',  width: '14%', height: '48%', label: '初', color: '#ffee58' },
  { id: 2, top: '30%', left: '53%',  width: '14%', height: '48%', label: '川', color: '#66bb6a' },
  { id: 3, top: '30%', left: '73%',  width: '14%', height: '48%', label: '尾', color: '#ef5350' },
];

const ZONE_KEYS = ['tian', 'di', 'xuan', 'huang'];

const PHASES = {
    BETTING:   'BETTING',
    DEALING:   'DEALING',
    SQUEEZING: 'SQUEEZING',
    RESULT:    'RESULT',
};

const CHIP_RADIUS = 28; // 籌碼顯示半徑（scale 0.5 × 55px）

// 用 DOM rect 計算隨機落點，確保不依賴手動百分比計算
const getChipPosFromRect = (rect) => {
    if (!rect) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const minX = rect.left + CHIP_RADIUS;
    const maxX = rect.right - CHIP_RADIUS;
    const minY = rect.top + CHIP_RADIUS;
    const maxY = rect.bottom - CHIP_RADIUS;
    return {
        x: minX + Math.random() * Math.max(0, maxX - minX),
        y: minY + Math.random() * Math.max(0, maxY - minY),
    };
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
  const storeUser     = useGameStore((state) => state.user);
  const setUserBalance = useGameStore((state) => state.setUserBalance);
  const [isLoggedIn, setIsLoggedIn] = useState(!!storeUser);
  const [username, setUsername] = useState(storeUser?.name || '');
  const [balance, setBalance] = useState(storeUser?.balance || 0);
  const [currentBets, setCurrentBets] = useState({ 0:0, 1:0, 2:0, 3:0 });
  const [totalContributions, setTotalContributions] = useState(0);

  const [gameState, setGameState] = useState(PHASES.BETTING);
  const [countdown, setCountdown] = useState(0);
  const [winZones, setWinZones] = useState([]);
  const [isBetLocked, setIsBetLocked] = useState(false);

  const [tableChips, setTableChips] = useState([]);
  const chipsRowRef = useRef(null);
  const zoneRefs    = useRef({});  // { [zoneId]: HTMLElement }
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

  // ── 彩金池 ──
  const [jackpotAmount, setJackpotAmount] = useState(0);
  const [jackpotWinData, setJackpotWinData] = useState(null);
  const jackpotWinTimerRef = useRef(null);

  // ── 莊家系統 ──
  const [bankerStatus, setBankerStatus] = useState({ hasBanker: false, banker: null, queue: [], queueCount: 0, queueLimit: 5, minFrozen: 100000 });
  const [showBankerModal, setShowBankerModal] = useState(false);
  const [showBankerManageModal, setShowBankerManageModal] = useState(false);
  const [bankerFrozenInput, setBankerFrozenInput] = useState('');
  const [bankerApplying, setBankerApplying] = useState(false);
  const [bankerEndPopup, setBankerEndPopup] = useState(null); // { isForced, finalFrozen, netPnl, roundsPlayed }

  // ── 本局輸贏彈窗 ──
  const [roundResultPopup, setRoundResultPopup] = useState(null);

  // ── 投注紀錄（本次進入房間後的 session-only，離開後清空） ──
  const [betHistory, setBetHistory] = useState([]);

  // ── Refs：追蹤本局下注（不觸發 re-render） ──
  const roundBetTotalRef    = useRef(0);
  const roundWinAmountRef   = useRef(0);
  const roundNetChangeRef   = useRef(null); // 後端傳來的真實淨損益（含莊家倍率追賠）
  const roundBetsRef        = useRef({ tian: 0, di: 0, xuan: 0, huang: 0 });
  const roundCountRef       = useRef(0);
  const resultPopupTimerRef = useRef(null);
  const returnFromHiddenRef    = useRef(false); // 追蹤是否從背景返回
  const isFullyInitializedRef  = useRef(false); // 收到第一次 init_state 後才算初始化完成

  const isBettingPhase = gameState === PHASES.BETTING;

  // gameState ref 供 visibilitychange 閉包讀最新值
  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // iAmBanker ref 供 socket 事件閉包讀最新值
  const iAmBankerRef = useRef(false);
  // 追蹤本局下注門（供 gameApp.setPlayerContext 使用）
  const currentBetsRef = useRef({ 0: 0, 1: 0, 2: 0, 3: 0 });
  useEffect(() => { currentBetsRef.current = currentBets; }, [currentBets]);

  const totalCurrentBet = Object.values(currentBets).reduce((a, b) => a + b, 0);
  const maxAffordableBet = Math.floor((balance + totalCurrentBet) / MAX_ODDS) - totalCurrentBet;

  // ── 斷線重連 & 切換視窗 ─────────────────────────────────────
  useEffect(() => {
      const handleReconnect = () => {
          setTableChips([]);
          setWinZones([]);
          setCurrentBets({ 0:0, 1:0, 2:0, 3:0 });
          setTotalContributions(0);
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
        if (data.jackpotAmount !== undefined) setJackpotAmount(data.jackpotAmount);
        if (data.bankerStatus !== undefined) setBankerStatus(data.bankerStatus);
    };

    const onPhaseChange = (data) => {
        setGameState(data.phase);
        setCountdown(data.countdown);

        if (data.phase === PHASES.DEALING && data.roundResult) {
            // 用 roundBetsRef（在 handleBetZone 同步更新，比 state 更可靠）
            const bettedZones = ZONE_KEYS
                .map((k, i) => (roundBetsRef.current[k] > 0 ? i : -1))
                .filter(i => i >= 0);
            gameApp.setPlayerContext(iAmBankerRef.current, bettedZones);
            gameApp.startRoundWithData(data.roundResult);
        }

        if (data.phase === PHASES.BETTING) {
            soundManager.newRound();
            soundManager.placeBetAnnounce();
            setIsBetLocked(false);
            setShowMidRoundNotice(false);
            setWinZones([]);
            setCurrentBets({ 0:0, 1:0, 2:0, 3:0 });
            setTotalContributions(0);
            setTableChips([]);
            gameApp.resetTable();
            // 重置本局追蹤
            roundBetTotalRef.current  = 0;
            roundWinAmountRef.current = 0;
            roundNetChangeRef.current = null;
            roundBetsRef.current = { tian: 0, di: 0, xuan: 0, huang: 0 };
            clearTimeout(resultPopupTimerRef.current);
            setRoundResultPopup(null);
        }

        if (data.phase === PHASES.RESULT && data.roundResult) {
            const { winners, results } = data.roundResult;
            const winZoneIds = [];
            if (winners.tian)  winZoneIds.push(0);
            if (winners.di)    winZoneIds.push(1);
            if (winners.xuan)  winZoneIds.push(2);
            if (winners.huang) winZoneIds.push(3);
            setWinZones(winZoneIds);
            gameApp.revealAllRemaining();

            if (iAmBankerRef.current) {
                // ── 莊家結算紀錄 ──
                const net = roundNetChangeRef.current || 0;
                roundCountRef.current += 1;
                const bankerEntry = {
                    round:      roundCountRef.current,
                    type:       'banker',
                    net,
                    bankerType: results?.banker?.typeName || '',
                    // winZones: 莊家贏 = 玩家輸 = !winners[zone]
                    winZones: {
                        tian:  !winners.tian,
                        di:    !winners.di,
                        xuan:  !winners.xuan,
                        huang: !winners.huang,
                    },
                };
                setBetHistory(prev => [...prev, bankerEntry].slice(-30));
                clearTimeout(resultPopupTimerRef.current);
                resultPopupTimerRef.current = setTimeout(() => {
                    setRoundResultPopup({ betTotal: 0, winAmount: 0, net, isBanker: true });
                    if (net > 0) soundManager.win();
                    else         soundManager.lose();
                }, 1500);
            } else if (roundBetTotalRef.current > 0) {
                // ── 玩家投注紀錄 ──
                const betTotal  = roundBetTotalRef.current;
                const winAmount = roundWinAmountRef.current;
                const net = roundNetChangeRef.current !== null
                    ? roundNetChangeRef.current
                    : winAmount - betTotal;

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
            setTotalContributions(0);
        }
        if (data.bankerStatus) setBankerStatus(data.bankerStatus);
        if (data.jackpotAmount) setJackpotAmount(data.jackpotAmount);

        // 下注階段重連：從 tableBets 還原機器人籌碼視覺
        if (data.phase === PHASES.BETTING && data.tableBets) {
            const ZONE_KEYS = ['tian', 'di', 'xuan', 'huang'];
            const myBets = data.myBets || {};
            setTimeout(() => {
                const ghostChips = [];
                ZONE_KEYS.forEach((key, zoneId) => {
                    const total = (data.tableBets[key] || 0) - (myBets[key] || 0);
                    if (total <= 0) return;
                    const zoneEl = zoneRefs.current[zoneId];
                    if (!zoneEl) return;
                    const targetPos = getChipPosFromRect(zoneEl.getBoundingClientRect());
                    // 選最接近的籌碼面額代表該門累積量
                    const chipData = [...CHIPS].sort((a, b) => b.val - a.val).find(c => c.val <= total) || CHIPS[0];
                    ghostChips.push({
                        id: `ghost_${key}_${Date.now()}`,
                        val: chipData.val,
                        img: chipData.img,
                        targetX: targetPos.x,
                        targetY: targetPos.y,
                        targetZoneId: zoneId,
                    });
                });
                if (ghostChips.length > 0) setTableChips(prev => [...prev, ...ghostChips]);
            }, 150);
        }

        const hasBets = data.myBets && Object.values(data.myBets).some(v => v > 0);
        if (!hasBets) {
            if (data.phase !== PHASES.BETTING || returnFromHiddenRef.current) {
                setShowMidRoundNotice(true);
            }
        }
        returnFromHiddenRef.current   = false;
        isFullyInitializedRef.current = true;
    };

    const onUpdateBalance = (data) => {
        setBalance(data.balance);
        setUserBalance(data.balance); // 同步更新 Zustand store，確保返回大廳後餘額正確
        // 捕捉本局結算數據（settleBets 在 phase_change(RESULT) 之前發送）
        if (data.winAmount) roundWinAmountRef.current = data.winAmount;
        if (data.netChange !== undefined) roundNetChangeRef.current = data.netChange;
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
        // 僅為自己追蹤 currentBets（由 handleBetZone 直接更新）
        // 其他玩家（含機器人）的下注只播放籌碼動畫，不影響本地風控計算
        const zoneEl    = zoneRefs.current[data.zoneId];
        const targetPos = getChipPosFromRect(zoneEl?.getBoundingClientRect());
        const chipData  = CHIPS.find(c => c.val === data.amount) || CHIPS[0];
        const newChip = {
            id: `bot_chip_${Date.now()}_${Math.random()}`,
            val: data.amount, img: chipData.img,
            targetX: targetPos.x, targetY: targetPos.y,
            targetZoneId: data.zoneId,
        };
        setTableChips(prev => [...prev, newChip]);
    };

    const onBetLock = (data) => { setIsBetLocked(data.lock); };

    const onJackpotWon = (data) => {
        clearTimeout(jackpotWinTimerRef.current);
        setJackpotWinData(data);
        setJackpotAmount(0); // 視覺上立即歸零，等下一個 tick 更新種子金額
        jackpotWinTimerRef.current = setTimeout(() => setJackpotWinData(null), 8000);
    };

    const onBankerStatus  = (data) => setBankerStatus(data);
    const onBankerStarted = () => {}; // banker_status 廣播已更新狀態，iAmBanker 由 username 比對推導
    const onBankerEnded   = (data) => {
        setBankerEndPopup(data);
        setTimeout(() => setBankerEndPopup(null), 10000);
    };
    const onApplyResult = (res) => {
        setBankerApplying(false);
        if (res.success) {
            setShowBankerModal(false);
            setBankerFrozenInput('');
        } else {
            alert(res.msg || '申請失敗');
        }
    };
    const onCancelResult = (res) => {
        if (!res.success) alert(res.msg || '取消失敗');
        else setShowBankerManageModal(false);
    };
    const onQuitBankerResult = (res) => {
        if (!res.success) alert(res.msg || '下莊失敗');
        else setShowBankerManageModal(false);
    };

    socket.on('time_tick',        onTimeTick);
    socket.on('phase_change',     onPhaseChange);
    socket.on('init_state',       onInitState);
    socket.on('update_balance',   onUpdateBalance);
    socket.on('error_msg',        onErrorMsg);
    socket.on('login_response',   onLoginResponse);
    socket.on('auth_success',     onAuthSuccess);
    socket.on('update_table_bets', onUpdateTableBets);
    socket.on('bet_lock',         onBetLock);
    socket.on('jackpot_won',      onJackpotWon);
    socket.on('banker_status',        onBankerStatus);
    socket.on('banker_started',       onBankerStarted);
    socket.on('banker_ended',         onBankerEnded);
    socket.on('apply_banker_result',  onApplyResult);
    socket.on('cancel_apply_result',  onCancelResult);
    socket.on('quit_banker_result',   onQuitBankerResult);

    if (socket.connected) socket.emit('request_state');

    // 偵測使用者將應用切到背景再返回（最小化、切換 App 等）
    // 只有在初始化完成後才追蹤，避免切頁過渡動畫誤觸發
    const handleVisibilityChange = () => {
        if (!isFullyInitializedRef.current) return;
        if (document.visibilityState === 'hidden') {
            returnFromHiddenRef.current = true;
        } else if (document.visibilityState === 'visible' && returnFromHiddenRef.current) {
            if (socket.connected) socket.emit('request_state');
        }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        socket.off('time_tick',        onTimeTick);
        socket.off('phase_change',     onPhaseChange);
        socket.off('init_state',       onInitState);
        socket.off('update_balance',   onUpdateBalance);
        socket.off('error_msg',        onErrorMsg);
        socket.off('login_response',   onLoginResponse);
        socket.off('auth_success',     onAuthSuccess);
        socket.off('update_table_bets', onUpdateTableBets);
        socket.off('bet_lock',         onBetLock);
        socket.off('jackpot_won',      onJackpotWon);
        socket.off('banker_status',        onBankerStatus);
        socket.off('banker_started',       onBankerStarted);
        socket.off('banker_ended',         onBankerEnded);
        socket.off('apply_banker_result',  onApplyResult);
        socket.off('cancel_apply_result',  onCancelResult);
        socket.off('quit_banker_result',   onQuitBankerResult);
        clearTimeout(resultPopupTimerRef.current);
        clearTimeout(jackpotWinTimerRef.current);
    };
  }, [username]);

  // ── 莊家推導狀態（必須在所有參照它的 useEffect 之前宣告）────────
  const iAmBanker  = !!(bankerStatus.banker && bankerStatus.banker.username === username);
  useEffect(() => { iAmBankerRef.current = iAmBanker; }, [iAmBanker]);
  const iAmInQueue = !!(bankerStatus.queue?.some(q => q.username === username));

  // ── 做莊中離開頁面警告 ────────────────────────────────────────
  useEffect(() => {
    if (!iAmBanker) return;
    const handler = (e) => {
        e.preventDefault();
        e.returnValue = '您正在做莊中，離開或重整將強制下莊並結算！';
        return e.returnValue;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [iAmBanker]);

  useEffect(() => {
    setHistory(gameApp.history);
    gameApp.onHistoryChange = (newHistory) => setHistory(newHistory);
  }, []);

  // ── BGM：進入遊戲房啟動輕快流行，離房停止 ───────────────────────
  useEffect(() => {
    soundManager.startGameBGM();
    return () => soundManager.stopBGM();
  }, []);

  const handleApplyBanker = () => {
    const amount = parseInt(bankerFrozenInput.replace(/,/g, ''), 10);
    if (isNaN(amount)) return alert('請輸入有效金額');
    setBankerApplying(true);
    socket.emit('apply_banker', { frozenAmount: amount });
  };

  const handleCancelApply = () => {
    socket.emit('cancel_apply');
  };

  const handleQuitBanker = () => {
    if (!window.confirm('確認下莊？凍結金將依盈虧結算後退還。')) return;
    socket.emit('quit_banker');
  };

  // ── 下注 ─────────────────────────────────────────────────────
  const handleBetZone = (zoneId) => {
    if (!isBettingPhase || !isLoggedIn || isBetLocked || iAmBanker || showMidRoundNotice) return;
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
    setTotalContributions(prev => prev + Math.ceil(selectedChipVal * JACKPOT_RATE));

    const zoneEl    = zoneRefs.current[zoneId];
    const targetPos = getChipPosFromRect(zoneEl?.getBoundingClientRect());
    const chipData  = CHIPS.find(c => c.val === selectedChipVal);

    const newChip = {
        id: Date.now(),
        val: selectedChipVal, img: chipData.img,
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

      {/* ── 彩金得獎全螢幕彈窗 ── */}
      {jackpotWinData && (
        <div style={jackpotStyles.overlay} onClick={() => setJackpotWinData(null)}>
          <div style={jackpotStyles.panel} onClick={e => e.stopPropagation()}>
            <div style={jackpotStyles.title}>🎊 彩金觸發！</div>
            <div style={jackpotStyles.amount}>${jackpotWinData.jackpotPaid?.toLocaleString()}</div>
            <div style={jackpotStyles.subtitle}>
              {jackpotWinData.zones?.join('、')} 門開出 {jackpotWinData.handTypeName}
            </div>
            <div style={jackpotStyles.winnerList}>
              {jackpotWinData.winners?.slice(0, 5).map((w, i) => (
                <div key={i} style={jackpotStyles.winnerRow}>
                  <span style={jackpotStyles.winnerName}>{w.username}</span>
                  <span style={jackpotStyles.winnerZone}>{w.zone}門</span>
                  <span style={jackpotStyles.winnerAmt}>+${w.jackpotWon?.toLocaleString()}</span>
                </div>
              ))}
              {jackpotWinData.winners?.length > 5 && (
                <div style={{ color: '#aaa', fontSize: '0.8rem', textAlign: 'center', marginTop: 4 }}>
                  …等共 {jackpotWinData.winners.length} 人獲獎
                </div>
              )}
            </div>
            <div style={jackpotStyles.hint}>點擊任意處關閉</div>
          </div>
        </div>
      )}

      <div style={styles.backgroundLayer} />

      <div style={styles.container}>

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
                      ref={el => { zoneRefs.current[zone.id] = el; }}
                      style={{
                          ...styles.bettingZone,
                          position: 'absolute',
                          top: zone.top, left: zone.left,
                          width: zone.width, height: zone.height,
                          borderColor: isWinner ? '#ffd700' : (currentBets[zone.id] > 0 ? '#f1c40f' : 'rgba(255,255,255,0.1)'),
                          backgroundColor: isWinner ? 'rgba(255,215,0,0.4)' : 'rgba(0,0,0,0.05)',
                          boxShadow: isWinner ? '0 0 20px rgba(255,215,0,0.6), inset 0 0 20px rgba(255,215,0,0.3)' : 'none',
                          pointerEvents: (isBettingPhase && !isBetLocked && !iAmBanker) ? 'auto' : 'none',
                          opacity: (!isBettingPhase || isBetLocked || iAmBanker) ? 0.6 : 1,
                      }}
                      onClick={() => handleBetZone(zone.id)}
                    >
                        <div style={{...styles.zoneLabel, color: zone.color}}>{zone.label}</div>
                        {bankerStatus.hasBanker && bankerStatus.banker?.perZoneCap ? (
                            <div style={styles.zoneCapBadge}>
                                上限 ${bankerStatus.banker.perZoneCap.toLocaleString()}
                            </div>
                        ) : (
                            <div style={styles.zoneRate}>最高 7.6:1</div>
                        )}
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

        {/* 右下：籌碼選擇 */}
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
                          transform: selectedChipVal === chip.val ? 'scale(1.2) translateY(-8px)' : 'scale(1)',
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

      {/* 左下：餘額 + 總扣除（移出 container 避免 overflow 截斷） */}
      <div style={styles.bottomLeft}>
          <div style={styles.balanceBox}>
              <div style={styles.balanceLabel}>💰 餘額</div>
              <div style={styles.balanceNum}>$ {Number(balance).toLocaleString()}</div>
          </div>
          <div style={styles.betBox}>
              <div style={styles.balanceLabel}>🎯 總扣除</div>
              <div style={styles.balanceNum}>$ {Number(totalCurrentBet + totalContributions).toLocaleString()}</div>
              {totalContributions > 0 && (
                  <div style={{ fontSize: '0.55rem', color: '#D4AF37', marginTop: '1px', whiteSpace: 'nowrap' }}>
                      下注 ${Number(totalCurrentBet).toLocaleString()} + 彩金 ${Number(totalContributions).toLocaleString()}
                  </div>
              )}
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
      {/* 彩金池：獨立 fixed 定位，右上角，不干擾按鈕欄寬度 */}
      <div style={jackpotStyles.poolBar}>
          <div style={jackpotStyles.poolLabel}>🏆 彩金池</div>
          <div style={jackpotStyles.poolAmount}>${jackpotAmount.toLocaleString()}</div>
      </div>

      <div style={styles.fixedBtns}>
          <div onClick={handleBackToLobby} style={styles.iconBtnWrapper}>
              <img src={btnSettingsImg} style={styles.iconBtnImg} alt="設定" />
          </div>
          <div onClick={() => setShowTrend(true)} style={styles.trendBtn}>
              <span style={{ fontSize: '1.5rem', lineHeight: '1', display: 'block' }}>📊</span>
              <span style={{ fontSize: '0.6rem', color: '#D4AF37', fontWeight: 'bold', lineHeight: '1', display: 'block' }}>走勢</span>
          </div>
          <SmallBtn emoji="📜" label="紀錄" onClick={() => setShowBetHistory(true)} />
          {iAmBanker ? (
              <SmallBtn emoji="👑" label="做莊中" onClick={() => setShowBankerManageModal(true)} />
          ) : iAmInQueue ? (
              <SmallBtn emoji="⏳" label="排隊中" onClick={() => setShowBankerManageModal(true)} />
          ) : (
              <SmallBtn emoji="🏦" label="申請上莊" onClick={() => setShowBankerModal(true)} />
          )}
      </div>

      {/* 莊家資訊面板 */}
      <BankerPanel bankerStatus={bankerStatus} iAmBanker={iAmBanker} />

      {/* ↓ 以下所有 overlay 必須在 container 外，否則被 zIndex:20 stacking context 鎖住 */}

      {showTrend && <TrendBoard history={history} onClose={() => setShowTrend(false)} />}

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      {showBetHistory && <BetHistoryModal history={betHistory} onClose={() => setShowBetHistory(false)} />}

      {showSettingsModal && (
          <div style={styles.modalOverlay} onClick={() => setShowSettingsModal(false)}>
              <div style={styles.modalPanel} onClick={e => e.stopPropagation()}>
                  <div style={styles.modalTitle}>設定</div>

                  {/* 音效切換 */}
                  <div style={styles.settingRow} onClick={() => {
                      const enabled = soundManager.toggle();
                      setSoundEnabled(enabled);
                      if (enabled) soundManager.resumeBGM('game');
                  }}>
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

      {/* 莊家管理 Modal（排隊中 / 做莊中 共用） */}
      {showBankerManageModal && (
          <div style={styles.modalOverlay} onClick={() => setShowBankerManageModal(false)}>
              <div style={bankerStyles.applyPanel} onClick={e => e.stopPropagation()}>
                  {iAmBanker ? (
                      <>
                          <div style={styles.modalTitle}>👑 做莊管理</div>
                          <div style={bankerStyles.applyInfoBox}>
                              <div style={bankerStyles.applyInfoRow}>
                                  莊家
                                  <span style={{ color: '#FFD700', fontWeight: 800 }}>{bankerStatus.banker?.username}</span>
                              </div>
                              <div style={bankerStyles.applyInfoRow}>
                                  凍結金
                                  <span>${bankerStatus.banker?.initialFrozen?.toLocaleString()}</span>
                              </div>
                              <div style={bankerStyles.applyInfoRow}>
                                  每門上限
                                  <span style={{ color: '#FFD700', fontWeight: 700 }}>${bankerStatus.banker?.perZoneCap?.toLocaleString()}</span>
                              </div>
                              <div style={bankerStyles.applyInfoRow}>
                                  已做局數
                                  <span>{bankerStatus.banker?.roundsPlayed} / 10 局</span>
                              </div>
                              <div style={{ ...bankerStyles.applyInfoRow, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8, marginTop: 4 }}>
                                  當前盈虧
                                  <span style={{
                                      fontWeight: 800,
                                      color: (bankerStatus.banker?.netPnl ?? 0) >= 0 ? '#4caf50' : '#ef5350',
                                  }}>
                                      {(bankerStatus.banker?.netPnl ?? 0) >= 0 ? '+' : ''}${bankerStatus.banker?.netPnl?.toLocaleString() ?? 0}
                                  </span>
                              </div>
                          </div>
                          <button style={{ ...styles.modalBtnLogout, marginTop: '12px' }} onClick={handleQuitBanker}>
                              申請下莊
                          </button>
                      </>
                  ) : (
                      <>
                          <div style={styles.modalTitle}>⏳ 排隊管理</div>
                          <div style={bankerStyles.applyInfoBox}>
                              {(() => {
                                  const myQ = bankerStatus.queue?.find(q => q.username === username);
                                  return myQ ? (
                                      <>
                                          <div style={bankerStyles.applyInfoRow}>
                                              排隊位置
                                              <span style={{ color: '#FFD700', fontWeight: 800 }}>第 {myQ.position} 位</span>
                                          </div>
                                          <div style={bankerStyles.applyInfoRow}>
                                              凍結金
                                              <span>${myQ.frozenAmount?.toLocaleString()}</span>
                                          </div>
                                          <div style={bankerStyles.applyInfoRow}>
                                              預計每門上限
                                              <span>${myQ.perZoneCap?.toLocaleString()}</span>
                                          </div>
                                      </>
                                  ) : <div style={{ color: '#aaa', fontSize: '0.85rem' }}>找不到排隊資訊</div>;
                              })()}
                              {bankerStatus.hasBanker && bankerStatus.banker && (
                                  <div style={{ ...bankerStyles.applyInfoRow, marginTop: 6 }}>
                                      前方莊家
                                      <span>{bankerStatus.banker.username}（剩 {bankerStatus.banker.roundsLeft} 局）</span>
                                  </div>
                              )}
                          </div>
                          <button style={{ ...styles.modalBtnLogout, marginTop: '12px' }} onClick={handleCancelApply}>
                              取消排隊（退還凍結金）
                          </button>
                      </>
                  )}
                  <button style={styles.modalBtnCancel} onClick={() => setShowBankerManageModal(false)}>關閉</button>
              </div>
          </div>
      )}

      {/* 申請上莊 Modal */}
      {showBankerModal && (
          <div style={styles.modalOverlay} onClick={() => { setShowBankerModal(false); setBankerFrozenInput(''); }}>
              <div style={bankerStyles.applyPanel} onClick={e => e.stopPropagation()}>
                  <div style={styles.modalTitle}>🏦 申請上莊</div>

                  <div style={bankerStyles.applyInfoBox}>
                      <div style={bankerStyles.applyInfoRow}>最低凍結金<span>${bankerStatus.minFrozen?.toLocaleString()}</span></div>
                      <div style={bankerStyles.applyInfoRow}>排隊人數<span>{bankerStatus.queueCount} / {bankerStatus.queueLimit}</span></div>
                      {bankerStatus.hasBanker && bankerStatus.banker && (
                          <div style={bankerStyles.applyInfoRow}>目前莊家<span>{bankerStatus.banker.username}（剩 {bankerStatus.banker.roundsLeft} 局）</span></div>
                      )}
                  </div>

                  <div style={bankerStyles.applyLabel}>凍結金額（從餘額扣除，下莊後歸還）</div>
                  <input
                      type="number"
                      value={bankerFrozenInput}
                      onChange={e => setBankerFrozenInput(e.target.value)}
                      placeholder={`最低 $${bankerStatus.minFrozen?.toLocaleString()}`}
                      style={bankerStyles.applyInput}
                  />
                  {bankerFrozenInput && !isNaN(parseInt(bankerFrozenInput)) && parseInt(bankerFrozenInput) >= (bankerStatus.minFrozen || 0) && (
                      <div style={bankerStyles.applyPreview}>
                          預計每門上限：<b>${Math.floor(parseInt(bankerFrozenInput) / 34.4).toLocaleString()}</b>
                      </div>
                  )}

                  <button
                      style={{ ...styles.modalBtnLobby, marginTop: '12px', opacity: bankerApplying ? 0.6 : 1 }}
                      onClick={handleApplyBanker}
                      disabled={bankerApplying}
                  >
                      {bankerApplying ? '處理中…' : '確認申請'}
                  </button>
                  <button style={styles.modalBtnCancel} onClick={() => { setShowBankerModal(false); setBankerFrozenInput(''); }}>取消</button>
              </div>
          </div>
      )}

      {/* 莊家下莊結算彈窗 */}
      {bankerEndPopup && (
          <div style={styles.resultPopupWrap} onClick={() => setBankerEndPopup(null)}>
              <div style={{ ...styles.resultPopupCard, minWidth: '220px' }}>
                  <div style={styles.resultPopupTitle}>
                      {bankerEndPopup.isForced ? '⚠️ 強制下莊' : '✅ 任期結束'}
                  </div>
                  <div style={styles.resultRows}>
                      <div style={styles.resultRow}>
                          <span>做莊局數</span>
                          <span>{bankerEndPopup.roundsPlayed} 局</span>
                      </div>
                      <div style={styles.resultRow}>
                          <span>退還凍結金</span>
                          <span>${bankerEndPopup.finalFrozen?.toLocaleString()}</span>
                      </div>
                      <div style={styles.resultDivider} />
                  </div>
                  <div style={{
                      ...styles.resultNet,
                      color: bankerEndPopup.netPnl >= 0 ? '#4caf50' : '#ef5350',
                  }}>
                      {bankerEndPopup.netPnl >= 0 ? '+' : ''}{bankerEndPopup.netPnl?.toLocaleString()}
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

// ─── 莊家資訊面板元件 ─────────────────────────────────────────
const BankerPanel = ({ bankerStatus, iAmBanker }) => {
    const b = bankerStatus?.banker;
    const hasHumanBanker = !!(bankerStatus?.hasBanker && b);

    return (
        <div style={bankerPanelStyles.wrap}>
            <div style={bankerPanelStyles.iconRow}>
                <span style={bankerPanelStyles.crown}>
                    {hasHumanBanker ? '👑' : '🏦'}
                </span>
                <span style={bankerPanelStyles.title}>
                    {hasHumanBanker ? '真人莊家' : '電腦莊家'}
                </span>
            </div>

            {hasHumanBanker ? (
                <>
                    <div style={bankerPanelStyles.name}>{b.username}</div>
                    <div style={bankerPanelStyles.row}>
                        <span style={bankerPanelStyles.label}>剩餘</span>
                        <span style={bankerPanelStyles.value}>{b.roundsLeft} 局</span>
                    </div>
                    <div style={bankerPanelStyles.row}>
                        <span style={bankerPanelStyles.label}>每門上限</span>
                        <span style={{...bankerPanelStyles.value, color: '#FFD700', fontWeight: 800}}>
                            ${b.perZoneCap?.toLocaleString()}
                        </span>
                    </div>
                    {iAmBanker && (
                        <div style={bankerPanelStyles.pnlRow}>
                            <span style={bankerPanelStyles.label}>盈虧</span>
                            <span style={{
                                ...bankerPanelStyles.value,
                                color: b.netPnl >= 0 ? '#4caf50' : '#ef5350',
                                fontWeight: 800,
                            }}>
                                {b.netPnl >= 0 ? '+' : ''}${b.netPnl?.toLocaleString()}
                            </span>
                        </div>
                    )}
                </>
            ) : (
                <div style={bankerPanelStyles.sub}>系統自動結算</div>
            )}
        </div>
    );
};

const bankerPanelStyles = {
    wrap: {
        position: 'fixed',
        top: 'max(10px, calc(env(safe-area-inset-top) + 6px))',
        left: 'max(10px, calc(env(safe-area-inset-left) + 10px))',
        zIndex: 9997,
        background: 'linear-gradient(160deg, rgba(18,12,2,0.92), rgba(40,28,4,0.92))',
        border: '1px solid rgba(212,175,55,0.45)',
        borderRadius: '14px',
        padding: '10px 14px',
        minWidth: '110px',
        maxWidth: '150px',
        pointerEvents: 'none',
        boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
    },
    iconRow: {
        display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px',
    },
    crown: { fontSize: '1rem' },
    title: {
        fontSize: '0.62rem', color: 'rgba(212,175,55,0.8)',
        fontWeight: 700, letterSpacing: '0.03em',
    },
    name: {
        fontSize: '0.85rem', color: '#FFD700', fontWeight: 800,
        marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    },
    row: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '3px',
    },
    pnlRow: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginTop: '4px', paddingTop: '4px',
        borderTop: '1px solid rgba(212,175,55,0.2)',
    },
    label: { fontSize: '0.62rem', color: 'rgba(255,255,255,0.5)' },
    value: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.85)' },
    sub:   { fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', marginTop: '2px' },
};

// ─── 籌碼動畫元件 ─────────────────────────────────────────────
const ChipOnTable = ({ chip, index }) => {
    const elRef = useRef(null);
    useEffect(() => {
        gsap.fromTo(elRef.current,
            { x: chip.targetX, y: chip.targetY - 25, opacity: 0, scale: 0.1 },
            { x: chip.targetX, y: chip.targetY, scale: 0.5, opacity: 1, duration: 0.4, ease: "back.out(1.5)" }
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
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      padding: '10px',
  },
  // 右側固定按鈕群：position:fixed 脫離所有 stacking context
  fixedBtns: {
      position: 'fixed',
      top: 'max(10px, calc(env(safe-area-inset-top) + 6px))',
      right: 'max(10px, calc(env(safe-area-inset-right) + 10px))',
      zIndex: 9997,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '5px',
      pointerEvents: 'auto',
  },
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
  zoneCapBadge: {
      color: '#FFD700', fontSize: '0.72rem', fontWeight: 700,
      border: '1px solid rgba(212,175,55,0.6)',
      background: 'rgba(212,175,55,0.12)',
      padding: '2px 6px', borderRadius: '6px',
  },
  zoneTotalBet: { marginTop: 'auto', marginBottom: '5px', color: '#f1c40f', fontWeight: 'bold', fontSize: '0.9rem', background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: '4px' },
  winBadge: {
      position: 'absolute', top: '-15px',
      background: 'linear-gradient(180deg, #ffd700 0%, #ff8f00 100%)',
      color: '#3e2723', fontSize: '0.8rem', fontWeight: 'bold',
      padding: '2px 10px', borderRadius: '20px', border: '2px solid #fff', zIndex: 10,
  },
  bottomBar: { display: 'none' },
  bottomInfoRow: {},
  bottomLeftGroup: {},
  // 左下固定：餘額 + 總扣除
  bottomLeft: {
      position: 'fixed',
      bottom: 'max(18px, calc(env(safe-area-inset-bottom) + 10px))',
      left: 'max(10px, calc(env(safe-area-inset-left) + 10px))',
      zIndex: 9990,
      display: 'flex',
      flexDirection: 'row',
      gap: '6px',
      alignItems: 'flex-end',
      pointerEvents: 'auto',
  },
  balanceBox: {
      background: 'linear-gradient(180deg, #f1c40f 0%, #f57f17 100%)',
      border: '2px solid #fffde7', borderRadius: '8px',
      padding: '4px 10px', boxShadow: '0 4px 0 #bf360c',
  },
  betBox: {
      background: 'linear-gradient(180deg, #29b6f6 0%, #0288d1 100%)',
      border: '2px solid #e1f5fe', borderRadius: '8px',
      padding: '4px 10px', boxShadow: '0 4px 0 #01579b',
  },
  balanceLabel: { fontSize: '0.6rem', color: '#3e2723', fontWeight: 'bold', whiteSpace: 'nowrap' },
  balanceNum:   { fontSize: '0.88rem', color: '#3e2723', fontWeight: 'bold', whiteSpace: 'nowrap' },
  // 右下固定：籌碼
  chipsRow: {
      position: 'fixed',
      bottom: 'max(18px, calc(env(safe-area-inset-bottom) + 10px))',
      right: 'max(10px, calc(env(safe-area-inset-right) + 10px))',
      zIndex: 9990,
      display: 'flex',
      flexDirection: 'row',
      gap: '6px',
      alignItems: 'flex-end',
      pointerEvents: 'auto',
  },
  chipWrapper: {
      width: '48px', height: '48px',
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
      pointerEvents: 'all',
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

// ─── 彩金池樣式 ───────────────────────────────────────────────
const jackpotStyles = {
  poolBar: {
    position: 'fixed',
    top: 'max(10px, calc(env(safe-area-inset-top) + 6px))',
    right: 'max(70px, calc(env(safe-area-inset-right) + 70px))',
    zIndex: 9997,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    background: 'linear-gradient(135deg, rgba(180,120,0,0.35), rgba(255,215,0,0.15))',
    border: '1px solid rgba(255,215,0,0.5)', borderRadius: '10px',
    padding: '4px 14px', minWidth: '110px',
    pointerEvents: 'none',
  },
  poolLabel: { fontSize: '0.6rem', color: '#D4AF37', letterSpacing: '0.08em', fontWeight: 700 },
  poolAmount: { fontSize: '1rem', color: '#FFD700', fontWeight: 900, letterSpacing: '0.02em' },

  overlay: {
    position: 'fixed', inset: 0, zIndex: 99999,
    background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  panel: {
    background: 'linear-gradient(160deg, #1a1200, #2d1f00)',
    border: '2px solid #FFD700', borderRadius: '24px',
    padding: '36px 40px', maxWidth: '420px', width: '90%',
    boxShadow: '0 0 60px rgba(255,215,0,0.4), 0 0 120px rgba(255,165,0,0.2)',
    textAlign: 'center',
  },
  title:   { fontSize: '1.6rem', fontWeight: 900, color: '#FFD700', marginBottom: 8 },
  amount:  { fontSize: '2.8rem', fontWeight: 900, color: '#FFD700', margin: '8px 0',
             textShadow: '0 0 20px rgba(255,215,0,0.8)' },
  subtitle:{ fontSize: '1rem', color: '#FFA500', marginBottom: 20, fontWeight: 600 },
  winnerList: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 },
  winnerRow:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'rgba(255,215,0,0.08)', borderRadius: 8, padding: '6px 14px' },
  winnerName: { color: '#fff', fontWeight: 700, fontSize: '0.9rem' },
  winnerZone: { color: '#aaa', fontSize: '0.8rem' },
  winnerAmt:  { color: '#4caf50', fontWeight: 800, fontSize: '0.95rem' },
  hint:       { color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' },
};

// ─── 莊家系統樣式（申請上莊 Modal 用）────────────────────────
const bankerStyles = {
  applyPanel: {
    background: 'rgba(12,10,4,0.97)', border: '1px solid rgba(212,175,55,0.45)',
    borderRadius: '20px', padding: '28px 24px', width: '90%', maxWidth: '340px',
    display: 'flex', flexDirection: 'column', gap: '8px',
    boxShadow: '0 0 40px rgba(0,0,0,0.8)',
  },
  applyInfoBox: {
    background: 'rgba(255,255,255,0.04)', borderRadius: '10px',
    padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px',
  },
  applyInfoRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)',
  },
  applyLabel: { fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: '4px' },
  applyInput: {
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(212,175,55,0.3)',
    borderRadius: '10px', padding: '10px 14px', color: '#fff',
    fontSize: '1rem', fontFamily: 'inherit', outline: 'none', width: '100%',
    boxSizing: 'border-box',
  },
  applyPreview: {
    fontSize: '0.82rem', color: '#D4AF37', textAlign: 'center',
    background: 'rgba(212,175,55,0.1)', borderRadius: '8px', padding: '6px',
  },
};

export default GameUI;
