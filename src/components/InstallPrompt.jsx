import React, { useState, useEffect } from 'react';

const InstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showAndroid, setShowAndroid] = useState(false);
    const [showIOS, setShowIOS] = useState(false);

    useEffect(() => {
        // 已安裝則不顯示
        if (window.matchMedia('(display-mode: fullscreen)').matches ||
            window.matchMedia('(display-mode: standalone)').matches) return;

        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isInStandaloneMode = window.navigator.standalone;

        if (isIOS && !isInStandaloneMode) {
            // iOS：無法自動觸發，顯示手動引導
            const dismissed = sessionStorage.getItem('pwa_ios_dismissed');
            if (!dismissed) setShowIOS(true);
            return;
        }

        // Android / Chrome：監聽安裝事件
        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowAndroid(true);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleAndroidInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') setShowAndroid(false);
        setDeferredPrompt(null);
    };

    const handleDismiss = (type) => {
        if (type === 'ios') {
            sessionStorage.setItem('pwa_ios_dismissed', '1');
            setShowIOS(false);
        } else {
            setShowAndroid(false);
        }
    };

    if (!showAndroid && !showIOS) return null;

    return (
        <div style={styles.wrap}>
            <div style={styles.card}>
                <div style={styles.icon}>🎴</div>
                <div style={styles.title}>加入主畫面</div>
                <div style={styles.desc}>
                    安裝後全螢幕遊玩，體驗更佳
                </div>

                {showAndroid && (
                    <button style={styles.btnInstall} onClick={handleAndroidInstall}>
                        立即安裝
                    </button>
                )}

                {showIOS && (
                    <div style={styles.iosGuide}>
                        <div style={styles.iosStep}>
                            <span style={styles.iosNum}>1</span>
                            點下方 <b style={styles.iosHighlight}>分享按鈕</b>（方塊加箭頭 ↑）
                        </div>
                        <div style={styles.iosStep}>
                            <span style={styles.iosNum}>2</span>
                            選擇 <b style={styles.iosHighlight}>「加入主畫面」</b>
                        </div>
                        <div style={styles.iosStep}>
                            <span style={styles.iosNum}>3</span>
                            點右上角 <b style={styles.iosHighlight}>「新增」</b>
                        </div>
                    </div>
                )}

                <button style={styles.btnDismiss} onClick={() => handleDismiss(showIOS ? 'ios' : 'android')}>
                    稍後再說
                </button>
            </div>
        </div>
    );
};

const styles = {
    wrap: {
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 99999,
        display: 'flex',
        justifyContent: 'center',
        padding: '0 16px 20px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)',
    },
    card: {
        background: 'linear-gradient(160deg, #1a1200, #2a1e00)',
        border: '1px solid rgba(212,175,55,0.5)',
        borderRadius: '20px',
        padding: '20px 24px',
        width: '100%',
        maxWidth: '380px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        boxShadow: '0 -4px 30px rgba(0,0,0,0.8)',
    },
    icon:  { fontSize: '2.5rem', lineHeight: 1 },
    title: { color: '#D4AF37', fontSize: '1.1rem', fontWeight: 900, letterSpacing: '0.05em' },
    desc:  { color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', textAlign: 'center' },
    btnInstall: {
        width: '100%',
        background: 'linear-gradient(135deg, #D4AF37, #b8860b)',
        color: '#1a1000',
        border: 'none',
        borderRadius: '12px',
        padding: '14px',
        fontSize: '1rem',
        fontWeight: 900,
        cursor: 'pointer',
        marginTop: '4px',
    },
    btnDismiss: {
        background: 'transparent',
        color: 'rgba(255,255,255,0.3)',
        border: 'none',
        fontSize: '0.8rem',
        cursor: 'pointer',
        padding: '4px',
    },
    iosGuide: {
        width: '100%',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '12px',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        marginTop: '4px',
    },
    iosStep: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: '0.88rem',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
    },
    iosNum: {
        background: '#D4AF37',
        color: '#1a1000',
        borderRadius: '50%',
        width: '22px', height: '22px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 900, fontSize: '0.75rem',
        flexShrink: 0,
    },
    iosHighlight: { color: '#D4AF37' },
};

export default InstallPrompt;
