import React, { useState, useEffect } from 'react';
import { socket } from '../../socket';
import useGameStore from '../../stores/useGameStore';

const phoneRegex    = /^09\d{8}$/;
const passwordRegex = /^(?=.*\d).{8,20}$/;

// ── 橫屏提醒彈窗（明亮風格） ─────────────────────────────────────
const RotateModal = ({ onContinue }) => (
  <div style={rm.overlay}>
    <div style={rm.box}>
      <div style={rm.iconRow}>
        <span style={rm.phonePortrait}>📱</span>
        <span style={rm.arrow}>→</span>
        <span style={rm.phoneLandscape}>📱</span>
      </div>
      <h2 style={rm.title}>請旋轉為橫向</h2>
      <p style={rm.desc}>
        本遊戲為橫屏設計<br />
        請將手機轉為 <b style={{ color: '#f97316' }}>橫向模式</b> 以獲得最佳體驗
      </p>
      <button style={rm.btn} onClick={onContinue}>我知道了，進入遊戲</button>
    </div>
  </div>
);

const rm = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 999999,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24,
  },
  box: {
    background: '#fff', borderRadius: 20,
    padding: '32px 28px 28px',
    maxWidth: 300, width: '100%',
    textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  iconRow: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 12, marginBottom: 20,
  },
  phonePortrait: {
    fontSize: '2.8rem', lineHeight: 1,
    animation: 'rm-pulse 2s ease-in-out infinite',
    display: 'inline-block',
  },
  arrow: {
    fontSize: '1.6rem', color: '#f97316', fontWeight: 900,
    animation: 'rm-arrow 2s ease-in-out infinite',
  },
  phoneLandscape: {
    fontSize: '2.8rem', lineHeight: 1,
    display: 'inline-block',
    transform: 'rotate(-90deg)',
  },
  title: {
    margin: '0 0 8px',
    fontSize: '1.2rem', fontWeight: 800, color: '#111827',
    fontFamily: '"PingFang TC","Microsoft JhengHei",sans-serif',
  },
  desc: {
    margin: '0 0 22px',
    fontSize: '0.88rem', color: '#6b7280', lineHeight: 1.75,
    fontFamily: '"PingFang TC","Microsoft JhengHei",sans-serif',
  },
  btn: {
    width: '100%', padding: '13px',
    background: 'linear-gradient(90deg, #f97316, #ea580c)',
    border: 'none', borderRadius: 10,
    color: '#fff', fontSize: '0.95rem', fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(249,115,22,0.35)',
    fontFamily: '"PingFang TC","Microsoft JhengHei",sans-serif',
  },
};

