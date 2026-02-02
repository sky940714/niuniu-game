import { Application, Assets, Sprite, Text, TextStyle, Container, Texture } from 'pixi.js';
import { SqueezeController } from './SqueezeController';
import { CoinRain } from './Effects';
import gsap from 'gsap';

class GameApp {
    constructor() {
        this.app = null;
        this.squeezeCtrl = null;
        this.cardContainer = null;
        this.resultTexts = []; 
        this.isPlaying = false;
        
        // 回呼函式
        this.onBalanceChange = null; 
        this.onHistoryChange = null;
        this.onSqueezeStateChange = null; 
        this.onWinZones = null; 

        this.history = [];
        this.bankerSprites = []; 
        this.playerSprites = [[], [], [], []]; 
        
        this.cardScale = 0.8; 
        this.squeezedMap = {}; 
        this.targetHands = null;
        this.serverResult = null;
    }

    async init(containerElement) {
        // 防止重複初始化
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
        this.app.canvas.style.zIndex = '0'; 

        // 重新建立容器
        this.cardContainer = new Container();
        this.app.stage.addChild(this.cardContainer);
        
        this.squeezeCtrl = new SqueezeController();
        this.coinRain = new CoinRain(this.app);

        await this.loadAssets();
        this.generateFakeHistory();
        console.log("🎮 Pixi 遊戲引擎初始化完成");
    }

    async loadAssets() {
        // 檢查是否已加載，避免重複噴錯
        if (Assets.cache.has('card_back')) return;

        const modules = import.meta.glob('/src/assets/cards/*.png', { eager: true, as: 'url' });
        const assetsToLoad = [];
        for (const path in modules) {
            const name = path.split('/').pop().replace('.png', '');
            assetsToLoad.push({ alias: name, src: modules[path] });
        }
        await Assets.load(assetsToLoad);
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
        if (this.cardContainer) {
            this.cardContainer.removeChildren();
        }
        // 清除正在進行的 GSAP 動畫，防止物件被刪除但動畫還在回傳
        gsap.killTweensOf(this.bankerSprites);
        this.playerSprites.forEach(group => gsap.killTweensOf(group));

        this.bankerSprites = [];
        this.playerSprites = [[], [], [], []];
        this.resultTexts = []; 
        this.squeezedMap = {};
        this.isPlaying = false;
    }

