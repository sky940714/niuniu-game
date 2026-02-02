import { Application, Assets, Sprite, Text, TextStyle, Container, Texture } from 'pixi.js';
import { SqueezeController } from './SqueezeController';
import { CoinRain } from './Effects';
import gsap from 'gsap';

class GameApp {
  constructor() {
    this.app = null;
    this.squeezeCtrl = null;
    this.cardContainer = new Container();
    
    this.resultTexts = []; 
    
    this.isPlaying = false;
    this.onBalanceChange = null; 
    this.onHistoryChange = null;
    this.onSqueezeStateChange = null; 
    this.onSqueezeTick = null; 
    this.onWinZones = null; 

    this.history = [];
    this.bankerSprites = []; 
    this.playerSprites = [[], [], [], []]; 
    
    this.cardScale = 0.8; 
    this.squeezedMap = {}; 

    // Store backend data
    this.targetHands = null;
    this.serverResult = null;
  }

  async init(containerElement) {
    if (this.app) return;
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

    this.app.stage.addChild(this.cardContainer);
    this.squeezeCtrl = new SqueezeController();
    this.coinRain = new CoinRain(this.app);

    await this.loadAssets();
    this.generateFakeHistory();
  }

  generateFakeHistory() {
      for(let i=0; i<10; i++) {
          const isPlayerWin = Math.random() > 0.5;
          this.history.push({
              winner: isPlayerWin ? 'player' : 'banker',
              type: isPlayerWin ? '牛' + Math.floor(Math.random()*9+1) : '牛' + Math.floor(Math.random()*9+1) 
          });
      }
  }

  async loadAssets() {
    const modules = import.meta.glob('/src/assets/cards/*.png', { eager: true, as: 'url' });
    const assetsToLoad = [];
    for (const path in modules) {
      const name = path.split('/').pop().replace('.png', '');
      assetsToLoad.push({ alias: name, src: modules[path] });
    }
    await Assets.load(assetsToLoad);
  }

  // Manual table reset (clears visual but keeps data for current round logic)
  resetTable() {
      this.cardContainer.removeChildren();
      this.bankerSprites = [];
      this.playerSprites = [[], [], [], []];
      this.resultTexts = []; 
      this.squeezedMap = {};
      // Note: do not clear this.targetHands here as it is needed for the round
  }

  // === Core: Receive backend data and start animation ===
  startRoundWithData(serverResult) {
      console.log("Pixi received server data:", serverResult);
      
      this.serverResult = serverResult;

      const suitMap = { 
          's': 'spades',   // Spades
          'h': 'hearts',   // Hearts
          'd': 'diamonds', // Diamonds
          'c': 'clubs'     // Clubs
      };

      const rankMap = { 
          1: 'A', 
          2: '02', 3: '03', 4: '04', 5: '05', 6: '06', 7: '07', 8: '08', 9: '09',
          10: '10', 
          11: 'J', 12: 'Q', 13: 'K' 
      };

      const formatCard = (c) => {
          const s = suitMap[c.suit];
          const r = rankMap[c.rank];
          return `card_${s}_${r}`; 
      };

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

    if (!this.targetHands) {
        console.error("No deal data received! Cannot start animation.");
        this.isPlaying = false;
        return;
    }

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

    const bets = {0:0, 1:0, 2:0, 3:0}; 

    await this.dealRound(bankerHand, playersHands, bResult, pResults, bets);
  }

  getFanCardProps(zoneIndex, cardIndex, totalCards = 5) {
      const w = this.app.screen.width;
      const h = this.app.screen.height;
      const gap = w * 0.95 / 4;
      const startOffset = (w - (w * 0.95)) / 2; 

      let centerX, centerY;
      
      if (zoneIndex === -1) { 
          centerX = (w / 2) + 10 + 40; 
          centerY = h * 0.22; 
      } else { 
          centerX = startOffset + (zoneIndex * gap) + (gap / 2);
          centerY = h * 0.62; 
      }

      const spreadAngle = 0.15; 
      const centerIndex = (totalCards - 1) / 2;
      const angle = (cardIndex - centerIndex) * spreadAngle;
      const xOffset = (cardIndex - centerIndex) * 20; 
      
      return {
          x: centerX + xOffset,
          y: centerY,
          rotation: angle
      };
  }

  async dealRound(bankerHand, playersHands, bResult, pResults, bets) {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const dealStartX = w / 2;
    const dealStartY = h + 100;
    const dealOrder = [-1, 0, 1, 2, 3];
    
    const { Texture } = await import('pixi.js');

    for (let round = 0; round < 5; round++) {
        for (let zoneIdx of dealOrder) {
            
            const card = Sprite.from('card_back');
            card.anchor.set(0.5, 1.5); 
            card.scale.set(this.cardScale);
            
            card.x = dealStartX; 
            card.y = dealStartY;
            card.rotation = 0;
            
            this.cardContainer.addChild(card);

            if (zoneIdx === -1) {
                this.bankerSprites.push(card);
            } else {
                this.playerSprites[zoneIdx].push(card);
            }

            const target = this.getFanCardProps(zoneIdx, round);
            const isFifthCard = (round === 4);
            const isBanker = (zoneIdx === -1);

            gsap.to(card, {
                x: target.x,
                y: target.y,
                rotation: target.rotation,
                duration: 0.5,
                delay: (round * 5 + (zoneIdx + 1)) * 0.1, 
                ease: "power2.out",
                onComplete: () => {
                    // Reveal first 4 cards
                    if (!isBanker && !isFifthCard) {
                        this.flipCard(card, playersHands[zoneIdx][round].texture);
                    } 
                    // Prepare 5th card for squeeze
                    else if (!isBanker && isFifthCard) {
                        card.eventMode = 'static';
                        card.cursor = 'pointer';
                        card.bgKey = playersHands[zoneIdx][round].texture; 
                        card.zoneId = zoneIdx;
                        
                        // 🔥 Enabled: Allow clicking to squeeze
                        card.on('pointerdown', () => {
                            this.handleSqueezeClick(card, playersHands[zoneIdx][round], bankerHand, bResult, pResults, bets);
                        });
                    }
                }
            });
        }
    }
  }

