import { Container, Sprite, Texture, Mesh, PlaneGeometry } from 'pixi.js';
import { gameApp } from './app';
import gsap from 'gsap';

export class SqueezeController {
  constructor() {
    this.container = new Container();
    this.container.visible = false;
    this.container.zIndex = 100; // 確保在最上層

    // 背景遮罩 (黑色半透明)
    this.bg = new Sprite(Texture.WHITE);
    this.bg.tint = 0x000000;
    this.bg.alpha = 0.9;
    this.bg.interactive = true; // 阻擋下方點擊
    this.container.addChild(this.bg);

    this.cardFace = null;       // 底牌 (花色)
    this.cardBack = null;       // 牌背 (可變形網格)
    this.originalVertices = null; // 原始網格數據備份
    this.onCompleteCallback = null; // 搓牌完成後的通知對象
    
    this.isSqueezing = false;
    this.startPoint = { x: 0, y: 0 };
    this.cardHeight = 0;
    
    // 加入遊戲舞台
    gameApp.app.stage.addChild(this.container);
  }

  /**
   * 啟動搓牌
   * @param {string} textureName - 撲克牌花色圖片名稱
   * @param {Function} onComplete - 搓完後執行的函式
   */
  start(textureName, onComplete) {
    this.onCompleteCallback = onComplete;
    
    this.bg.width = gameApp.app.screen.width;
    this.bg.height = gameApp.app.screen.height;

    // 1. 建立底牌 (顯示花色)
    if (this.cardFace) this.cardFace.destroy();
    this.cardFace = Sprite.from(textureName);
    this.cardFace.anchor.set(0.5);
    this.cardFace.scale.set(1.5); 
    this.cardFace.x = gameApp.app.screen.width / 2;
    this.cardFace.y = gameApp.app.screen.height / 2;
    this.container.addChild(this.cardFace);

    // 2. 建立牌背 (Mesh 網格)
    if (this.cardBack) this.cardBack.destroy();
    const backTexture = Texture.from('card_back');
    this.cardHeight = backTexture.height;

    // 設定網格密度 20x20 (讓彎曲更圓滑)
    const geometry = new PlaneGeometry({
      width: backTexture.width, 
      height: backTexture.height,
      verticesX: 20, 
      verticesY: 20
    });

    this.cardBack = new Mesh({
      geometry: geometry,
      texture: backTexture
    });
    
    this.cardBack.pivot.set(backTexture.width/2, backTexture.height/2);
    this.cardBack.x = this.cardFace.x;
    this.cardBack.y = this.cardFace.y;
    this.cardBack.scale.set(1.5);

    // 3. 備份原始頂點數據 (重要：防止變形累積誤差)
    const positionAttribute = geometry.getAttribute('aPosition');
    this.originalVertices = Float32Array.from(positionAttribute.buffer.data);

    // 開啟互動
    this.cardBack.interactive = true;
    this.cardBack.cursor = 'grab';
    this.container.addChild(this.cardBack);

    // 綁定拖曳事件
    this.cardBack.on('pointerdown', this.onDragStart.bind(this));
    this.cardBack.on('pointermove', this.onDragMove.bind(this));
    this.cardBack.on('pointerup', this.onDragEnd.bind(this));
    this.cardBack.on('pointerupoutside', this.onDragEnd.bind(this));

    // 進場淡入動畫
    this.container.visible = true;
    this.container.alpha = 0;
    gsap.to(this.container, { alpha: 1, duration: 0.3 });
  }

  // 關閉並執行回呼
  close() {
    gsap.to(this.container, { 
      alpha: 0, 
      duration: 0.3, 
      onComplete: () => {
        this.container.visible = false;
        // 通知主程式：搓牌結束
        if (this.onCompleteCallback) {
            this.onCompleteCallback();
            this.onCompleteCallback = null;
        }
      }
    });
  }

  // --- 互動邏輯 ---

  onDragStart(event) {
    this.isSqueezing = true;
    this.startPoint = event.global.clone();
  }

  onDragMove(event) {
    if (!this.isSqueezing) return;

    const currentPoint = event.global;
    const dy = currentPoint.y - this.startPoint.y;
    
    // 【限制】最大只能拉牌身高度的 60%
    const maxDist = this.cardHeight * 0.6; 
    
    // 限制只能往上拉 (負值)，且不能超過 maxDist
    let moveY = Math.min(0, Math.max(dy, -maxDist));

    this.updateMesh(moveY);
  }

  // 更新網格形狀 (彎曲算法)
  updateMesh(moveY) {
    const geometry = this.cardBack.geometry;
    const positionBuffer = geometry.getAttribute('aPosition').buffer;
    const data = positionBuffer.data;
    const original = this.originalVertices;
    const height = this.cardHeight;
    
    for (let i = 0; i < data.length; i += 2) {
      const originalY = original[i + 1];
      const ratio = originalY / height; // 0(頂部) ~ 1(底部)
      
      // 只移動下半部 (0.3 以下不動)
      if (ratio > 0.3) { 
        const part = (ratio - 0.3) / 0.7;
        
        // 二次曲線 (讓邊緣彎曲更自然)
        const curve = Math.pow(part, 2); 
        const deform = moveY * curve; 
        
        data[i + 1] = originalY + deform; 
      }
    }
    positionBuffer.update();
  }

  onDragEnd(event) {
    this.isSqueezing = false;

    const currentPoint = event.global;
    const dy = currentPoint.y - this.startPoint.y;
    const threshold = this.cardHeight * 0.4; // 閾值：拉超過 40% 就算成功

    if (dy < -threshold) {
      // ✅ 成功開牌
      this.revealCard();
    } else {
      // ❌ 沒拉到位，彈回去
      this.resetCard();
    }
  }

  // 彈回重置動畫
  resetCard() {
    // 視覺上用彈性動畫縮放一下
    gsap.to(this.cardBack.scale, { 
        y: 1.5, duration: 0.3, ease: "elastic.out(1, 0.3)" 
    });
    
    // 將網格頂點歸位
    const geometry = this.cardBack.geometry;
    const positionBuffer = geometry.getAttribute('aPosition').buffer;
    const data = positionBuffer.data;
    const original = this.originalVertices;
    
    // 直接還原所有點的位置
    for (let i = 0; i < data.length; i++) {
        data[i] = original[i];
    }
    positionBuffer.update();
  }

  // 成功亮牌動畫
  revealCard() {
    // 牌背往上飛走並消失
    gsap.to(this.cardBack, {
        alpha: 0,
        y: this.cardBack.y - 150, 
        duration: 0.4,
        ease: "back.in(1.2)",
        onComplete: () => {
            // 稍作停留展示底牌，然後關閉
            gsap.delayedCall(0.5, () => {
                this.close();
            });
        }
    });
    
    // 底牌放大慶祝
    gsap.to(this.cardFace.scale, { 
        x: 1.8, y: 1.8, duration: 0.3, yoyo: true, repeat: 1 
    });
  }
}