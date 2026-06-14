import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import './App.css';

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const API_URL  = BASE_URL + "/api/admin";

// Access Token 存記憶體（不存 localStorage）
let _accessToken = null;
let H = { headers: {} };
let _forceLogout = null; // 由 App component 設定

function _setAccessToken(token) {
    _accessToken = token;
    H = { headers: { 'Authorization': `Bearer ${token}` } };
}

// Axios 攔截器：401 時自動換 Token，失敗則強制登出
axios.interceptors.response.use(
    res => res,
    async err => {
        const orig = err.config;
        if (err.response?.status === 401 && !orig._retry) {
            orig._retry = true;
            const rt = localStorage.getItem('admin_refresh_token');
            if (rt) {
                try {
                    const r = await axios.post(`${BASE_URL}/api/admin/refresh`, { refreshToken: rt });
                    localStorage.setItem('admin_refresh_token', r.data.refreshToken);
                    _setAccessToken(r.data.token);
                    orig.headers['Authorization'] = `Bearer ${r.data.token}`;
                    return axios(orig);
                } catch {
                    localStorage.removeItem('admin_refresh_token');
                    _accessToken = null;
                    H = { headers: {} };
                    if (_forceLogout) _forceLogout();
                }
            } else {
                if (_forceLogout) _forceLogout();
            }
        }
        return Promise.reject(err);
    }
);

