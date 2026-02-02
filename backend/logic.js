// backend/logic.js

// === 輔助設定 ===
// 花色大小：黑桃 > 愛心 > 梅花 > 方塊 (依照您的 s, h, c, d 習慣，或 s, h, d, c)
// 這裡沿用您原本的邏輯：s=4, h=3, d=2, c=1
const SUIT_ORDER = { 's': 4, 'h': 3, 'd': 2, 'c': 1 };

// 1. 產生一副洗好的牌 (104張，雙副牌)
function createDeck() {
    const suits = ['s', 'h', 'd', 'c'];
    const ranks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    let deck = [];

    // 兩副牌，所以迴圈跑兩次
    for (let i = 0; i < 2; i++) {
        for (let s of suits) {
            for (let r of ranks) {
                deck.push({ suit: s, rank: r });
            }
        }
    }

    // 洗牌 (Fisher-Yates Shuffle)
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck;
}

// 2. 計算點數 (J,Q,K 算 10, A 算 1)
function getCardValue(rank) {
    if (rank > 10) return 10;
    return rank;
}

// 輔助：排序手牌 (數字大 -> 小，花色大 -> 小)
function sortCards(cards) {
    return [...cards].sort((a, b) => {
        if (b.rank !== a.rank) return b.rank - a.rank;
        return SUIT_ORDER[b.suit] - SUIT_ORDER[a.suit];
    });
}

