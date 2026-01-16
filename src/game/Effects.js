import { Container, Graphics, Ticker } from 'pixi.js';
import gsap from 'gsap';

export class CoinRain {
  constructor(app) {
    this.app = app;
    this.container = new Container();
    this.container.zIndex = 200; // 確保在文字更上層
    this.container.pointerEvents = 'none'; // 讓滑鼠可以穿透金幣點擊按鈕
    this.app.stage.addChild(this.container);
    this.coins = [];
    this.isActive = false;
  }

  // 發射金幣！
  play() {
    if (this.isActive) return;
    this.isActive = true;
    this.container.visible = true;

    // 一次產生 100 枚金幣
    for (let i = 0; i < 100; i++) {
      this.createCoin(i * 0.05); // 錯開時間產生
    }

    // 5秒後自動停止清理
    gsap.delayedCall(5, () => {
      this.stop();
    });
  }

  createCoin(delay) {
    // 1. 畫金幣 (外圈深金，內圈亮金)
    const coin = new Graphics();
    coin.circle(0, 0, 15 + Math.random() * 10); // 大小隨機
    coin.fill({ color: 0xFFD700 }); // 金色
    coin.stroke({ color: 0xB8860B, width: 2 }); // 暗金邊框
    
    // 2. 設定初始位置 (從螢幕上方隨機落下)
    coin.x = Math.random() * this.app.screen.width;
    coin.y = -50;
    coin.alpha = 0; // 一開始透明

    // 3. 加入容器
    this.container.addChild(coin);
    this.coins.push(coin);

    // 4. 動畫：落下 + 旋轉 + 彈跳
    const duration = 1.5 + Math.random(); // 隨機落下時間
    const targetY = this.app.screen.height + 100; // 落下目標

    // A. 落下動畫
    gsap.to(coin, {
      y: targetY,
      duration: duration,
      ease: "power1.in", // 重力加速感
      delay: delay,
      onStart: () => { coin.alpha = 1; } // 開始掉落時才顯示
    });

    // B. 水平飄動 (模擬空氣阻力)
    gsap.to(coin, {
      x: coin.x + (Math.random() - 0.5) * 200,
      duration: duration,
      delay: delay,
      ease: "sine.inOut"
    });

    // C. 3D 旋轉效果 (縮放 Y 軸)
    gsap.to(coin.scale, {
      x: Math.random() > 0.5 ? 1 : -1, // 隨機翻轉方向
      y: 0.1, // 壓扁
      duration: 0.2 + Math.random() * 0.3,
      repeat: -1,
      yoyo: true, // 來回播放
      delay: delay
    });
  }

  stop() {
    this.isActive = false;
    // 清除所有金幣
    this.container.removeChildren();
    this.coins = [];
    this.container.visible = false;
  }
}