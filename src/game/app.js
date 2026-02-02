import { Application, Assets, Sprite, Text, TextStyle, Container, Texture } from 'pixi.js';
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
        
        this.cardScale = 0.55; 
        this.squeezedMap = {}; 
        this.targetHands = null;
        this.serverResult = null;
        this.assetsLoaded = false;
    }

    async init(containerElement) {
        if (this.app) {
            this.destroy();
        }

        this.app = new Application();
        await this.app.init({
            backgroundAlpha: 0,
            resizeTo: window,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
            antialias: true,
        });
        
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
        if (this.cardContainer) this.cardContainer.removeChildren();
        if (this.uiLayer) this.uiLayer.removeChildren();

        gsap.killTweensOf(this.bankerSprites);
        this.playerSprites.forEach(group => gsap.killTweensOf(group));

        this.bankerSprites = [];
        this.playerSprites = [[], [], [], []];
        this.resultTexts = []; 
        this.squeezedMap = {};
        this.isPlaying = false;
        
        // 重置時確保畫布回歸穿透狀態
        if (this.app) {
            this.app.canvas.style.pointerEvents = 'none';
            this.app.canvas.style.zIndex = '5';
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
        
        // 重要：發牌開始時，允許畫布接收點擊，否則點不到卡片
        this.app.canvas.style.pointerEvents = 'auto';

        const bankerHand = this.targetHands.banker.map(t => ({ texture: t }));
        const playersHands = [
            this.targetHands.tian.map(t => ({ texture: t })),
            this.targetHands.di.map(t => ({ texture: t })),
            this.targetHands.xuan.map(t => ({ texture: t })),
            this.targetHands.huang.map(t => ({ texture: t }))
        ];

        const formatNiuLabel = (res) => {
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

        await this.dealRound(bankerHand, playersHands, bResult, pResults);
    }

    getFanCardProps(zoneIndex, cardIndex, totalCards = 5) {
        const w = this.app.screen.width;
        const h = this.app.screen.height;
        const gap = w / 4.2;
        const startOffset = (w - (gap * 3)) / 2;
        let centerX, centerY;
        if (zoneIndex === -1) { 
            centerX = w / 2; centerY = h * 0.25; 
        } else { 
            centerX = startOffset + (zoneIndex * gap); centerY = h * 0.58; 
        }
        const spreadAngle = 0.1; 
        const centerIndex = (totalCards - 1) / 2;
        const angle = (cardIndex - centerIndex) * spreadAngle;
        const xOffset = (cardIndex - centerIndex) * 22; 
        return { x: centerX + xOffset, y: centerY, rotation: angle };
    }

    async dealRound(bankerHand, playersHands, bResult, pResults) {
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
                            card.on('pointerdown', (e) => {
                                e.stopPropagation(); // 防止事件穿透
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

        // 1. 進入咪牌狀態：通知 UI 隱藏，提升畫布層級
        if (this.onSqueezeStateChange) this.onSqueezeStateChange(true, 0); 
        this.app.canvas.style.zIndex = '2000'; // 確保在所有 UI 之上
        this.app.canvas.style.pointerEvents = 'auto';

        // 2. 呼叫 SqueezeController 開始咪牌
        this.squeezeCtrl.start(cardData.texture, () => {
            // 3. 咪牌完成回調
            cardSprite.texture = Texture.from(cardData.texture);
            cardSprite.visible = true;
            
            // 恢復原本層級與穿透
            this.app.canvas.style.zIndex = '5'; 
            this.app.canvas.style.pointerEvents = 'auto'; // 發牌完仍保持 auto 才能點下一張，直到 settleAll 結束
            
            if (this.onSqueezeStateChange) this.onSqueezeStateChange(false);
            gsap.fromTo(cardSprite.scale, {x: 1.1, y: 1.1}, {x: this.cardScale, y: this.cardScale, duration: 0.2});
        });
    }

    async revealAllRemaining() {
        if(!this.targetHands) return;
        const handKeys = ['tian', 'di', 'xuan', 'huang'];
        for(let z=0; z<4; z++) {
            if (!this.squeezedMap[z]) { 
                this.flipCard(this.playerSprites[z][4], this.targetHands[handKeys[z]][4]);
            }
        }
        setTimeout(() => this.openBankerAndSettle(), 800);
    }

    async openBankerAndSettle() {
        const bankerCards = this.targetHands.banker;
        for(let i=0; i<5; i++) {
            await new Promise(r => setTimeout(r, 150)); 
            this.flipCard(this.bankerSprites[i], bankerCards[i]);
        }
        setTimeout(() => this.settleAll(), 600);
    }

    async settleAll() {
        if (!this.serverResult) return;
        const winners = this.serverResult.winners; 
        const winnerKeys = ['tian', 'di', 'xuan', 'huang'];
        const winningZones = [];

        const styleWin = new TextStyle({ fontFamily: 'Arial', fontSize: 36, fontWeight: 'bold', fill: '#f1c40f', stroke: '#000', strokeThickness: 4 });
        const styleLose = new TextStyle({ fontFamily: 'Arial', fontSize: 36, fontWeight: 'bold', fill: '#bdc3c7', stroke: '#000', strokeThickness: 4 });

        const bRes = this.serverResult.results.banker;
        const bLabel = bRes.niu === 10 ? "牛牛" : (bRes.niu > 0 ? `牛${bRes.niu}` : "無牛");
        const bankerText = new Text({ text: bLabel, style: styleWin });
        const bPos = this.getFanCardProps(-1, 2);
        bankerText.anchor.set(0.5);
        bankerText.x = bPos.x; bankerText.y = bPos.y - 100;
        this.uiLayer.addChild(bankerText);

        for(let i=0; i<4; i++) {
            const key = winnerKeys[i];
            const isWin = winners[key];
            if (isWin) winningZones.push(i);
            const pRes = this.serverResult.results[key];
            const pLabel = pRes.niu === 10 ? "牛牛" : (pRes.niu > 0 ? `牛${pRes.niu}` : "無牛");
            const typeText = new Text({ text: pLabel, style: isWin ? styleWin : styleLose });
            const pPos = this.getFanCardProps(i, 2);
            typeText.anchor.set(0.5);
            typeText.x = pPos.x; typeText.y = pPos.y + 100;
            this.uiLayer.addChild(typeText);
        }

        if (winningZones.length > 0) this.coinRain.play();
        if (this.onWinZones) this.onWinZones(winningZones);

        this.isPlaying = false;
        // 結算完成，恢復畫布穿透，讓用戶可以點擊下一局籌碼
        this.app.canvas.style.pointerEvents = 'none';
    }

    destroy() {
        if (this.app) {
            this.app.destroy(true, { children: true, texture: false, baseTexture: false });
            this.app = null;
            this.assetsLoaded = false;
        }
    }
}

export const gameApp = new GameApp();