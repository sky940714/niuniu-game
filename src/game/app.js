import { Application, Assets, Sprite, Text, TextStyle, Container, Texture, Rectangle } from 'pixi.js'; 
import { SqueezeController } from './SqueezeController';
import { CoinRain } from './Effects';
import gsap from 'gsap';

class GameApp {
    constructor() {
        this.app = null;
        this.squeezeCtrl = null;
        
        this.bgLayer = null;
        this.cardContainer = null;
        this.uiLayer = null;

        this.resultTexts = []; 
        this.isPlaying = false;
        
        this.onBalanceChange = null; 
        this.onHistoryChange = null;
        this.onSqueezeStateChange = null; 
        this.onWinZones = null; 

        this.history = [];
        this.bankerSprites = []; 
        this.playerSprites = [[], [], [], []]; 
        
        this.cardScale = 1.6;
        this.squeezedMap = {};
        this.targetHands = null;
        this.serverResult = null;
        this.assetsLoaded = false;
        // 結算動畫計時器 ID，resetTable 時用來取消懸空的 setTimeout
        this._settleTimer1 = null;
        this._settleTimer2 = null;
        // 世代計數器：resetTable() 時遞增，舊的非同步結算鏈比對不符即放棄
        this._settleGeneration = 0;
    }

    async init(containerElement) {
        if (this.app) {
            this.destroy();
        }

        this.parentElement = containerElement;

        this.app = new Application();
        await this.app.init({
            backgroundAlpha: 0,
            resizeTo: window,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
            antialias: true,
        });

        this.app.stage.sortableChildren = true;
        
        containerElement.appendChild(this.app.canvas);
        this.app.canvas.style.position = 'absolute';
        this.app.canvas.style.top = '0';
        this.app.canvas.style.left = '0';
        this.app.canvas.style.zIndex = '5'; 
        
        // 初始狀態：允許穿透，這樣才能點到下方的下注按鈕
        this.app.canvas.style.pointerEvents = 'none'; 

        this.bgLayer = new Container();
        this.cardContainer = new Container();
        this.uiLayer = new Container();
        
        this.app.stage.addChild(this.bgLayer);
        this.app.stage.addChild(this.cardContainer);
        this.app.stage.addChild(this.uiLayer);
        
        // 傳入 app 實例以便 SqueezeController 能掛載自己的容器到 stage
        this.squeezeCtrl = new SqueezeController(this.app);
        this.coinRain = new CoinRain(this.app);

        // 擱置分頁後回來時，避免 GSAP 補間動畫大幅跳躍
        gsap.ticker.lagSmoothing(500, 33);

        await this.loadAssets();
        this.generateFakeHistory();
        console.log("🎮 Pixi 遊戲引擎初始化完成");
    }

    async loadAssets() {
        if (this.assetsLoaded) return;
        try {
            const modules = import.meta.glob('/src/assets/cards/*.png', { eager: true });
            const assetsToLoad = [];
            for (const path in modules) {
                const name = path.split('/').pop().replace('.png', '');
                const src = modules[path].default || modules[path];
                assetsToLoad.push({ alias: name, src: src });
            }
            await Assets.load(assetsToLoad);
            this.assetsLoaded = true;
            console.log("📦 遊戲資源加載完畢");
        } catch (error) {
            console.error("❌ 資源加載失敗:", error);
        }
    }

    generateFakeHistory() {
        if (this.history.length > 0) return;
        for(let i=0; i<10; i++) {
            const isPlayerWin = Math.random() > 0.5;
            this.history.push({
                winner: isPlayerWin ? 'player' : 'banker',
                type: '牛' + Math.floor(Math.random()*9+1) 
            });
        }
    }

    resetTable() {
        // 取消仍在飛的結算 setTimeout（防止 RESULT→BETTING 切換後 settleAll 還跑出來）
        clearTimeout(this._settleTimer1); this._settleTimer1 = null;
        clearTimeout(this._settleTimer2); this._settleTimer2 = null;
        // 世代遞增 → 讓所有仍在 await 中的舊結算鏈一律放棄執行
        this._settleGeneration++;

        // 先停金幣動畫並清除所有金幣 Graphics，重置 isActive 旗標，
        // 否則下局 play() 會被自己的 guard 擋住且金幣粒子殘留在 stage
        if (this.coinRain) this.coinRain.stop();

        // 強制中止進行中的咪牌（避免跨局殘留 overlay 或事件監聽）
        if (this.squeezeCtrl) this.squeezeCtrl.forceReset();

        if (this.cardContainer) this.cardContainer.removeChildren();
        if (this.uiLayer) this.uiLayer.removeChildren();

        gsap.killTweensOf(this.bankerSprites);
        this.playerSprites.forEach(group => gsap.killTweensOf(group));

        this.bankerSprites = [];
        this.playerSprites = [[], [], [], []];
        this.resultTexts = [];
        this.squeezedMap = {};
        this.isPlaying = false;

        // 重置：canvas 穿透，容器降回 zIndex 5（低於籌碼層 50）
        if (this.app) {
            this.app.canvas.style.pointerEvents = 'none';
        }
        if (this.parentElement) {
            this.parentElement.style.zIndex = '5';
        }
    }

