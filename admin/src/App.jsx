import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';

const API_URL      = (import.meta.env.VITE_API_URL || "http://localhost:3001") + "/api/admin";
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || "Prestige_Admin_X7k9_2026";
const H            = { headers: { 'x-admin-secret': ADMIN_SECRET } };

const ZONE_META = {
  banker: { label: '😈 莊家', color: '#ef4444' },
  tian:   { label: '🔵 天門', color: '#2563eb' },
  di:     { label: '🟡 地門', color: '#d97706' },
  xuan:   { label: '🟢 玄門', color: '#16a34a' },
  huang:  { label: '🔴 黃門', color: '#dc2626' },
};

const HAND_TYPES = [
  { value: 'FIVE_SMALL',    label: '五小妞 (8×)' },
  { value: 'BOMB',          label: '鐵支妞 (6×)' },
  { value: 'FULL_HOUSE',    label: '葫蘆妞 (6×)' },
  { value: 'STRAIGHT_FLUSH',label: '同花順 (6×)' },
  { value: 'FIVE_KNIGHTS',  label: '五龍妞 (5×)' },
  { value: 'SILVER_NIU',    label: '銀花妞 (5×)' },
  { value: 'NIU_NIU',       label: '妞妞 (3×)'  },
  { value: 'NIU_9',         label: '妞9 (2×)'   },
  { value: 'NIU_8',         label: '妞8 (2×)'   },
  { value: 'NIU_7',         label: '妞7 (1×)'   },
  { value: 'NIU_6',         label: '妞6 (1×)'   },
  { value: 'NIU_5',         label: '妞5 (1×)'   },
  { value: 'NIU_4',         label: '妞4 (1×)'   },
  { value: 'NIU_3',         label: '妞3 (1×)'   },
  { value: 'NIU_2',         label: '妞2 (1×)'   },
  { value: 'NIU_1',         label: '妞1 (1×)'   },
  { value: 'NO_NIU',        label: '沒妞 (1×)'  },
];

const SUIT_SYMBOL = { s:'♠', h:'♥', d:'♦', c:'♣' };
const SUIT_NAME   = { s:'黑桃', h:'紅心', d:'方塊', c:'梅花' };
const RANK_LABEL  = { 1:'A', 11:'J', 12:'Q', 13:'K' };
const fmt = (n) => Number(n || 0).toLocaleString();

const PHASE_LABELS = {
  BETTING:   '下注中',
  DEALING:   '發牌中',
  SQUEEZING: '咪牌中',
  RESULT:    '結算中',
};

// ─── 單張牌 ──────────────────────────────────────────────────────
const CardView = ({ card }) => {
  if (!card) return null;
  const isRed = card.suit==='h' || card.suit==='d';
  const rank  = RANK_LABEL[card.rank] ?? card.rank;
  return (
    <div className={`card-simple ${isRed?'red':'black'}`}>
      <div className="card-suit">{SUIT_SYMBOL[card.suit]}</div>
      <div className="card-rank">{rank}</div>
      <div className="card-label-small">{SUIT_NAME[card.suit]}{rank}</div>
    </div>
  );
};

const ResultBadge = ({ result }) => {
  if (!result) return null;
  return (
    <div className="result-info">
      <span className="type-label">{result.typeName ?? result.label ?? '計算中'}</span>
      <span className="multiplier">×{result.multiplier ?? '?'}</span>
    </div>
  );
};

