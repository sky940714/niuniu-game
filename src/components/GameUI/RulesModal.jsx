import React from 'react';

const PAYTABLE = [
    { name: '五小妞', desc: '全5張點數≤5 且總和≤10', mult: '8×', color: '#ff5722' },
    { name: '鐵支妞', desc: '四條',                   mult: '6×', color: '#e91e63' },
    { name: '葫蘆妞', desc: '三條 + 對子',             mult: '6×', color: '#e91e63' },
    { name: '同花順', desc: '同花順',                   mult: '6×', color: '#e91e63' },
    { name: '五龍妞', desc: '全部 J、Q、K',            mult: '5×', color: '#9c27b0' },
    { name: '銀花妞', desc: '一張10 + 四張JQK',        mult: '5×', color: '#9c27b0' },
    { name: '妞妞',   desc: '任三張合為10倍數，餘數0', mult: '3×', color: '#2196f3' },
    { name: '妞8/妞9', desc: '剩餘兩張點數餘 8 或 9', mult: '2×', color: '#00bcd4' },
    { name: '妞1～妞7', desc: '剩餘兩張點數餘 1–7',   mult: '1×', color: '#4caf50' },
    { name: '沒妞',   desc: '無法湊出三張10的倍數',    mult: '1×', color: '#9e9e9e' },
];

const RulesModal = ({ onClose }) => (
    <div style={s.overlay} onClick={onClose}>
        <div style={s.panel} onClick={e => e.stopPropagation()}>

            <div style={s.header}>
                <span style={s.title}>📖 玩法與賠率</span>
                <button onClick={onClose} style={s.closeBtn}>✖</button>
            </div>

            <div style={s.limitRow}>
                <span>最低 $100</span>
                <span style={s.sep}>｜</span>
                <span>單門上限 $500,000</span>
                <span style={s.sep}>｜</span>
                <span>每局上限 $2,000,000</span>
            </div>

            <div style={s.list}>
                {PAYTABLE.map((row, i) => (
                    <div key={i} style={s.row}>
                        <div style={s.left}>
                            <span style={{
                                ...s.badge,
                                background: row.color + '25',
                                border: `1px solid ${row.color}`,
                                color: row.color,
                            }}>{row.mult}</span>
                            <span style={s.name}>{row.name}</span>
                        </div>
                        <span style={s.desc}>{row.desc}</span>
                    </div>
                ))}
            </div>

            <div style={s.note}>※ 所有賠付實際獲利 × 0.95（抽水 5%）</div>
        </div>
    </div>
);

const s = {
    overlay: {
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
        zIndex: 9998, display: 'flex', justifyContent: 'center', alignItems: 'center',
        pointerEvents: 'auto',
    },
    panel: {
        width: '90%', maxWidth: '420px',
        background: 'rgba(10,12,24,0.97)',
        border: '1px solid rgba(212,175,55,0.4)', borderRadius: '20px',
        padding: '20px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.9)',
        pointerEvents: 'auto',
        maxHeight: '82vh', overflowY: 'auto',
    },
    header: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '10px', paddingBottom: '10px',
        borderBottom: '1px solid rgba(212,175,55,0.2)',
    },
    title: { fontSize: '1.1rem', fontWeight: 'bold', color: '#D4AF37' },
    closeBtn: {
        background: 'transparent', border: 'none', color: '#fff',
        fontSize: '1.2rem', cursor: 'pointer',
    },
    limitRow: {
        display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255,255,255,0.05)', borderRadius: '8px',
        padding: '8px 10px', marginBottom: '12px',
        fontSize: '0.75rem', color: '#aaa',
    },
    sep: { color: '#444' },
    list: { display: 'flex', flexDirection: 'column', gap: '5px' },
    row: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px',
    },
    left: { display: 'flex', alignItems: 'center', gap: '8px' },
    badge: {
        padding: '2px 8px', borderRadius: '20px',
        fontSize: '0.82rem', fontWeight: 'bold',
        flexShrink: 0, minWidth: '34px', textAlign: 'center',
    },
    name: { color: '#fff', fontSize: '0.88rem', fontWeight: 'bold' },
    desc: { color: '#777', fontSize: '0.72rem', textAlign: 'right', maxWidth: '170px' },
    note: { marginTop: '12px', color: '#555', fontSize: '0.7rem', textAlign: 'center' },
};

export default RulesModal;