    startRoundWithData(serverResult) {
        if (!this.assetsLoaded) {
            setTimeout(() => this.startRoundWithData(serverResult), 500);
            return;
        }
        this.serverResult = serverResult;
        const suitMap = { 's': 'spades', 'h': 'hearts', 'd': 'diamonds', 'c': 'clubs' };
        const rankMap = { 
            1: 'A', 2: '02', 3: '03', 4: '04', 5: '05', 6: '06', 7: '07', 8: '08', 9: '09',
            10: '10', 11: 'J', 12: 'Q', 13: 'K' 
        };
        const formatCard = (c) => `card_${suitMap[c.suit]}_${rankMap[c.rank]}`;

        this.targetHands = {
            banker: serverResult.hands.banker.map(formatCard),
            tian:   serverResult.hands.tian.map(formatCard),
            di:     serverResult.hands.di.map(formatCard),
            xuan:   serverResult.hands.xuan.map(formatCard),
            huang:  serverResult.hands.huang.map(formatCard),
        };
        this.startGame();
    }

    async startGame() {
        this.isPlaying = true;
        this.resetTable();

        // 將整個 GameCanvas 容器（position:fixed, zIndex:5）提升到 55，
        // 高於籌碼層（position:fixed, zIndex:50），確保牌面不被籌碼遮擋。
        // 注意：修改 canvas 本身的 zIndex 無效，因為它在容器的 stacking context 內。
        if (this.parentElement) {
            this.parentElement.style.zIndex = '55';
        }
        this.app.canvas.style.pointerEvents = 'auto';

        const bankerHand = this.targetHands.banker.map(t => ({ texture: t }));
        const playersHands = [
            this.targetHands.tian.map(t => ({ texture: t })),
            this.targetHands.di.map(t => ({ texture: t })),
            this.targetHands.xuan.map(t => ({ texture: t })),
            this.targetHands.huang.map(t => ({ texture: t }))
        ];

        // 這裡的 formatNiuLabel 已經不再是唯一的判斷標準，後端會送 label 過來
        const formatNiuLabel = (res) => {
            if (res.label) return res.label; // 優先使用後端 label
            if(!res || res.type === 'NO_NIU') return '無牛';
            if(res.niu === 10) return '牛牛';
            return `牛${res.niu}`;
        };

        const bResult = { ...this.serverResult.results.banker, label: formatNiuLabel(this.serverResult.results.banker) };
        const pResults = [
            { ...this.serverResult.results.tian, label: formatNiuLabel(this.serverResult.results.tian) },
            { ...this.serverResult.results.di, label: formatNiuLabel(this.serverResult.results.di) },
            { ...this.serverResult.results.xuan, label: formatNiuLabel(this.serverResult.results.xuan) },
            { ...this.serverResult.results.huang, label: formatNiuLabel(this.serverResult.results.huang) }
        ];

        await this.dealRound(bankerHand, playersHands);
    }

    getFanCardProps(zoneIndex, cardIndex, totalCards = 5) {
        const w = this.app.screen.width;
        const h = this.app.screen.height;

        let centerY = (zoneIndex === -1) ? h * 0.15 : h * 0.54; 

        let centerX;
        if (zoneIndex === -1) { 
            centerX = w / 2; 
        } else { 
            const GAP_RATE = 0.20; 
            const startX = w * (0.5 - (1.5 * GAP_RATE)); 
            const gap = w * GAP_RATE;   
            centerX = startX + (zoneIndex * gap); 
        }
    
        const spreadAngle = 0.1; 
        const centerIndex = (totalCards - 1) / 2;
        const angle = (cardIndex - centerIndex) * spreadAngle;
        const xOffset = (cardIndex - centerIndex) * 23; 
        
        return { x: centerX + xOffset, y: centerY, rotation: angle };
    }

