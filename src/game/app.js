import { Application, Assets, Sprite, Text, TextStyle, Container, Texture } from 'pixi.js';
import { SqueezeController } from './SqueezeController';
import { calculateNiu, compareHands } from './logic'; 
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

  // 🔥 新增：手動清空桌面的方法
  resetTable() {
      this.cardContainer.removeChildren();
      this.bankerSprites = [];
      this.playerSprites = [[], [], [], []];
      this.resultTexts = []; 
      this.squeezedMap = {};
  }

  async startGame(bets = {0:0, 1:0, 2:0, 3:0}) {
    if (this.isPlaying) return;
    this.isPlaying = true;
    
    // 確保開始前再清一次，雙重保險
    this.resetTable();

    const suits = ['spades', 'hearts', 'clubs', 'diamonds'];
    const ranks = ['02', '03', '04', '05', '06', '07', '08', '09', '10', 'J', 'Q', 'K', 'A'];
    let deck = [];
    
    while(deck.length < 25) {
        const s = suits[Math.floor(Math.random() * suits.length)];
        const r = ranks[Math.floor(Math.random() * ranks.length)];
        const key = `${s}_${r}`;
        if (!deck.find(c => c.key === key)) {
            deck.push({ suit: s, rank: r, texture: `card_${s}_${r}`, key });
        }
    }

    const bankerHand = deck.slice(0, 5);
    const playersHands = [
        deck.slice(5, 10),  
        deck.slice(10, 15), 
        deck.slice(15, 20), 
        deck.slice(20, 25)  
    ];

    const bResult = calculateNiu(bankerHand);
    const pResults = playersHands.map(h => calculateNiu(h));

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
                    if (!isBanker && !isFifthCard) {
                        this.flipCard(card, playersHands[zoneIdx][round].texture);
                    } else if (!isBanker && isFifthCard) {
                        card.eventMode = 'static';
                        card.cursor = 'pointer';
                        card.bgKey = playersHands[zoneIdx][round].texture; 
                        card.zoneId = zoneIdx;
                        
                        card.on('pointerdown', () => {
                            this.handleSqueezeClick(card, playersHands[zoneIdx][round], bankerHand, bResult, pResults, bets);
                        });
                    }
                }
            });
        }
    }

    setTimeout(() => {
        this.startSqueezeTimer(10, playersHands, bankerHand, bResult, pResults, bets);
    }, (25 * 0.1 + 0.5) * 1000); 
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
          
          this.checkAllSqueezed(bankerHand, bResult, pResults, bets);
      });
  }

  startSqueezeTimer(seconds, playersHands, bankerHand, bResult, pResults, bets) {
      let timeLeft = seconds;
      
      if (this.onSqueezeStateChange) this.onSqueezeStateChange(true, timeLeft);

      this.squeezeTimer = setInterval(() => {
          timeLeft--;
          if (this.onSqueezeTick) this.onSqueezeTick(timeLeft);

          const allSqueezed = [0,1,2,3].every(z => this.squeezedMap[z]);
          
          if (timeLeft <= 0 || allSqueezed) {
              clearInterval(this.squeezeTimer);
              if (this.onSqueezeStateChange) this.onSqueezeStateChange(false);
              this.revealAllRemaining(playersHands, bankerHand, bResult, pResults, bets);
          }
      }, 1000);
  }

  checkAllSqueezed(bankerHand, bResult, pResults, bets) {
      const allSqueezed = [0,1,2,3].every(z => this.squeezedMap[z]);
      if (allSqueezed) {
          if (this.squeezeTimer) clearInterval(this.squeezeTimer);
          if (this.onSqueezeStateChange) this.onSqueezeStateChange(false);
          setTimeout(() => {
               this.openBankerAndSettle(bankerHand, bResult, pResults, bets);
          }, 500);
      }
  }

  async revealAllRemaining(playersHands, bankerHand, bResult, pResults, bets) {
      const { Texture } = await import('pixi.js');
      
      for(let z=0; z<4; z++) {
          if (!this.squeezedMap[z]) {
              const card = this.playerSprites[z][4];
              const texture = playersHands[z][4].texture;
              card.eventMode = 'none'; 
              this.flipCard(card, texture);
          }
      }
      
      setTimeout(() => {
          this.openBankerAndSettle(bankerHand, bResult, pResults, bets);
      }, 800);
  }

  async openBankerAndSettle(bankerHand, bResult, pResults, bets) {
      const { Texture } = await import('pixi.js');
      for(let i=0; i<5; i++) {
          await new Promise(r => setTimeout(r, 150)); 
          const card = this.bankerSprites[i];
          
          gsap.to(card.scale, {x:0, duration:0.1, onComplete:()=>{
               card.texture = Texture.from(bankerHand[i].texture);
               gsap.to(card.scale, {x: this.cardScale, duration:0.1});
          }});
      }

      setTimeout(() => {
          this.settleAll(bResult, pResults, bets);
      }, 500);
  }

  async settleAll(bResult, pResults, bets) {
    let totalPayout = 0;
    let totalNetProfit = 0; 
    let winningZones = [];

    const styleWin = new TextStyle({
        fontFamily: 'Arial', fontSize: 36, fontWeight: 'bold', fill: '#f1c40f',
        stroke: { color: '#000000', width: 4 }, dropShadow: true
    });
    const styleLose = new TextStyle({
        fontFamily: 'Arial', fontSize: 36, fontWeight: 'bold', fill: '#ccc',
        stroke: { color: '#000000', width: 4 }
    });

    const bankerText = new Text({ text: bResult.label, style: styleWin });
    bankerText.anchor.set(0, 0.5); 
    
    const bankerProps = this.getFanCardProps(-1, 4);
    bankerText.x = bankerProps.x + 60; 
    bankerText.y = bankerProps.y - 32; 
    
    this.cardContainer.addChild(bankerText);
    this.resultTexts.push(bankerText);

    for(let i=0; i<4; i++) {
        const centerProps = this.getFanCardProps(i, 2); 
        
        const winMultiplier = compareHands(pResults[i], bResult);
        const betAmount = bets[i] || 0;
        const netWinAmount = winMultiplier * betAmount; 
        const payout = betAmount + netWinAmount;

        totalPayout += payout;
        totalNetProfit += netWinAmount;

        const isWin = winMultiplier > 0;
        if (isWin) {
            winningZones.push(i);
        }

        const resultStr = isWin ? `+${netWinAmount}` : `${netWinAmount}`; 
        
        const typeText = new Text({ text: pResults[i].label, style: isWin ? styleWin : styleLose });
        typeText.anchor.set(0.5);
        typeText.scale.set(0.8); 
        typeText.x = centerProps.x;
        typeText.y = centerProps.y + 10;  

        if (betAmount > 0) {
            const moneyText = new Text({ text: resultStr, style: isWin ? styleWin : styleLose });
            moneyText.anchor.set(0.5);
            moneyText.scale.set(0.7);
            moneyText.x = centerProps.x;
            moneyText.y = centerProps.y + 40; 
            this.cardContainer.addChild(moneyText);
            this.resultTexts.push(moneyText);
        }
        
        this.cardContainer.addChild(typeText);
        this.resultTexts.push(typeText);
    }

    if (totalNetProfit > 0) {
        this.coinRain.play();
    }

    if (this.onBalanceChange) {
        this.onBalanceChange(totalPayout);
    }
    
    if (this.onWinZones) {
        this.onWinZones(winningZones);
    }

    const firstWin = compareHands(pResults[0], bResult) > 0;
    this.history.push({ winner: firstWin ? 'player' : 'banker', type: pResults[0].label.substring(0,2) });
    if(this.onHistoryChange) this.onHistoryChange([...this.history]);

    this.isPlaying = false;
  }

  destroy() {
    if (this.app) this.app.destroy(true, { children: true });
  }
}

export const gameApp = new GameApp();