// ── 主元件 ────────────────────────────────────────────────────────
const LoginForm = () => {
  const [isRegistering,   setIsRegistering]   = useState(false);
  const [username,        setUsername]        = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword,    setShowPassword]    = useState(false);
  const [showConfirmPwd,  setShowConfirmPwd]  = useState(false);
  const [referralCode,    setReferralCode]    = useState('');
  const [errors,          setErrors]          = useState({});
  const [loading,         setLoading]         = useState(false);
  const [successMsg,      setSuccessMsg]      = useState('');
  const [focused,         setFocused]         = useState(null);
  const [showRotate,      setShowRotate]      = useState(false);
  const [pendingUser,     setPendingUser]     = useState(null);

  const reLoginAction = useGameStore((s) => s.reLogin);

  useEffect(() => {
    const onLogin = (res) => {
      setLoading(false);
      if (res.success) {
        localStorage.setItem('prestige_token', res.token);
        setPendingUser({ username: res.username, balance: res.balance, referral_code: res.referral_code });
        setShowRotate(true);
      } else {
        setErrors({ general: res.message || '帳號或密碼錯誤' });
      }
    };
    const onRegister = (res) => {
      setLoading(false);
      if (res.success) {
        setSuccessMsg('🎉 開戶成功！體驗金 $10,000 已撥入帳戶');
        setTimeout(() => {
          setIsRegistering(false);
          setSuccessMsg('');
          setUsername(''); setPassword(''); setConfirmPassword(''); setReferralCode('');
        }, 1800);
      } else {
        setErrors({ general: res.message || '註冊失敗，請稍後再試' });
      }
    };
    socket.on('login_response', onLogin);
    socket.on('register_response', onRegister);
    return () => {
      socket.off('login_response', onLogin);
      socket.off('register_response', onRegister);
    };
  }, [reLoginAction]);

  const validate = () => {
    const e = {};
    if (!username)                       e.username = '請輸入手機號碼';
    else if (!phoneRegex.test(username)) e.username = '請輸入 09 開頭的 10 位數字';

    if (!password) e.password = '請輸入密碼';
    else if (isRegistering && !passwordRegex.test(password))
      e.password = '需 8~20 位且至少含 1 個數字';

    if (isRegistering) {
      if (!confirmPassword)                   e.confirm = '請再次輸入密碼';
      else if (password !== confirmPassword)  e.confirm = '兩次密碼輸入不一致';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    setLoading(true); setErrors({});
    if (isRegistering) {
      socket.emit('register', { username, password, referralCodeInput: referralCode.toUpperCase() });
    } else {
      socket.emit('login', { username, password });
    }
    setTimeout(() => setLoading(false), 9000);
  };

  const onKey = (e) => { if (e.key === 'Enter') handleSubmit(); };

  const switchTab = (toReg) => {
    setIsRegistering(toReg);
    setErrors({}); setSuccessMsg('');
    setPassword(''); setConfirmPassword('');
  };

  const bc = (field) => {
    if (errors[field])     return '#ef4444';
    if (focused === field) return '#f97316';
    return '#e5e7eb';
  };

  return (
    <>
      <style>{`
        @keyframes lf-spin { to { transform: rotate(360deg); } }
        @keyframes lf-up {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes rm-pulse {
          0%,100% { opacity: 1; }
          50%     { opacity: 0.4; }
        }
        @keyframes rm-arrow {
          0%,100% { transform: translateX(0); opacity: 0.5; }
          50%     { transform: translateX(4px); opacity: 1; }
        }
        .lf-input::placeholder { color: #c9c6c2 !important; }
        .lf-input:focus { outline: none; }
        .lf-btn:hover:not(:disabled) {
          filter: brightness(1.07);
          transform: translateY(-1px) !important;
          box-shadow: 0 6px 20px rgba(249,115,22,0.45) !important;
        }
        .lf-btn:active:not(:disabled) { transform: translateY(0) !important; }
        .lf-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .lf-tab:hover { color: #6b7280 !important; }
      `}</style>

      {/* 橫屏提醒 */}
      {showRotate && (
        <RotateModal onContinue={() => { setShowRotate(false); reLoginAction(pendingUser); }} />
      )}

      {/* ── 全螢幕直式佈局 ── */}
      <div style={s.screen}>

        {/* 背景點紋 */}
        <div style={s.bgDots} />

        {/* ── 上半：品牌 ── */}
        <div style={s.brandSection}>
          <div style={s.suitDecor}>♠ ♥ ♦ ♣</div>
          <div style={s.crown}>♟</div>
          <h1 style={s.title}>尊爵妞妞</h1>
          <p style={s.subtitle}>PRESTIGE NIU NIU</p>
          <p style={s.tagline}>最頂級的線上牌桌體驗</p>
        </div>

        {/* ── 下半：表單卡片 ── */}
        <div style={s.formCard}>

          {/* 頁籤 */}
          <div style={s.tabRow}>
            <button className="lf-tab"
              style={{ ...s.tab, ...(isRegistering ? {} : s.tabOn) }}
              onClick={() => switchTab(false)}>
              登入
            </button>
            <button className="lf-tab"
              style={{ ...s.tab, ...(isRegistering ? s.tabOn : {}) }}
              onClick={() => switchTab(true)}>
              新會員開戶
            </button>
          </div>

          {/* 捲動表單區 */}
          <div style={s.scrollArea}>

            {successMsg && <div style={s.successBox}>{successMsg}</div>}
            {errors.general && <div style={s.errorBox}>⚠ {errors.general}</div>}

            {/* 手機號碼 */}
            <div style={s.field}>
              <label style={s.label}>手機號碼</label>
              <div style={{ ...s.inputWrap, borderColor: bc('username') }}>
                <span style={s.icon}>📱</span>
                <input type="text" className="lf-input"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setErrors(v => ({ ...v, username: '' })); }}
                  onFocus={() => setFocused('username')} onBlur={() => setFocused(null)}
                  onKeyDown={onKey} style={s.input}
                  placeholder="09xxxxxxxx" maxLength={10} inputMode="numeric"
                  autoComplete="username" />
              </div>
              {errors.username && <p style={s.errText}>{errors.username}</p>}
            </div>

            {/* 密碼 */}
            <div style={s.field}>
              <label style={s.label}>
                密碼
                {isRegistering && <span style={s.labelNote}>&nbsp;（8~20位，含數字）</span>}
              </label>
              <div style={{ ...s.inputWrap, borderColor: bc('password') }}>
                <span style={s.icon}>🔒</span>
                <input type={showPassword ? 'text' : 'password'} className="lf-input"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setErrors(v => ({ ...v, password: '' })); }}
                  onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
                  onKeyDown={onKey} style={{ ...s.input, flex: 1 }}
                  placeholder={isRegistering ? '設定密碼' : '請輸入密碼'}
                  autoComplete={isRegistering ? 'new-password' : 'current-password'} />
                <button type="button" style={s.eyeBtn}
                  onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {errors.password && <p style={s.errText}>{errors.password}</p>}
            </div>

            {/* 確認密碼（僅限註冊） */}
            {isRegistering && (
              <div style={s.field}>
                <label style={s.label}>確認密碼</label>
                <div style={{ ...s.inputWrap, borderColor: bc('confirm') }}>
                  <span style={s.icon}>🔐</span>
                  <input type={showConfirmPwd ? 'text' : 'password'} className="lf-input"
                    value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); setErrors(v => ({ ...v, confirm: '' })); }}
                    onFocus={() => setFocused('confirm')} onBlur={() => setFocused(null)}
                    onKeyDown={onKey} style={{ ...s.input, flex: 1 }}
                    placeholder="再次輸入密碼"
                    autoComplete="new-password" />
                  <button type="button" style={s.eyeBtn}
                    onClick={() => setShowConfirmPwd(v => !v)} tabIndex={-1}>
                    {showConfirmPwd ? '🙈' : '👁️'}
                  </button>
                </div>
                {errors.confirm && <p style={s.errText}>{errors.confirm}</p>}
                {confirmPassword && password && confirmPassword === password && !errors.confirm && (
                  <p style={{ ...s.errText, color: '#16a34a' }}>✓ 密碼一致</p>
                )}
              </div>
            )}

            {/* 推薦碼（僅限註冊） */}
            {isRegistering && (
              <div style={s.field}>
                <label style={s.label}>推薦碼 <span style={s.labelNote}>（選填）</span></label>
                <div style={{ ...s.inputWrap, borderColor: focused === 'ref' ? '#f97316' : '#e5e7eb' }}>
                  <span style={s.icon}>🎁</span>
                  <input type="text" className="lf-input"
                    value={referralCode}
                    onChange={e => setReferralCode(e.target.value.toUpperCase())}
                    onFocus={() => setFocused('ref')} onBlur={() => setFocused(null)}
                    onKeyDown={onKey} style={s.input}
                    placeholder="輸入推薦碼享優惠" maxLength={8} />
                </div>
              </div>
            )}

            {/* 送出 */}
            <button className="lf-btn" style={s.submitBtn}
              onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{
                    width: 14, height: 14,
                    border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff',
                    borderRadius: '50%', display: 'inline-block',
                    animation: 'lf-spin 0.65s linear infinite',
                  }} />
                  驗證中…
                </span>
              ) : (
                isRegistering ? '立即開戶' : '進入遊戲'
              )}
            </button>

            <p style={s.footer}>
              {isRegistering
                ? <>新會員開戶即享 <b style={{ color: '#f97316' }}>$10,000</b> 體驗金</>
                : '歡迎回來，祝您旗開得勝！'
              }
            </p>

          </div>
        </div>
      </div>
    </>
  );
};

