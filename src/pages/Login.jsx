import React, { useState } from 'react';
import useGameStore from '../stores/useGameStore';

const Login = () => {
  const login = useGameStore((state) => state.login);
  const [phone, setPhone] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    if (phone.length > 0) {
      login(phone); // 模擬登入
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h1 style={styles.title}>尊爵妞妞 <span style={{fontSize: '0.4em', display:'block', color:'#888'}}>PREMIUM NIU NIU</span></h1>
        
        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>手機號碼</label>
            <input 
              type="tel" 
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="請輸入手機號碼"
              style={styles.input}
            />
          </div>
          
          <button type="submit" className="btn-gold" style={styles.button}>
            進入遊戲
          </button>
        </form>
      </div>
    </div>
  );
};

// CSS-in-JS 樣式 (也可以寫在 scss 裡)
const styles = {
  container: {
    width: '100%',
    height: '100%',
    background: 'var(--bg-radial-black)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column',
  },
  content: {
    width: '80%',
    maxWidth: '400px',
    textAlign: 'center',
  },
  title: {
    color: 'var(--c-gold-light)',
    fontSize: '3rem',
    marginBottom: '40px',
    textShadow: '0 2px 10px rgba(0,0,0,0.5)',
    fontFamily: 'serif', // 襯線體比較優雅
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  inputGroup: {
    textAlign: 'left',
  },
  label: {
    color: '#888',
    fontSize: '0.9rem',
    marginBottom: '5px',
    display: 'block',
  },
  input: {
    width: '100%',
    padding: '15px',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.05)', // 半透明黑
    border: '1px solid #444',
    color: '#fff',
    fontSize: '1.2rem',
    outline: 'none',
    transition: 'border-color 0.3s',
  },
  button: {
    width: '100%',
    padding: '15px',
    borderRadius: '30px',
    fontSize: '1.2rem',
    marginTop: '20px',
    cursor: 'pointer',
    border: 'none',
  }
};

export default Login;