import React, { useState, useEffect } from 'react';
import useGameStore from '../stores/useGameStore';
import LobbyBetHistoryModal from '../components/GameUI/LobbyBetHistoryModal';
import AnnouncementToast from '../components/AnnouncementToast';
import { socket } from '../socket';

import bannerNiuniu from '../assets/buttons/banner_game_niuniu.png';
import bgLobby from '../assets/bg/bg_lobby.png';

const CATEGORIES = ['全部', '真人', '電子', '棋牌', '體育'];

const PROMOS = [
  {
    id: 1,
    title: '🎊 新會員首存 100% 贈金',
    sub: '最高獎勵 $50,000　限時活動',
    bg: 'linear-gradient(135deg, #7B5A00 0%, #C8950A 40%, #7B5A00 100%)',
  },
];

const WIN_MSGS = [
  '恭喜玩家 J**888 在百人妞妞贏得 $128,000',
  '恭喜玩家 M**er 在百人妞妞獲得五小妞 ×8 大獎',
  '恭喜玩家 T**ony 在百人妞妞贏得 $52,000',
  '恭喜玩家 K**ng 在百人妞妞連贏 5 局獲得 $88,000',
  '恭喜玩家 A**li 在百人妞妞贏得牛牛 $36,000',
];

const COMING_SOON = [
  { name: '龍虎鬥', icon: '🐉' },
  { name: '百家樂', icon: '♠️' },
  { name: '骰　寶', icon: '🎲' },
];

const BOTTOM_TABS = [
  { id: 'lobby',    icon: '🏠', label: '大廳' },
  { id: 'activity', icon: '🎁', label: '活動' },
  { id: 'service',  icon: '💬', label: '客服' },
  { id: 'account',  icon: '👤', label: '帳戶' },
];

// ─── VIP 等級計算（依累積餘額） ────────────────────────────────
const getVipLevel = (balance) => {
  if (balance >= 1_000_000) return 'V4';
  if (balance >= 500_000)   return 'V3';
  if (balance >= 100_000)   return 'V2';
  return 'V1';
};

