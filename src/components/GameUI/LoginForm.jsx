import React, { useState, useEffect } from 'react';
import { socket } from '../../socket';
import useGameStore from '../../stores/useGameStore';

const LoginForm = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [referralCodeInput, setReferralCodeInput] = useState(''); // 新增：推薦碼狀態
  
  const loginAction = useGameStore((state) => state.login);

  useEffect(() => {
    // 監聽後端回傳
    const handleLoginResponse = (res) => {
      if (res.success) {
        console.log("登入成功，已簽發 JWT");
        
        // 💾 關鍵優化：將 JWT Token 存入 LocalStorage (效期由後端控制)
        localStorage.setItem('prestige_token', res.token);
        localStorage.setItem('username', res.username);
        
        // 執行 Store 的 login
        loginAction(res.username); 
      } else {
        alert(res.message || "登入失敗，請檢查帳號密碼");
      }
    };

    const handleRegisterResponse = (res) => {
      if (res.success) {
        alert("註冊成功！體驗金 $10,000 已撥入帳戶，請進行登入");
        setIsRegistering(false);
        // 清空推薦碼，避免下次誤填
        setReferralCodeInput('');
      } else {
        alert(res.message || "註冊失敗");
      }
    };

    socket.on('login_response', handleLoginResponse);
    socket.on('register_response', handleRegisterResponse);

    return () => {
      socket.off('login_response', handleLoginResponse);
      socket.off('register_response', handleRegisterResponse);
    };
  }, [loginAction]);

  const handleSubmit = () => {
    // 1. 基本非空檢查
    if (!username || !password) {
      alert("請輸入帳號與密碼");
      return;
    }

    // 2. 強化：手機號碼格式檢查 (Regex)
    const phoneRegex = /^09\d{8}$/;
    if (!phoneRegex.test(username)) {
      alert("請輸入正確的手機號碼 (10位數字，09開頭)");
      return;
    }

    // 3. 強化：密碼長度檢查
    if (password.length < 6) {
      alert("密碼長度至少需要 6 位元");
      return;
    }

    if (isRegistering) {
      // 註冊時帶入推薦碼
      socket.emit('register', { 
        username, 
        password, 
        referralCodeInput: referralCodeInput.toUpperCase() 
      });
    } else {
      socket.emit('login', { username, password });
    }
  };

  return (
    <div style={styles.fullScreenContainer}>
      <div style={styles.bgEffect}></div>
      <div style={styles.loginBox}>
        <div style={styles.logoArea}>
            <h1 style={styles.gameTitle}>👑 尊爵妞妞</h1>
            <p style={styles.subTitle}>PRESTIGE NIU NIU</p>
        </div>

        <div style={styles.tabs}>
            <div 
                style={{...styles.tab, borderBottom: !isRegistering ? '3px solid #f1c40f' : 'transparent', color: !isRegistering ? '#fff' : '#666'}}
                onClick={() => setIsRegistering(false)}
            >登入會員</div>
            <div 
                style={{...styles.tab, borderBottom: isRegistering ? '3px solid #f1c40f' : 'transparent', color: isRegistering ? '#fff' : '#666'}}
                onClick={() => setIsRegistering(true)}
            >註冊帳號</div>
        </div>

        <div style={styles.formArea}>
            <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={styles.input}
                placeholder="手機號碼 (09xxxxxxxx)"
                maxLength={10}
            />
            <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                placeholder="請輸入密碼 (至少6位)"
            />
            
            {/* 🆕 新增：僅在註冊時顯示的推薦碼欄位 */}
            {isRegistering && (
              <input 
                  type="text" 
                  value={referralCodeInput}
                  onChange={(e) => setReferralCodeInput(e.target.value)}
                  style={{...styles.input, borderColor: '#f1c40f'}}
                  placeholder="推薦碼 (選填)"
                  maxLength={8}
              />
            )}

            <button onClick={handleSubmit} style={styles.mainButton}>
                {isRegistering ? '立即註冊' : '進入遊戲'}
            </button>
        </div>
        <div style={styles.footerInfo}>
            {isRegistering ? '註冊即送 $10,000 體驗金' : '祝您 旗開得勝'}
        </div>
      </div>
    </div>
  );
};

const styles = {
  fullScreenContainer: {
    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
    background: 'radial-gradient(circle at center, #2c3e50 0%, #000000 100%)', 
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    zIndex: 99999,
  },
  bgEffect: {
    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
    backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)',
    backgroundSize: '30px 30px',
    pointerEvents: 'none'
  },
  loginBox: {
    width: '380px', background: 'rgba(20, 20, 20, 0.95)', borderRadius: '16px',
    boxShadow: '0 0 50px rgba(241, 196, 15, 0.2)', border: '1px solid #333',
    overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 2
  },
  logoArea: { padding: '30px 0 20px 0', textAlign: 'center', background: 'linear-gradient(180deg, #1a1a1a 0%, #111 100%)', borderBottom: '1px solid #333' },
  gameTitle: { margin: 0, color: '#f1c40f', fontSize: '2rem', textShadow: '0 2px 4px rgba(0,0,0,0.8)' },
  subTitle: { margin: 0, color: '#666', fontSize: '0.8rem', letterSpacing: '2px', marginTop: '5px' },
  tabs: { display: 'flex', background: '#000', cursor: 'pointer' },
  tab: { flex: 1, textAlign: 'center', padding: '15px 0', fontSize: '1rem', fontWeight: 'bold', transition: 'all 0.3s' },
  formArea: { padding: '30px', display: 'flex', flexDirection: 'column', gap: '15px' },
  input: { width: '100%', padding: '15px', borderRadius: '8px', border: '1px solid #444', background: '#222', color: '#fff', fontSize: '1.1rem', outline: 'none', boxSizing: 'border-box' },
  mainButton: { width: '100%', padding: '15px', borderRadius: '8px', border: 'none', background: 'linear-gradient(90deg, #f1c40f 0%, #f39c12 100%)', color: '#000', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px', boxShadow: '0 4px 15px rgba(241, 196, 15, 0.4)' },
  footerInfo: { textAlign: 'center', paddingBottom: '20px', color: '#555', fontSize: '0.9rem' }
};

export default LoginForm;