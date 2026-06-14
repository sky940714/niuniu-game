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

    // 1. 五小妞 (8倍): 全 A~5 且 總和 <= 10
    const isAllSmall = cards.every(c => c.rank <= 5);
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
    // 莊閒皆無妞：莊家恆贏（不論牌面大小）
    if (playerResult.type === 'NO_NIU' && bankerResult.type === 'NO_NIU') return false;

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

// ── Admin: Generate a hand of a specific type ─────────────────────────────

function _shuffleArr(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function _buildPool(excludedCards) {
    const excluded = new Set(excludedCards.map(c => `${c.suit}_${c.rank}`));
    const suits = ['s','h','d','c'];
    const ranks = [1,2,3,4,5,6,7,8,9,10,11,12,13];
    const deck = [];
    for (const suit of suits)
        for (const rank of ranks)
            if (!excluded.has(`${suit}_${rank}`))
                deck.push({ suit, rank });
    return _shuffleArr(deck);
}

function _genNiuHand(available, targetNiu) {
    const target = targetNiu === 10 ? 0 : targetNiu;
    const sample = available.slice(0, Math.min(available.length, 24));
    const n = sample.length;

    for (let i = 0; i < n - 2; i++) {
        for (let j = i+1; j < n - 1; j++) {
            for (let k = j+1; k < n; k++) {
                const ts = (getCardValue(sample[i].rank) + getCardValue(sample[j].rank) + getCardValue(sample[k].rank)) % 10;
                if (ts !== 0) continue;

                const used = new Set([i,j,k]);
                // bucket remaining cards by (value % 10)
                const buckets = {};
                for (let m = 0; m < n; m++) {
                    if (used.has(m)) continue;
                    const v = getCardValue(sample[m].rank) % 10;
                    if (!buckets[v]) buckets[v] = [];
                    buckets[v].push(m);
                }

                for (let p = 0; p < n; p++) {
                    if (used.has(p)) continue;
                    const vp = getCardValue(sample[p].rank) % 10;
                    const need = (target - vp + 10) % 10;
                    const cands = buckets[need] || [];
                    for (const q of cands) {
                        if (q <= p) continue;
                        const hand = [sample[i], sample[j], sample[k], sample[p], sample[q]];
                        const res = calculateHand(hand);
                        if (targetNiu === 10 && res.type === 'NIU_NIU') return hand;
                        if (targetNiu < 10 && res.niu === targetNiu) return hand;
                    }
                }
            }
        }
    }
    return null;
}

function _genNoNiuHand(available) {
    const nonFace = available.filter(c => c.rank <= 9);
    const pool = nonFace.length >= 8 ? _shuffleArr([...nonFace]) : _shuffleArr([...available]);
    for (let t = 0; t < 300; t++) {
        _shuffleArr(pool);
        const hand = pool.slice(0, 5);
        if (hand.length < 5) break;
        if (calculateHand(hand).type === 'NO_NIU') return hand;
    }
    return null;
}

function generateHandOfType(handType, excludedCards = []) {
    const av = _buildPool(excludedCards);
    if (av.length < 5) return null;

    const byRank = {};
    for (const c of av) { if (!byRank[c.rank]) byRank[c.rank] = []; byRank[c.rank].push(c); }

    switch (handType) {

        case 'FIVE_SMALL': {
            const small = av.filter(c => c.rank <= 5).sort((a,b) => a.rank - b.rank);
            if (small.length < 5) return null;
            const h = small.slice(0, 5);
            return h.reduce((s,c) => s + c.rank, 0) <= 10 ? h : null;
        }

        case 'BOMB': {
            const qr = Object.keys(byRank).filter(r => byRank[r].length >= 4);
            if (!qr.length) return null;
            for (const r of qr) {
                const four = byRank[r].slice(0,4);
                // Fifth card must not be tiny enough to form FIVE_SMALL
                const fifth = av.find(c => c.rank != r && !(four.every(x=>x.rank<=5) && c.rank<=5 && four.reduce((s,x)=>s+x.rank,0)+c.rank<=10));
                if (!fifth) continue;
                const hand = [...four, fifth];
                if (calculateHand(hand).type === 'BOMB') return hand;
            }
            return null;
        }

        case 'FULL_HOUSE': {
            const tr = Object.keys(byRank).filter(r => byRank[r].length >= 3);
            for (const triR of tr) {
                const pr = Object.keys(byRank).filter(r => r != triR && byRank[r].length >= 2);
                for (const pR of pr) {
                    const hand = [...byRank[triR].slice(0,3), ...byRank[pR].slice(0,2)];
                    if (calculateHand(hand).type === 'FULL_HOUSE') return hand;
                }
            }
            return null;
        }

        case 'STRAIGHT_FLUSH': {
            const bySuit = {};
            for (const c of av) { if (!bySuit[c.suit]) bySuit[c.suit] = {}; bySuit[c.suit][c.rank] = c; }
            const seqs = [[1,2,3,4,5],[2,3,4,5,6],[3,4,5,6,7],[4,5,6,7,8],
                          [5,6,7,8,9],[6,7,8,9,10],[7,8,9,10,11],[8,9,10,11,12],[9,10,11,12,13]];
            for (const suit of ['s','h','d','c']) {
                if (!bySuit[suit]) continue;
                for (const seq of seqs)
                    if (seq.every(r => bySuit[suit][r])) return seq.map(r => bySuit[suit][r]);
            }
            return null;
        }

        case 'FIVE_KNIGHTS': {
            // Pick mixed J/Q/K to avoid accidentally forming BOMB (4-of-a-kind)
            const j = av.filter(c => c.rank === 11);
            const q = av.filter(c => c.rank === 12);
            const k = av.filter(c => c.rank === 13);
            const combos = [
                [...j.slice(0,2), ...q.slice(0,2), ...k.slice(0,1)],
                [...j.slice(0,2), ...q.slice(0,1), ...k.slice(0,2)],
                [...j.slice(0,1), ...q.slice(0,2), ...k.slice(0,2)],
                [...j.slice(0,1), ...q.slice(0,1), ...k.slice(0,3)],
                [...j.slice(0,3), ...q.slice(0,1), ...k.slice(0,1)],
                [...j.slice(0,1), ...q.slice(0,3), ...k.slice(0,1)],
            ];
            for (const hand of combos)
                if (hand.length === 5 && calculateHand(hand).type === 'FIVE_KNIGHTS') return hand;
            return null;
        }

        case 'SILVER_NIU': {
            const tens = av.filter(c => c.rank === 10);
            const face = av.filter(c => c.rank >= 11);
            return (tens.length && face.length >= 4) ? [tens[0], ...face.slice(0,4)] : null;
        }

        case 'NIU_NIU': return _genNiuHand(av, 10);
        case 'NO_NIU':  return _genNoNiuHand(av);

        default: {
            const m = handType.match(/^NIU_(\d)$/);
            return m ? _genNiuHand(av, parseInt(m[1])) : null;
        }
    }
}

// 從可用牌池隨機取 5 張（供閒門發牌用）
function generateRandomHand(excludedCards = []) {
    const pool = _buildPool(excludedCards);
    return pool.length >= 5 ? pool.slice(0, 5) : null;
}

// ── 精確勝率控制輔助 ──────────────────────────────────────────────

// 特殊牌型（牛牛以上）在受控出牌中降低出現頻率
const SPECIAL_HAND_TYPES = new Set([
    'NIU_NIU', 'SILVER_NIU', 'FIVE_KNIGHTS',
    'STRAIGHT_FLUSH', 'FULL_HOUSE', 'BOMB', 'FIVE_SMALL'
]);

// 加權排列候選牌型：普通牌型優先（90%），特殊牌型低機率（10%）
function _weightedShuffleTiers(candidates) {
    const normals  = _shuffleArr(candidates.filter(c => !SPECIAL_HAND_TYPES.has(c.type)));
    const specials = _shuffleArr(candidates.filter(c =>  SPECIAL_HAND_TYPES.has(c.type)));

    if (normals.length > 0 && specials.length > 0) {
        if (Math.random() < 0.10) {
            return [specials[0], ...normals, ...specials.slice(1)];
        }
        return [...normals, ...specials];
    }
    return _shuffleArr([...candidates]);
}

// 牌型強度表（tier 越大越強）
const HAND_TIERS = [
    { type: 'FIVE_SMALL',     tier: 90 },
    { type: 'BOMB',           tier: 80 },
    { type: 'FULL_HOUSE',     tier: 70 },
    { type: 'STRAIGHT_FLUSH', tier: 65 },
    { type: 'FIVE_KNIGHTS',   tier: 60 },
    { type: 'SILVER_NIU',     tier: 55 },
    { type: 'NIU_NIU',        tier: 10 },
    { type: 'NIU_9',          tier: 9  },
    { type: 'NIU_8',          tier: 8  },
    { type: 'NIU_7',          tier: 7  },
    { type: 'NIU_6',          tier: 6  },
    { type: 'NIU_5',          tier: 5  },
    { type: 'NIU_4',          tier: 4  },
    { type: 'NIU_3',          tier: 3  },
    { type: 'NIU_2',          tier: 2  },
    { type: 'NIU_1',          tier: 1  },
    { type: 'NO_NIU',         tier: 0  },
];

// 從 calculateHand 的結果取得 tier 值
function getResultTier(result) {
    if (result.type === 'FIVE_SMALL')     return 90;
    if (result.type === 'BOMB')           return 80;
    if (result.type === 'FULL_HOUSE')     return 70;
    if (result.type === 'STRAIGHT_FLUSH') return 65;
    if (result.type === 'FIVE_KNIGHTS')   return 60;
    if (result.type === 'SILVER_NIU')     return 55;
    if (result.type === 'NIU_NIU')        return 10;
    if (result.type === 'BIG_NIU' || result.type === 'SMALL_NIU') return result.niu;
    return 0;
}

// 生成「比 bankerResult 弱」的手牌（讓莊家贏）
function generateWeakerHand(bankerResult, excludedCards, bannedTypes = new Set()) {
    const bankerTier = getResultTier(bankerResult);

    // 莊家無牛時，無更弱牌型可選；直接生成另一手無牛給閒家
    // 依據雙無牛規則（莊家恆贏），此做法仍讓莊家贏
    if (bankerTier === 0) {
        const hand = generateHandOfType('NO_NIU', excludedCards);
        if (hand) return hand;
    }

    const candidates = _weightedShuffleTiers(
        HAND_TIERS.filter(h => h.tier < bankerTier && !bannedTypes.has(h.type))
    );
    for (const { type } of candidates) {
        const hand = generateHandOfType(type, excludedCards);
        if (hand) return hand;
    }
    return null;
}

// 生成「比 bankerResult 強」的手牌（讓玩家贏）
function generateStrongerHand(bankerResult, excludedCards, bannedTypes = new Set()) {
    const bankerTier = getResultTier(bankerResult);
    const candidates = _weightedShuffleTiers(
        HAND_TIERS.filter(h => h.tier > bankerTier && !bannedTypes.has(h.type))
    );
    for (const { type } of candidates) {
        const hand = generateHandOfType(type, excludedCards);
        if (hand) return hand;
    }
    return null;
}

// 將 calculateHand 結果轉為禁牌 key（如 BIG_NIU niu=9 → 'NIU_9'）
function getHandTypeKey(result) {
    if (result.type === 'BIG_NIU' || result.type === 'SMALL_NIU') return `NIU_${result.niu}`;
    return result.type;
}

module.exports = {
    createDeck, calculateHand, isPlayerWin,
    generateHandOfType, generateRandomHand,
    generateWeakerHand, generateStrongerHand,
    getResultTier, getHandTypeKey, HAND_TIERS,
};