const Lobby = () => {
  const { user, setCurrentPage, logout, setUserBalance } = useGameStore();
  const [activeCategory, setActiveCategory] = useState('全部');
  const [activeTab, setActiveTab]           = useState('lobby');
  const [focusedPromo, setFocusedPromo]     = useState(0);
  const [showBetHistory, setShowBetHistory] = useState(false);
  const [copyTip, setCopyTip]               = useState(false);

  // ── 進入大廳時，透過 socket 同步最新餘額 ──────────────────────
  useEffect(() => {
    const onUpdateBalance = (data) => {
      if (data.balance !== undefined) setUserBalance(data.balance);
    };
    const onAuthSuccess = (data) => {
      if (data.balance !== undefined) setUserBalance(data.balance);
    };
    socket.on('update_balance', onUpdateBalance);
    socket.on('auth_success',   onAuthSuccess);
    return () => {
      socket.off('update_balance', onUpdateBalance);
      socket.off('auth_success',   onAuthSuccess);
    };
  }, [setUserBalance]);

  const handleEnterGame = () => setCurrentPage('room');

  const handleCopyReferral = () => {
    const code = user?.referral_code;
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopyTip(true);
      setTimeout(() => setCopyTip(false), 1800);
    });
  };

  const marqueeText = WIN_MSGS.join('　　　　　');
  const vip = getVipLevel(user?.balance ?? 0);

  return (
    <>
      <AnnouncementToast />
      <style>{`
        @keyframes lobbyMarquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .lobby-marquee-inner {
          display: inline-block;
          white-space: nowrap;
          animation: lobbyMarquee 28s linear infinite;
          color: rgba(255,255,255,0.75);
          font-size: 0.72rem;
        }
        .lobby-game-card {
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .lobby-game-card:hover {
          transform: translateY(-5px) scale(1.025);
          box-shadow: 0 18px 40px rgba(0,0,0,0.55), 0 0 24px rgba(212,175,55,0.25) !important;
        }
        .lobby-promo-card { transition: transform 0.3s ease, opacity 0.3s ease; }
        .lobby-enter-btn:hover { filter: brightness(1.15); }
        .lobby-cat-tab { transition: all 0.2s ease; }
        .lobby-cat-tab:hover { color: rgba(212,175,55,0.8) !important; }
        .lobby-acct-row:hover { background: rgba(255,255,255,0.07) !important; }
      `}</style>

      <div style={S.root}>
        <div style={S.bgImg} />
        <div style={S.bgOverlay} />

        {/* ── HEADER ──────────────────────────────────────────── */}
        <header style={S.header}>
          <div style={S.logo}>
            <span style={S.logoIcon}>♛</span>
            <div style={S.logoText}>
              <span style={S.logoMain}>尊爵妞妞</span>
              <span style={S.logoSub}>PRESTIGE NIU NIU</span>
            </div>
          </div>

          <nav style={S.catTabs}>
            {CATEGORIES.map(cat => {
              const active = activeCategory === cat;
              return (
                <div
                  key={cat}
                  className="lobby-cat-tab"
                  style={{
                    ...S.catTab,
                    color:      active ? '#D4AF37' : 'rgba(255,255,255,0.45)',
                    background: active ? 'rgba(212,175,55,0.12)' : 'transparent',
                    border:     active ? '1px solid rgba(212,175,55,0.35)' : '1px solid transparent',
                  }}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                </div>
              );
            })}
          </nav>

          <div style={S.headerRight}>
            {/* Bell */}
            <div style={S.bellBtn} onClick={() => alert('暫無最新公告')}>
              <span style={{ fontSize: '1rem', lineHeight: 1 }}>🔔</span>
              <div style={S.bellDot} />
            </div>

            {/* User pill — 顯示最新餘額 */}
            <div style={S.userPill}>
              <div style={S.avatar}>
                {user?.name ? user.name[0].toUpperCase() : 'G'}
              </div>
              <div style={S.userMeta}>
                <span style={S.userName}>{user?.name || 'Guest'}</span>
                <span style={S.userBal}>
                  $ {(user?.balance ?? 0).toLocaleString()}
                </span>
              </div>
              <div style={S.vipTag}>{vip}</div>
            </div>

            {/* Bet History */}
            <div style={S.historyBtn} onClick={() => setShowBetHistory(true)}>
              📜 紀錄
            </div>

            {/* Deposit */}
            <div style={S.depositBtn} onClick={() => alert('儲值系統建置中…')}>
              ＋ 存款
            </div>
          </div>
        </header>

        {/* ── MAIN CONTENT ────────────────────────────────────── */}
        <main style={S.main}>

          {/* ── 大廳頁 ── */}
          {activeTab === 'lobby' && <>
            <div style={S.promoRow}>
              {PROMOS.map((p, i) => (
                <div
                  key={p.id}
                  className="lobby-promo-card"
                  style={{
                    ...S.promoCard,
                    background: p.bg,
                    opacity:   i === focusedPromo ? 1 : 0.58,
                    transform: i === focusedPromo ? 'scale(1.02)' : 'scale(0.96)',
                  }}
                  onClick={() => setFocusedPromo(i)}
                >
                  <div style={S.promoTitle}>{p.title}</div>
                  <div style={S.promoSub}>{p.sub}</div>
                  <div style={S.promoAction}>立即領取 →</div>
                  <div style={S.promoShine} />
                </div>
              ))}
            </div>

            <div style={S.sectionDivider}>
              <div style={S.divLine} />
              <span style={S.divLabel}>🎲 熱門遊戲</span>
              <div style={S.divLine} />
            </div>

            <div style={S.gameGrid}>
              <div
                className="lobby-game-card"
                style={{ ...S.gameCard, boxShadow: '0 8px 32px rgba(0,0,0,0.45)' }}
                onClick={handleEnterGame}
              >
                <div style={S.hotBadge}>🔥 HOT</div>
                <div style={S.onlineBadge}>● 即時開局</div>
                <img src={bannerNiuniu} alt="百人妞妞" style={S.cardBanner} />
                <div style={S.cardFooter}>
                  <div>
                    <div style={S.cardName}>百人妞妞</div>
                    <div style={S.cardMin}>最低下注 $100</div>
                  </div>
                  <div className="lobby-enter-btn" style={S.enterBtn}>進入</div>
                </div>
              </div>

              {COMING_SOON.map(g => (
                <div
                  key={g.name}
                  className="lobby-game-card"
                  style={{ ...S.gameCard, cursor: 'default', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}
                >
                  <div style={S.soonBadge}>即將上線</div>
                  <div style={S.soonBody}>
                    <span style={S.soonIcon}>{g.icon}</span>
                    <span style={S.soonName}>{g.name}</span>
                  </div>
                  <div style={{ ...S.cardFooter, justifyContent: 'center' }}>
                    <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.65rem', fontWeight: 600 }}>
                      Coming Soon
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>}

          {/* ── 活動 / 客服 建置中頁 ── */}
          {(activeTab === 'activity' || activeTab === 'service') && (
            <div style={S.comingSoonPage}>
              <div style={S.comingSoonIcon}>
                {activeTab === 'activity' ? '🎁' : '💬'}
              </div>
              <div style={S.comingSoonTitle}>
                {activeTab === 'activity' ? '活動中心' : '線上客服'}
              </div>
              <div style={S.comingSoonSub}>此功能即將推出，敬請期待</div>
            </div>
          )}

          {/* ── 帳戶頁 ── */}
          {activeTab === 'account' && (
            <div style={S.accountPage}>

              {/* 大頭貼 + 名稱 */}
              <div style={S.acctHero}>
                <div style={S.acctAvatarLg}>
                  {user?.name ? user.name[0].toUpperCase() : 'G'}
                </div>
                <div style={S.acctHeroName}>{user?.name || 'Guest'}</div>
                <div style={S.acctVipBadge}>{vip}</div>
              </div>

              {/* 資訊列 */}
              <div style={S.acctCard}>

                <div className="lobby-acct-row" style={S.acctRow}>
                  <span style={S.acctLabel}>帳戶餘額</span>
                  <span style={{ ...S.acctValue, color: '#D4AF37', fontWeight: 700 }}>
                    $ {(user?.balance ?? 0).toLocaleString()}
                  </span>
                </div>

                <div style={S.acctDivider} />

                <div
                  className="lobby-acct-row"
                  style={{ ...S.acctRow, cursor: user?.referral_code ? 'pointer' : 'default' }}
                  onClick={handleCopyReferral}
                >
                  <span style={S.acctLabel}>推薦碼</span>
                  <div style={S.acctRightGroup}>
                    <span style={S.acctValue}>{user?.referral_code || '—'}</span>
                    {user?.referral_code && (
                      <span style={S.copyHint}>{copyTip ? '✓ 已複製' : '點擊複製'}</span>
                    )}
                  </div>
                </div>

                <div style={S.acctDivider} />

                <div className="lobby-acct-row" style={S.acctRow}>
                  <span style={S.acctLabel}>VIP 等級</span>
                  <span style={S.acctValue}>{vip}</span>
                </div>

              </div>

              {/* 投注紀錄 */}
              <button style={S.acctHistoryBtn} onClick={() => setShowBetHistory(true)}>
                📜 查看投注紀錄
              </button>

              {/* 登出 */}
              <button style={S.acctLogoutBtn} onClick={logout}>
                🚪 登出
              </button>

            </div>
          )}

        </main>

        {/* ── MARQUEE ─────────────────────────────────────────── */}
        <div style={S.marqueeBar}>
          <span style={S.marqueePrefix}>📢</span>
          <div style={S.marqueeTrack}>
            <span className="lobby-marquee-inner">
              {marqueeText}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{marqueeText}
            </span>
          </div>
        </div>

        {/* ── BOTTOM NAV ──────────────────────────────────────── */}
        <nav style={S.bottomNav}>
          {BOTTOM_TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <div
                key={tab.id}
                style={S.bottomTab}
                onClick={() => setActiveTab(tab.id)}
              >
                <span style={{ fontSize: '1.15rem', lineHeight: 1 }}>{tab.icon}</span>
                <span style={{
                  ...S.bottomLabel,
                  color:      active ? '#D4AF37' : 'rgba(255,255,255,0.38)',
                  fontWeight: active ? 700 : 400,
                }}>
                  {tab.label}
                </span>
                {active && <div style={S.bottomLine} />}
              </div>
            );
          })}
        </nav>
      </div>

      {/* 投注紀錄 Modal */}
      {showBetHistory && (
        <LobbyBetHistoryModal
          onClose={() => setShowBetHistory(false)}
        />
      )}
    </>
  );
};