    startRoundWithData(serverResult) {
        console.log("🎲 Pixi 接收到發牌數據:", serverResult);
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
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.resetTable();

        if (!this.targetHands) return;

        const bankerHand = this.targetHands.banker.map(t => ({ texture: t }));
        const playersHands = [
            this.targetHands.tian.map(t => ({ texture: t })),
            this.targetHands.di.map(t => ({ texture: t })),
            this.targetHands.xuan.map(t => ({ texture: t })),
            this.targetHands.huang.map(t => ({ texture: t }))
        ];

        const formatNiuLabel = (res) => {
            if(res.type === 'NO_NIU') return '無牛';
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
        const gap = w * 0.95 / 4;
        const startOffset = (w - (w * 0.95)) / 2; 

        let centerX, centerY;
        if (zoneIndex === -1) { 
            centerX = (w / 2) + 50; 
            centerY = h * 0.22; 
        } else { 
            centerX = startOffset + (zoneIndex * gap) + (gap / 2);
            centerY = h * 0.62; 
        }

        const spreadAngle = 0.12; 
        const centerIndex = (totalCards - 1) / 2;
        const angle = (cardIndex - centerIndex) * spreadAngle;
        const xOffset = (cardIndex - centerIndex) * 18; 
        
        return { x: centerX + xOffset, y: centerY, rotation: angle };
    }

    async dealRound(bankerHand, playersHands, bResult, pResults) {
        const w = this.app.screen.width;
        const h = this.app.screen.height;
        const dealOrder = [-1, 0, 1, 2, 3];
        
        for (let round = 0; round < 5; round++) {
            for (let zoneIdx of dealOrder) {
                const card = Sprite.from('card_back');
                card.anchor.set(0.5, 0.5); 
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
                    x: target.x,
                    y: target.y,
                    rotation: target.rotation,
                    duration: 0.4,
                    delay: (round * 5 + (zoneIdx + 1)) * 0.08,
                    ease: "sine.out",
                    onComplete: () => {
                        if (!isBanker && !isFifthCard) {
                            this.flipCard(card, playersHands[zoneIdx][round].texture);
                        } else if (!isBanker && isFifthCard) {
                            card.eventMode = 'static';
                            card.cursor = 'pointer';
                            card.on('pointerdown', () => {
                                this.handleSqueezeClick(card, playersHands[zoneIdx][round]);
                            });
                        }
                    }
                });
            }
        }
    }

    async flipCard(sprite, textureName) {
        if (!sprite || !this.app) return;
        const tex = Texture.from(textureName);
        gsap.to(sprite.scale, { x: 0, duration: 0.12, onComplete: () => {
            sprite.texture = tex;
            gsap.to(sprite.scale, { x: this.cardScale, duration: 0.12 });
        }});
    }

    async handleSqueezeClick(cardSprite, cardData) {
        if (this.squeezedMap[cardSprite.zoneId]) return; 
        this.squeezedMap[cardSprite.zoneId] = true;
        
        cardSprite.eventMode = 'none';
        cardSprite.visible = false;

        if (this.onSqueezeStateChange) this.onSqueezeStateChange(true, 0); 
        this.app.canvas.style.zIndex = '999';

        this.squeezeCtrl.start(cardData.texture, () => {
            cardSprite.texture = Texture.from(cardData.texture);
            cardSprite.visible = true;
            this.app.canvas.style.zIndex = '0';
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
        setTimeout(() => this.openBankerAndSettle(), 600);
    }

    async openBankerAndSettle() {
        const bankerCards = this.targetHands.banker;
        for(let i=0; i<5; i++) {
            await new Promise(r => setTimeout(r, 120)); 
            this.flipCard(this.bankerSprites[i], bankerCards[i]);
        }
        setTimeout(() => this.settleAll(), 500);
    }

    async settleAll() {
        const winners = this.serverResult.winners; 
        const winnerKeys = ['tian', 'di', 'xuan', 'huang'];
        const winningZones = [];

        const styleWin = new TextStyle({ fontFamily: 'Arial', fontSize: 32, fontWeight: 'bold', fill: '#f1c40f', stroke: '#000', strokeThickness: 4 });
        const styleLose = new TextStyle({ fontFamily: 'Arial', fontSize: 32, fontWeight: 'bold', fill: '#bdc3c7', stroke: '#000', strokeThickness: 4 });

        // 莊家結果
        const bLabel = this.serverResult.results.banker.niu === 10 ? "牛牛" : `牛${this.serverResult.results.banker.niu || 0}`;
        const bankerText = new Text({ text: bLabel, style: styleWin });
        const bPos = this.getFanCardProps(-1, 2);
        bankerText.anchor.set(0.5);
        bankerText.x = bPos.x; bankerText.y = bPos.y - 80;
        this.cardContainer.addChild(bankerText);

        // 閒家結果
        for(let i=0; i<4; i++) {
            const isWin = winners[winnerKeys[i]];
            if (isWin) winningZones.push(i);

            const pRes = this.serverResult.results[winnerKeys[i]];
            const pLabel = pRes.niu === 10 ? "牛牛" : `牛${pRes.niu || 0}`;
            const typeText = new Text({ text: pLabel, style: isWin ? styleWin : styleLose });
            const pPos = this.getFanCardProps(i, 2);
            typeText.anchor.set(0.5);
            typeText.x = pPos.x; typeText.y = pPos.y + 70;
            this.cardContainer.addChild(typeText);
        }

        if (winningZones.length > 0) this.coinRain.play();
        if (this.onWinZones) this.onWinZones(winningZones);

        this.isPlaying = false;
    }

    destroy() {
        if (this.app) {
            this.app.destroy(true, { children: true, texture: false, baseTexture: false });
            this.app = null;
        }
    }
}

export const gameApp = new GameApp();