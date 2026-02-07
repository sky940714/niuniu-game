// backend/logic.js

const SUIT_ORDER = { 's': 4, 'h': 3, 'd': 2, 'c': 1 }; // 黑桃 > 愛心 > 方塊 > 梅花

// 1. 產生牌組
function createDeck() {
    const suits = ['s', 'h', 'd', 'c'];
    const ranks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    let deck = [];
    // 兩副牌
    for (let i = 0; i < 2; i++) {
        for (let s of suits) {
            for (let r of ranks) {
                deck.push({ suit: s, rank: r });
            }
        }
    }
    // 洗牌
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// 2. 取得點數 (JQK=10)
function getCardValue(rank) {
    if (rank > 10) return 10;
    return rank;
}

// 3. 排序 (比大小用，K最大，A最小)
function sortCards(cards) {
    return [...cards].sort((a, b) => {
        if (b.rank !== a.rank) return b.rank - a.rank;
        return SUIT_ORDER[b.suit] - SUIT_ORDER[a.suit];
    });
}

// 4. 計算手牌
function calculateHand(cards) {
    const sorted = sortCards(cards);
    // 預設最大牌 (單張最大)
    let highCard = sorted[0]; 

    // 統計
    let ranksMap = {};
    let suitsMap = {};
    let ranksList = [];
    
    cards.forEach(c => {
        ranksMap[c.rank] = (ranksMap[c.rank] || 0) + 1;
        suitsMap[c.suit] = (suitsMap[c.suit] || 0) + 1;
        ranksList.push(c.rank);
    });
    ranksList.sort((a, b) => a - b);

    const isFlush = Object.keys(suitsMap).length === 1;
    let isStraight = true;
    for(let i=0; i<4; i++) {
        if(ranksList[i+1] !== ranksList[i] + 1) isStraight = false;
    }

    // --- 特殊牌型判斷 (分數權重設定：萬位數代表牌型) ---

    // 1. 五小妞 (8倍): 全 <= 5 且 總和 <= 10
    const isAllSmall = cards.every(c => c.rank < 5); 
    const sumFace = cards.reduce((sum, c) => sum + c.rank, 0);
    if (isAllSmall && sumFace <= 10) {
        return { type: 'FIVE_SMALL', label: '五小妞', multiplier: 8, rankScore: 90000, highCard };
    }

    // 2. 炸彈 / 鐵支妞 (6倍)
    // 🔥 修正：HighCard 應該是炸彈的那張牌，而不是手中的最大牌
    for (const [rank, count] of Object.entries(ranksMap)) {
        if (count === 4) {
            const bombCard = sorted.find(c => c.rank == rank); 
            return { 
                type: 'BOMB', 
                label: '鐵支妞', 
                multiplier: 6, 
                // 加 rank 防止同鐵支比輸贏
                rankScore: 80000 + parseInt(rank), 
                highCard: bombCard 
            };
        }
    }

    // 3. 葫蘆妞 (6倍)
    // 🔥 修正：HighCard 應該是三條的那張牌
    if (Object.values(ranksMap).includes(3) && Object.values(ranksMap).includes(2)) {
         const tripleRank = Object.keys(ranksMap).find(r => ranksMap[r] === 3);
         const tripleCard = sorted.find(c => c.rank == tripleRank);
         return { 
             type: 'FULL_HOUSE', 
             label: '葫蘆妞', 
             multiplier: 6, 
             rankScore: 70000 + parseInt(tripleRank), 
             highCard: tripleCard 
         };
    }

    // 4. 同花順 (6倍)
    if (isFlush && isStraight) {
        return { type: 'STRAIGHT_FLUSH', label: '同花順', multiplier: 6, rankScore: 65000 + highCard.rank, highCard };
    }

    // 5. 五龍妞 (5倍): 全 JQK
    if (cards.every(c => c.rank >= 11)) {
        return { type: 'FIVE_KNIGHTS', label: '五龍妞', multiplier: 5, rankScore: 60000, highCard };
    }
    
    // 6. 銀花妞 (5倍): 1張10, 4張JQK
    const count10 = ranksMap[10] || 0;
    const countJQK = cards.filter(c => c.rank >= 11).length;
    if (count10 === 1 && countJQK === 4) {
        return { type: 'SILVER_NIU', label: '銀花妞', multiplier: 5, rankScore: 55000, highCard };
    }

    // --- 普通牛牛計算 ---
    let maxRemainder = -1; // -1 代表無牛

    // 暴力窮舉 C(5,3) = 10 種組合，找出最大的牛
    for (let i = 0; i < 3; i++) {
        for (let j = i + 1; j < 4; j++) {
            for (let k = j + 1; k < 5; k++) {
                const sum3 = getCardValue(cards[i].rank) + getCardValue(cards[j].rank) + getCardValue(cards[k].rank);
                
                if (sum3 % 10 === 0) {
                    const totalSum = cards.reduce((acc, c) => acc + getCardValue(c.rank), 0);
                    let remainder = (totalSum - sum3) % 10;
                    if (remainder === 0) remainder = 10; // 牛牛
                    
                    if (remainder > maxRemainder) {
                        maxRemainder = remainder;
                    }
                }
            }
        }
    }

    if (maxRemainder === 10) {
        // 牛牛 (3倍)
        // rankScore: 10000 + 最大牌 (確保比 牛9 大)
        return { type: 'NIU_NIU', label: '牛牛', niu: 10, multiplier: 3, rankScore: 10000 + highCard.rank, highCard };
    } else if (maxRemainder >= 1) {
        // 牛1 ~ 牛9
        const multiplier = maxRemainder >= 8 ? 2 : 1;
        // rankScore: 牛幾 * 1000 + 最大牌
        // 例如 牛9 = 9000分, 牛1 = 1000分
        return { 
            type: maxRemainder >= 8 ? 'BIG_NIU' : 'SMALL_NIU', 
            label: `牛${maxRemainder}`, 
            niu: maxRemainder, 
            multiplier: multiplier, 
            rankScore: maxRemainder * 1000 + highCard.rank, 
            highCard 
        };
    } else {
        // 無牛 (0分)
        return { type: 'NO_NIU', label: '無牛', niu: 0, multiplier: 1, rankScore: 0 + highCard.rank, highCard };
    }
}

// 5. 比牌邏輯 (回傳 true: 閒家贏, false: 莊家贏)
// 規則：莊閒同牌型同點數同花色 -> 莊贏 (莊家優勢)
function isPlayerWin(playerResult, bankerResult) {
    // 1. 比牌型分數 (萬位數與千位數已經決定了牌型大小)
    // 舉例：五小妞(90000) > 牛牛(10013) > 牛9(9013) > 無牛(13)
    const pScore = Math.floor(playerResult.rankScore / 1000);
    const bScore = Math.floor(bankerResult.rankScore / 1000);

    if (pScore > bScore) return true;
    if (pScore < bScore) return false;

    // 2. 牌型一樣 (例如都是牛9)，比最大牌點數 (rank)
    if (playerResult.highCard.rank > bankerResult.highCard.rank) return true;
    if (playerResult.highCard.rank < bankerResult.highCard.rank) return false;

    // 3. 點數一樣，比最大牌花色 (suit)
    const pSuit = SUIT_ORDER[playerResult.highCard.suit];
    const bSuit = SUIT_ORDER[bankerResult.highCard.suit];
    
    if (pSuit > bSuit) return true;
    if (pSuit < bSuit) return false;

    // 4. 完全一樣 (機率極低)，莊家贏
    return false;
}

module.exports = { createDeck, calculateHand, isPlayerWin };