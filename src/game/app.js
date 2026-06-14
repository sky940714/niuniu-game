import { Application, Assets, Sprite, Text, TextStyle, Container, Texture, Rectangle } from 'pixi.js';
import { SqueezeController } from './SqueezeController';
import { CoinRain, HighHandEffect } from './Effects';
import { soundManager } from './SoundManager';
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

        this._settleTimer1 = null;
        this._settleTimer2 = null;
        this._settleGeneration = 0;

        // 瞇牌權限（由 GameUI 在發牌前設定）
        this.iAmBanker = false;
        this.playerBetZones = new Set(); // 有下注的門 (0-3)
    }

    // 由 GameUI 在每局發牌前呼叫，設定本局的瞇牌權限
    setPlayerContext(iAmBanker, bettedZones = []) {
        this.iAmBanker = !!iAmBanker;
        this.playerBetZones = new Set(bettedZones);
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
        this.app.canvas.style.pointerEvents = 'none';

        this.bgLayer = new Container();
        this.cardContainer = new Container();
        this.uiLayer = new Container();

        this.app.stage.addChild(this.bgLayer);
        this.app.stage.addChild(this.cardContainer);
        this.app.stage.addChild(this.uiLayer);

        this.squeezeCtrl    = new SqueezeController(this.app);
        this.coinRain       = new CoinRain(this.app);
        this.highHandEffect = new HighHandEffect(this.app);

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
            // 預載牌型特效圖（去背 PNG，放在 public/images/effects/）
            const effectNames = ['niuniu','wulong','yinhua','tonghuashun','hulu','tiezhi','wuxiao'];
            effectNames.forEach(n => assetsToLoad.push({
                alias: `effect_${n}`,
                src:   `/images/effects/effect_${n}.png`,
            }));
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
        clearTimeout(this._settleTimer1); this._settleTimer1 = null;
        clearTimeout(this._settleTimer2); this._settleTimer2 = null;
        this._settleGeneration++;

        if (this.coinRain) this.coinRain.stop();
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

        const formatNiuLabel = (res) => {
            if (res.label) return res.label;
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
                    onStart: () => {
                        soundManager.deal();
                    },
                    onComplete: () => {
                        if (isBanker && !isFifthCard) {
                            // 莊家前4張：維持牌背（不翻）
                        } else if (isBanker && isFifthCard && this.iAmBanker) {
                            // 莊家第5張：若本玩家是莊家，可瞇牌
                            card.eventMode = 'static';
                            card.cursor = 'pointer';
                            const baseW = card.texture.width;
                            const baseH = card.texture.height;
                            card.hitArea = new Rectangle(-baseW * 0.75, -baseH * 0.75, baseW * 1.5, baseH * 1.5);
                            card.on('pointerdown', (e) => {
                                e.stopPropagation();
                                this.handleSqueezeClick(card, bankerHand[4], -1);
                            });
                        } else if (!isBanker && !isFifthCard) {
                            // 閒家前4張：直接翻面
                            this.flipCard(card, playersHands[zoneIdx][round].texture);
                        } else if (!isBanker && isFifthCard) {
                            // 閒家第5張：有下注的門才能瞇牌
                            // playerBetZones 為空代表 setPlayerContext 未被呼叫（相容舊行為允許全部瞇）
                            const canSqueeze = this.playerBetZones.size === 0
                                ? true
                                : this.playerBetZones.has(zoneIdx);
                            if (canSqueeze) {
                                card.eventMode = 'static';
                                card.cursor = 'pointer';
                                const baseW = card.texture.width;
                                const baseH = card.texture.height;
                                card.hitArea = new Rectangle(-baseW * 0.75, -baseH * 0.75, baseW * 1.5, baseH * 1.5);
                                card.on('pointerdown', (e) => {
                                    e.stopPropagation();
                                    this.handleSqueezeClick(card, playersHands[zoneIdx][round], zoneIdx);
                                });
                            }
                            // 未下注的門：保持牌背，等 revealAllRemaining 統一翻開
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
                soundManager.flip();
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

            if (this.parentElement) this.parentElement.style.zIndex = '55';
            this.app.canvas.style.pointerEvents = 'auto';

            if (this.onSqueezeStateChange) this.onSqueezeStateChange(false);
            gsap.fromTo(cardSprite.scale, {x: 1.1, y: 1.1}, {x: this.cardScale, y: this.cardScale, duration: 0.2});
        });
    }

    async revealAllRemaining() {
        if (!this.targetHands) return;
        if (!this.playerSprites[0] || this.playerSprites[0].length === 0) return;
        const gen = this._settleGeneration;
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
            if (this._settleGeneration !== gen) return;
            // 若莊家第5張已瞇牌揭露，跳過重複翻牌
            if (i === 4 && this.squeezedMap[-1]) continue;
            this.flipCard(this.bankerSprites[i], bankerCards[i]);
        }
        this._settleTimer2 = setTimeout(() => {
            if (this._settleGeneration === gen) this.settleAll();
        }, 600);
    }

    async settleAll() {
        if (!this.serverResult) return;
        const winners = this.serverResult.winners;
        const winnerKeys = ['tian', 'di', 'xuan', 'huang'];
        const winningZones = [];

        const SPECIAL = new Set(['FIVE_SMALL','BOMB','FULL_HOUSE','STRAIGHT_FLUSH','FIVE_KNIGHTS','SILVER_NIU','NIU_NIU']);

        const styleWin  = new TextStyle({ fontFamily: 'Arial', fontSize: 36, fontWeight: 'bold', fill: '#f1c40f', stroke: { color: '#000000', width: 5 } });
        const styleLose = new TextStyle({ fontFamily: 'Arial', fontSize: 36, fontWeight: 'bold', fill: '#bdc3c7', stroke: { color: '#000000', width: 5 } });

        const fmtLabel = (res) => res.label || (res.niu === 10 ? '牛牛' : (res.niu > 0 ? `牛${res.niu}` : '無牛'));

        // ── 莊家 ─────────────────────────────────────────────────
        const bRes = this.serverResult.results.banker;
        const bPos = this.getFanCardProps(-1, 2);
        if (!SPECIAL.has(bRes.type)) {
            // 普通牌型：文字顯示
            const bText = new Text({ text: fmtLabel(bRes), style: styleWin });
            bText.anchor.set(0.5);
            bText.x = bPos.x + 140;
            bText.y = bPos.y;
            this.uiLayer.addChild(bText);
        }

        // ── 閒家結果 + 勝負統計 ─────────────────────────────────
        for (let i = 0; i < 4; i++) {
            const key   = winnerKeys[i];
            const isWin = winners[key];
            if (isWin) winningZones.push(i);

            const pRes = this.serverResult.results[key];
            if (!SPECIAL.has(pRes.type)) {
                // 普通牌型：文字顯示
                const pPos = this.getFanCardProps(i, 2);
                const pText = new Text({ text: fmtLabel(pRes), style: isWin ? styleWin : styleLose });
                pText.anchor.set(0.5);
                pText.x = pPos.x;
                pText.y = pPos.y + 100;
                this.uiLayer.addChild(pText);
            }
        }

        if (winningZones.length > 0) this.coinRain.play();
        if (this.onWinZones) this.onWinZones(winningZones);

        // ── 特殊牌型：圖片特效定位至各門牌堆 ────────────────────
        let effectDelay = 0;
        if (SPECIAL.has(bRes.type)) {
            this.highHandEffect.play(bRes.type, bPos.x, bPos.y, effectDelay);
            effectDelay += 0.35;
        }
        winnerKeys.forEach((key, i) => {
            const pRes = this.serverResult.results[key];
            if (SPECIAL.has(pRes.type)) {
                const pPos = this.getFanCardProps(i, 2);
                this.highHandEffect.play(pRes.type, pPos.x, pPos.y, effectDelay);
                effectDelay += 0.35;
            }
        });

        // 走勢歷史
        winnerKeys.forEach((key) => {
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
        this._settleGeneration++;
        if (this.coinRain)       this.coinRain.stop();
        if (this.highHandEffect) this.highHandEffect.stop();
        if (this.app) {
            this.app.destroy(true, { children: true, texture: false, baseTexture: false });
            this.app = null;
            this.assetsLoaded = false;
        }
        this.targetHands = null;
        this.serverResult = null;
        this.coinRain = null;
        this.bankerSprites = [];
        this.playerSprites = [[], [], [], []];
        this.squeezedMap = {};
        this.isPlaying = false;
        this.iAmBanker = false;
        this.playerBetZones = new Set();
    }
}

export const gameApp = new GameApp();
