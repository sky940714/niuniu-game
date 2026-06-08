import React from 'react';

const ZONE_LABELS = ['天', '地', '玄', '黃'];
const ZONE_KEYS   = ['tian', 'di', 'xuan', 'huang'];

const BetHistoryModal = ({ history, onClose }) => {
    const totalNet = history.reduce((acc, e) => acc + e.net, 0);

    return (
        <div style={s.overlay} onClick={onClose}>
            <div style={s.panel} onClick={e => e.stopPropagation()}>

                <div style={s.header}>
                    <span style={s.title}>📜 投注紀錄</span>
                    <button onClick={onClose} style={s.closeBtn}>✖</button>
                </div>

                {history.length > 0 && (
                    <div style={s.summary}>
                        <span>共 {history.length} 局</span>
                        <span style={s.sep}>｜</span>
                        <span>累計輸贏：</span>
                        <span style={{ color: totalNet >= 0 ? '#4caf50' : '#ef5350', fontWeight: 'bold' }}>
                            {totalNet >= 0 ? '+' : ''}{totalNet.toLocaleString()}
                        </span>
                    </div>
                )}

                {history.length === 0 ? (
                    <div style={s.empty}>尚無投注紀錄</div>
                ) : (
                    <div style={s.list}>
                        {[...history].reverse().map((entry, i) => (
                            <div key={i} style={s.row}>
                                <div style={s.rowTop}>
                                    <span style={s.roundLabel}>第 {entry.round} 局</span>
                                    <span style={{
                                        ...s.netBadge,
                                        color:      entry.net >= 0 ? '#4caf50' : '#ef5350',
                                        borderColor: entry.net >= 0 ? '#4caf50' : '#ef5350',
                                        background:  entry.net >= 0 ? 'rgba(76,175,80,0.1)' : 'rgba(239,83,80,0.1)',
                                    }}>
                                        {entry.net >= 0 ? '+' : ''}{entry.net.toLocaleString()}
                                    </span>
                                </div>

                                <div style={s.zoneBets}>
                                    {ZONE_KEYS.map((z, zi) => entry.bets[z] > 0 && (
                                        <span key={zi} style={s.zoneBet}>
                                            {ZONE_LABELS[zi]} ${entry.bets[z].toLocaleString()}
                                        </span>
                                    ))}
                                </div>

                                <div style={s.detail}>
                                    <span style={s.detailItem}>下注 ${entry.betTotal.toLocaleString()}</span>
                                    <span style={s.arrow}>→</span>
                                    <span style={{ ...s.detailItem, color: entry.net >= 0 ? '#4caf50' : '#ef5350' }}>
                                        獲得 ${entry.winAmount.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const s = {
    overlay: {
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
        zIndex: 9998, display: 'flex', justifyContent: 'center', alignItems: 'center',
        pointerEvents: 'auto',
    },
    panel: {
        width: '90%', maxWidth: '400px',
        background: 'rgba(10,12,24,0.97)',
        border: '1px solid rgba(212,175,55,0.4)', borderRadius: '20px',
        padding: '20px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.9)',
        pointerEvents: 'auto',
        maxHeight: '78vh', overflowY: 'auto',
    },
    header: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '10px', paddingBottom: '10px',
        borderBottom: '1px solid rgba(212,175,55,0.2)',
    },
    title: { fontSize: '1.1rem', fontWeight: 'bold', color: '#D4AF37' },
    closeBtn: { background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' },
    summary: {
        display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center',
        background: 'rgba(255,255,255,0.04)', borderRadius: '8px',
        padding: '7px 10px', marginBottom: '10px',
        fontSize: '0.82rem', color: '#aaa',
    },
    sep: { color: '#444' },
    empty: { textAlign: 'center', color: '#555', padding: '30px 0', fontSize: '0.9rem' },
    list: { display: 'flex', flexDirection: 'column', gap: '8px' },
    row: {
        background: 'rgba(255,255,255,0.04)', borderRadius: '10px',
        padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '5px',
    },
    rowTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    roundLabel: { color: '#666', fontSize: '0.78rem' },
    netBadge: {
        padding: '2px 10px', borderRadius: '20px', border: '1px solid',
        fontSize: '0.9rem', fontWeight: 'bold',
    },
    zoneBets: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
    zoneBet: {
        background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.25)',
        borderRadius: '4px', padding: '1px 7px',
        fontSize: '0.73rem', color: '#D4AF37',
    },
    detail: { display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.78rem' },
    detailItem: { color: '#aaa' },
    arrow: { color: '#444' },
};

export default BetHistoryModal;