  async flipCard(sprite, textureName) {
      const { Texture } = await import('pixi.js');
      gsap.to(sprite.scale, { x: 0, duration: 0.15, onComplete: () => {
          sprite.texture = Texture.from(textureName);
          gsap.to(sprite.scale, { x: this.cardScale, duration: 0.15 });
      }});
  }

  async handleSqueezeClick(cardSprite, cardData, bankerHand, bResult, pResults, bets) {
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
          
          gsap.fromTo(cardSprite.scale, {x: 1.0, y: 1.0}, {x: this.cardScale, y: this.cardScale, duration: 0.3});
      });
  }

  // UI calls this to reveal any un-squeezed cards when time is up
  async revealAllRemaining() {
      if(!this.targetHands) return;

      const { Texture } = await import('pixi.js');
      
      for(let z=0; z<4; z++) {
          const card = this.playerSprites[z][4];
          const handKeys = ['tian', 'di', 'xuan', 'huang'];
          const textureName = this.targetHands[handKeys[z]][4];
          
          // Check if not already revealed (squeezed)
          // Simple check: compare texture name. If it's still 'card_back', flip it.
          // Note: 'card_back' is the alias for back texture.
          // Since we don't easily access texture alias property, let's rely on squeezedMap or visual check
          
          // Better check: use squeezedMap
          if (!this.squeezedMap[z]) { 
               this.flipCard(card, textureName);
          }
      }
      
      setTimeout(() => {
          this.openBankerAndSettle();
      }, 800);
  }

  async openBankerAndSettle() {
      const { Texture } = await import('pixi.js');
      const bankerCards = this.targetHands.banker;

      for(let i=0; i<5; i++) {
          await new Promise(r => setTimeout(r, 150)); 
          const card = this.bankerSprites[i];
          
          gsap.to(card.scale, {x:0, duration:0.1, onComplete:()=>{
               card.texture = Texture.from(bankerCards[i]);
               gsap.to(card.scale, {x: this.cardScale, duration:0.1});
          }});
      }

      setTimeout(() => {
          this.settleAll();
      }, 500);
  }

  async settleAll() {
    let winningZones = [];

    const formatNiuLabel = (res) => {
        if(res.type === 'NO_NIU') return '無牛';
        if(res.niu === 10) return '牛牛';
        return `牛${res.niu}`;
    };

    const bResult = { label: formatNiuLabel(this.serverResult.results.banker) };
    const pResults = [
        { label: formatNiuLabel(this.serverResult.results.tian) },
        { label: formatNiuLabel(this.serverResult.results.di) },
        { label: formatNiuLabel(this.serverResult.results.xuan) },
        { label: formatNiuLabel(this.serverResult.results.huang) }
    ];

    const winners = this.serverResult.winners; 
    const winnerKeys = ['tian', 'di', 'xuan', 'huang'];

    const styleWin = new TextStyle({
        fontFamily: 'Arial', fontSize: 36, fontWeight: 'bold', fill: '#f1c40f',
        stroke: { color: '#000000', width: 4 }, dropShadow: true
    });
    const styleLose = new TextStyle({
        fontFamily: 'Arial', fontSize: 36, fontWeight: 'bold', fill: '#ccc',
        stroke: { color: '#000000', width: 4 }
    });

    // Show Banker Result
    const bankerText = new Text({ text: bResult.label, style: styleWin });
    bankerText.anchor.set(0, 0.5); 
    const bankerProps = this.getFanCardProps(-1, 4);
    bankerText.x = bankerProps.x + 60; 
    bankerText.y = bankerProps.y - 32; 
    this.cardContainer.addChild(bankerText);
    this.resultTexts.push(bankerText);

    // Show Player Results
    for(let i=0; i<4; i++) {
        const centerProps = this.getFanCardProps(i, 2); 
        const isWin = winners[winnerKeys[i]]; 
        
        if (isWin) {
            winningZones.push(i);
        }

        const typeText = new Text({ text: pResults[i].label, style: isWin ? styleWin : styleLose });
        typeText.anchor.set(0.5);
        typeText.scale.set(0.8); 
        typeText.x = centerProps.x;
        typeText.y = centerProps.y + 10;  

        this.cardContainer.addChild(typeText);
        this.resultTexts.push(typeText);
    }

    // Win Effect
    if (winningZones.length > 0) {
        this.coinRain.play();
    }

    if (this.onWinZones) {
        this.onWinZones(winningZones);
    }

    const firstWin = winners.tian;
    this.history.push({ winner: firstWin ? 'player' : 'banker', type: pResults[0].label.substring(0,2) });
    if(this.onHistoryChange) this.onHistoryChange([...this.history]);

    this.isPlaying = false;
  }

  destroy() {
    if (this.app) this.app.destroy(true, { children: true });
  }
}

export const gameApp = new GameApp();