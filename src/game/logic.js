// src/game/logic.js

// 取得點數 (A=1, 10/J/Q/K=10)
export const getCardValue = (rank) => {
  if (rank === 'A') return 1;
  if (['10', 'J', 'Q', 'K'].includes(rank)) return 10;
  return parseInt(rank, 10);
};

// 取得花色權重 (黑桃 > 紅心 > 梅花 > 方塊) - 備用
export const getSuitWeight = (suit) => {
  const map = { 'spades': 4, 'hearts': 3, 'clubs': 2, 'diamonds': 1 };
  return map[suit] || 0;
};

/**
 * 核心算法：判斷牛牛牌型
 */
export const calculateNiu = (cards) => {
  if (cards.length !== 5) return { type: 'error', label: '錯誤' };

  const values = cards.map(c => getCardValue(c.rank));
  const totalSum = values.reduce((a, b) => a + b, 0);

  let hasNiu = false;
  let remainder = 0;

  // 暴力法找 3 張湊 10 的倍數
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 4; j++) {
      for (let k = j + 1; k < 5; k++) {
        const sum3 = values[i] + values[j] + values[k];
        if (sum3 % 10 === 0) {
          hasNiu = true;
          const remainingSum = totalSum - sum3;
          remainder = remainingSum % 10;
          if (remainder === 0) remainder = 10; // 餘數0 = 牛牛
          break;
        }
      }
      if (hasNiu) break;
    }
    if (hasNiu) break;
  }

  if (!hasNiu) {
    return { type: 'no_niu', multiplier: 1, label: '無牛 (烏龍)' };
  } else {
    if (remainder === 10) return { type: 'niu_niu', multiplier: 3, label: '🐂 牛牛 🐂' };
    const label = `牛${['一','二','三','四','五','六','七','八','九'][remainder-1]}`;
    const multiplier = remainder >= 7 ? 2 : 1;
    return { type: `niu_${remainder}`, multiplier, label };
  }
};

/**
 * 比較兩手牌的大小
 */
export const compareHands = (playerResult, bankerResult) => {
  const typeWeight = {
    'no_niu': 0,
    'niu_1': 1, 'niu_2': 2, 'niu_3': 3, 'niu_4': 4, 'niu_5': 5, 'niu_6': 6,
    'niu_7': 7, 'niu_8': 8, 'niu_9': 9,
    'niu_niu': 10,
    'bomb': 11,
    'gold': 12
  };

  const pWeight = typeWeight[playerResult.type] || 0;
  const bWeight = typeWeight[bankerResult.type] || 0;

  if (pWeight > bWeight) {
    return playerResult.multiplier; 
  } else if (bWeight > pWeight) {
    return -bankerResult.multiplier; 
  } else {
    // 平手或同點數，莊家贏 (簡化規則)
    return -bankerResult.multiplier;
  }
};