// 3. 核心：計算手牌牌型、倍率、權重
function calculateHand(cards) {
    const sorted = sortCards(cards);
    const highCard = sorted[0]; // 最大牌 (比大小用)

    // 分析手牌結構 (次數統計、花色統計、點數和)
    let ranksMap = {};
    let suitsMap = {};
    let totalValue = 0; // 計算五小妞用的點數和
    let ranksList = []; // 純數字列表

    cards.forEach(c => {
        ranksMap[c.rank] = (ranksMap[c.rank] || 0) + 1;
        suitsMap[c.suit] = (suitsMap[c.suit] || 0) + 1;
        totalValue += getCardValue(c.rank); // 注意：五小妞是看點數(1-10)還是牌面(1-13)? 通常五小妞看牌面A=1
        ranksList.push(c.rank);
    });

    ranksList.sort((a, b) => a - b);
    
    const isFlush = Object.keys(suitsMap).length === 1; // 是否同花
    // 是否順子 (注意: A-K 不循環，只支援連續數字)
    let isStraight = true;
    for(let i=0; i<4; i++) {
        if(ranksList[i+1] !== ranksList[i] + 1) {
            isStraight = false;
            break;
        }
    }
    // 特例: 10, J, Q, K, A 在某些規則算順子，但您的規則說「只支援數字順」，故 A,2,3,4,5 或 9,10,11,12,13 算順子

    // === 依照優先順序判斷牌型 ===

    // 1. 五小妞 (8倍): 所有牌點數 <= 4 且 總和 <= 10
    // 注意：這裡用 rank (牌面) 判斷 <= 4
    const isAllSmall = cards.every(c => c.rank <= 4);
    // 計算總點數 (A=1)
    const sumFaceValue = cards.reduce((sum, c) => sum + c.rank, 0); 
    if (isAllSmall && sumFaceValue <= 10) {
        return { type: 'FIVE_SMALL', label: '五小妞', multiplier: 8, rankScore: 1200, highCard };
    }

    // 2. 鐵支妞 (6倍): 4張相同
    if (Object.values(ranksMap).some(count => count === 4)) {
        return { type: 'BOMB', label: '鐵支妞', multiplier: 6, rankScore: 1100, highCard };
    }

    // 3. 葫蘆妞 (6倍): 3張相同 + 2張相同
    if (Object.values(ranksMap).includes(3) && Object.values(ranksMap).includes(2)) {
        return { type: 'FULL_HOUSE', label: '葫蘆妞', multiplier: 6, rankScore: 1000, highCard };
    }

    // 4. 同花順妞 (6倍)
    if (isFlush && isStraight) {
        return { type: 'STRAIGHT_FLUSH', label: '同花順妞', multiplier: 6, rankScore: 900, highCard };
    }

    // 5. 同花妞 (5倍)
    if (isFlush) {
        return { type: 'FLUSH', label: '同花妞', multiplier: 5, rankScore: 800, highCard };
    }

    // 6. 五龍妞 (5倍): 5張皆為 J(11), Q(12), K(13)
    const isAllJQK = cards.every(c => c.rank >= 11);
    if (isAllJQK) {
        return { type: 'FIVE_KNIGHTS', label: '五龍妞', multiplier: 5, rankScore: 700, highCard };
    }

    // 7. 銀花妞 (5倍): 1張10，其餘4張 J/Q/K
    const count10 = ranksMap[10] || 0;
    const countJQK = cards.filter(c => c.rank >= 11).length;
    if (count10 === 1 && countJQK === 4) {
        return { type: 'SILVER_NIU', label: '銀花妞', multiplier: 5, rankScore: 600, highCard };
    }

    // 8. 順子妞 (5倍)
    if (isStraight) {
        return { type: 'STRAIGHT', label: '順子妞', multiplier: 5, rankScore: 500, highCard };
    }

    // === 普通妞妞計算 ===
    // 演算法：找出3張和為10的倍數
    let foundNiu = false;
    let remainder = 0;

    for (let i = 0; i < 3; i++) {
        for (let j = i + 1; j < 4; j++) {
            for (let k = j + 1; k < 5; k++) {
                const sum3 = getCardValue(cards[i].rank) + getCardValue(cards[j].rank) + getCardValue(cards[k].rank);
                if (sum3 % 10 === 0) {
                    foundNiu = true;
                    const totalSum = cards.reduce((acc, c) => acc + getCardValue(c.rank), 0);
                    remainder = (totalSum - sum3) % 10;
                    if (remainder === 0) remainder = 10; // 牛牛
                }
            }
        }
    }

    if (!foundNiu) {
        // 12. 無妞 (1倍)
        return { type: 'NO_NIU', label: '無妞', niu: 0, multiplier: 1, rankScore: 0, highCard };
    } else {
        // 有牛，判斷牛幾
        if (remainder === 10) {
            // 9. 牛牛 (3倍)
            return { type: 'NIU_NIU', label: '牛牛', niu: 10, multiplier: 3, rankScore: 100, highCard };
        } else if (remainder >= 8) {
            // 10. 牛9, 牛8 (2倍)
            return { type: 'BIG_NIU', label: `牛${remainder}`, niu: remainder, multiplier: 2, rankScore: 10 + remainder, highCard };
        } else {
            // 11. 牛7 ~ 牛1 (1倍)
            return { type: 'SMALL_NIU', label: `牛${remainder}`, niu: remainder, multiplier: 1, rankScore: 10 + remainder, highCard };
        }
    }
}

// 4. 比牌 (回傳 true 代表 閒家贏，false 代表 莊家贏)
// 規則：先比牌型(rankScore)，一樣比最大牌數字，再一樣比最大牌花色
function isPlayerWin(playerResult, bankerResult) {
    // 1. 比牌型分數 (五小妞 > 鐵支 > ... > 牛牛 > 牛1 > 無妞)
    if (playerResult.rankScore > bankerResult.rankScore) return true;
    if (playerResult.rankScore < bankerResult.rankScore) return false;

    // 2. 牌型一樣，比最大牌數字 (K > Q > ... > 2 > A)
    // 注意：A 在這裡是 1，所以最小。如果您的規則 A 是最大，這裡需要改。通常妞妞 A 是最小。
    if (playerResult.highCard.rank > bankerResult.highCard.rank) return true;
    if (playerResult.highCard.rank < bankerResult.highCard.rank) return false;

    // 3. 數字一樣，比最大牌花色 (黑桃 > 愛心 > 方塊 > 梅花)
    // 這裡用我們定義的 SUIT_ORDER
    const pSuit = SUIT_ORDER[playerResult.highCard.suit];
    const bSuit = SUIT_ORDER[bankerResult.highCard.suit];
    return pSuit > bSuit;
}

module.exports = { createDeck, calculateHand, isPlayerWin };