    async dealRound(bankerHand, playersHands) {
        const w = this.app.screen.width;
        const h = this.app.screen.height;
        const dealOrder = [-1, 0, 1, 2, 3];
        
        for (let round = 0; round < 5; round++) {
            for (let zoneIdx of dealOrder) {
                const card = Assets.cache.has('card_back') ? Sprite.from('card_back') : new Sprite(Texture.WHITE);
                card.anchor.set(0.5); 
                card.scale.set(this.cardScale);
                card.x = w / 2; 
                card.y = h + 100;
                this.cardContainer.addChild(card);

                if (zoneIdx === -1) this.bankerSprites.push(card);
                else this.playerSprites[zoneIdx].push(card);

                const target = this.getFanCardProps(zoneIdx, round);
                const isFifthCard = (round === 4);
                const isBanker = (zoneIdx === -1);

                gsap.to(card, {
                    x: target.x, y: target.y, rotation: target.rotation,
                    duration: 0.5,
                    delay: (round * 5 + (zoneIdx + 1)) * 0.05,
                    ease: "power2.out",
                    onComplete: () => {
                        if (!isBanker && !isFifthCard) {
                            this.flipCard(card, playersHands[zoneIdx][round].texture);
                        } else if (!isBanker && isFifthCard) {
                            // 第五張牌設定為可點擊
                            card.eventMode = 'static';
                            card.cursor = 'pointer';
                            
                            // 1. 加大 1.5 倍判定範圍
                            const baseW = card.texture.width;
                            const baseH = card.texture.height;
                            const hitW = baseW * 1.5;
                            const hitH = baseH * 1.5;
                            
                            card.hitArea = new Rectangle(-hitW/2, -hitH/2, hitW, hitH);
                            card.on('pointerdown', (e) => {
                                e.stopPropagation(); 
                                this.handleSqueezeClick(card, playersHands[zoneIdx][round], zoneIdx);
                            });
                        }
                    }
                });
            }
        }
    }

    async flipCard(sprite, textureName) {
        if (!sprite || !this.app) return;
        try {
            const tex = Texture.from(textureName);
            gsap.to(sprite.scale, { x: 0, duration: 0.15, onComplete: () => {
                sprite.texture = tex;
                gsap.to(sprite.scale, { x: this.cardScale, duration: 0.15 });
            }});
        } catch (e) { console.error("翻牌失敗:", textureName); }
    }

    async handleSqueezeClick(cardSprite, cardData, zoneIdx) {
        if (this.squeezedMap[zoneIdx]) return; 
        this.squeezedMap[zoneIdx] = true;
        
        cardSprite.eventMode = 'none';
        cardSprite.visible = false;

        if (this.onSqueezeStateChange) this.onSqueezeStateChange(true, 0); 
        
        if (this.parentElement) this.parentElement.style.zIndex = '2000';
        this.app.canvas.style.zIndex = '2000'; 
        this.app.canvas.style.pointerEvents = 'auto';

        this.squeezeCtrl.start(cardData.texture, () => {
            if (cardData && cardData.texture) {
                cardSprite.texture = Texture.from(cardData.texture);
            }
            cardSprite.visible = true;
            cardSprite.removeChildren();

            // 咪牌結束後：容器降回 55（仍高於籌碼 50，牌面保持可見）
            // 不能降回 5，否則後續的牌又被籌碼蓋住
            if (this.parentElement) this.parentElement.style.zIndex = '55';
            this.app.canvas.style.pointerEvents = 'auto';

            if (this.onSqueezeStateChange) this.onSqueezeStateChange(false);
            gsap.fromTo(cardSprite.scale, {x: 1.1, y: 1.1}, {x: this.cardScale, y: this.cardScale, duration: 0.2});
        });
    }

    async revealAllRemaining() {
        if (!this.targetHands) return;
        // 若本次進入遊戲廳沒有發牌（中途加入），sprites 為空，直接跳過
        if (!this.playerSprites[0] || this.playerSprites[0].length === 0) return;
        const gen = this._settleGeneration; // 捕捉當前世代，稍後用來驗證是否已被 resetTable 取消
        const handKeys = ['tian', 'di', 'xuan', 'huang'];
        for(let z=0; z<4; z++) {
            if (!this.squeezedMap[z]) {
                this.flipCard(this.playerSprites[z][4], this.targetHands[handKeys[z]][4]);
            }
        }
        this._settleTimer1 = setTimeout(() => {
            if (this._settleGeneration === gen) this.openBankerAndSettle(gen);
        }, 800);
    }