/* ── STYLES ─────────────────────────────────────────────────── */
const GOLD     = '#D4AF37';
const GLASS    = 'rgba(255,255,255,0.055)';
const BORDER   = '1px solid rgba(255,255,255,0.09)';
const BLUR     = 'blur(18px)';

const S = {
  root: {
    position: 'fixed', inset: 0,
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang TC", "Helvetica Neue", sans-serif',
  },
  bgImg: {
    position: 'absolute', inset: 0,
    backgroundImage: `url(${bgLobby})`,
    backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 0,
  },
  bgOverlay: {
    position: 'absolute', inset: 0,
    background: 'linear-gradient(180deg, rgba(4,6,16,0.88) 0%, rgba(4,6,16,0.68) 45%, rgba(4,6,16,0.9) 100%)',
    zIndex: 1,
  },

  // Header
  header: {
    position: 'relative', zIndex: 10, flexShrink: 0,
    minHeight: '54px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 'env(safe-area-inset-top)',
    paddingBottom: '0',
    paddingLeft: 'max(18px, calc(env(safe-area-inset-left) + 10px))',
    paddingRight: 'max(18px, calc(env(safe-area-inset-right) + 10px))',
    background: 'rgba(6,8,20,0.75)',
    backdropFilter: BLUR, WebkitBackdropFilter: BLUR,
    borderBottom: '1px solid rgba(212,175,55,0.18)',
  },
  logo:     { display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0 },
  logoIcon: { color: GOLD, fontSize: '1.5rem', lineHeight: 1, textShadow: '0 0 14px rgba(212,175,55,0.55)' },
  logoText: { display: 'flex', flexDirection: 'column', lineHeight: 1.15 },
  logoMain: { color: GOLD, fontSize: '0.95rem', fontWeight: 800, letterSpacing: '1.5px', textShadow: '0 0 10px rgba(212,175,55,0.35)' },
  logoSub:  { color: 'rgba(212,175,55,0.4)', fontSize: '0.46rem', letterSpacing: '2.5px' },

  catTabs: { display: 'flex', gap: '4px', alignItems: 'center' },
  catTab:  { padding: '5px 14px', borderRadius: '30px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', userSelect: 'none', letterSpacing: '0.3px' },

  headerRight: { display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 },
  bellBtn: {
    position: 'relative', width: '34px', height: '34px', borderRadius: '50%',
    background: GLASS, border: BORDER,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', backdropFilter: 'blur(8px)',
  },
  bellDot: {
    position: 'absolute', top: '6px', right: '6px',
    width: '7px', height: '7px', borderRadius: '50%',
    background: '#C0392B', border: '1.5px solid rgba(6,8,20,0.9)',
  },
  userPill: {
    display: 'flex', alignItems: 'center', gap: '7px',
    background: GLASS, border: BORDER, borderRadius: '40px',
    padding: '3px 10px 3px 3px', backdropFilter: 'blur(12px)',
  },
  avatar: {
    width: '28px', height: '28px', borderRadius: '50%',
    background: `linear-gradient(135deg, ${GOLD} 0%, #8B6914 100%)`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.85rem', fontWeight: 800, color: '#1a1000', flexShrink: 0,
  },
  userMeta:  { display: 'flex', flexDirection: 'column', lineHeight: 1.2 },
  userName:  { color: 'rgba(255,255,255,0.65)', fontSize: '0.62rem' },
  userBal:   { color: GOLD, fontSize: '0.82rem', fontWeight: 700 },
  vipTag: {
    background: 'linear-gradient(135deg, #C0392B 0%, #7B241C 100%)',
    color: '#fff', fontSize: '0.52rem', fontWeight: 800,
    padding: '2px 5px', borderRadius: '4px', letterSpacing: '0.5px',
  },
  historyBtn: {
    background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)',
    fontSize: '0.75rem', fontWeight: 700, padding: '7px 12px', borderRadius: '22px',
    cursor: 'pointer', border: '1px solid rgba(255,255,255,0.12)',
    userSelect: 'none', flexShrink: 0, backdropFilter: 'blur(8px)',
  },
  depositBtn: {
    background: `linear-gradient(135deg, ${GOLD} 0%, #8B6914 100%)`,
    color: '#1a1000', fontSize: '0.78rem', fontWeight: 800,
    padding: '7px 14px', borderRadius: '22px', cursor: 'pointer',
    boxShadow: '0 3px 12px rgba(212,175,55,0.38)',
    userSelect: 'none', letterSpacing: '0.5px', flexShrink: 0,
  },

  // Main
  main: {
    flex: 1, position: 'relative', zIndex: 10,
    display: 'flex', flexDirection: 'column',
    padding: '10px 18px 6px', gap: '10px',
    overflow: 'hidden', minHeight: 0,
  },

  // Promos
  promoRow: { display: 'flex', gap: '10px', flexShrink: 0 },
  promoCard: {
    flex: 1, borderRadius: '14px', padding: '10px 14px',
    cursor: 'pointer', position: 'relative', overflow: 'hidden',
    minHeight: '68px', border: '1px solid rgba(255,255,255,0.08)',
  },
  promoTitle: { color: '#fff', fontSize: '0.82rem', fontWeight: 700, marginBottom: '2px', textShadow: '0 1px 4px rgba(0,0,0,0.6)' },
  promoSub:   { color: 'rgba(255,255,255,0.65)', fontSize: '0.65rem', marginBottom: '7px' },
  promoAction: {
    display: 'inline-block', color: 'rgba(255,255,255,0.85)', fontSize: '0.62rem', fontWeight: 600,
    background: 'rgba(255,255,255,0.12)', padding: '2px 9px', borderRadius: '8px', backdropFilter: 'blur(4px)',
  },
  promoShine: {
    position: 'absolute', top: '-30%', right: '-5%', width: '55%', height: '160%',
    background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.06) 50%, transparent 70%)',
    pointerEvents: 'none',
  },

  // Section divider
  sectionDivider: { display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 },
  divLine:  { flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.25), transparent)' },
  divLabel: { color: 'rgba(212,175,55,0.8)', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '1.5px', flexShrink: 0 },

  // Game grid
  gameGrid: { flex: 1, display: 'flex', gap: '12px', minHeight: 0, overflow: 'hidden' },
  gameCard: {
    flex: 1, borderRadius: '16px', background: GLASS, border: BORDER,
    backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
    position: 'relative', overflow: 'hidden', cursor: 'pointer',
    display: 'flex', flexDirection: 'column',
  },
  hotBadge: {
    position: 'absolute', top: '8px', right: '8px', zIndex: 3,
    background: 'linear-gradient(135deg, #C0392B, #922B21)', color: '#fff',
    fontSize: '0.58rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px',
    letterSpacing: '0.8px', boxShadow: '0 2px 8px rgba(192,57,43,0.55)',
  },
  onlineBadge: {
    position: 'absolute', top: '8px', left: '8px', zIndex: 3,
    background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(6px)',
    color: '#4cff6e', fontSize: '0.58rem', fontWeight: 600,
    padding: '3px 7px', borderRadius: '6px', border: '1px solid rgba(76,255,110,0.25)',
  },
  cardBanner: { width: '100%', flex: 1, objectFit: 'cover', display: 'block', minHeight: 0 },
  cardFooter: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 10px', background: 'rgba(4,6,16,0.55)', backdropFilter: 'blur(8px)', flexShrink: 0,
  },
  cardName: { color: '#fff', fontSize: '0.78rem', fontWeight: 700, marginBottom: '1px' },
  cardMin:  { color: 'rgba(255,255,255,0.38)', fontSize: '0.58rem' },
  enterBtn: {
    background: `linear-gradient(135deg, ${GOLD} 0%, #8B6914 100%)`,
    color: '#1a1000', fontSize: '0.7rem', fontWeight: 800,
    padding: '5px 14px', borderRadius: '12px',
    boxShadow: '0 2px 10px rgba(212,175,55,0.4)', userSelect: 'none', cursor: 'pointer',
  },
  soonBadge: {
    position: 'absolute', top: '8px', right: '8px', zIndex: 3,
    background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.38)',
    fontSize: '0.53rem', fontWeight: 700, padding: '3px 7px', borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  soonBody:  { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  soonIcon:  { fontSize: '2rem', opacity: 0.35, filter: 'grayscale(1)' },
  soonName:  { color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '2px' },

  // 建置中頁
  comingSoonPage: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: '12px',
  },
  comingSoonIcon:  { fontSize: '3.5rem', opacity: 0.5, filter: 'grayscale(0.4)' },
  comingSoonTitle: { color: 'rgba(255,255,255,0.7)', fontSize: '1.1rem', fontWeight: 700 },
  comingSoonSub:   { color: 'rgba(255,255,255,0.3)', fontSize: '0.78rem' },

  // 帳戶頁
  accountPage: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '14px',
    paddingTop: '8px', overflowY: 'auto',
  },
  acctHero: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
    paddingBottom: '4px',
  },
  acctAvatarLg: {
    width: '72px', height: '72px', borderRadius: '50%',
    background: `linear-gradient(135deg, ${GOLD} 0%, #8B6914 100%)`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '2rem', fontWeight: 800, color: '#1a1000',
    boxShadow: '0 0 0 4px rgba(212,175,55,0.2), 0 0 24px rgba(212,175,55,0.25)',
  },
  acctHeroName: { color: '#fff', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.5px' },
  acctVipBadge: {
    background: 'linear-gradient(135deg, #C0392B 0%, #7B241C 100%)',
    color: '#fff', fontSize: '0.65rem', fontWeight: 800,
    padding: '3px 10px', borderRadius: '6px', letterSpacing: '1px',
  },

  acctCard: {
    width: '100%', maxWidth: '400px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '16px', overflow: 'hidden',
  },
  acctRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 18px',
    transition: 'background 0.15s',
  },
  acctRightGroup: { display: 'flex', alignItems: 'center', gap: '8px' },
  acctLabel: { color: 'rgba(255,255,255,0.45)', fontSize: '0.82rem' },
  acctValue: { color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem', fontWeight: 600 },
  copyHint:  { color: 'rgba(212,175,55,0.7)', fontSize: '0.65rem', fontWeight: 600 },
  acctDivider: { height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0 18px' },

  acctHistoryBtn: {
    width: '100%', maxWidth: '400px',
    background: 'rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.75)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '14px', padding: '14px',
    fontSize: '0.95rem', fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  acctLogoutBtn: {
    width: '100%', maxWidth: '400px',
    background: 'rgba(231,76,60,0.08)',
    color: '#e74c3c',
    border: '1px solid rgba(231,76,60,0.25)',
    borderRadius: '14px', padding: '14px',
    fontSize: '0.95rem', fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
  },

  // Marquee
  marqueeBar: {
    position: 'relative', zIndex: 10, flexShrink: 0, height: '27px',
    display: 'flex', alignItems: 'center',
    background: 'rgba(6,8,20,0.82)', backdropFilter: 'blur(12px)',
    borderTop: '1px solid rgba(212,175,55,0.14)', overflow: 'hidden',
  },
  marqueePrefix: {
    flexShrink: 0, fontSize: '0.75rem', padding: '0 10px',
    borderRight: '1px solid rgba(212,175,55,0.18)',
    height: '100%', display: 'flex', alignItems: 'center',
    background: 'rgba(6,8,20,0.9)',
  },
  marqueeTrack: { flex: 1, overflow: 'hidden', height: '100%', display: 'flex', alignItems: 'center' },

  // Bottom Nav
  bottomNav: {
    position: 'relative', zIndex: 10, flexShrink: 0,
    minHeight: 'calc(50px + env(safe-area-inset-bottom))',
    paddingTop: '0',
    paddingBottom: 'env(safe-area-inset-bottom)',
    paddingLeft: 'env(safe-area-inset-left)',
    paddingRight: 'env(safe-area-inset-right)',
    display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start',
    background: 'rgba(4,6,16,0.88)',
    backdropFilter: BLUR, WebkitBackdropFilter: BLUR,
    borderTop: '1px solid rgba(255,255,255,0.07)',
  },
  bottomTab: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', position: 'relative',
    gap: '2px', paddingBottom: '2px', userSelect: 'none',
  },
  bottomLabel: { fontSize: '0.58rem', lineHeight: 1 },
  bottomLine: {
    position: 'absolute', bottom: 0, left: '22%', right: '22%',
    height: '2px',
    background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
    borderRadius: '2px',
  },
};

export default Lobby;
