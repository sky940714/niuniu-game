import React, { useState, useEffect } from 'react';
import { socket } from '../socket';

const AnnouncementToast = () => {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const handler = ({ message }) => {
      const id = Date.now();
      setMessages(prev => [...prev, { id, message }]);
      setTimeout(() => setMessages(prev => prev.filter(m => m.id !== id)), 9000);
    };
    socket.on('announcement', handler);
    return () => socket.off('announcement', handler);
  }, []);

  if (!messages.length) return null;

  return (
    <div style={s.wrap}>
      {messages.map(m => (
        <div key={m.id} style={s.toast}>
          <span style={s.icon}>📢</span>
          <span style={s.text}>{m.message}</span>
          <button style={s.close} onClick={() => setMessages(p => p.filter(x => x.id !== m.id))}>✕</button>
        </div>
      ))}
    </div>
  );
};

const s = {
  wrap: {
    position: 'fixed', top: 64, left: '50%', transform: 'translateX(-50%)',
    zIndex: 99999, display: 'flex', flexDirection: 'column', gap: 8,
    width: '90%', maxWidth: 480, pointerEvents: 'none',
  },
  toast: {
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    border: '1px solid rgba(241,196,15,0.55)',
    borderRadius: 12, padding: '13px 16px',
    display: 'flex', alignItems: 'center', gap: 10,
    boxShadow: '0 6px 24px rgba(0,0,0,0.55)',
    pointerEvents: 'auto',
  },
  icon: { fontSize: 20, flexShrink: 0 },
  text: { flex: 1, color: '#fbbf24', fontSize: '0.95rem', fontWeight: 600, lineHeight: 1.4 },
  close: {
    background: 'none', border: 'none', color: '#475569', cursor: 'pointer',
    fontSize: '0.9rem', padding: '2px 4px', flexShrink: 0,
  },
};

export default AnnouncementToast;