// ─── 區域卡片 ────────────────────────────────────────────────────
const ZoneCard = ({ zone, hand, result, winner, bet, isSelected, isLocked, onClick, onForceHand, pickerOpen, onPickerToggle, isForcing }) => {
  const meta = ZONE_META[zone] ?? { label: zone, color: '#6b7280' };

  let cls = 'zone-box';
  if (isLocked)         cls += ' locked';
  else if (isSelected)  cls += ' selected';
  if (winner===true)    cls += ' is-winner';
  else if (winner===false) cls += ' is-loser';

  const handleClick = () => {
    if (isLocked) return;
    onClick();
  };

  return (
    <div className={cls} onClick={handleClick}>
      {/* Header */}
      <div className="zone-header">
        <h3 style={{ color: meta.color }}>{meta.label}</h3>
        <div className="bull-tag">
          <ResultBadge result={result} />
          {winner===true  && <span className="win-badge">WIN</span>}
          {winner===false && <span className="lose-badge">LOSE</span>}
        </div>
      </div>

      {/* Cards */}
      <div className="cards-display-area">
        {hand ? (
          <div className="cards-row">{hand.map((c,i)=><CardView key={i} card={c}/>)}</div>
        ) : (
          <div className="waiting-text">等待發牌…</div>
        )}
      </div>

      {/* Bet row (閒家才顯示) */}
      {zone !== 'banker' && (
        <div className="zone-bet-row">
          <span className="zone-bet-label">即時投注</span>
          <strong className={`zone-bet-amount${(!bet||bet===0)?' zero':''}`}>
            {bet ? `$${fmt(bet)}` : '$0'}
          </strong>
        </div>
      )}

      {/* Force-hand toolbar */}
      <div className="force-hand-bar" onClick={e=>e.stopPropagation()}>
        {pickerOpen ? (
          <select
            className="hand-type-select"
            defaultValue=""
            onChange={e=>{const v=e.target.value;if(!v)return;e.target.value='';onPickerToggle(null);onForceHand(zone,v);}}
          >
            <option value="" disabled>── 選擇牌型 ──</option>
            {HAND_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        ) : (
          <button
            className="force-btn"
            disabled={isForcing || isLocked}
            onClick={()=>{ if(!isLocked) onPickerToggle(zone); }}
          >
            🎯 指定牌型
          </button>
        )}
      </div>

      {isSelected && <div className="selection-overlay">✦ 已選取，請點擊交換目標</div>}
    </div>
  );
};

// ─── Tabs ────────────────────────────────────────────────────────
const TABS = [
  { id:'board',    label:'🃏 牌局控制' },
  { id:'players',  label:'👥 在線玩家' },
  { id:'balance',  label:'💰 餘額管理' },
  { id:'history',  label:'📋 歷史記錄' },
  { id:'rounds',   label:'📊 牌局紀錄' },
  { id:'announce', label:'📢 公告推播' },
  { id:'settings', label:'⚙️ 勝率設定' },
  { id:'jackpot',  label:'🏆 彩金池' },
  { id:'banker',   label:'👑 莊家管理' },
];

// ─── Main ────────────────────────────────────────────────────────
function App() {
  const [gameState,    setGameState]    = useState(null);
  const [clockTime,    setClockTime]    = useState('');
  const [activeTab,    setActiveTab]    = useState('board');
  const [selectedZone, setSelectedZone] = useState(null);
  const [pickerZone,   setPickerZone]   = useState(null);
  const [isForcing,    setIsForcing]    = useState(false);
  const [lastMessage,  setLastMessage]  = useState('系統就緒');
  // players tab
  const [players,       setPlayers]       = useState([]);
  const [loadingPlayers,setLoadingPlayers] = useState(false);
  // balance tab
  const [adjUsername,  setAdjUsername]   = useState('');
  const [adjAmount,    setAdjAmount]     = useState('');
  const [adjResult,    setAdjResult]     = useState(null);
  // history tab
  const [history,        setHistory]        = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  // announce tab
  const [announceMsg,     setAnnounceMsg]     = useState('');
  const [sentAnnouncements, setSentAnnouncements] = useState([]);
  // settings tab
  const [bannedTypes,    setBannedTypes]    = useState(new Set());
  const [loadingBanned,  setLoadingBanned]  = useState(false);
  // banker tab
  const [bankerInfo,        setBankerInfo]        = useState(null);
  const [bankerHistory,     setBankerHistory]     = useState([]);
  const [bankerHistPage,    setBankerHistPage]    = useState(1);
  const [bankerHistTotal,   setBankerHistTotal]   = useState(0);
  const [kickingBanker,     setKickingBanker]     = useState(false);
  // jackpot tab
  const [jackpotStatus,     setJackpotStatus]     = useState(null);
  const [jackpotConfigs,    setJackpotConfigs]     = useState([]); // [{ hand_type, payout_rate, is_enabled }]
  const [jackpotHistory,    setJackpotHistory]     = useState([]);
  const [jackpotHistPage,   setJackpotHistPage]    = useState(1);
  const [jackpotHistTotal,  setJackpotHistTotal]   = useState(0);
  const [jackpotAdjDelta,   setJackpotAdjDelta]    = useState('');
  const [savingJackpot,     setSavingJackpot]      = useState(false);
  // rounds tab
  const [rounds,          setRounds]          = useState([]);
  const [roundsTotal,     setRoundsTotal]     = useState(0);
  const [roundsPage,      setRoundsPage]      = useState(1);
  const [roundsStats,     setRoundsStats]     = useState(null);
  const [loadingRounds,   setLoadingRounds]   = useState(false);
  const [statsN,          setStatsN]          = useState(100);

  const fetchStatus = useCallback(async () => {
    try { const r = await axios.get(`${API_URL}/preview`, H); setGameState(r.data); }
    catch {}
  }, []);

  useEffect(() => {
    const id = setInterval(fetchStatus, 1000);
    fetchStatus();
    return () => clearInterval(id);
  }, [fetchStatus]);

  // 即時時鐘
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClockTime(now.toLocaleTimeString('zh-TW', { hour12: false }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (activeTab !== 'players') return;
    const load = async () => {
      setLoadingPlayers(true);
      try { const r = await axios.get(`${API_URL}/online-players`, H); setPlayers(r.data); }
      catch {} finally { setLoadingPlayers(false); }
    };
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [activeTab]);

  useEffect(() => { if (activeTab==='history') fetchHistory(); }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'settings') return;
    const load = async () => {
      setLoadingBanned(true);
      try {
        const r = await axios.get(`${API_URL}/banned-types`, H);
        setBannedTypes(new Set(r.data.bannedTypes));
      } catch {} finally { setLoadingBanned(false); }
    };
    load();
  }, [activeTab]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try { const r = await axios.get(`${API_URL}/round-history?limit=30`, H); setHistory(r.data); }
    catch {} finally { setLoadingHistory(false); }
  };

  const fetchRounds = useCallback(async (page = roundsPage) => {
    setLoadingRounds(true);
    try {
      const [r, s] = await Promise.all([
        axios.get(`${API_URL}/game-rounds?page=${page}&limit=30`, H),
        axios.get(`${API_URL}/game-rounds/stats?n=${statsN}`, H),
      ]);
      setRounds(r.data.rows || []);
      setRoundsTotal(r.data.total || 0);
      setRoundsStats(s.data);
    } catch {} finally { setLoadingRounds(false); }
  }, [roundsPage, statsN]);

  useEffect(() => { if (activeTab === 'rounds') fetchRounds(roundsPage); }, [activeTab, roundsPage, statsN]);

  const isBettingPhase = gameState?.status === 'BETTING';

  // ── Controls ──
  const control = async (action, seconds) => {
    try {
      await axios.post(`${API_URL}/control`, { action, seconds }, H);
      setLastMessage(action==='pause'?'⏸️ 已暫停':action==='resume'?'▶️ 已恢復':`⏰ 已延長 ${seconds||30}s`);
      fetchStatus();
    } catch { setLastMessage('❌ 操作失敗'); }
  };

  // ── 換牌 (僅 BETTING 階段) ──
  const handleZoneClick = async (zone) => {
    if (!isBettingPhase) { setLastMessage('⚠️ 發牌進行中，禁止換牌'); return; }
    if (!gameState?.hands?.[zone]) return;
    if (!selectedZone) { setSelectedZone(zone); return; }
    if (selectedZone===zone) { setSelectedZone(null); return; }
    const a = ZONE_META[selectedZone]?.label; const b = ZONE_META[zone]?.label;
    if (!window.confirm(`確定要交換 ${a} 與 ${b} 的手牌？`)) { setSelectedZone(null); return; }
    try {
      await axios.post(`${API_URL}/swap-hand`, { pos1: selectedZone, pos2: zone }, H);
      setLastMessage(`✅ 已交換：${a} ↔ ${b}`);
      setSelectedZone(null); fetchStatus();
    } catch { alert('交換失敗'); setSelectedZone(null); }
  };

  // ── 指定牌型 (僅 BETTING 階段) ──
  const handleForceHand = async (zone, handType) => {
    if (!isBettingPhase) { setLastMessage('⚠️ 發牌進行中，禁止指定牌型'); return; }
    const label    = HAND_TYPES.find(t=>t.value===handType)?.label ?? handType;
    const zoneName = ZONE_META[zone]?.label ?? zone;
    setIsForcing(true);
    setLastMessage(`⏳ 為 ${zoneName} 生成 ${label}…`);
    try {
      await axios.post(`${API_URL}/force-hand`, { zone, handType }, H);
      setLastMessage(`✅ ${zoneName} 已指定為 ${label}`);
      fetchStatus();
    } catch (err) {
      const msg = err.response?.data?.error || '指定牌型失敗';
      setLastMessage(`❌ ${msg}`); alert(msg);
    } finally { setIsForcing(false); }
  };

  // ── 踢除 ──
  const kickPlayer = async (socketId, username) => {
    if (!window.confirm(`確定要踢除 ${username}？`)) return;
    try {
      await axios.post(`${API_URL}/kick-player`, { socketId }, H);
      setLastMessage(`✅ 已踢除 ${username}`);
      setPlayers(prev=>prev.filter(p=>p.socketId!==socketId));
    } catch (err) { alert(err.response?.data?.error||'踢除失敗'); }
  };

  // ── 調整餘額 ──
  const adjustBalance = async () => {
    if (!adjUsername.trim() || !adjAmount) return alert('請填寫帳號與金額');
    const n = Number(adjAmount);
    if (isNaN(n)||n===0) return alert('金額必須為非零數字');
    try {
      const r = await axios.post(`${API_URL}/adjust-balance`, { username: adjUsername.trim(), amount: n }, H);
      setAdjResult({ ok:true, msg:`${adjUsername} 新餘額：$${fmt(r.data.newBalance)}` });
      setAdjUsername(''); setAdjAmount('');
      setLastMessage(`✅ 已調整 ${adjUsername} 餘額`);
    } catch (err) { setAdjResult({ ok:false, msg:err.response?.data?.error||'調整失敗' }); }
  };

  // ── 彩金池 ──
  const fetchJackpotData = useCallback(async (page = 1) => {
    try {
      const [statusRes, configRes, histRes] = await Promise.all([
        axios.get(`${API_URL}/jackpot/status`, H),
        axios.get(`${API_URL}/jackpot/config`,  H),
        axios.get(`${API_URL}/jackpot/history?page=${page}&limit=10`, H),
      ]);
      setJackpotStatus(statusRes.data);
      // 若後台尚無設定，給空陣列讓使用者自行新增
      setJackpotConfigs(configRes.data.length > 0 ? configRes.data : []);
      setJackpotHistory(histRes.data.rows || []);
      setJackpotHistTotal(histRes.data.total || 0);
      setJackpotHistPage(page);
    } catch {}
  }, []);

  useEffect(() => {
    if (activeTab !== 'jackpot') return;
    fetchJackpotData(1);
    const id = setInterval(() => {
      axios.get(`${API_URL}/jackpot/status`, H).then(r => setJackpotStatus(r.data)).catch(()=>{});
    }, 3000);
    return () => clearInterval(id);
  }, [activeTab, fetchJackpotData]);

  const saveJackpotConfig = async () => {
    setSavingJackpot(true);
    try {
      await axios.post(`${API_URL}/jackpot/config`, { configs: jackpotConfigs }, H);
      setLastMessage(`✅ 彩金設定已儲存`);
    } catch { setLastMessage('❌ 儲存失敗'); }
    finally { setSavingJackpot(false); }
  };

  const adjustJackpotPool = async () => {
    const delta = Number(jackpotAdjDelta);
    if (!jackpotAdjDelta || isNaN(delta) || delta === 0) return alert('請輸入非零數字');
    if (!window.confirm(`確定要 ${delta > 0 ? '增加' : '扣除'} $${Math.abs(delta).toLocaleString()} 嗎？`)) return;
    try {
      const r = await axios.post(`${API_URL}/jackpot/adjust`, { delta }, H);
      setLastMessage(`✅ 彩金池已調整，目前：$${r.data.newAmount.toLocaleString()}`);
      setJackpotAdjDelta('');
      fetchJackpotData(jackpotHistPage);
    } catch (e) { alert(e.response?.data?.error || '調整失敗'); }
  };

  const fetchBankerData = useCallback(async (page = 1) => {
    try {
      const [statusRes, histRes] = await Promise.all([
        axios.get(`${API_URL}/banker/status`, H),
        axios.get(`${API_URL}/banker/history?page=${page}&limit=10`, H),
      ]);
      setBankerInfo(statusRes.data);
      setBankerHistory(histRes.data.rows || []);
      setBankerHistTotal(histRes.data.total || 0);
      setBankerHistPage(page);
    } catch {}
  }, []);

  useEffect(() => {
    if (activeTab !== 'banker') return;
    fetchBankerData(1);
    const id = setInterval(() => {
      axios.get(`${API_URL}/banker/status`, H).then(r => setBankerInfo(r.data)).catch(()=>{});
    }, 2000);
    return () => clearInterval(id);
  }, [activeTab, fetchBankerData]);

  const kickBanker = async () => {
    if (!window.confirm('確定要強制踢除目前莊家？')) return;
    setKickingBanker(true);
    try {
      await axios.post(`${API_URL}/banker/kick`, {}, H);
      setLastMessage('✅ 已強制踢除莊家');
      fetchBankerData(bankerHistPage);
    } catch (e) { alert(e.response?.data?.error || '踢除失敗'); }
    finally { setKickingBanker(false); }
  };

  const addJackpotConfig = () => {
    setJackpotConfigs(prev => [...prev, { hand_type: 'FIVE_SMALL', payout_rate: 1.0, is_enabled: 1 }]);
  };

  const removeJackpotConfig = (idx) => {
    setJackpotConfigs(prev => prev.filter((_, i) => i !== idx));
  };

  const updateJackpotConfig = (idx, field, value) => {
    setJackpotConfigs(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  // ── 禁牌 ──
  const toggleBannedType = (type) => {
    setBannedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const saveBannedTypes = async () => {
    setLoadingBanned(true);
    try {
      await axios.post(`${API_URL}/set-banned-types`, { types: [...bannedTypes] }, H);
      setLastMessage(`✅ 禁止牌型已儲存 (${bannedTypes.size} 種)`);
    } catch { setLastMessage('❌ 儲存失敗'); }
    finally { setLoadingBanned(false); }
  };

  // ── 公告 ──
  const sendAnnouncement = async () => {
    if (!announceMsg.trim()) return alert('請輸入公告內容');
    try {
      await axios.post(`${API_URL}/announce`, { message: announceMsg.trim() }, H);
      setSentAnnouncements(prev=>[{ msg:announceMsg.trim(), time:new Date().toLocaleTimeString() }, ...prev].slice(0,10));
      setAnnounceMsg(''); setLastMessage('✅ 公告已推播');
    } catch { alert('推播失敗'); }
  };

  if (!gameState) return <div className="loading">⏳ 正在連線遊戲伺服器…</div>;

  const { hands, results, winners, status, tableBets, theoreticalPnl, isPaused, countdown } = gameState;
  const totalBets = tableBets ? Object.values(tableBets).reduce((s,v)=>s+(v||0),0) : 0;

  return (
    <div className="admin-container">

      {/* ── Header ── */}
      <header className="admin-header">
        <div className="header-top">
          <h1>🎴 妞妞後台控制中心</h1>
          <div className="header-controls">
            <div className={`status-badge ${status ?? 'BETTING'}`}>{PHASE_LABELS[status] ?? '下注中'}</div>
            <span className="countdown-badge">⏱ {countdown ?? '--'}s</span>
            <span className="clock-badge">🕐 {clockTime}</span>
            {isPaused
              ? <button className="ctrl-btn resume" onClick={()=>control('resume')}>▶ 恢復</button>
              : <button className="ctrl-btn pause"  onClick={()=>control('pause')}>⏸ 暫停</button>
            }
            <button className="ctrl-btn extend" onClick={()=>control('extend',30)}>+30s</button>
          </div>
        </div>
        <div className="system-msg">{lastMessage}</div>
        {selectedZone && <div className="action-hint">💡 已選取 <b>{ZONE_META[selectedZone]?.label}</b>，請點擊任意區域執行換牌</div>}
      </header>

      {/* ── Tabs ── */}
      <nav className="tab-bar">
        {TABS.map(t=>(
          <button key={t.id} className={`tab-btn${activeTab===t.id?' active':''}`} onClick={()=>setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {/* ── Content ── */}
      <div className="tab-content">

        {/* ── Tab 1: 牌局控制 ── */}
        {activeTab==='board' && (
          <div className="game-board">

            {/* 鎖定提示 */}
            {!isBettingPhase && (
              <div className="lock-banner">
                🔒 {status==='DEALING'?'發牌中':status==='SQUEEZING'?'咪牌中':'結算中'} — 換牌與指定牌型已鎖定
              </div>
            )}

            {/* 莊家 */}
            <div className="banker-row">
              <ZoneCard zone="banker" hand={hands?.banker} result={results?.banker} winner={null} bet={null}
                isSelected={selectedZone==='banker'} isLocked={!isBettingPhase}
                onClick={()=>handleZoneClick('banker')}
                onForceHand={handleForceHand} pickerOpen={pickerZone==='banker'} onPickerToggle={setPickerZone} isForcing={isForcing}/>
            </div>

            {/* 4 閒家 */}
            <div className="player-grid">
              {['tian','di','xuan','huang'].map(z=>(
                <ZoneCard key={z} zone={z} hand={hands?.[z]} result={results?.[z]}
                  winner={winners?.[z]??null} bet={tableBets?.[z]||0}
                  isSelected={selectedZone===z} isLocked={!isBettingPhase}
                  onClick={()=>handleZoneClick(z)}
                  onForceHand={handleForceHand} pickerOpen={pickerZone===z} onPickerToggle={setPickerZone} isForcing={isForcing}/>
              ))}
            </div>

            {/* 投注摘要列 */}
            <div className="board-summary">
              <div className="board-summary-item">
                <span className="bsi-label">本局總投注</span>
                <span className="bsi-value">${fmt(totalBets)}</span>
              </div>
              <div className="board-summary-item">
                <span className="bsi-label">理論莊家盈虧</span>
                <span className={`bsi-value ${theoreticalPnl>=0?'pnl-pos':'pnl-neg'}`}>
                  {theoreticalPnl>=0?'+':''}{fmt(theoreticalPnl)}
                </span>
              </div>
              <div className="board-summary-item">
                <span className="bsi-label">天門</span>
                <span className="bsi-value">${fmt(tableBets?.tian)}</span>
              </div>
              <div className="board-summary-item">
                <span className="bsi-label">地門</span>
                <span className="bsi-value">${fmt(tableBets?.di)}</span>
              </div>
              <div className="board-summary-item">
                <span className="bsi-label">玄門</span>
                <span className="bsi-value">${fmt(tableBets?.xuan)}</span>
              </div>
              <div className="board-summary-item">
                <span className="bsi-label">黃門</span>
                <span className="bsi-value">${fmt(tableBets?.huang)}</span>
              </div>
            </div>

          </div>
        )}

        {/* ── Tab 2: 在線玩家 ── */}
        {activeTab==='players' && (
          <div className="table-panel">
            <div className="panel-header">
              <span>在線人數：<b>{players.length}</b></span>
              <button className="refresh-btn" onClick={async()=>{setLoadingPlayers(true);const r=await axios.get(`${API_URL}/online-players`,H);setPlayers(r.data);setLoadingPlayers(false);}}>
                {loadingPlayers?'載入中…':'🔄 刷新'}
              </button>
            </div>
            {players.length===0 ? (
              <div className="empty-state">目前無在線玩家</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>#</th><th>帳號</th><th>餘額</th><th>操作</th></tr></thead>
                <tbody>
                  {players.map((p,i)=>(
                    <tr key={p.socketId}>
                      <td style={{color:'#9ca3af'}}>{i+1}</td>
                      <td style={{fontWeight:700}}>{p.username}</td>
                      <td style={{color:'#ea580c',fontWeight:700}}>${fmt(p.balance)}</td>
                      <td><button className="kick-btn" onClick={()=>kickPlayer(p.socketId,p.username)}>踢除</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Tab 3: 餘額管理 ── */}
        {activeTab==='balance' && (
          <div className="form-panel">
            <h2 className="panel-title">手動調整玩家餘額</h2>
            <div className="adj-form">
              <label className="form-label">帳號（手機號）</label>
              <input className="form-input" placeholder="09xxxxxxxx" value={adjUsername} onChange={e=>setAdjUsername(e.target.value)}/>
              <label className="form-label">金額（正數＝加值，負數＝扣除）</label>
              <input className="form-input" type="number" placeholder="例：10000 或 -5000" value={adjAmount} onChange={e=>setAdjAmount(e.target.value)}/>
              <button className="submit-btn" onClick={adjustBalance}>確認調整</button>
            </div>
            {adjResult && <div className={`adj-result ${adjResult.ok?'ok':'err'}`}>{adjResult.msg}</div>}
            <p className="adj-hint">⚠️ 操作不可逆，請確認帳號與金額無誤後再送出。</p>
          </div>
        )}

        {/* ── Tab 4: 歷史記錄 ── */}
        {activeTab==='history' && (
          <div className="table-panel">
            <div className="panel-header">
              <span>最近 <b>{history.length}</b> 筆牌局</span>
              <button className="refresh-btn" onClick={fetchHistory}>{loadingHistory?'載入中…':'🔄 刷新'}</button>
            </div>
            {history.length===0 ? (
              <div className="empty-state">{loadingHistory?'載入中…':'尚無紀錄'}</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>時間</th><th>莊家牌型</th><th>莊家牌</th><th>人數</th><th>總投注</th><th>總派彩</th><th>莊家盈虧</th></tr>
                </thead>
                <tbody>
                  {history.map((r,i)=>(
                    <tr key={i}>
                      <td style={{color:'#9ca3af',fontSize:'0.75rem'}}>{new Date(r.settled_at).toLocaleString('zh-TW')}</td>
                      <td><span className="type-label">{r.banker_type}</span></td>
                      <td style={{fontSize:'0.72rem',color:'#6b7280'}}>{r.banker_cards}</td>
                      <td style={{textAlign:'center',fontWeight:700}}>{r.player_count}</td>
                      <td style={{color:'#d97706',fontWeight:700}}>${fmt(r.total_bets)}</td>
                      <td style={{color:'#2563eb',fontWeight:700}}>${fmt(r.total_win)}</td>
                      <td style={{color:r.house_profit>=0?'#16a34a':'#dc2626',fontWeight:800}}>
                        {r.house_profit>=0?'+':''}{fmt(r.house_profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Tab 5: 牌局紀錄 ── */}
        {activeTab==='rounds' && (
          <div className="form-panel">
            <h2 className="panel-title">牌局紀錄</h2>

            {/* 統計區 */}
            <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:14, flexWrap:'wrap' }}>
              <span style={{color:'#9ca3af',fontSize:'0.85rem'}}>統計近</span>
              {[50,100,500,1000].map(n => (
                <button key={n}
                  onClick={() => setStatsN(n)}
                  style={{
                    padding:'4px 12px', borderRadius:8, border:'none', cursor:'pointer', fontSize:'0.82rem',
                    background: statsN===n ? '#2563eb' : 'rgba(255,255,255,0.08)',
                    color: statsN===n ? '#fff' : '#9ca3af',
                  }}>{n} 局</button>
              ))}
              <button onClick={() => fetchRounds(roundsPage)} style={{ padding:'4px 12px', borderRadius:8, border:'none', cursor:'pointer', background:'rgba(255,255,255,0.08)', color:'#9ca3af', fontSize:'0.82rem' }}>🔄 刷新</button>
            </div>

            {roundsStats && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:10, marginBottom:20 }}>
                {[
                  { label:'統計局數',   val: fmt(roundsStats.total_rounds),          color:'#fff' },
                  { label:'目標勝率',   val: `${roundsStats.target_win_rate_pct}%`,   color:'#facc15' },
                  { label:'實際勝率',   val: `${roundsStats.actual_win_rate_pct}%`,   color: Math.abs(roundsStats.actual_win_rate_pct - roundsStats.target_win_rate_pct) <= 3 ? '#4ade80' : '#f87171' },
                  { label:'莊家獲利',   val: `$${fmt(roundsStats.house_profit)}`,     color: roundsStats.house_profit >= 0 ? '#4ade80' : '#f87171' },
                  { label:'總下注額',   val: `$${fmt(roundsStats.total_bet)}`,         color:'#60a5fa' },
                  { label:'換牌次數',   val: fmt(roundsStats.swap_count),             color:'#fb923c' },
                  { label:'指定牌型',   val: fmt(roundsStats.force_count),            color:'#fb923c' },
                  { label:'放水失敗',   val: fmt(roundsStats.total_failed_releases),  color: roundsStats.total_failed_releases > 0 ? '#f87171' : '#6b7280' },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ background:'rgba(255,255,255,0.05)', borderRadius:10, padding:'10px 14px', border:'1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ color:'#6b7280', fontSize:'0.72rem', marginBottom:4 }}>{label}</div>
                    <div style={{ color, fontWeight:700, fontSize:'1.05rem' }}>{val}</div>
                  </div>
                ))}
              </div>
            )}

            {/* 牌局列表 */}
            {loadingRounds ? (
              <div style={{ textAlign:'center', color:'#6b7280', padding:30 }}>載入中…</div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table className="history-table" style={{ fontSize:'0.78rem' }}>
                  <thead>
                    <tr>
                      <th>時間</th>
                      <th>莊家牌型</th>
                      <th style={{color:'#60a5fa'}}>頭</th>
                      <th style={{color:'#facc15'}}>初</th>
                      <th style={{color:'#4ade80'}}>川</th>
                      <th style={{color:'#f87171'}}>尾</th>
                      <th>莊贏門數</th>
                      <th>目標勝率</th>
                      <th>下注額</th>
                      <th>莊家獲利</th>
                      <th>備註</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rounds.map((r, i) => {
                      const dt = new Date(r.settled_at);
                      const timeStr = `${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
                      const flags = [r.had_swap && '換牌', r.had_force && '指定', r.failed_releases > 0 && `失敗${r.failed_releases}門`].filter(Boolean);
                      return (
                        <tr key={i}>
                          <td style={{color:'#6b7280'}}>{timeStr}</td>
                          <td style={{fontWeight:700}}>{r.banker_type}</td>
                          {['tian','di','xuan','huang'].map(z => (
                            <td key={z} style={{ color: r[`${z}_win`] ? '#f87171' : '#4ade80', fontWeight:600 }}>
                              {r[`${z}_type`]}<br/>
                              <span style={{fontSize:'0.68rem'}}>{r[`${z}_win`] ? '玩家贏' : '莊贏'}</span>
                            </td>
                          ))}
                          <td style={{ color: r.banker_win_count >= 3 ? '#4ade80' : r.banker_win_count <= 1 ? '#f87171' : '#facc15', fontWeight:700, textAlign:'center' }}>
                            {r.banker_win_count}/4
                          </td>
                          <td style={{color:'#9ca3af'}}>{(parseFloat(r.target_win_rate)*100).toFixed(0)}%</td>
                          <td style={{color:'#60a5fa'}}>${fmt(r.total_bet)}</td>
                          <td style={{color: r.house_profit>=0?'#4ade80':'#f87171', fontWeight:700}}>
                            {r.house_profit>=0?'+':''}{fmt(r.house_profit)}
                          </td>
                          <td style={{color:'#fb923c', fontSize:'0.7rem'}}>
                            {flags.join(' ')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 分頁 */}
            {Math.ceil(roundsTotal/30) > 1 && (
              <div style={{ display:'flex', gap:10, justifyContent:'center', marginTop:14, alignItems:'center' }}>
                <button className="kick-btn" disabled={roundsPage<=1} onClick={() => setRoundsPage(p=>p-1)}>‹ 上一頁</button>
                <span style={{color:'#6b7280', fontSize:'0.82rem'}}>{roundsPage} / {Math.ceil(roundsTotal/30)}</span>
                <button className="kick-btn" disabled={roundsPage>=Math.ceil(roundsTotal/30)} onClick={() => setRoundsPage(p=>p+1)}>下一頁 ›</button>
              </div>
            )}
          </div>
        )}

        {/* ── Tab 6: 公告推播 ── */}
        {activeTab==='announce' && (
          <div className="form-panel">
            <h2 className="panel-title">系統公告推播</h2>
            <div className="adj-form">
              <label className="form-label">公告內容</label>
              <textarea className="form-textarea" placeholder="輸入要推送給所有玩家的訊息…" value={announceMsg} onChange={e=>setAnnounceMsg(e.target.value)} rows={4}/>
              <button className="submit-btn announce" onClick={sendAnnouncement}>📢 立即推播</button>
            </div>
            {sentAnnouncements.length>0 && (
              <div className="announce-history">
                <div className="announce-history-title">最近推播記錄</div>
                {sentAnnouncements.map((a,i)=>(
                  <div key={i} className="announce-record">
                    <span className="announce-time">{a.time}</span>
                    <span className="announce-content">{a.msg}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab 6: 勝率設定 ── */}
        {activeTab==='settings' && (
          <div className="form-panel">
            <h2 className="panel-title">禁止牌型設定</h2>
            <p className="adj-hint">
              勾選後，該牌型將不會在任何閒門出現。<br/>
              ⚠️ 禁止越多強牌（五小妞、鐵支妞等），每門放水空間縮小，實際莊家勝率可能略高於目標值。
            </p>

            <div className="banned-grid">
              {HAND_TYPES.map(t => (
                <label key={t.value} className={`banned-item${bannedTypes.has(t.value) ? ' banned-active' : ''}`}>
                  <input
                    type="checkbox"
                    checked={bannedTypes.has(t.value)}
                    onChange={() => toggleBannedType(t.value)}
                  />
                  <span>{t.label}</span>
                </label>
              ))}
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:16, marginTop:20 }}>
              <button className="submit-btn" onClick={saveBannedTypes} disabled={loadingBanned}>
                {loadingBanned ? '儲存中…' : '💾 儲存設定'}
              </button>
              {bannedTypes.size > 0 && (
                <button className="kick-btn" onClick={() => setBannedTypes(new Set())}>
                  清除全部
                </button>
              )}
            </div>

            {bannedTypes.size > 0 ? (
              <div className="adj-result ok" style={{ marginTop:16 }}>
                目前禁止 {bannedTypes.size} 種牌型：
                {[...bannedTypes].map(t => HAND_TYPES.find(h=>h.value===t)?.label || t).join('、')}
              </div>
            ) : (
              <div className="adj-result ok" style={{ marginTop:16 }}>目前無禁止牌型，所有牌型正常出現。</div>
            )}

            <div className="banned-info-box">
              <div className="banned-info-title">目前勝率設定</div>
              <div className="banned-info-row">
                <span>熱門時段（20:00 ~ 02:00）</span>
                <strong style={{color:'#ef4444'}}>莊家勝率 69%</strong>
              </div>
              <div className="banned-info-row">
                <span>離峰時段（02:00 ~ 20:00）</span>
                <strong style={{color:'#2563eb'}}>莊家勝率 60%</strong>
              </div>
              <div className="banned-info-note">* 使用精確每門獨立控制，每門勝率直接對應設定值</div>
            </div>
          </div>
        )}

        {/* ── Tab 7: 彩金池 ── */}
        {activeTab==='jackpot' && (
          <div className="form-panel">
            <h2 className="panel-title">彩金池管理</h2>

            {/* 狀態卡片 */}
            {jackpotStatus && (
              <div className="jackpot-status-grid">
                <div className="jackpot-stat-card jackpot-main">
                  <div className="jackpot-stat-label">目前彩金池金額</div>
                  <div className="jackpot-stat-value gold">${fmt(jackpotStatus.live_amount ?? jackpotStatus.current_amount)}</div>
                </div>
                <div className="jackpot-stat-card">
                  <div className="jackpot-stat-label">累積貢獻總額</div>
                  <div className="jackpot-stat-value">${fmt(jackpotStatus.total_contributed)}</div>
                </div>
                <div className="jackpot-stat-card">
                  <div className="jackpot-stat-label">歷史賠出總額</div>
                  <div className="jackpot-stat-value red">${fmt(jackpotStatus.total_paid_out)}</div>
                </div>
              </div>
            )}

            {/* 手動調整 */}
            <div className="jackpot-section">
              <h3 className="jackpot-section-title">手動調整池金額</h3>
              <div className="adj-form" style={{ flexDirection:'row', gap:10, alignItems:'flex-end' }}>
                <div style={{ flex:1 }}>
                  <label className="form-label">金額（正數＝補池，負數＝扣除）</label>
                  <input className="form-input" type="number" placeholder="例：50000 或 -10000"
                    value={jackpotAdjDelta} onChange={e=>setJackpotAdjDelta(e.target.value)}/>
                </div>
                <button className="submit-btn" style={{ whiteSpace:'nowrap' }} onClick={adjustJackpotPool}>確認調整</button>
              </div>
            </div>

            {/* 觸發設定 */}
            <div className="jackpot-section">
              <h3 className="jackpot-section-title">觸發牌型設定</h3>
              <p className="adj-hint">設定哪些牌型可以觸發彩金，以及賠出比例（1.0 = 100%）。</p>

              {jackpotConfigs.length === 0 && (
                <div className="empty-state" style={{ padding:'20px 0' }}>尚無觸發設定，請點擊「新增」</div>
              )}

              {jackpotConfigs.map((cfg, idx) => (
                <div key={idx} className="jackpot-config-row">
                  <select
                    className="form-input" style={{ flex:2 }}
                    value={cfg.hand_type}
                    onChange={e => updateJackpotConfig(idx, 'hand_type', e.target.value)}
                  >
                    {HAND_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>

                  <div style={{ display:'flex', alignItems:'center', gap:6, flex:1 }}>
                    <span style={{ color:'#aaa', fontSize:'0.85rem', whiteSpace:'nowrap' }}>賠出</span>
                    <input
                      className="form-input" type="number" min="0.01" max="1" step="0.01"
                      style={{ flex:1 }}
                      value={cfg.payout_rate}
                      onChange={e => updateJackpotConfig(idx, 'payout_rate', parseFloat(e.target.value) || 1)}
                    />
                    <span style={{ color:'#aaa', fontSize:'0.85rem' }}>×</span>
                  </div>

                  <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', color:'#aaa', fontSize:'0.85rem', whiteSpace:'nowrap' }}>
                    <input type="checkbox"
                      checked={!!cfg.is_enabled}
                      onChange={e => updateJackpotConfig(idx, 'is_enabled', e.target.checked ? 1 : 0)}
                    />
                    啟用
                  </label>

                  <button className="kick-btn" onClick={() => removeJackpotConfig(idx)}>移除</button>
                </div>
              ))}

              <div style={{ display:'flex', gap:12, marginTop:14 }}>
                <button className="ctrl-btn extend" onClick={addJackpotConfig}>＋ 新增觸發牌型</button>
                <button className="submit-btn" onClick={saveJackpotConfig} disabled={savingJackpot}>
                  {savingJackpot ? '儲存中…' : '💾 儲存設定'}
                </button>
              </div>
            </div>

            {/* 得獎歷史 */}
            <div className="jackpot-section">
              <h3 className="jackpot-section-title">彩金得獎歷史</h3>
              {jackpotHistory.length === 0 ? (
                <div className="empty-state">尚無得獎紀錄</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr><th>時間</th><th>觸發牌型</th><th>觸發門</th><th>賠出前</th><th>賠出金額</th><th>得獎者</th></tr>
                  </thead>
                  <tbody>
                    {jackpotHistory.map((r, i) => {
                      const winners = typeof r.winners_detail === 'string'
                        ? JSON.parse(r.winners_detail) : (r.winners_detail || []);
                      return (
                        <tr key={i}>
                          <td style={{ color:'#9ca3af', fontSize:'0.75rem' }}>{new Date(r.won_at).toLocaleString('zh-TW')}</td>
                          <td><span className="type-label">{r.trigger_hand_type}</span></td>
                          <td style={{ color:'#d97706' }}>{r.trigger_zones}</td>
                          <td style={{ color:'#6b7280' }}>${fmt(r.jackpot_before)}</td>
                          <td style={{ color:'#FFD700', fontWeight:800 }}>${fmt(r.jackpot_paid)}</td>
                          <td style={{ fontSize:'0.75rem', color:'#9ca3af' }}>
                            {winners.slice(0,2).map(w=>`${w.username}(+$${fmt(w.jackpotWon)})`).join('、')}
                            {winners.length > 2 ? `…等${winners.length}人` : ''}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* 分頁 */}
              {Math.ceil(jackpotHistTotal / 10) > 1 && (
                <div style={{ display:'flex', gap:12, justifyContent:'center', marginTop:14 }}>
                  <button className="ctrl-btn" disabled={jackpotHistPage <= 1}
                    onClick={() => fetchJackpotData(jackpotHistPage - 1)}>‹ 上頁</button>
                  <span style={{ color:'#aaa', fontSize:'0.85rem', alignSelf:'center' }}>
                    {jackpotHistPage} / {Math.ceil(jackpotHistTotal / 10)}
                  </span>
                  <button className="ctrl-btn" disabled={jackpotHistPage >= Math.ceil(jackpotHistTotal / 10)}
                    onClick={() => fetchJackpotData(jackpotHistPage + 1)}>下頁 ›</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab 8: 莊家管理 ── */}
        {activeTab==='banker' && (
          <div className="section-box">
            <h2>👑 莊家管理</h2>

            {/* 當前莊家 */}
            <div className="section-box" style={{ marginBottom:16 }}>
              <h3 style={{ marginBottom:12 }}>當前莊家</h3>
              {bankerInfo?.hasBanker && bankerInfo.banker ? (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={{ display:'flex', gap:24, flexWrap:'wrap', alignItems:'center' }}>
                    <div><span style={{ color:'#aaa' }}>莊家：</span><strong style={{ color:'#FFD700', fontSize:'1.1rem' }}>{bankerInfo.banker.username}</strong></div>
                    <div><span style={{ color:'#aaa' }}>每門上限：</span><strong>${fmt(bankerInfo.banker.perZoneCap)}</strong></div>
                    <div><span style={{ color:'#aaa' }}>凍結金：</span><strong>${fmt(bankerInfo.banker.currentFrozen)}</strong></div>
                    <div><span style={{ color:'#aaa' }}>剩餘局數：</span><strong>{bankerInfo.banker.roundsLeft} 局</strong></div>
                    <div>
                      <span style={{ color:'#aaa' }}>盈虧：</span>
                      <strong style={{ color: bankerInfo.banker.netPnl >= 0 ? '#4caf50' : '#ef5350' }}>
                        {bankerInfo.banker.netPnl >= 0 ? '+' : ''}${fmt(bankerInfo.banker.netPnl)}
                      </strong>
                    </div>
                  </div>
                  <button
                    className="ctrl-btn"
                    style={{ background:'#c0392b', width:'fit-content', marginTop:8 }}
                    onClick={kickBanker}
                    disabled={kickingBanker}
                  >
                    {kickingBanker ? '處理中…' : '⚡ 強制下莊'}
                  </button>
                </div>
              ) : (
                <div style={{ color:'#aaa', fontSize:'0.9rem' }}>目前為系統莊家（無真人做莊）</div>
              )}
            </div>

            {/* 排隊列表 */}
            <div className="section-box" style={{ marginBottom:16 }}>
              <h3 style={{ marginBottom:12 }}>排隊列表（{bankerInfo?.queueCount ?? 0} / {bankerInfo?.queueLimit ?? 5}）</h3>
              {bankerInfo?.queue?.length > 0 ? (
                <table className="data-table" style={{ width:'100%' }}>
                  <thead><tr><th>排名</th><th>玩家</th><th>凍結金</th><th>預計每門上限</th></tr></thead>
                  <tbody>
                    {bankerInfo.queue.map(q => (
                      <tr key={q.position}>
                        <td>#{q.position}</td>
                        <td>{q.username}</td>
                        <td>${fmt(q.frozenAmount)}</td>
                        <td>${fmt(q.perZoneCap)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ color:'#aaa', fontSize:'0.9rem' }}>目前排隊為空</div>
              )}
            </div>

            {/* 歷史記錄 */}
            <div className="section-box">
              <h3 style={{ marginBottom:12 }}>做莊歷史</h3>
              {bankerHistory.length > 0 ? (
                <>
                  <table className="data-table" style={{ width:'100%' }}>
                    <thead>
                      <tr>
                        <th>玩家</th><th>凍結金</th><th>結算金</th><th>盈虧</th><th>局數</th><th>強制</th><th>時間</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bankerHistory.map(r => (
                        <tr key={r.id}>
                          <td>{r.username}</td>
                          <td>${fmt(r.initial_frozen)}</td>
                          <td>${fmt(r.final_frozen)}</td>
                          <td style={{ color: r.net_pnl >= 0 ? '#4caf50' : '#ef5350' }}>
                            {r.net_pnl >= 0 ? '+' : ''}${fmt(r.net_pnl)}
                          </td>
                          <td>{r.rounds_played}</td>
                          <td>{r.force_quit ? '⚠️是' : '否'}</td>
                          <td style={{ fontSize:'0.78rem', color:'#aaa' }}>
                            {r.started_at ? new Date(r.started_at).toLocaleString('zh-TW') : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {bankerHistTotal > 10 && (
                    <div style={{ display:'flex', gap:12, justifyContent:'center', marginTop:14 }}>
                      <button className="ctrl-btn" disabled={bankerHistPage <= 1}
                        onClick={() => fetchBankerData(bankerHistPage - 1)}>‹ 上頁</button>
                      <span style={{ color:'#aaa', fontSize:'0.85rem', alignSelf:'center' }}>
                        {bankerHistPage} / {Math.ceil(bankerHistTotal / 10)}
                      </span>
                      <button className="ctrl-btn" disabled={bankerHistPage >= Math.ceil(bankerHistTotal / 10)}
                        onClick={() => fetchBankerData(bankerHistPage + 1)}>下頁 ›</button>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ color:'#aaa', fontSize:'0.9rem' }}>尚無做莊記錄</div>
              )}
            </div>
          </div>
        )}

      </div>

      <footer className="admin-footer">
        牌局控制說明：下注階段可換牌與指定牌型；發牌後自動鎖定。
      </footer>
    </div>
  );
}

export default App;