// ── Styles（明亮風格）─────────────────────────────────────────────
const s = {
  screen: {
    position: 'fixed', inset: 0,
    display: 'flex', flexDirection: 'column',
    background: 'linear-gradient(160deg, #fff7ed 0%, #fef3c7 50%, #fde8d0 100%)',
    overflow: 'hidden',
    zIndex: 99999,
  },
  bgDots: {
    position: 'absolute', inset: 0,
    backgroundImage: 'radial-gradient(circle, rgba(249,115,22,0.07) 1px, transparent 1px)',
    backgroundSize: '26px 26px',
    pointerEvents: 'none',
  },

  // ── 品牌上半 ──
  brandSection: {
    position: 'relative', zIndex: 1,
    flex: '0 0 auto',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '40px 20px 30px',
    textAlign: 'center',
  },
  suitDecor: {
    color: 'rgba(249,115,22,0.35)',
    fontSize: '0.9rem', letterSpacing: '8px',
    marginBottom: 10,
  },
  crown: {
    fontSize: '2.4rem', lineHeight: 1,
    color: '#f97316', marginBottom: 8,
    filter: 'drop-shadow(0 2px 6px rgba(249,115,22,0.3))',
  },
  title: {
    margin: 0,
    fontSize: '2.2rem', fontWeight: 900,
    color: '#111827', letterSpacing: 4,
    fontFamily: '"PingFang TC","Microsoft JhengHei",sans-serif',
  },
  subtitle: {
    margin: '5px 0 0',
    fontSize: '0.62rem', color: '#9ca3af',
    letterSpacing: '5px',
    fontFamily: '"Courier New",monospace',
  },
  tagline: {
    margin: '10px 0 0',
    fontSize: '0.82rem', color: '#6b7280',
    fontFamily: '"PingFang TC","Microsoft JhengHei",sans-serif',
  },

  // ── 表單下半卡片 ──
  formCard: {
    position: 'relative', zIndex: 1,
    flex: 1,
    background: '#ffffff',
    borderRadius: '22px 22px 0 0',
    boxShadow: '0 -4px 24px rgba(0,0,0,0.08)',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    animation: 'lf-up 0.38s cubic-bezier(0.22,1,0.36,1)',
  },
  tabRow: {
    display: 'flex',
    borderBottom: '1px solid #f3f4f6',
    flexShrink: 0,
  },
  tab: {
    flex: 1, padding: '13px 0',
    background: 'transparent', border: 'none',
    borderBottom: '2.5px solid transparent',
    color: '#9ca3af', fontSize: '0.9rem', fontWeight: 700,
    cursor: 'pointer',
    transition: 'color 0.15s, border-color 0.15s, background 0.15s',
    fontFamily: '"PingFang TC","Microsoft JhengHei",sans-serif',
  },
  tabOn: {
    color: '#f97316',
    borderBottom: '2.5px solid #f97316',
    background: '#fff7ed',
  },
  scrollArea: {
    flex: 1, overflowY: 'auto',
    padding: '16px 20px 28px',
    display: 'flex', flexDirection: 'column',
    gap: 11,
    WebkitOverflowScrolling: 'touch',
  },

  successBox: {
    background: '#f0fdf4', border: '1px solid #86efac',
    borderRadius: 9, padding: '9px 12px',
    color: '#16a34a', fontSize: '0.82rem', fontWeight: 600, textAlign: 'center',
  },
  errorBox: {
    background: '#fef2f2', border: '1px solid #fca5a5',
    borderRadius: 9, padding: '9px 12px',
    color: '#dc2626', fontSize: '0.82rem', fontWeight: 600, textAlign: 'center',
  },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: {
    color: '#374151', fontSize: '0.73rem', fontWeight: 700, paddingLeft: 2,
  },
  labelNote: { color: '#9ca3af', fontWeight: 400 },
  inputWrap: {
    display: 'flex', alignItems: 'center',
    background: '#f9fafb',
    border: '1.5px solid #e5e7eb',
    borderRadius: 10, overflow: 'hidden',
    transition: 'border-color 0.18s',
  },
  icon: {
    padding: '0 9px 0 11px',
    fontSize: '1rem', flexShrink: 0, lineHeight: 1,
    borderRight: '1px solid #f3f4f6',
  },
  input: {
    flex: 1, padding: '11px 11px',
    background: 'transparent', border: 'none',
    color: '#111827', fontSize: '0.94rem',
    outline: 'none', boxSizing: 'border-box',
    fontFamily: '"PingFang TC","Microsoft JhengHei",sans-serif',
  },
  eyeBtn: {
    background: 'transparent', border: 'none',
    padding: '0 11px', cursor: 'pointer',
    fontSize: '0.9rem', lineHeight: 1, flexShrink: 0,
    opacity: 0.45, transition: 'opacity 0.15s',
  },
  errText: {
    color: '#ef4444', fontSize: '0.71rem',
    margin: 0, paddingLeft: 4,
  },
  submitBtn: {
    width: '100%', padding: '13px',
    background: 'linear-gradient(90deg, #f97316, #ea580c)',
    border: 'none', borderRadius: 10,
    color: '#fff', fontSize: '1rem', fontWeight: 800,
    cursor: 'pointer', marginTop: 2,
    boxShadow: '0 4px 14px rgba(249,115,22,0.32)',
    letterSpacing: 1,
    fontFamily: '"PingFang TC","Microsoft JhengHei",sans-serif',
    transition: 'transform 0.15s, box-shadow 0.15s, filter 0.15s',
  },
  footer: {
    textAlign: 'center', margin: 0,
    color: '#9ca3af', fontSize: '0.76rem',
  },
};

export default LoginForm;
