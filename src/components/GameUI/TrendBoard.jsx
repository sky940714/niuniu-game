import React from 'react';

// 走勢圖元件
const TrendBoard = ({ history, onClose }) => {
  // 只顯示最近的 30 局，避免格子爆掉
  const displayHistory = history.slice(-30); 

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.board} onClick={e => e.stopPropagation()}>
        
        <div style={styles.header}>
            <span style={{fontSize:'1.2rem', fontWeight:'bold', color:'#fff'}}>📊 牌局走勢</span>
            <button onClick={onClose} style={styles.closeBtn}>✖</button>
        </div>

        {/* 珠盤路 Grid */}
        <div style={styles.gridContainer}>
            {/* 預先產生 30 個格子，填入歷史資料 */}
            {Array.from({ length: 30 }).map((_, index) => {
                const record = displayHistory[index];
                return (
                    <div key={index} style={styles.gridCell}>
                        {record && (
                            <div style={{
                                ...styles.bead,
                                background: record.winner === 'player' 
                                    ? 'linear-gradient(135deg, #42a5f5, #1565c0)' // 閒: 藍色
                                    : 'linear-gradient(135deg, #ef5350, #c62828)', // 莊: 紅色
                                border: record.winner === 'player' 
                                    ? '2px solid #90caf9' 
                                    : '2px solid #ef9a9a'
                            }}>
                                {record.type.replace('牛','')} 
                                {/* 顯示文字：例如 "牛8" 顯示 "8", "牛牛" 顯示 "牛" */}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
        
        <div style={styles.footer}>
            <div style={styles.legend}><span style={{...styles.dot, background:'#1565c0'}}></span> 閒贏</div>
            <div style={styles.legend}><span style={{...styles.dot, background:'#c62828'}}></span> 莊贏</div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)',
    zIndex: 999, display: 'flex', justifyContent: 'center', alignItems: 'center',
  },
  board: {
    width: '90%', maxWidth: '400px',
    background: '#1a1a1a',
    border: '2px solid #d4af37', borderRadius: '15px',
    padding: '15px',
    boxShadow: '0 0 30px rgba(212,175,55,0.3)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px',
    borderBottom: '1px solid #333', paddingBottom: '10px'
  },
  closeBtn: {
    background: 'transparent', border:'none', color:'#fff', fontSize:'1.2rem', cursor:'pointer'
  },
  
  // 網格系統：6列 x 5行 (共30格)
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)', // 6行
    gridTemplateRows: 'repeat(5, 1fr)',    // 5列
    gap: '5px',
    background: '#eee', // 白底才有珠盤路的感覺
    padding: '5px',
    borderRadius: '5px',
    marginBottom: '10px',
  },
  gridCell: {
    width: '100%', aspectRatio: '1/1', // 正方形
    background: '#fff',
    border: '1px solid #ccc',
    display: 'flex', justifyContent: 'center', alignItems: 'center',
  },
  
  // 珠子樣式
  bead: {
    width: '80%', height: '80%', borderRadius: '50%',
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    color: '#fff', fontSize: '0.8rem', fontWeight: 'bold',
    boxShadow: '0 2px 2px rgba(0,0,0,0.3)',
    textShadow: '0 1px 1px rgba(0,0,0,0.5)',
  },
  
  footer: { display:'flex', gap:'20px', justifyContent:'center', color:'#ccc', fontSize:'0.9rem' },
  legend: { display:'flex', alignItems:'center', gap:'5px' },
  dot: { width:'12px', height:'12px', borderRadius:'50%' }
};

export default TrendBoard;