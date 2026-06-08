import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';

const API_URL      = "http://localhost:3001/api/admin";
const ADMIN_SECRET = "Prestige_Admin_X7k9_2026";
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
  { id:'announce', label:'📢 公告推播' },
];

// ─── Main ────────────────────────────────────────────────────────
function App() {
  const [gameState,    setGameState]    = useState(null);
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

  const fetchStatus = useCallback(async () => {
    try { const r = await axios.get(`${API_URL}/preview`, H); setGameState(r.data); }
    catch {}
  }, []);

  useEffect(() => {
    const id = setInterval(fetchStatus, 1000);
    fetchStatus();
    return () => clearInterval(id);
  }, [fetchStatus]);

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

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try { const r = await axios.get(`${API_URL}/round-history?limit=30`, H); setHistory(r.data); }
    catch {} finally { setLoadingHistory(false); }
  };

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
            <div className={`status-badge ${status ?? 'BETTING'}`}>{status ?? 'BETTING'}</div>
            <span className="countdown-badge">⏱ {countdown ?? '--'}s</span>
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

        {/* ── Tab 5: 公告推播 ── */}
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

      </div>

      <footer className="admin-footer">
        牌局控制說明：下注階段可換牌與指定牌型；發牌後自動鎖定。
      </footer>
    </div>
  );
}

export default App;
