import { Container, Sprite, Texture, Mesh, PlaneGeometry } from 'pixi.js';
import gsap from 'gsap';

export class SqueezeController {
  constructor(app) {
    this.app = app; // 從 app.js 傳入 app 實例
    this.container = new Container();
    this.container.visible = false;
    this.container.zIndex = 2000; // 提高層級

    // 背景遮罩
    this.bg = new Sprite(Texture.WHITE);
    this.bg.tint = 0x000000;
    this.bg.alpha = 0.8;
    this.bg.eventMode = 'static'; // Pixi v8 使用 eventMode 代替 interactive
    this.container.addChild(this.bg);

    this.cardFace = null;
    this.cardBack = null;
    this.originalVertices = null;
    this.onCompleteCallback = null;
    
    this.isSqueezing = false;
    this.startPoint = { x: 0, y: 0 };
    this.cardHeight = 0;
    
    // 將自己加入舞台
    this.app.stage.addChild(this.container);
  }

  start(textureName, onComplete) {
    this.onCompleteCallback = onComplete;
    
    // 更新背景尺寸
    this.bg.width = this.app.screen.width;
    this.bg.height = this.app.screen.height;

    // 1. 建立底牌
    if (this.cardFace) this.cardFace.destroy();
    this.cardFace = Sprite.from(textureName);
    this.cardFace.anchor.set(0.5);
    this.cardFace.scale.set(1.5); 
    this.cardFace.x = this.app.screen.width / 2;
    this.cardFace.y = this.app.screen.height / 2;
    this.container.addChild(this.cardFace);

    // 2. 建立牌背 Mesh
    if (this.cardBack) this.cardBack.destroy();
    const backTexture = Texture.from('card_back');
    this.cardHeight = backTexture.height;

    // Pixi v8 的 PlaneGeometry 參數結構修正
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
    
    this.cardBack.pivot.set(backTexture.width / 2, backTexture.height / 2);
    this.cardBack.x = this.cardFace.x;
    this.cardBack.y = this.cardFace.y;
    this.cardBack.scale.set(1.5);

    // 3. 獲取頂點數據 (Pixi v8 修正)
    // 注意：v8 中存取 attribute 的方式
    const positionAttribute = geometry.getAttribute('aPosition');
    this.originalVertices = new Float32Array(positionAttribute.buffer.data);

    // 開啟互動
    this.cardBack.eventMode = 'static';
    this.cardBack.cursor = 'grab';
    this.container.addChild(this.cardBack);

    // 綁定事件
    this.cardBack.on('pointerdown', this.onDragStart.bind(this));
    this.cardBack.on('pointermove', this.onDragMove.bind(this));
    this.cardBack.on('pointerup', this.onDragEnd.bind(this));
    this.cardBack.on('pointerupoutside', this.onDragEnd.bind(this));

    // 進場
    this.container.visible = true;
    this.container.alpha = 0;
    gsap.to(this.container, { alpha: 1, duration: 0.3 });
  }

  onDragStart(event) {
    this.isSqueezing = true;
    // 使用 event.client 確保在不同縮放下的座標正確
    this.startPoint = { x: event.global.x, y: event.global.y };
    this.cardBack.cursor = 'grabbing';
  }

  onDragMove(event) {
    if (!this.isSqueezing) return;

    const currentPoint = event.global;
    const dy = currentPoint.y - this.startPoint.y;
    
    // 最大向上拉動距離
    const maxDist = this.cardHeight * 0.8; 
    let moveY = Math.max(dy, -maxDist); // 向上拉是負值

    // 只有當真的往上拉時才更新網格
    if (moveY < 0) {
      this.updateMesh(moveY);
    }
  }

  updateMesh(moveY) {
    const geometry = this.cardBack.geometry;
    const positionAttribute = geometry.getAttribute('aPosition');
    const data = positionAttribute.buffer.data;
    const original = this.originalVertices;
    const height = this.cardHeight;
    
    for (let i = 0; i < data.length; i += 2) {
      const originalY = original[i + 1];
      // Y 座標歸一化 (從中心點轉為 0~1)
      const ratio = (originalY + height / 2) / height; 
      
      // 從底部向上搓 (ratio 接近 1 的部分移動)
      if (ratio > 0.1) { 
        const weight = Math.pow(ratio, 3); // 越靠底部權重越大
        data[i + 1] = originalY + (moveY * weight);
      }
    }
    // 關鍵：標記緩衝區需要更新，否則畫面不會動
    positionAttribute.buffer.update();
  }

  onDragEnd(event) {
    if (!this.isSqueezing) return;
    this.isSqueezing = false;
    this.cardBack.cursor = 'grab';

    const dy = event.global.y - this.startPoint.y;
    const threshold = -this.cardHeight * 0.3; // 向上拉超過 30% 就開牌

    if (dy < threshold) {
      this.revealCard();
    } else {
      this.resetCard();
    }
  }

  resetCard() {
    const geometry = this.cardBack.geometry;
    const positionAttribute = geometry.getAttribute('aPosition');
    const data = positionAttribute.buffer.data;
    const original = this.originalVertices;

    // 建立一個 proxy 物件給 GSAP 做數值動畫
    const obj = { val: 1 }; 
    gsap.to(obj, {
      val: 0,
      duration: 0.4,
      ease: "elastic.out(1, 0.5)",
      onUpdate: () => {
        for (let i = 0; i < data.length; i++) {
          // 根據動畫進度插值回到原始位置
          data[i] = data[i] + (original[i] - data[i]) * (1 - obj.val);
        }
        positionAttribute.buffer.update();
      }
    });
  }

  revealCard() {
    gsap.to(this.cardBack, {
      alpha: 0,
      y: this.cardBack.y - 200, 
      duration: 0.5,
      ease: "power2.in",
      onComplete: () => {
        gsap.delayedCall(0.8, () => this.close());
      }
    });
    
    gsap.to(this.cardFace.scale, { 
      x: 1.8, y: 1.8, duration: 0.3, yoyo: true, repeat: 1 
    });
  }

  close() {
    gsap.to(this.container, { 
      alpha: 0, 
      duration: 0.3, 
      onComplete: () => {
        this.container.visible = false;
        if (this.onCompleteCallback) this.onCompleteCallback();
      }
    });
  }
}