// ─── 登入頁（ERP 企業管理系統風格）──────────────────────────────
function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [showPwd,  setShowPwd]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${BASE_URL}/api/admin/login`, { username, password });
      onLogin(res.data.token, res.data.refreshToken);
    } catch (err) {
      setError(err.response?.data?.error || '帳號或密碼錯誤，請重試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', minWidth: '1100px',
      background: 'linear-gradient(135deg, #e8f0fe 0%, #f0f4ff 50%, #e8edf8 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Segoe UI','PingFang TC','Microsoft JhengHei',sans-serif",
    }}>
      {/* 裝飾圓形 */}
      <div style={{ position:'fixed', top:'-120px', right:'-80px', width:'400px', height:'400px',
        borderRadius:'50%', background:'rgba(37,99,235,0.07)', pointerEvents:'none' }} />
      <div style={{ position:'fixed', bottom:'-100px', left:'-60px', width:'320px', height:'320px',
        borderRadius:'50%', background:'rgba(37,99,235,0.05)', pointerEvents:'none' }} />

      {/* 主卡片：雙欄 */}
      <div style={{
        display: 'flex', width: '880px', height: '520px',
        borderRadius: '16px', overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(37,99,235,0.14), 0 4px 16px rgba(0,0,0,0.08)',
      }}>

        {/* ── 左欄：系統資訊 ── */}
        <div style={{
          width: '340px', flexShrink: 0,
          background: 'linear-gradient(160deg, #1e3a8a 0%, #1d4ed8 55%, #2563eb 100%)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '48px 40px', color: '#fff', textAlign: 'center',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* 背景裝飾網格 */}
          <div style={{ position:'absolute', inset:0, opacity:0.06,
            backgroundImage:'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
            backgroundSize:'32px 32px', pointerEvents:'none' }} />

          <div style={{ position:'relative', zIndex:1 }}>
            {/* Logo */}
            <div style={{
              width:'72px', height:'72px', borderRadius:'18px',
              background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)',
              display:'flex', alignItems:'center', justifyContent:'center',
              margin:'0 auto 24px', fontSize:'2rem',
              backdropFilter:'blur(8px)',
            }}>🏨</div>

            <div style={{ fontSize:'0.62rem', letterSpacing:'0.4em', color:'rgba(255,255,255,0.55)',
              textTransform:'uppercase', marginBottom:'8px' }}>
              MANAGEMENT SYSTEM
            </div>
            <h1 style={{ margin:'0 0 6px', fontSize:'1.8rem', fontWeight:'700', letterSpacing:'0.15em' }}>
              PRESTIGE
            </h1>
            <div style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.6)', letterSpacing:'0.12em',
              marginBottom:'28px', textTransform:'uppercase' }}>
              Resort &amp; Hospitality
            </div>

            <div style={{ width:'40px', height:'1px', background:'rgba(255,255,255,0.25)', margin:'0 auto 28px' }} />

            <div style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.5)', lineHeight:2 }}>
              後台管理系統<br/>
              System v2.0
            </div>
          </div>
        </div>

        {/* ── 右欄：登入表單 ── */}
        <div style={{
          flex:1, background:'#ffffff',
          display:'flex', flexDirection:'column', justifyContent:'center',
          padding:'52px 52px',
        }}>
          {/* 頂部系統標籤 */}
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'32px' }}>
            <div style={{ width:'4px', height:'24px', background:'#2563eb', borderRadius:'2px' }} />
            <span style={{ fontSize:'0.72rem', color:'#64748b', fontWeight:'600', letterSpacing:'0.05em', textTransform:'uppercase' }}>
              Administrator Login
            </span>
          </div>

          <h2 style={{ margin:'0 0 6px', fontSize:'1.5rem', fontWeight:'700', color:'#0f172a' }}>
            管理員登入
          </h2>
          <p style={{ margin:'0 0 32px', fontSize:'0.82rem', color:'#94a3b8' }}>
            請輸入授權帳號與密碼以進入管理系統
          </p>

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'18px' }}>
            {/* 帳號 */}
            <div>
              <label style={{ display:'block', fontSize:'0.75rem', fontWeight:'600',
                color:'#374151', marginBottom:'7px' }}>帳號</label>
              <input
                type="text" value={username}
                onChange={e => setUsername(e.target.value)}
                required autoComplete="username"
                placeholder="請輸入管理員帳號"
                style={{
                  width:'100%', boxSizing:'border-box',
                  padding:'11px 14px', borderRadius:'8px',
                  border:'1.5px solid #e2e8f0', background:'#f8fafc',
                  fontSize:'0.9rem', color:'#0f172a', outline:'none',
                  transition:'border-color 0.15s',
                }}
                onFocus={e=>e.target.style.borderColor='#2563eb'}
                onBlur={e=>e.target.style.borderColor='#e2e8f0'}
              />
            </div>

            {/* 密碼 */}
            <div>
              <label style={{ display:'block', fontSize:'0.75rem', fontWeight:'600',
                color:'#374151', marginBottom:'7px' }}>密碼</label>
              <div style={{ position:'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  required autoComplete="current-password"
                  placeholder="請輸入密碼"
                  style={{
                    width:'100%', boxSizing:'border-box',
                    padding:'11px 44px 11px 14px', borderRadius:'8px',
                    border:'1.5px solid #e2e8f0', background:'#f8fafc',
                    fontSize:'0.9rem', color:'#0f172a', outline:'none',
                    transition:'border-color 0.15s',
                  }}
                  onFocus={e=>e.target.style.borderColor='#2563eb'}
                  onBlur={e=>e.target.style.borderColor='#e2e8f0'}
                />
                <button type="button" onClick={()=>setShowPwd(v=>!v)} style={{
                  position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)',
                  background:'none', border:'none', cursor:'pointer',
                  color:'#94a3b8', fontSize:'0.85rem', padding:'2px',
                }}>
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* 錯誤訊息 */}
            {error && (
              <div style={{
                padding:'10px 14px', borderRadius:'8px',
                background:'#fef2f2', border:'1px solid #fecaca',
                color:'#dc2626', fontSize:'0.82rem', display:'flex', alignItems:'center', gap:'8px',
              }}>
                <span>⚠</span>{error}
              </div>
            )}

            {/* 登入按鈕 */}
            <button type="submit" disabled={loading} style={{
              marginTop:'4px', padding:'12px',
              background: loading ? '#93c5fd' : 'linear-gradient(135deg, #1d4ed8, #2563eb)',
              border:'none', borderRadius:'8px',
              color:'#fff', fontSize:'0.9rem', fontWeight:'700',
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing:'0.05em', transition:'opacity 0.15s, transform 0.1s',
              boxShadow: loading ? 'none' : '0 4px 14px rgba(37,99,235,0.35)',
            }}>
              {loading ? '驗 證 中…' : '登 入 系 統'}
            </button>
          </form>

          <div style={{ marginTop:'28px', paddingTop:'20px', borderTop:'1px solid #f1f5f9',
            fontSize:'0.7rem', color:'#cbd5e1', textAlign:'center' }}>
            © 2024 Prestige Resort &amp; Hospitality · 授權人員專用
          </div>
        </div>
      </div>
    </div>
  );
}

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
  { id:'balance',  label:'🔍 玩家查詢' },
  { id:'history',  label:'📋 歷史記錄' },
  { id:'rounds',   label:'📊 牌局紀錄' },
  { id:'announce', label:'📢 公告推播' },
  { id:'settings', label:'⚙️ 勝率設定' },
  { id:'jackpot',  label:'🏆 彩金池' },
  { id:'banker',   label:'👑 莊家管理' },
  { id:'agents',   label:'🤝 代理管理' },
  { id:'sysadmin', label:'🔐 系統管理' },
  { id:'errors',   label:'🐛 錯誤日誌' },
];

// ─── Main ────────────────────────────────────────────────────────
function App() {
  // null = 驗證中, false = 未登入, true = 已登入
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [gameState,    setGameState]    = useState(null);
  const [clockTime,    setClockTime]    = useState('');
  const [activeTab,    setActiveTab]    = useState('board');
  const [displayCountdown, setDisplayCountdown] = useState(null);
  const serverSnapshotRef = useRef(null); // { countdown, receivedAt }
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const [idleCountdown,   setIdleCountdown]   = useState(60);
  const idleTimerRef    = useRef(null);
  const warningTimerRef = useRef(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [pickerZone,   setPickerZone]   = useState(null);
  const [isForcing,    setIsForcing]    = useState(false);
  const [lastMessage,  setLastMessage]  = useState('系統就緒');
  // players tab
  const [players,       setPlayers]       = useState([]);
  const [loadingPlayers,setLoadingPlayers] = useState(false);
  // player search tab
  const [adjUsername,      setAdjUsername]      = useState('');
  const [adjAmount,        setAdjAmount]        = useState('');
  const [adjResult,        setAdjResult]        = useState(null);
  const [playerSearch,     setPlayerSearch]     = useState('');
  const [playerResults,    setPlayerResults]    = useState(null);
  const [searchLoading,    setSearchLoading]    = useState(false);
  const [unboundPlayers,   setUnboundPlayers]   = useState([]);
  const [unboundLoading,   setUnboundLoading]   = useState(false);
  // player list
  const [allPlayers,       setAllPlayers]       = useState([]);
  const [allPlayersTotal,  setAllPlayersTotal]  = useState(0);
  const [allPlayersPage,   setAllPlayersPage]   = useState(1);
  const [allPlayersAgent,  setAllPlayersAgent]  = useState('');
  const [allPlayersSearch, setAllPlayersSearch] = useState('');
  const [allPlayersLoading,setAllPlayersLoading]= useState(false);
  // player detail
  const [selectedPlayer,   setSelectedPlayer]  = useState(null);
  const [playerDetail,     setPlayerDetail]    = useState(null);
  const [detailLoading,    setDetailLoading]   = useState(false);
  const [detailAdj,        setDetailAdj]       = useState('');
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
  // agents tab
  const [agents,           setAgents]           = useState([]);
  const [agentPlayers,     setAgentPlayers]     = useState(null);   // { agentId, rows }
  const [agentSettlement,  setAgentSettlement]  = useState(null);   // settlement result
  const [settlementRange,  setSettlementRange]  = useState({ from:'', to:'' });
  const [showAddAgent,     setShowAddAgent]     = useState(false);
  const [editingAgent,     setEditingAgent]     = useState(null);   // agent obj being edited
  const [agentForm,        setAgentForm]        = useState({ name:'', referral_code:'', contact:'', credit_limit:'' });
  const [agentLoading,     setAgentLoading]     = useState(false);
  // rounds tab
  const [rounds,          setRounds]          = useState([]);
  const [roundsTotal,     setRoundsTotal]     = useState(0);
  const [roundsPage,      setRoundsPage]      = useState(1);
  const [roundsStats,     setRoundsStats]     = useState(null);
  const [loadingRounds,   setLoadingRounds]   = useState(false);
  const [statsN,          setStatsN]          = useState(100);
  // balance logs (player detail)
  const [balanceLogs,       setBalanceLogs]       = useState([]);
  const [balanceLogsLoading,setBalanceLogsLoading]= useState(false);
  const [detailNote,        setDetailNote]        = useState('');
  // sysadmin tab
  const [isMaintenance,     setIsMaintenance]     = useState(false);
  const [maintenanceLoading,setMaintenanceLoading]= useState(false);
  const [adminAccounts,     setAdminAccounts]     = useState([]);
  const [adminAccLoading,   setAdminAccLoading]   = useState(false);
  const [newAdminUsername,  setNewAdminUsername]  = useState('');
  const [newAdminPassword,  setNewAdminPassword]  = useState('');
  const [changePwdId,       setChangePwdId]       = useState(null);
  const [changePwdVal,      setChangePwdVal]      = useState('');

  const fetchStatus = useCallback(async () => {
    if (!_accessToken) return;
    try { const r = await axios.get(`${API_URL}/preview`, H); setGameState(r.data); }
    catch {}
  }, []);

  // 頁面載入時嘗試用 refresh token 自動登入
  useEffect(() => {
    _forceLogout = () => {
        setIsAuthenticated(false);
        setGameState(null);
    };
    const rt = localStorage.getItem('admin_refresh_token');
    if (!rt) { setIsAuthenticated(false); return; }
    axios.post(`${BASE_URL}/api/admin/refresh`, { refreshToken: rt })
        .then(res => {
            localStorage.setItem('admin_refresh_token', res.data.refreshToken);
            _setAccessToken(res.data.token);
            setIsAuthenticated(true);
        })
        .catch(() => {
            localStorage.removeItem('admin_refresh_token');
            setIsAuthenticated(false);
        });
  }, []);

  useEffect(() => {
    const id = setInterval(fetchStatus, 1000);
    fetchStatus();
    return () => clearInterval(id);
  }, [fetchStatus]);

  // 每次 poll 回來記錄快照（收到時間 + 倒數值）
  useEffect(() => {
    if (!gameState?.status) return;
    serverSnapshotRef.current = {
      countdown:  gameState.countdown ?? 0,
      receivedAt: Date.now(),
    };
  }, [gameState]);

  // 本地插值：每 250ms 依實際經過時間推算顯示值，消除輪詢延遲感
  useEffect(() => {
    const id = setInterval(() => {
      const snap = serverSnapshotRef.current;
      if (!snap) return;
      const elapsed = Math.floor((Date.now() - snap.receivedAt) / 1000);
      setDisplayCountdown(Math.max(0, snap.countdown - elapsed));
    }, 250);
    return () => clearInterval(id);
  }, []);

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

  // 閒置自動登出（15 分鐘無操作 → 60 秒倒數 → 強制登出）
  const resetIdleTimer = useCallback(() => {
    clearTimeout(idleTimerRef.current);
    clearInterval(warningTimerRef.current);
    setShowIdleWarning(false);
    idleTimerRef.current = setTimeout(() => {
        setShowIdleWarning(true);
        let cnt = 60;
        setIdleCountdown(cnt);
        warningTimerRef.current = setInterval(() => {
            cnt -= 1;
            setIdleCountdown(cnt);
            if (cnt <= 0) {
                clearInterval(warningTimerRef.current);
                handleLogout();
            }
        }, 1000);
    }, 15 * 60 * 1000);
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!isAuthenticated) return;
    const events = ['mousemove', 'click', 'keydown', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetIdleTimer));
    resetIdleTimer();
    return () => {
        events.forEach(e => window.removeEventListener(e, resetIdleTimer));
        clearTimeout(idleTimerRef.current);
        clearInterval(warningTimerRef.current);
    };
  }, [isAuthenticated, resetIdleTimer]);

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

  // ── 玩家搜尋 ──
  const searchPlayers = async () => {
    if (!playerSearch.trim()) return;
    setSearchLoading(true);
    try {
      const r = await axios.get(`${API_URL}/player-search?q=${encodeURIComponent(playerSearch.trim())}`, H);
      setPlayerResults(r.data);
    } catch (e) { alert(e.response?.data?.error || '搜尋失敗'); }
    finally { setSearchLoading(false); }
  };

  const fetchAllPlayers = useCallback(async (page = 1, agentId = allPlayersAgent, search = allPlayersSearch) => {
    setAllPlayersLoading(true);
    try {
      const p = new URLSearchParams({ page, limit: 20 });
      if (agentId) p.set('agentId', agentId);
      if (search)  p.set('search', search);
      const r = await axios.get(`${API_URL}/players?${p}`, H);
      setAllPlayers(r.data.rows);
      setAllPlayersTotal(r.data.total);
      setAllPlayersPage(page);
    } catch {}
    finally { setAllPlayersLoading(false); }
  }, [allPlayersAgent, allPlayersSearch]);

  const fetchPlayerDetail = async (player) => {
    setSelectedPlayer(player);
    setDetailLoading(true);
    setDetailAdj(''); setDetailNote('');
    setBalanceLogs([]);
    try {
      const r = await axios.get(`${API_URL}/players/${player.id}/detail`, H);
      setPlayerDetail(r.data);
      fetchBalanceLogs(player.id);
    } catch {}
    finally { setDetailLoading(false); }
  };

  const fetchBalanceLogs = async (userId) => {
    setBalanceLogsLoading(true);
    try {
      const r = await axios.get(`${API_URL}/balance-logs?userId=${userId}&limit=10`, H);
      setBalanceLogs(r.data.rows || []);
    } catch {} finally { setBalanceLogsLoading(false); }
  };

  const detailAdjustBalance = async (player) => {
    const n = Number(detailAdj);
    if (!n) return;
    try {
      const r = await axios.post(`${API_URL}/adjust-balance`, { username: player.username, amount: n, note: detailNote || undefined }, H);
      setDetailAdj(''); setDetailNote('');
      const nb = r.data.newBalance;
      setPlayerDetail(prev => prev ? { ...prev, user: { ...prev.user, balance: nb } } : prev);
      setAllPlayers(prev => prev.map(p => p.id === player.id ? { ...p, balance: nb } : p));
      setLastMessage(`✅ ${player.username} 新餘額 $${fmt(nb)}`);
      fetchBalanceLogs(player.id);
    } catch (e) { alert(e.response?.data?.error || '調整失敗'); }
  };

  const banPlayer = async (player) => {
    const isBanned = !!(player.is_banned);
    const msg = isBanned ? `確定解鎖 ${player.username}？` : `確定封鎖 ${player.username}？封鎖後此玩家無法登入。`;
    if (!window.confirm(msg)) return;
    try {
      await axios.patch(`${API_URL}/players/${player.id}/${isBanned ? 'unban' : 'ban'}`, {}, H);
      const newBanned = !isBanned;
      setPlayerDetail(prev => prev ? { ...prev, user: { ...prev.user, is_banned: newBanned } } : prev);
      setAllPlayers(prev => prev.map(p => p.id === player.id ? { ...p, is_banned: newBanned } : p));
      if (selectedPlayer?.id === player.id) setSelectedPlayer(prev => prev ? { ...prev, is_banned: newBanned } : prev);
      setLastMessage(newBanned ? `🚫 已封鎖 ${player.username}` : `✅ 已解鎖 ${player.username}`);
    } catch (e) { alert(e.response?.data?.error || '操作失敗'); }
  };

  const fetchMaintenance = async () => {
    try { const r = await axios.get(`${API_URL}/maintenance`, H); setIsMaintenance(r.data.isMaintenance); } catch {}
  };

  const toggleMaintenance = async () => {
    setMaintenanceLoading(true);
    try {
      const r = await axios.post(`${API_URL}/maintenance`, { enabled: !isMaintenance }, H);
      setIsMaintenance(r.data.isMaintenance);
      setLastMessage(r.data.isMaintenance ? '🔴 維護模式已開啟' : '🟢 維護模式已關閉');
    } catch { setLastMessage('❌ 切換失敗'); }
    finally { setMaintenanceLoading(false); }
  };

  const fetchAdminAccounts = async () => {
    setAdminAccLoading(true);
    try { const r = await axios.get(`${API_URL}/admins`, H); setAdminAccounts(r.data); }
    catch {} finally { setAdminAccLoading(false); }
  };

  const createAdmin = async () => {
    if (!newAdminUsername.trim() || !newAdminPassword || newAdminPassword.length < 6) return alert('請填寫帳號，密碼至少 6 碼');
    try {
      await axios.post(`${API_URL}/admins`, { username: newAdminUsername.trim(), password: newAdminPassword }, H);
      setNewAdminUsername(''); setNewAdminPassword('');
      setLastMessage(`✅ 已建立管理員 ${newAdminUsername}`);
      fetchAdminAccounts();
    } catch (e) { alert(e.response?.data?.error || '建立失敗'); }
  };

  const deleteAdmin = async (admin) => {
    if (!window.confirm(`確定刪除管理員「${admin.username}」？`)) return;
    try {
      await axios.delete(`${API_URL}/admins/${admin.id}`, H);
      setLastMessage(`✅ 已刪除 ${admin.username}`);
      fetchAdminAccounts();
    } catch (e) { alert(e.response?.data?.error || '刪除失敗'); }
  };

  const changeAdminPassword = async (id) => {
    if (!changePwdVal || changePwdVal.length < 6) return alert('密碼至少 6 碼');
    try {
      await axios.put(`${API_URL}/admins/${id}/password`, { newPassword: changePwdVal }, H);
      setChangePwdId(null); setChangePwdVal('');
      setLastMessage('✅ 密碼已修改');
    } catch (e) { alert(e.response?.data?.error || '修改失敗'); }
  };

  useEffect(() => { if (activeTab === 'balance') { fetchAllPlayers(1); fetchUnboundPlayers(); fetchAgents(); } }, [activeTab]);

  const fetchUnboundPlayers = async () => {
    setUnboundLoading(true);
    try {
      const r = await axios.get(`${API_URL}/unbound-players`, H);
      setUnboundPlayers(r.data);
    } catch {}
    finally { setUnboundLoading(false); }
  };

  const assignAgent = async (userId, agentId) => {
    try {
      await axios.patch(`${API_URL}/users/${userId}/agent`, { agentId }, H);
      setUnboundPlayers(prev => prev.filter(p => p.id !== userId));
      if (playerResults) {
        setPlayerResults(prev => prev.map(p => p.id === userId
          ? { ...p, agent_id: agentId, agent_name: agents.find(a=>a.id===agentId)?.name || '已綁定' }
          : p
        ));
      }
      setLastMessage('✅ 已更新代理綁定');
    } catch (e) { alert(e.response?.data?.error || '操作失敗'); }
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

  // ── 代理管理 ──
  const fetchAgents = useCallback(async () => {
    try { const r = await axios.get(`${API_URL}/agents`, H); setAgents(r.data); }
    catch {}
  }, []);

  useEffect(() => { if (activeTab === 'agents') fetchAgents(); }, [activeTab, fetchAgents]);

  useEffect(() => { if (activeTab === 'sysadmin') { fetchMaintenance(); fetchAdminAccounts(); } }, [activeTab]); // eslint-disable-line

  // ── 錯誤日誌 ──
  const [errorLogs,      setErrorLogs]      = useState([]);
  const [errorLogsTotal, setErrorLogsTotal] = useState(0);
  const [errorLogsPage,  setErrorLogsPage]  = useState(1);
  const [errorFilter,    setErrorFilter]    = useState({ level: 'all', source: 'all' });
  const [expandedErrId,  setExpandedErrId]  = useState(null);
  const ERROR_PAGE_SIZE = 30;

  const fetchErrorLogs = useCallback(async (page = 1, filter = errorFilter) => {
    try {
      const offset = (page - 1) * ERROR_PAGE_SIZE;
      const params = new URLSearchParams({ limit: ERROR_PAGE_SIZE, offset });
      if (filter.level  !== 'all') params.set('level',  filter.level);
      if (filter.source !== 'all') params.set('source', filter.source);
      const r = await axios.get(`${API_URL}/error-logs?${params}`, H);
      setErrorLogs(r.data.rows || []);
      setErrorLogsTotal(r.data.total || 0);
      setErrorLogsPage(page);
    } catch {}
  }, [errorFilter]); // eslint-disable-line

  useEffect(() => {
    if (activeTab === 'errors') fetchErrorLogs(1, errorFilter);
  }, [activeTab]); // eslint-disable-line

  const fetchAgentPlayers = async (agentId) => {
    try {
      const r = await axios.get(`${API_URL}/agents/${agentId}/players`, H);
      setAgentPlayers({ agentId, rows: r.data });
    } catch (e) { alert(e.response?.data?.error || '載入失敗'); }
  };

  const fetchSettlement = async (agentId) => {
    if (!settlementRange.from || !settlementRange.to) return alert('請選擇起迄日期');
    try {
      const r = await axios.get(`${API_URL}/agents/${agentId}/settlement?from=${settlementRange.from}&to=${settlementRange.to}`, H);
      setAgentSettlement(r.data);
    } catch (e) { alert(e.response?.data?.error || '載入失敗'); }
  };

  const submitAgent = async () => {
    if (!agentForm.name || !agentForm.referral_code) return alert('名稱和推薦碼為必填');
    setAgentLoading(true);
    try {
      if (editingAgent) {
        await axios.put(`${API_URL}/agents/${editingAgent.id}`, agentForm, H);
      } else {
        await axios.post(`${API_URL}/agents`, agentForm, H);
      }
      setShowAddAgent(false);
      setEditingAgent(null);
      setAgentForm({ name:'', referral_code:'', contact:'', credit_limit:'' });
      fetchAgents();
    } catch (e) { alert(e.response?.data?.error || '操作失敗'); }
    finally { setAgentLoading(false); }
  };

  const deleteAgent = async (agent) => {
    if (!window.confirm(`確定刪除代理「${agent.name}」？`)) return;
    try {
      await axios.delete(`${API_URL}/agents/${agent.id}`, H);
      fetchAgents();
      if (agentPlayers?.agentId === agent.id) setAgentPlayers(null);
    } catch (e) { alert(e.response?.data?.error || '刪除失敗'); }
  };

  const handleLogin = (token, refreshToken) => {
    localStorage.setItem('admin_refresh_token', refreshToken);
    _setAccessToken(token);
    setIsAuthenticated(true);
  };
  const handleLogout = async () => {
    const rt = localStorage.getItem('admin_refresh_token');
    if (rt) {
        try { await axios.post(`${BASE_URL}/api/admin/logout`, { refreshToken: rt }); } catch {}
    }
    localStorage.removeItem('admin_refresh_token');
    _accessToken = null;
    H = { headers: {} };
    setIsAuthenticated(false);
    setGameState(null);
    setShowIdleWarning(false);
    clearTimeout(idleTimerRef.current);
    clearInterval(warningTimerRef.current);
  };

  // 驗證中
  if (isAuthenticated === null) return <div className="loading">⏳ 驗證中…</div>;
  // 未登入 → 顯示登入頁（必須在 gameState 判斷之前）
  if (!isAuthenticated) return <LoginPage onLogin={handleLogin} />;

  if (!gameState) return <div className="loading">⏳ 正在連線遊戲伺服器…</div>;

  const { hands, results, winners, status, tableBets, theoreticalPnl, isPaused, countdown } = gameState;
  const totalBets = tableBets ? Object.values(tableBets).reduce((s,v)=>s+(v||0),0) : 0;

  return (
    <div className="admin-container">

      {/* ── 閒置警告彈窗 ── */}
      {showIdleWarning && (
        <div style={{
          position:'fixed', inset:0, zIndex:9999,
          background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center'
        }}>
          <div style={{
            background:'#1e293b', border:'1px solid #f59e0b', borderRadius:'12px',
            padding:'32px 40px', textAlign:'center', maxWidth:'360px', color:'#f8fafc'
          }}>
            <div style={{fontSize:'48px', marginBottom:'12px'}}>⚠️</div>
            <div style={{fontSize:'18px', fontWeight:700, marginBottom:'8px'}}>閒置逾時警告</div>
            <div style={{color:'#94a3b8', marginBottom:'16px'}}>您已閒置 15 分鐘，將在以下時間後自動登出：</div>
            <div style={{fontSize:'48px', fontWeight:700, color:'#f59e0b', marginBottom:'20px'}}>{idleCountdown}s</div>
            <button
              onClick={() => { resetIdleTimer(); }}
              style={{
                background:'#2563eb', color:'#fff', border:'none', borderRadius:'8px',
                padding:'10px 28px', fontSize:'15px', cursor:'pointer', fontWeight:600
              }}
            >繼續使用</button>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="admin-header">
        <div className="header-top">
          <h1>⚙️ Prestige 管理後台</h1>
          <div className="header-controls">
            <div className={`status-badge ${status ?? 'BETTING'}`}>{PHASE_LABELS[status] ?? '下注中'}</div>
            <span className="countdown-badge">⏱ {displayCountdown ?? countdown ?? '--'}s</span>
            <span className="clock-badge">🕐 {clockTime}</span>
            {isPaused
              ? <button className="ctrl-btn resume" onClick={()=>control('resume')}>▶ 恢復</button>
              : <button className="ctrl-btn pause"  onClick={()=>control('pause')}>⏸ 暫停</button>
            }
            <button className="ctrl-btn extend" onClick={()=>control('extend',30)}>+30s</button>
            <button
              onClick={toggleMaintenance}
              disabled={maintenanceLoading}
              style={{
                padding:'5px 12px', borderRadius:6, cursor:'pointer',
                fontSize:'0.78rem', fontWeight:700,
                background: isMaintenance ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.15)',
                color: isMaintenance ? '#f87171' : '#86efac',
                border: `1px solid ${isMaintenance ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.3)'}`,
              }}
            >
              {isMaintenance ? '🔴 維護中' : '🟢 正常'}
            </button>
            <button className="ctrl-btn" onClick={handleLogout}
              style={{background:'rgba(239,68,68,0.15)',color:'#f87171',border:'1px solid rgba(239,68,68,0.3)'}}>
              登出
            </button>
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

        {/* ── Tab 3: 玩家管理 ── */}
        {activeTab==='balance' && (() => {
          const totalPages = Math.ceil(allPlayersTotal / 20);
          const daysAgo = (d) => {
            if (!d) return '從未登入';
            const diff = Math.floor((Date.now() - new Date(d)) / 86400000);
            if (diff === 0) return '今天';
            if (diff === 1) return '昨天';
            return `${diff} 天前`;
          };
          return (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <h2 style={{ margin:0 }}>👤 玩家管理</h2>
              <span style={{ color:'#64748b', fontSize:'0.85rem' }}>共 {allPlayersTotal} 名玩家</span>
            </div>

            <div style={{ display:'flex', gap:16, alignItems:'flex-start' }}>

              {/* ── 左側：玩家列表 ── */}
              <div style={{ flex:'0 0 56%', minWidth:0 }}>

                {/* 篩選列 */}
                <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
                  <input className="admin-input" style={{ flex:1, minWidth:120 }}
                    placeholder="搜尋帳號…"
                    value={allPlayersSearch}
                    onChange={e => setAllPlayersSearch(e.target.value)}
                    onKeyDown={e => e.key==='Enter' && fetchAllPlayers(1, allPlayersAgent, allPlayersSearch)} />
                  <select className="admin-input" style={{ width:140 }}
                    value={allPlayersAgent}
                    onChange={e => { setAllPlayersAgent(e.target.value); fetchAllPlayers(1, e.target.value, allPlayersSearch); }}>
                    <option value="">全部代理</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <button className="ctrl-btn" style={{ background:'#2563eb' }}
                    onClick={() => fetchAllPlayers(1, allPlayersAgent, allPlayersSearch)}
                    disabled={allPlayersLoading}>
                    {allPlayersLoading ? '…' : '🔍'}
                  </button>
                </div>

                {/* 列表 */}
                <div style={{ overflowX:'auto' }}>
                  <table className="data-table" style={{ width:'100%' }}>
                    <thead>
                      <tr><th>帳號</th><th>代理</th><th>餘額</th><th>累計投注</th><th>盈虧</th><th>最後登入</th></tr>
                    </thead>
                    <tbody>
                      {allPlayers.length === 0 && !allPlayersLoading && (
                        <tr><td colSpan={6} style={{ textAlign:'center', color:'#64748b' }}>查無玩家</td></tr>
                      )}
                      {allPlayers.map(p => (
                        <tr key={p.id}
                          onClick={() => fetchPlayerDetail(p)}
                          style={{ cursor:'pointer', background: selectedPlayer?.id===p.id ? 'rgba(37,99,235,0.18)':'' }}>
                          <td>
                            <strong style={{ color: selectedPlayer?.id===p.id ? '#1d4ed8':'#0f172a' }}>{p.username}</strong>
                            {p.is_banned ? <span style={{ marginLeft:6, fontSize:'0.68rem', background:'#dc2626', color:'#fff', borderRadius:4, padding:'1px 5px' }}>封鎖</span> : null}
                          </td>
                          <td style={{ fontSize:'0.82rem' }}>
                            {p.agent_name
                              ? <span style={{ color:'#60a5fa' }}>{p.agent_name}</span>
                              : <span style={{ color:'#f87171', fontSize:'0.75rem' }}>未綁定</span>}
                          </td>
                          <td style={{ color:'#fbbf24', fontWeight:700 }}>${fmt(p.balance)}</td>
                          <td style={{ color:'#94a3b8', fontSize:'0.85rem' }}>${fmt(p.total_bet)}</td>
                          <td style={{ color: Number(p.total_net) <= 0 ? '#4ade80':'#f87171', fontSize:'0.85rem' }}>
                            {Number(p.total_net) <= 0 ? '' : '+'}{fmt(p.total_net)}
                          </td>
                          <td style={{ fontSize:'0.78rem', color:'#64748b' }}>{daysAgo(p.last_login_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 分頁 */}
                <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:8, padding:'10px 0', marginTop:4 }}>
                  <button className="ctrl-btn" style={{ padding:'3px 12px', background:'#334155', fontSize:13 }}
                    disabled={allPlayersPage <= 1}
                    onClick={() => fetchAllPlayers(allPlayersPage - 1)}>＜</button>
                  <span style={{ color:'#94a3b8', fontSize:13 }}>{allPlayersPage} / {totalPages || 1}</span>
                  <button className="ctrl-btn" style={{ padding:'3px 12px', background:'#334155', fontSize:13 }}
                    disabled={allPlayersPage >= totalPages}
                    onClick={() => fetchAllPlayers(allPlayersPage + 1)}>＞</button>
                </div>

                {/* 未綁定區塊（收合式） */}
                {unboundPlayers.length > 0 && (
                  <details style={{ marginTop:12 }}>
                    <summary style={{ cursor:'pointer', color:'#f59e0b', fontWeight:600, fontSize:'0.9rem', padding:'8px 0' }}>
                      ⚠️ 未綁定代理玩家（{unboundPlayers.length} 人）— 點擊展開補綁
                    </summary>
                    <table className="data-table" style={{ width:'100%', marginTop:8 }}>
                      <thead><tr><th>帳號</th><th>餘額</th><th>指定代理</th></tr></thead>
                      <tbody>
                        {unboundPlayers.map(p => (
                          <tr key={p.id}>
                            <td>{p.username}</td>
                            <td>${fmt(p.balance)}</td>
                            <td>
                              <div style={{ display:'flex', gap:6 }}>
                                <select style={{ background:'#1e293b', border:'1px solid #334155', borderRadius:4, color:'#f8fafc', padding:'2px 6px', fontSize:12 }}
                                  defaultValue="" id={`agent-sel-${p.id}`}>
                                  <option value="" disabled>選擇代理</option>
                                  {agents.map(a => <option key={a.id} value={a.id}>{a.name}（{a.referral_code}）</option>)}
                                </select>
                                <button className="ctrl-btn" style={{ fontSize:11, padding:'2px 8px', background:'#7c3aed' }}
                                  onClick={() => {
                                    const sel = document.getElementById(`agent-sel-${p.id}`);
                                    if (!sel.value) return alert('請先選擇代理');
                                    assignAgent(p.id, Number(sel.value));
                                  }}>綁定</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                )}
              </div>

              {/* ── 右側：玩家詳情 ── */}
              <div style={{ flex:1, minWidth:0, background:'#0f172a', borderRadius:10, border:'1px solid #1e293b', padding:20, minHeight:500 }}>
                {!selectedPlayer ? (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:400, color:'#334155' }}>
                    <div style={{ fontSize:48 }}>👈</div>
                    <div style={{ marginTop:12, fontSize:'0.9rem' }}>點擊左側玩家查看詳情</div>
                  </div>
                ) : detailLoading ? (
                  <div style={{ textAlign:'center', padding:40, color:'#64748b' }}>載入中…</div>
                ) : playerDetail ? (() => {
                  const u = playerDetail.user;
                  return (
                    <div>
                      {/* 頭部 */}
                      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20, paddingBottom:16, borderBottom:'1px solid #1e293b' }}>
                        <div style={{ width:48, height:48, borderRadius:'50%', background:'linear-gradient(135deg,#2563eb,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700 }}>
                          {u.username[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <span style={{ fontWeight:700, fontSize:'1.1rem' }}>{u.username}</span>
                            {u.is_banned && <span style={{ fontSize:'0.7rem', background:'#dc2626', color:'#fff', borderRadius:4, padding:'2px 7px', fontWeight:700 }}>已封鎖</span>}
                          </div>
                          <div style={{ color:'#64748b', fontSize:'0.8rem', marginTop:2 }}>
                            ID #{u.id} &nbsp;·&nbsp;
                            {u.agent_name
                              ? <span style={{ color:'#60a5fa' }}>代理：{u.agent_name}</span>
                              : <span style={{ color:'#f87171' }}>未綁定代理</span>}
                          </div>
                        </div>
                        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
                          <button
                            onClick={() => banPlayer(u)}
                            style={{
                              padding:'5px 12px', borderRadius:6, cursor:'pointer', fontSize:'0.78rem', fontWeight:700,
                              background: u.is_banned ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                              color: u.is_banned ? '#86efac' : '#f87171',
                              border: `1px solid ${u.is_banned ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                            }}>
                            {u.is_banned ? '✅ 解鎖' : '🚫 封鎖'}
                          </button>
                          <button className="ctrl-btn" style={{ background:'#1e293b', fontSize:12 }}
                            onClick={() => { setSelectedPlayer(null); setPlayerDetail(null); }}>✕</button>
                        </div>
                      </div>

                      {/* 財務統計 */}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
                        {[
                          { label:'當前餘額', value:`$${fmt(u.balance)}`, color:'#fbbf24' },
                          { label:'累計投注', value:`$${fmt(u.total_bet)}`, color:'#f8fafc' },
                          { label:'投注次數', value:`${fmt(u.bet_count)} 局`, color:'#94a3b8' },
                          { label:'累計盈虧', value:`${Number(u.total_net)<=0?'':'+'}${fmt(u.total_net)}`, color: Number(u.total_net)<=0?'#4ade80':'#f87171' },
                        ].map(item => (
                          <div key={item.label} style={{ background:'#1e293b', borderRadius:8, padding:'10px 14px' }}>
                            <div style={{ color:'#64748b', fontSize:'0.75rem', marginBottom:4 }}>{item.label}</div>
                            <div style={{ color:item.color, fontWeight:700, fontSize:'1.05rem' }}>{item.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* 時間資訊 */}
                      <div style={{ display:'flex', gap:16, marginBottom:20, fontSize:'0.8rem', color:'#64748b' }}>
                        <span>加入：{new Date(u.created_at).toLocaleDateString('zh-TW')}</span>
                        <span>最後登入：{daysAgo(u.last_login_at)}</span>
                      </div>

                      {/* 調整餘額 */}
                      <div style={{ background:'#1e293b', borderRadius:8, padding:14, marginBottom:20 }}>
                        <div style={{ color:'#94a3b8', fontSize:'0.8rem', marginBottom:10 }}>開分 / 扣分</div>
                        <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
                          <input type="number" placeholder="正數開分，負數扣分"
                            style={{ flex:1, background:'#0f172a', border:'1px solid #334155', borderRadius:6, color:'#f8fafc', padding:'6px 10px', fontSize:14 }}
                            value={detailAdj}
                            onChange={e => setDetailAdj(e.target.value)}
                            onKeyDown={e => e.key==='Enter' && detailAdjustBalance(u)} />
                          <button className="ctrl-btn" style={{ background:'#16a34a', whiteSpace:'nowrap' }}
                            onClick={() => detailAdjustBalance(u)}>確認調整</button>
                        </div>
                        <input placeholder="備註（選填，例：測試金）"
                          style={{ width:'100%', boxSizing:'border-box', background:'#0f172a', border:'1px solid #334155', borderRadius:6, color:'#94a3b8', padding:'5px 10px', fontSize:12 }}
                          value={detailNote}
                          onChange={e => setDetailNote(e.target.value)} />
                      </div>

                      {/* 換代理 */}
                      <div style={{ background:'#1e293b', borderRadius:8, padding:14, marginBottom:20 }}>
                        <div style={{ color:'#94a3b8', fontSize:'0.8rem', marginBottom:10 }}>更換所屬代理</div>
                        <div style={{ display:'flex', gap:8 }}>
                          <select style={{ flex:1, background:'#0f172a', border:'1px solid #334155', borderRadius:6, color:'#f8fafc', padding:'6px 10px', fontSize:13 }}
                            defaultValue={u.agent_id || ''} id={`detail-agent-${u.id}`}>
                            <option value="">無代理</option>
                            {agents.map(a => <option key={a.id} value={a.id}>{a.name}（{a.referral_code}）</option>)}
                          </select>
                          <button className="ctrl-btn" style={{ background:'#7c3aed', whiteSpace:'nowrap' }}
                            onClick={async () => {
                              const sel = document.getElementById(`detail-agent-${u.id}`);
                              await assignAgent(u.id, sel.value ? Number(sel.value) : null);
                              setPlayerDetail(prev => prev ? { ...prev, user: { ...prev.user, agent_id: sel.value ? Number(sel.value) : null, agent_name: agents.find(a=>a.id===Number(sel.value))?.name || null } } : prev);
                            }}>更換</button>
                        </div>
                      </div>

                      {/* 最近投注紀錄 */}
                      <div style={{ marginBottom:20 }}>
                        <div style={{ color:'#94a3b8', fontSize:'0.8rem', marginBottom:10 }}>最近 10 筆投注紀錄</div>
                        {playerDetail.recentBets.length === 0
                          ? <div style={{ color:'#334155', fontSize:'0.85rem' }}>尚無投注紀錄</div>
                          : (
                            <table className="data-table" style={{ width:'100%', fontSize:'0.8rem' }}>
                              <thead>
                                <tr><th>時間</th><th>投注</th><th>結果</th><th>盈虧</th></tr>
                              </thead>
                              <tbody>
                                {playerDetail.recentBets.map((b, i) => {
                                  const wins = [b.tian_win, b.di_win, b.xuan_win, b.huang_win].filter(Boolean).length;
                                  return (
                                    <tr key={i}>
                                      <td style={{ color:'#64748b', whiteSpace:'nowrap' }}>{new Date(b.settled_at).toLocaleString('zh-TW',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
                                      <td>${fmt(b.bet_total)}</td>
                                      <td style={{ color:'#94a3b8' }}>{b.banker_type} · 贏{wins}門</td>
                                      <td style={{ color: Number(b.net)>=0?'#4ade80':'#f87171', fontWeight:600 }}>
                                        {Number(b.net)>=0?'+':''}{fmt(b.net)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )
                        }
                      </div>

                      {/* 開分紀錄 */}
                      <div>
                        <div style={{ color:'#94a3b8', fontSize:'0.8rem', marginBottom:10 }}>最近 10 筆開分紀錄</div>
                        {balanceLogsLoading
                          ? <div style={{ color:'#334155', fontSize:'0.85rem' }}>載入中…</div>
                          : balanceLogs.length === 0
                          ? <div style={{ color:'#334155', fontSize:'0.85rem' }}>尚無開分紀錄</div>
                          : (
                            <table className="data-table" style={{ width:'100%', fontSize:'0.78rem' }}>
                              <thead>
                                <tr><th>時間</th><th>操作者</th><th>異動</th><th>異動前</th><th>異動後</th><th>備註</th></tr>
                              </thead>
                              <tbody>
                                {balanceLogs.map((b, i) => (
                                  <tr key={i}>
                                    <td style={{ color:'#64748b', whiteSpace:'nowrap' }}>{new Date(b.created_at).toLocaleString('zh-TW',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
                                    <td style={{ color:'#60a5fa' }}>{b.admin_username}</td>
                                    <td style={{ color: Number(b.amount)>=0?'#4ade80':'#f87171', fontWeight:700 }}>
                                      {Number(b.amount)>=0?'+':''}{fmt(b.amount)}
                                    </td>
                                    <td style={{ color:'#94a3b8' }}>${fmt(b.balance_before)}</td>
                                    <td style={{ color:'#fbbf24' }}>${fmt(b.balance_after)}</td>
                                    <td style={{ color:'#64748b' }}>{b.note || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )
                        }
                      </div>
                    </div>
                  );
                })() : null}
              </div>

            </div>
          </div>
          );
        })()}


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

            {/* 清除資料按鈕 */}
            <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10 }}>
              <button
                onClick={async () => {
                  if (!window.confirm('確定要清除所有牌局紀錄與投注紀錄？此操作不可逆。')) return;
                  try {
                    await axios.delete(`${API_URL}/clear-data`, H);
                    setLastMessage('🗑️ 資料已清除');
                    setRounds([]); setRoundsTotal(0); setRoundsStats(null);
                  } catch (e) { alert(e.response?.data?.error || '清除失敗'); }
                }}
                style={{
                  padding:'6px 18px', borderRadius:8, border:'1px solid rgba(239,68,68,0.4)',
                  background:'rgba(239,68,68,0.1)', color:'#f87171',
                  cursor:'pointer', fontSize:'0.82rem', fontWeight:600,
                }}
              >
                🗑️ 清除所有紀錄
              </button>
            </div>

            {roundsStats && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:10, marginBottom:20 }}>
                {[
                  { label:'統計局數',   val: fmt(roundsStats.total_rounds),          color:'#0f172a' },
                  { label:'目標勝率',   val: `${roundsStats.target_win_rate_pct}%`,   color:'#92400e' },
                  { label:'實際勝率',   val: `${roundsStats.actual_win_rate_pct}%`,   color: Math.abs(roundsStats.actual_win_rate_pct - roundsStats.target_win_rate_pct) <= 3 ? '#166534' : '#991b1b' },
                  { label:'莊家獲利',   val: `$${fmt(roundsStats.house_profit)}`,     color: roundsStats.house_profit >= 0 ? '#166534' : '#991b1b' },
                  { label:'總下注額',   val: `$${fmt(roundsStats.total_bet)}`,         color:'#1e40af' },
                  { label:'換牌次數',   val: fmt(roundsStats.swap_count),             color:'#9a3412' },
                  { label:'指定牌型',   val: fmt(roundsStats.force_count),            color:'#9a3412' },
                  { label:'放水失敗',   val: fmt(roundsStats.total_failed_releases),  color: roundsStats.total_failed_releases > 0 ? '#991b1b' : '#475569' },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ background:'#f8fafc', borderRadius:10, padding:'10px 14px', border:'1px solid #e2e8f0' }}>
                    <div style={{ color:'#64748b', fontSize:'0.72rem', marginBottom:4 }}>{label}</div>
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
              <div className="banned-info-title">目前發牌模式</div>
              <div className="banned-info-row">
                <span>發牌方式</span>
                <strong style={{color:'#4ade80'}}>純隨機發牌（RNG）</strong>
              </div>
              <div className="banned-info-row">
                <span>莊家優勢來源</span>
                <strong style={{color:'#facc15'}}>5% 手續費 + 雙無牛莊家恆贏</strong>
              </div>
              <div className="banned-info-row">
                <span>預期莊家自然勝率</span>
                <strong style={{color:'#60a5fa'}}>約 52–55%</strong>
              </div>
              <div className="banned-info-note">* 純隨機模式下長期期望獲利約 5–10%，無需手動控制勝率</div>
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

        {/* ── Tab: 代理管理 ── */}
        {activeTab==='agents' && (
          <div className="section-box">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h2>🤝 代理管理</h2>
              <button className="ctrl-btn" style={{ background:'#16a34a' }}
                onClick={() => { setEditingAgent(null); setAgentForm({ name:'', referral_code:'', contact:'', credit_limit:'' }); setShowAddAgent(true); }}>
                ＋ 新增代理
              </button>
            </div>

            {/* 新增/編輯表單 */}
            {showAddAgent && (
              <div style={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, padding:20, marginBottom:20 }}>
                <h3 style={{ marginBottom:14 }}>{editingAgent ? '✏️ 編輯代理' : '＋ 新增代理'}</h3>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:10, marginBottom:12 }}>
                  <div>
                    <div style={{ color:'#94a3b8', fontSize:12, marginBottom:4 }}>代理名稱 *</div>
                    <input className="admin-input" value={agentForm.name}
                      onChange={e => setAgentForm(f=>({...f, name:e.target.value}))} placeholder="例：張代理" />
                  </div>
                  <div>
                    <div style={{ color:'#94a3b8', fontSize:12, marginBottom:4 }}>推薦碼 *{editingAgent && ' (不可修改)'}</div>
                    <input className="admin-input" value={agentForm.referral_code} disabled={!!editingAgent}
                      onChange={e => setAgentForm(f=>({...f, referral_code:e.target.value.toUpperCase()}))} placeholder="例：AGT001" />
                  </div>
                  <div>
                    <div style={{ color:'#94a3b8', fontSize:12, marginBottom:4 }}>聯絡方式</div>
                    <input className="admin-input" value={agentForm.contact}
                      onChange={e => setAgentForm(f=>({...f, contact:e.target.value}))} placeholder="LINE / 電話" />
                  </div>
                  <div>
                    <div style={{ color:'#94a3b8', fontSize:12, marginBottom:4 }}>信用額度上限</div>
                    <input className="admin-input" type="number" value={agentForm.credit_limit}
                      onChange={e => setAgentForm(f=>({...f, credit_limit:e.target.value}))} placeholder="0" />
                  </div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="ctrl-btn" style={{ background:'#2563eb' }} onClick={submitAgent} disabled={agentLoading}>
                    {agentLoading ? '處理中…' : (editingAgent ? '儲存' : '新增')}
                  </button>
                  <button className="ctrl-btn" style={{ background:'#475569' }}
                    onClick={() => { setShowAddAgent(false); setEditingAgent(null); }}>取消</button>
                </div>
              </div>
            )}

            {/* 代理列表 */}
            <table className="data-table" style={{ width:'100%', marginBottom:24 }}>
              <thead>
                <tr><th>代理名稱</th><th>推薦碼</th><th>聯絡</th><th>信用上限</th><th>玩家數</th><th>旗下總餘額</th><th>操作</th></tr>
              </thead>
              <tbody>
                {agents.length === 0 && <tr><td colSpan={7} style={{ textAlign:'center', color:'#64748b' }}>尚無代理</td></tr>}
                {agents.map(ag => (
                  <tr key={ag.id} style={{ background: agentPlayers?.agentId===ag.id ? 'rgba(37,99,235,0.1)':'' }}>
                    <td><strong>{ag.name}</strong></td>
                    <td><code style={{ background:'#1e293b', padding:'2px 6px', borderRadius:4 }}>{ag.referral_code}</code></td>
                    <td style={{ color:'#94a3b8', fontSize:'0.85rem' }}>{ag.contact || '—'}</td>
                    <td>${fmt(ag.credit_limit)}</td>
                    <td>{ag.player_count} 人</td>
                    <td style={{ color: ag.total_balance > 0 ? '#4ade80':'#94a3b8' }}>${fmt(ag.total_balance)}</td>
                    <td>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        <button className="ctrl-btn" style={{ fontSize:12, padding:'3px 10px', background:'#0284c7' }}
                          onClick={() => { setAgentSettlement(null); fetchAgentPlayers(ag.id); }}>查看玩家</button>
                        <button className="ctrl-btn" style={{ fontSize:12, padding:'3px 10px', background:'#7c3aed' }}
                          onClick={() => { setAgentPlayers(null); setAgentSettlement(null); setSettlementRange({from:'',to:''}); fetchAgentPlayers(ag.id); document.getElementById('settlement-section')?.scrollIntoView(); }}>結算</button>
                        <button className="ctrl-btn" style={{ fontSize:12, padding:'3px 10px', background:'#475569' }}
                          onClick={() => { setEditingAgent(ag); setAgentForm({ name:ag.name, referral_code:ag.referral_code, contact:ag.contact||'', credit_limit:ag.credit_limit }); setShowAddAgent(true); }}>編輯</button>
                        <button className="ctrl-btn" style={{ fontSize:12, padding:'3px 10px', background:'#991b1b' }}
                          onClick={() => deleteAgent(ag)}>刪除</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 玩家清單 */}
            {agentPlayers && (
              <div className="section-box" style={{ marginBottom:20 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <h3>👥 {agents.find(a=>a.id===agentPlayers.agentId)?.name} 的玩家（{agentPlayers.rows.length} 人）</h3>
                  <button className="ctrl-btn" style={{ background:'#475569', fontSize:12 }} onClick={() => setAgentPlayers(null)}>關閉</button>
                </div>
                <table className="data-table" style={{ width:'100%' }}>
                  <thead>
                    <tr><th>帳號</th><th>當前餘額</th><th>累計投注</th><th>累計盈虧</th><th>最後登入</th><th>加入時間</th></tr>
                  </thead>
                  <tbody>
                    {agentPlayers.rows.length === 0 && <tr><td colSpan={6} style={{ textAlign:'center', color:'#64748b' }}>尚無玩家</td></tr>}
                    {agentPlayers.rows.map(p => (
                      <tr key={p.id}>
                        <td><strong>{p.username}</strong></td>
                        <td>${fmt(p.balance)}</td>
                        <td>${fmt(p.total_bet)}</td>
                        <td style={{ color: p.total_net >= 0 ? '#4ade80':'#f87171' }}>
                          {p.total_net >= 0 ? '+' : ''}${fmt(p.total_net)}
                        </td>
                        <td style={{ fontSize:'0.8rem', color:'#94a3b8' }}>
                          {p.last_login_at ? new Date(p.last_login_at).toLocaleString('zh-TW') : '從未登入'}
                        </td>
                        <td style={{ fontSize:'0.8rem', color:'#94a3b8' }}>{new Date(p.created_at).toLocaleDateString('zh-TW')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* 結算區 */}
                <div id="settlement-section" style={{ marginTop:20, background:'#0f172a', borderRadius:8, padding:16 }}>
                  <h4 style={{ marginBottom:12 }}>📊 結算報表</h4>
                  <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:12, flexWrap:'wrap' }}>
                    <div>
                      <span style={{ color:'#94a3b8', fontSize:12 }}>起始日期</span>
                      <input type="date" className="admin-input" style={{ marginLeft:6 }}
                        value={settlementRange.from} onChange={e => setSettlementRange(r=>({...r, from:e.target.value}))} />
                    </div>
                    <div>
                      <span style={{ color:'#94a3b8', fontSize:12 }}>結束日期</span>
                      <input type="date" className="admin-input" style={{ marginLeft:6 }}
                        value={settlementRange.to} onChange={e => setSettlementRange(r=>({...r, to:e.target.value}))} />
                    </div>
                    <button className="ctrl-btn" style={{ background:'#7c3aed' }}
                      onClick={() => fetchSettlement(agentPlayers.agentId)}>計算結算</button>
                  </div>

                  {agentSettlement && (
                    <div>
                      <div style={{ display:'flex', gap:24, marginBottom:12, flexWrap:'wrap' }}>
                        <div style={{ background:'#1e293b', borderRadius:8, padding:'12px 20px', textAlign:'center' }}>
                          <div style={{ color:'#94a3b8', fontSize:12 }}>期間總投注</div>
                          <div style={{ fontSize:'1.3rem', fontWeight:700 }}>${fmt(agentSettlement.totalBet)}</div>
                        </div>
                        <div style={{ background:'#1e293b', borderRadius:8, padding:'12px 20px', textAlign:'center' }}>
                          <div style={{ color:'#94a3b8', fontSize:12 }}>玩家淨盈虧</div>
                          <div style={{ fontSize:'1.3rem', fontWeight:700, color: agentSettlement.totalNet >= 0 ? '#4ade80':'#f87171' }}>
                            {agentSettlement.totalNet >= 0 ? '+' : ''}${fmt(agentSettlement.totalNet)}
                          </div>
                        </div>
                        <div style={{ background:'#7c3aed22', border:'1px solid #7c3aed', borderRadius:8, padding:'12px 20px', textAlign:'center' }}>
                          <div style={{ color:'#94a3b8', fontSize:12 }}>代理應付你</div>
                          <div style={{ fontSize:'1.4rem', fontWeight:700, color:'#a78bfa' }}>
                            ${fmt(Math.abs(agentSettlement.totalNet))}
                            <span style={{ fontSize:12, color:'#94a3b8', marginLeft:6 }}>
                              {agentSettlement.totalNet < 0 ? '（玩家贏，代理向你收）' : '（玩家輸，代理付你）'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <table className="data-table" style={{ width:'100%' }}>
                        <thead>
                          <tr><th>帳號</th><th>期間投注</th><th>期間輸贏</th><th>結算後餘額</th></tr>
                        </thead>
                        <tbody>
                          {agentSettlement.players.map(p => (
                            <tr key={p.id}>
                              <td>{p.username}</td>
                              <td>${fmt(p.period_bet)}</td>
                              <td style={{ color: p.period_net >= 0 ? '#4ade80':'#f87171' }}>
                                {p.period_net >= 0 ? '+' : ''}${fmt(p.period_net)}
                              </td>
                              <td>${fmt(p.balance)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: 系統管理 ── */}
        {activeTab==='sysadmin' && (
          <div className="section-box">
            <h2>🔐 系統管理</h2>

            {/* 維護模式 */}
            <div className="section-box" style={{ marginBottom:20 }}>
              <h3 style={{ marginBottom:14 }}>維護模式</h3>
              <div style={{ display:'flex', alignItems:'center', gap:20, flexWrap:'wrap' }}>
                <div style={{ background: isMaintenance ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)', border:`1px solid ${isMaintenance?'rgba(239,68,68,0.35)':'rgba(34,197,94,0.35)'}`, borderRadius:10, padding:'14px 24px', display:'flex', alignItems:'center', gap:16 }}>
                  <div style={{ fontSize:32 }}>{isMaintenance ? '🔴' : '🟢'}</div>
                  <div>
                    <div style={{ fontWeight:700, fontSize:'1.05rem', color: isMaintenance?'#f87171':'#86efac' }}>
                      {isMaintenance ? '維護模式：開啟中' : '維護模式：關閉（正常服務）'}
                    </div>
                    <div style={{ color:'#64748b', fontSize:'0.82rem', marginTop:3 }}>
                      {isMaintenance ? '玩家無法登入或註冊' : '所有玩家可正常登入與遊戲'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={toggleMaintenance}
                  disabled={maintenanceLoading}
                  style={{
                    padding:'10px 28px', borderRadius:8, border:'none', cursor:'pointer', fontWeight:700,
                    background: isMaintenance ? '#16a34a' : '#dc2626',
                    color:'#fff', fontSize:'0.9rem',
                  }}>
                  {maintenanceLoading ? '處理中…' : (isMaintenance ? '關閉維護模式' : '開啟維護模式')}
                </button>
              </div>
              <div style={{ color:'#475569', fontSize:'0.78rem', marginTop:10 }}>
                ⚠️ 開啟維護模式後，系統將向所有在線玩家推送公告通知，並拒絕新的登入請求。
              </div>
            </div>

            {/* 管理員帳號管理 */}
            <div className="section-box">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <h3>管理員帳號</h3>
                <button className="ctrl-btn" style={{ fontSize:12, background:'#334155' }}
                  onClick={fetchAdminAccounts} disabled={adminAccLoading}>
                  {adminAccLoading ? '載入中…' : '🔄 刷新'}
                </button>
              </div>

              {/* 帳號列表 */}
              <table className="data-table" style={{ width:'100%', marginBottom:20 }}>
                <thead>
                  <tr><th>#</th><th>帳號</th><th>建立時間</th><th>操作</th></tr>
                </thead>
                <tbody>
                  {adminAccounts.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign:'center', color:'#64748b' }}>載入中…</td></tr>
                  )}
                  {adminAccounts.map((adm, i) => (
                    <tr key={adm.id}>
                      <td style={{ color:'#64748b' }}>{i+1}</td>
                      <td><strong>{adm.username}</strong></td>
                      <td style={{ color:'#64748b', fontSize:'0.82rem' }}>{new Date(adm.created_at).toLocaleDateString('zh-TW')}</td>
                      <td>
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                          {changePwdId === adm.id ? (
                            <>
                              <input
                                type="password" placeholder="新密碼（至少 6 碼）"
                                value={changePwdVal}
                                onChange={e => setChangePwdVal(e.target.value)}
                                style={{ background:'#0f172a', border:'1px solid #334155', borderRadius:5, color:'#f8fafc', padding:'4px 8px', fontSize:12, width:160 }}
                              />
                              <button className="ctrl-btn" style={{ fontSize:11, padding:'3px 10px', background:'#16a34a' }}
                                onClick={() => changeAdminPassword(adm.id)}>確認</button>
                              <button className="ctrl-btn" style={{ fontSize:11, padding:'3px 10px', background:'#475569' }}
                                onClick={() => { setChangePwdId(null); setChangePwdVal(''); }}>取消</button>
                            </>
                          ) : (
                            <>
                              <button className="ctrl-btn" style={{ fontSize:11, padding:'3px 10px', background:'#0284c7' }}
                                onClick={() => { setChangePwdId(adm.id); setChangePwdVal(''); }}>改密碼</button>
                              <button className="ctrl-btn" style={{ fontSize:11, padding:'3px 10px', background:'#991b1b' }}
                                onClick={() => deleteAdmin(adm)}>刪除</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* 新增管理員 */}
              <div style={{ background:'#0f172a', borderRadius:8, padding:16 }}>
                <div style={{ color:'#94a3b8', fontSize:'0.82rem', marginBottom:12, fontWeight:600 }}>新增管理員帳號</div>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
                  <div>
                    <div style={{ color:'#64748b', fontSize:11, marginBottom:4 }}>帳號</div>
                    <input
                      placeholder="輸入帳號"
                      value={newAdminUsername}
                      onChange={e => setNewAdminUsername(e.target.value)}
                      style={{ background:'#1e293b', border:'1px solid #334155', borderRadius:6, color:'#f8fafc', padding:'7px 12px', fontSize:13, width:160 }}
                    />
                  </div>
                  <div>
                    <div style={{ color:'#64748b', fontSize:11, marginBottom:4 }}>密碼（至少 6 碼）</div>
                    <input
                      type="password" placeholder="輸入密碼"
                      value={newAdminPassword}
                      onChange={e => setNewAdminPassword(e.target.value)}
                      style={{ background:'#1e293b', border:'1px solid #334155', borderRadius:6, color:'#f8fafc', padding:'7px 12px', fontSize:13, width:160 }}
                    />
                  </div>
                  <button className="ctrl-btn" style={{ background:'#2563eb', padding:'7px 20px' }}
                    onClick={createAdmin}>＋ 建立</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 錯誤日誌 ── */}
        {activeTab === 'errors' && (
          <div className="section-box">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10, marginBottom:16 }}>
              <h2 style={{ margin:0 }}>🐛 錯誤日誌</h2>
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <select value={errorFilter.level} onChange={e => {
                    const f = { ...errorFilter, level: e.target.value };
                    setErrorFilter(f); fetchErrorLogs(1, f);
                  }} style={errSel}>
                  <option value="all">全部等級</option>
                  <option value="error">🔴 error</option>
                  <option value="warn">🟡 warn</option>
                </select>
                <select value={errorFilter.source} onChange={e => {
                    const f = { ...errorFilter, source: e.target.value };
                    setErrorFilter(f); fetchErrorLogs(1, f);
                  }} style={errSel}>
                  <option value="all">全部來源</option>
                  <option value="frontend">前端</option>
                  <option value="backend">後端</option>
                </select>
                <button onClick={() => fetchErrorLogs(errorLogsPage, errorFilter)}
                  style={{ padding:'6px 16px', borderRadius:6, border:'1px solid #334155', background:'#1e293b', color:'#94a3b8', cursor:'pointer', fontSize:'0.85rem' }}>
                  重新整理
                </button>
              </div>
            </div>

            <div style={{ color:'#64748b', fontSize:'0.82rem', marginBottom:10 }}>
              共 {errorLogsTotal} 筆，顯示第 {(errorLogsPage-1)*ERROR_PAGE_SIZE+1}–{Math.min(errorLogsPage*ERROR_PAGE_SIZE, errorLogsTotal)} 筆
            </div>

            {errorLogs.length === 0 ? (
              <div style={{ textAlign:'center', color:'#475569', padding:'40px 0', fontSize:'0.95rem' }}>目前沒有錯誤記錄 ✨</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {errorLogs.map(log => {
                  const isErr = log.level === 'error';
                  const expanded = expandedErrId === log.id;
                  let ctx = null;
                  try { ctx = log.context ? JSON.parse(log.context) : null; } catch {}
                  return (
                    <div key={log.id} style={{
                      background: isErr ? 'rgba(239,68,68,0.06)' : 'rgba(234,179,8,0.06)',
                      border: `1px solid ${isErr ? 'rgba(239,68,68,0.25)' : 'rgba(234,179,8,0.25)'}`,
                      borderRadius:8, padding:'10px 14px', cursor:'pointer',
                    }} onClick={() => setExpandedErrId(expanded ? null : log.id)}>
                      <div style={{ display:'flex', gap:8, alignItems:'flex-start', flexWrap:'wrap' }}>
                        <span style={{
                          flexShrink:0, fontSize:'0.72rem', fontWeight:700, padding:'2px 8px', borderRadius:20,
                          background: isErr ? 'rgba(239,68,68,0.2)' : 'rgba(234,179,8,0.2)',
                          color: isErr ? '#f87171' : '#fbbf24',
                        }}>{isErr ? '● ERROR' : '● WARN'}</span>
                        <span style={{ flexShrink:0, fontSize:'0.72rem', padding:'2px 8px', borderRadius:20, background:'rgba(99,102,241,0.15)', color:'#a5b4fc' }}>
                          {log.source === 'frontend' ? '前端' : '後端'}
                        </span>
                        {log.username && (
                          <span style={{ flexShrink:0, fontSize:'0.72rem', padding:'2px 8px', borderRadius:20, background:'rgba(16,185,129,0.12)', color:'#6ee7b7' }}>
                            👤 {log.username}
                          </span>
                        )}
                        <span style={{ flex:1, color:'#cbd5e1', fontSize:'0.88rem', wordBreak:'break-word' }}>{log.message}</span>
                        <span style={{ flexShrink:0, color:'#475569', fontSize:'0.75rem', whiteSpace:'nowrap' }}>
                          {new Date(log.created_at).toLocaleString('zh-TW')}
                        </span>
                      </div>

                      {expanded && (
                        <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:6 }}>
                          {ctx && (
                            <div style={{ background:'rgba(0,0,0,0.3)', borderRadius:6, padding:'8px 12px', fontSize:'0.8rem', color:'#94a3b8' }}>
                              <b style={{ color:'#64748b' }}>Context：</b>
                              <pre style={{ margin:0, whiteSpace:'pre-wrap', wordBreak:'break-all' }}>{JSON.stringify(ctx, null, 2)}</pre>
                            </div>
                          )}
                          {log.stack && (
                            <div style={{ background:'rgba(0,0,0,0.4)', borderRadius:6, padding:'8px 12px' }}>
                              <div style={{ color:'#64748b', fontSize:'0.75rem', marginBottom:4 }}>Stack Trace：</div>
                              <pre style={{ margin:0, fontSize:'0.75rem', color:'#f87171', whiteSpace:'pre-wrap', wordBreak:'break-all', maxHeight:200, overflowY:'auto' }}>{log.stack}</pre>
                            </div>
                          )}
                          {log.user_agent && (
                            <div style={{ color:'#475569', fontSize:'0.72rem' }}>UA：{log.user_agent}</div>
                          )}
                          {log.ip && (
                            <div style={{ color:'#475569', fontSize:'0.72rem' }}>IP：{log.ip}</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 分頁 */}
            {errorLogsTotal > ERROR_PAGE_SIZE && (
              <div style={{ display:'flex', gap:8, justifyContent:'center', marginTop:16 }}>
                <button disabled={errorLogsPage <= 1}
                  onClick={() => fetchErrorLogs(errorLogsPage - 1, errorFilter)}
                  style={{ ...errPageBtn, opacity: errorLogsPage <= 1 ? 0.4 : 1 }}>◀ 上一頁</button>
                <span style={{ color:'#64748b', lineHeight:'32px', fontSize:'0.85rem' }}>
                  {errorLogsPage} / {Math.ceil(errorLogsTotal / ERROR_PAGE_SIZE)}
                </span>
                <button disabled={errorLogsPage >= Math.ceil(errorLogsTotal / ERROR_PAGE_SIZE)}
                  onClick={() => fetchErrorLogs(errorLogsPage + 1, errorFilter)}
                  style={{ ...errPageBtn, opacity: errorLogsPage >= Math.ceil(errorLogsTotal / ERROR_PAGE_SIZE) ? 0.4 : 1 }}>下一頁 ▶</button>
              </div>
            )}
          </div>
        )}

      </div>

      <footer className="admin-footer">
        牌局控制說明：下注階段可換牌與指定牌型；發牌後自動鎖定。
      </footer>
    </div>
  );
}

const errSel = {
  padding:'6px 10px', borderRadius:6, border:'1px solid #334155',
  background:'#1e293b', color:'#cbd5e1', fontSize:'0.85rem', cursor:'pointer',
};
const errPageBtn = {
  padding:'6px 16px', borderRadius:6, border:'1px solid #334155',
  background:'#1e293b', color:'#94a3b8', cursor:'pointer', fontSize:'0.85rem',
};

export default App;
