import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://localhost:3001';
const LIMIT    = 20;

const ZONE_LABELS = { tian: '天', di: '地', xuan: '玄', huang: '黃' };
const ZONES = ['tian', 'di', 'xuan', 'huang'];

// ─── 可展開的單筆紀錄 ─────────────────────────────────────────
const RecordRow = ({ r }) => {
    const [open, setOpen] = useState(false);
    const net   = r.net;
    const bettedZones = ZONES.filter(z => r[`bet_${z}`] > 0);

    const dateStr = (() => {
        const d = new Date(r.settled_at);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        return `${mm}/${dd} ${hh}:${mi}`;
    })();

    return (
        <div style={s.row} onClick={() => setOpen(o => !o)}>
            <div style={s.rowTop}>
                <div style={s.rowLeft}>
                    <span style={s.rowDate}>{dateStr}</span>
                    <div style={s.zoneBets}>
                        {bettedZones.map(z => (
                            <span key={z} style={{
                                ...s.zoneBet,
                                color:       r[`${z}_win`] ? '#4caf50' : '#D4AF37',
                                borderColor: r[`${z}_win`] ? '#4caf50' : 'rgba(212,175,55,0.3)',
                            }}>
                                {ZONE_LABELS[z]} ${r[`bet_${z}`].toLocaleString()}
                            </span>
                        ))}
                    </div>
                </div>
                <span style={{
                    ...s.netBadge,
                    color:      net >= 0 ? '#4caf50' : '#ef5350',
                    borderColor: net >= 0 ? '#4caf50' : '#ef5350',
                    background:  net >= 0 ? 'rgba(76,175,80,0.1)' : 'rgba(239,83,80,0.1)',
                }}>
                    {net >= 0 ? '+' : ''}{net.toLocaleString()}
                </span>
            </div>

            {open && (
                <div style={s.detail}>
                    {/* 下注/獲得 */}
                    <div style={s.detailRow}>
                        <span style={s.detailLabel}>下注</span>
                        <span style={s.detailVal}>${r.bet_total.toLocaleString()}</span>
                        <span style={s.detailLabel}>獲得</span>
                        <span style={{ ...s.detailVal, color: net >= 0 ? '#4caf50' : '#ef5350' }}>
                            ${r.win_amount.toLocaleString()}
                        </span>
                    </div>
                    {/* 莊家 */}
                    <div style={s.detailRow}>
                        <span style={s.detailLabel}>莊家</span>
                        <span style={s.detailVal}>{r.banker_type}　{r.banker_cards}</span>
                    </div>
                    {/* 各區 */}
                    {bettedZones.map(z => (
                        <div key={z} style={s.detailRow}>
                            <span style={s.detailLabel}>{ZONE_LABELS[z]}</span>
                            <span style={{
                                ...s.detailVal,
                                color: r[`${z}_win`] ? '#4caf50' : '#ef5350',
                            }}>
                                {r[`${z}_type`]}　{r[`${z}_cards`]}　{r[`${z}_win`] ? '✓ 贏' : '✗ 輸'}
                            </span>
                        </div>
                    ))}
                    {/* 結算後餘額 */}
                    <div style={s.detailRow}>
                        <span style={s.detailLabel}>結算後餘額</span>
                        <span style={s.detailVal}>
                            ${parseFloat(r.balance_after).toLocaleString()}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── 主元件 ──────────────────────────────────────────────────
const LobbyBetHistoryModal = ({ onClose }) => {
    const [records,  setRecords]  = useState([]);
    const [page,     setPage]     = useState(1);
    const [total,    setTotal]    = useState(0);
    const [loading,  setLoading]  = useState(false);
    const [error,    setError]    = useState(null);

    const fetchPage = useCallback(async (p) => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('prestige_token');
            const res = await fetch(
                `${API_BASE}/api/bet-records?page=${p}&limit=${LIMIT}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || '查詢失敗');
            }
            const data = await res.json();
            setRecords(data.rows || []);
            setTotal(data.total || 0);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchPage(page); }, [page, fetchPage]);

    const totalPages = Math.ceil(total / LIMIT);

    const pageNetTotal = records.reduce((acc, r) => acc + r.net, 0);

    return (
        <div style={s.overlay} onClick={onClose}>
            <div style={s.panel} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={s.header}>
                    <span style={s.title}>📜 投注紀錄</span>
                    <button onClick={onClose} style={s.closeBtn}>✖</button>
                </div>

                {/* 統計列 */}
                {!loading && !error && records.length > 0 && (
                    <div style={s.summary}>
                        <span>共 {total} 筆</span>
                        <span style={s.sep}>｜</span>
                        <span>本頁淨利：</span>
                        <span style={{ color: pageNetTotal >= 0 ? '#4caf50' : '#ef5350', fontWeight: 'bold' }}>
                            {pageNetTotal >= 0 ? '+' : ''}{pageNetTotal.toLocaleString()}
                        </span>
                    </div>
                )}

                {/* 狀態 */}
                {loading && <div style={s.empty}>載入中…</div>}
                {!loading && error && <div style={{ ...s.empty, color: '#ef5350' }}>{error}</div>}
                {!loading && !error && records.length === 0 && (
                    <div style={s.empty}>尚無投注紀錄</div>
                )}

                {/* 紀錄列表 */}
                {!loading && !error && records.length > 0 && (
                    <div style={s.list}>
                        {records.map(r => <RecordRow key={r.id} r={r} />)}
                    </div>
                )}

                {/* 分頁控制 */}
                {totalPages > 1 && (
                    <div style={s.pager}>
                        <button
                            style={{ ...s.pageBtn, opacity: page <= 1 ? 0.35 : 1 }}
                            disabled={page <= 1}
                            onClick={() => setPage(p => p - 1)}
                        >‹</button>
                        <span style={s.pageInfo}>{page} / {totalPages}</span>
                        <button
                            style={{ ...s.pageBtn, opacity: page >= totalPages ? 0.35 : 1 }}
                            disabled={page >= totalPages}
                            onClick={() => setPage(p => p + 1)}
                        >›</button>
                    </div>
                )}
            </div>
        </div>
    );
};

const s = {
    overlay: {
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(7px)',
        zIndex: 9998, display: 'flex', justifyContent: 'center', alignItems: 'center',
        pointerEvents: 'auto',
    },
    panel: {
        width: '92%', maxWidth: '500px',
        background: 'rgba(10,12,24,0.97)',
        border: '1px solid rgba(212,175,55,0.4)', borderRadius: '20px',
        padding: '20px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.9)',
        maxHeight: '84vh', overflowY: 'auto',
    },
    header: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '10px', paddingBottom: '10px',
        borderBottom: '1px solid rgba(212,175,55,0.2)',
    },
    title:    { fontSize: '1.1rem', fontWeight: 'bold', color: '#D4AF37' },
    closeBtn: { background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' },
    summary: {
        display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center',
        background: 'rgba(255,255,255,0.04)', borderRadius: '8px',
        padding: '7px 10px', marginBottom: '10px',
        fontSize: '0.82rem', color: '#aaa',
    },
    sep:   { color: '#444' },
    empty: { textAlign: 'center', color: '#555', padding: '30px 0', fontSize: '0.9rem' },
    list:  { display: 'flex', flexDirection: 'column', gap: '7px' },
    row: {
        background: 'rgba(255,255,255,0.04)', borderRadius: '10px',
        padding: '10px 12px', cursor: 'pointer',
        transition: 'background 0.15s',
    },
    rowTop: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
    },
    rowLeft: { display: 'flex', flexDirection: 'column', gap: '5px', flex: 1, minWidth: 0 },
    rowDate: { color: '#555', fontSize: '0.72rem' },
    zoneBets: { display: 'flex', gap: '5px', flexWrap: 'wrap' },
    zoneBet: {
        border: '1px solid',
        borderRadius: '4px', padding: '1px 7px',
        fontSize: '0.72rem', fontWeight: '600',
    },
    netBadge: {
        padding: '3px 11px', borderRadius: '20px', border: '1px solid',
        fontSize: '0.9rem', fontWeight: 'bold', flexShrink: 0,
    },
    detail: {
        marginTop: '9px', paddingTop: '9px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column', gap: '5px',
    },
    detailRow:   { display: 'flex', gap: '8px', alignItems: 'baseline', flexWrap: 'wrap' },
    detailLabel: { color: '#555', fontSize: '0.71rem', flexShrink: 0 },
    detailVal:   { color: '#999', fontSize: '0.76rem' },
    pager: {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '14px', marginTop: '14px',
    },
    pageBtn: {
        background: 'rgba(255,255,255,0.08)', color: '#fff',
        border: '1px solid rgba(255,255,255,0.15)', borderRadius: '7px',
        width: '34px', height: '34px', fontSize: '1.2rem',
        cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    pageInfo: { color: 'rgba(255,255,255,0.45)', fontSize: '0.82rem' },
};

export default LobbyBetHistoryModal;
