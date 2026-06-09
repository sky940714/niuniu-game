// src/game/logic.js
// 前端手牌計算（僅供顯示，結算以後端為準）
// 邏輯需與 backend/logic.js 保持一致

// 取得牌面點數 (A=1, J/Q/K=10，同時相容整數與字串格式)
export const getCardValue = (rank) => {
  if (rank === 'A' || rank === 1) return 1;
  const n = typeof rank === 'number' ? rank : parseInt(rank, 10);
  return n > 10 ? 10 : n;
};

// 取得數字 rank（用於牌型判斷，J=11 Q=12 K=13）
const getRankNum = (rank) => {
  if (rank === 'J' || rank === 11) return 11;
  if (rank === 'Q' || rank === 12) return 12;
  if (rank === 'K' || rank === 13) return 13;
  if (rank === 'A' || rank === 1)  return 1;
  const n = parseInt(rank, 10);
  return isNaN(n) ? 0 : n;
};

// 取得花色權重（相容完整名稱與縮寫，黑桃 > 紅心 > 梅花 > 方塊）
export const getSuitWeight = (suit) => {
  const map = {
    'spades': 4, 's': 4,
    'hearts': 3, 'h': 3,
    'clubs': 2,  'c': 2,
    'diamonds': 1, 'd': 1,
  };
  return map[suit] || 0;
};

// ─── 特殊牌型判斷（優先順序對齊後端）────────────────────────────────
const checkSpecialHand = (cards) => {
  const nums  = cards.map(c => getRankNum(c.rank));
  const suits = cards.map(c => c.suit);

  // 五小妞：全部 rank ≤ 5 且 rank 總和 ≤ 10（含 A=1）
  if (nums.every(n => n <= 5) && nums.reduce((a, b) => a + b, 0) <= 10) {
    return { type: 'five_small', multiplier: 8, label: '五小妞' };
  }

  // 統計各 rank 出現次數
  const freq = {};
  nums.forEach(n => { freq[n] = (freq[n] || 0) + 1; });
  const freqs = Object.values(freq).sort((a, b) => b - a);

  // 鐵支妞：四條
  if (freqs[0] === 4) {
    return { type: 'bomb', multiplier: 6, label: '鐵支妞' };
  }

  // 葫蘆妞：三條 + 對子
  if (freqs[0] === 3 && freqs[1] === 2) {
    return { type: 'full_house', multiplier: 6, label: '葫蘆妞' };
  }

  // 同花順：同花 + 連續 rank
  if (new Set(suits.map(s => {
    // 統一花色縮寫，避免 'spades' vs 's' 的混淆
    if (s === 'spades')   return 's';
    if (s === 'hearts')   return 'h';
    if (s === 'clubs')    return 'c';
    if (s === 'diamonds') return 'd';
    return s;
  })).size === 1) {
    const sorted = [...nums].sort((a, b) => a - b);
    let isStraight = true;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] !== sorted[i - 1] + 1) { isStraight = false; break; }
    }
    if (isStraight) {
      return { type: 'straight_flush', multiplier: 6, label: '同花順' };
    }
  }

  // 五龍妞：五張全是 J/Q/K
  if (nums.every(n => n >= 11)) {
    return { type: 'five_knights', multiplier: 5, label: '五龍妞' };
  }

  // 銀花妞：剛好一張 10（非 JQK）＋ 四張 J/Q/K
  const count10  = nums.filter(n => n === 10).length;
  const countJQK = nums.filter(n => n >= 11).length;
  if (count10 === 1 && countJQK === 4) {
    return { type: 'silver_niu', multiplier: 5, label: '銀花妞' };
  }

  return null;
};

// ─── 核心牛牌計算（與後端一致：窮舉所有組合，取最大牛點）──────────────
export const calculateNiu = (cards) => {
  if (!cards || cards.length !== 5) return { type: 'error', label: '錯誤' };

  // 先判斷特殊牌型（優先於普通牛牌）
  const special = checkSpecialHand(cards);
  if (special) return special;

  const values   = cards.map(c => getCardValue(c.rank));
  const totalSum = values.reduce((a, b) => a + b, 0);

  let bestRemainder = -1;

  // 窮舉 C(5,3)=10 種組合，取最大牛點
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 4; j++) {
      for (let k = j + 1; k < 5; k++) {
        const sum3 = values[i] + values[j] + values[k];
        if (sum3 % 10 === 0) {
          let remainder = (totalSum - sum3) % 10;
          if (remainder === 0) remainder = 10; // 牛牛
          if (remainder > bestRemainder) bestRemainder = remainder;
        }
      }
    }
  }

  if (bestRemainder === -1) {
    return { type: 'no_niu', multiplier: 1, label: '無牛' };
  }
  if (bestRemainder === 10) {
    return { type: 'niu_niu', multiplier: 3, label: '🐂 牛牛 🐂' };
  }
  const names  = ['一','二','三','四','五','六','七','八','九'];
  const multi  = bestRemainder >= 8 ? 2 : 1;
  return { type: `niu_${bestRemainder}`, multiplier: multi, label: `牛${names[bestRemainder - 1]}` };
};

// ─── 比牌（顯示用，結算以後端為準）────────────────────────────────────
export const compareHands = (playerResult, bankerResult) => {
  const typeWeight = {
    'no_niu':       0,
    'niu_1':        1,  'niu_2':  2, 'niu_3': 3, 'niu_4': 4,
    'niu_5':        5,  'niu_6':  6, 'niu_7': 7,
    'niu_8':        8,  'niu_9':  9,
    'niu_niu':      10,
    'silver_niu':   11, // 5×
    'five_knights': 12, // 5×
    'full_house':   13, // 6×
    'straight_flush': 14, // 6×
    'bomb':         15, // 6×
    'five_small':   16, // 8×
  };

  const pW = typeWeight[playerResult?.type] ?? 0;
  const bW = typeWeight[bankerResult?.type] ?? 0;

  if (pW > bW) return  (playerResult.multiplier  || 1);
  if (bW > pW) return -(bankerResult.multiplier   || 1);
  return -(bankerResult.multiplier || 1); // 同牌型莊贏
};