    async openBankerAndSettle(gen) {
        const bankerCards = this.targetHands.banker;
        for(let i=0; i<5; i++) {
            await new Promise(r => setTimeout(r, 150));
            // 每次 await 回來都確認世代，若 resetTable() 已被呼叫就直接放棄
            if (this._settleGeneration !== gen) return;
            this.flipCard(this.bankerSprites[i], bankerCards[i]);
        }
        this._settleTimer2 = setTimeout(() => {
            if (this._settleGeneration === gen) this.settleAll();
        }, 600);
    }

    // 🔥 重點修改區塊：正確讀取後端 label 並套用你設定的座標 🔥
    async settleAll() {
        if (!this.serverResult) return;
        const winners = this.serverResult.winners; 
        const winnerKeys = ['tian', 'di', 'xuan', 'huang'];
        const winningZones = [];

        // Pixi v8：stroke 改為物件格式，移除已廢棄的 strokeThickness
        const styleWin  = new TextStyle({ fontFamily: 'Arial', fontSize: 36, fontWeight: 'bold', fill: '#f1c40f', stroke: { color: '#000000', width: 5 } });
        const styleLose = new TextStyle({ fontFamily: 'Arial', fontSize: 36, fontWeight: 'bold', fill: '#bdc3c7', stroke: { color: '#000000', width: 5 } });

        // --- 1. 處理莊家 (Banker) 文字位置 ---
        const bRes = this.serverResult.results.banker;
        
        // 🔥 [修正]：優先使用後端回傳的 label (例如 "五小妞", "炸彈", "牛牛")
        // 如果後端沒回傳 label (為了防呆)，才用舊邏輯
        const bLabel = bRes.label || (bRes.niu === 10 ? "牛牛" : (bRes.niu > 0 ? `牛${bRes.niu}` : "無牛"));
        
        const bankerText = new Text({ text: bLabel, style: styleWin });
        
        const bPos = this.getFanCardProps(-1, 2);
        bankerText.anchor.set(0.5);

        // 使用你設定的座標
        bankerText.x = bPos.x + 140; 
        bankerText.y = bPos.y + 0; 
        
        this.uiLayer.addChild(bankerText);

        // --- 2. 處理閒家 (Player) 文字位置 ---
        for(let i=0; i<4; i++) {
            const key = winnerKeys[i];
            const isWin = winners[key];
            if (isWin) winningZones.push(i);
            
            const pRes = this.serverResult.results[key];
            
            // 🔥 [修正]：同樣優先使用後端 label
            const pLabel = pRes.label || (pRes.niu === 10 ? "牛牛" : (pRes.niu > 0 ? `牛${pRes.niu}` : "無牛"));
            
            const typeText = new Text({ text: pLabel, style: isWin ? styleWin : styleLose });
            
            const pPos = this.getFanCardProps(i, 2);
            typeText.anchor.set(0.5);

            // 使用你設定的座標
            typeText.x = pPos.x + 0; 
            typeText.y = pPos.y + 100; 

            this.uiLayer.addChild(typeText);
        }

        if (winningZones.length > 0) this.coinRain.play();
        if (this.onWinZones) this.onWinZones(winningZones);

        // 將本局真實結果記入走勢歷史
        winnerKeys.forEach((key, i) => {
            const pRes = this.serverResult.results[key];
            this.history.push({
                winner: this.serverResult.winners[key] ? 'player' : 'banker',
                type: pRes.label || (pRes.niu > 0 ? `牛${pRes.niu}` : '無牛'),
            });
        });
        if (this.history.length > 100) this.history = this.history.slice(-100);
        if (this.onHistoryChange) this.onHistoryChange([...this.history]);

        this.isPlaying = false;
        this.app.canvas.style.pointerEvents = 'none';
    }

    destroy() {
        clearTimeout(this._settleTimer1); this._settleTimer1 = null;
        clearTimeout(this._settleTimer2); this._settleTimer2 = null;
        this._settleGeneration++; // 中止所有仍在 await 中的結算鏈
        // 停金幣、清 Pixi app（會 destroy 所有 Graphics children）
        if (this.coinRain) this.coinRain.stop();
        if (this.app) {
            this.app.destroy(true, { children: true, texture: false, baseTexture: false });
            this.app = null;
            this.assetsLoaded = false;
        }
        // 清除所有局資料，防止重新進入遊戲廳時用到舊資料
        this.targetHands = null;
        this.serverResult = null;
        this.coinRain = null;
        this.bankerSprites = [];
        this.playerSprites = [[], [], [], []];
        this.squeezedMap = {};
        this.isPlaying = false;
    }
}

export const gameApp = new GameApp();