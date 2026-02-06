import { Container, Sprite, Texture, Mesh, PlaneGeometry } from 'pixi.js';
import gsap from 'gsap';

export class SqueezeController {
  constructor(app) {
    this.app = app; // 從 app.js 傳入 app 實例
    this.container = new Container();
    this.container.visible = false;
    // 預設不接收事件，避免隱藏時擋住下方物件
    this.container.eventMode = 'none'; 
    this.container.zIndex = 2000; // 提高層級

    // 背景遮罩
    this.bg = new Sprite(Texture.WHITE);
    this.bg.tint = 0x000000;
    this.bg.alpha = 0.8;
    this.bg.eventMode = 'static'; // 讓背景可以攔截點擊，避免點穿
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
    
    // 開啟容器互動，確保能拖曳
    this.container.visible = true;
    this.container.eventMode = 'auto'; 

    // 更新背景尺寸
    this.bg.width = this.app.screen.width;
    this.bg.height = this.app.screen.height;

    // 1. 建立底牌 (正面)
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

    // Pixi v8 PlaneGeometry
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
    this.cardBack.scale.set(1.5); // 設定縮放

    // 3. 獲取頂點數據
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

    // 進場動畫
    this.container.alpha = 0;
    gsap.to(this.container, { alpha: 1, duration: 0.3 });
  }

  onDragStart(event) {
    this.isSqueezing = true;
    // 使用 global 確保座標準確
    this.startPoint = { x: event.global.x, y: event.global.y };
    this.cardBack.cursor = 'grabbing';
  }

  onDragMove(event) {
    if (!this.isSqueezing) return;

    const currentPoint = event.global;
    const dy = currentPoint.y - this.startPoint.y;
    
    // 計算最大拉動距離 (需考慮縮放後的視覺高度)
    const visualHeight = this.cardHeight * 1.5; 
    const maxDist = visualHeight * 0.8; 
    
    // 限制移動範圍 (向上拉是負值)
    let moveY = Math.max(dy, -maxDist); 

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
    
    // 關鍵修正：將螢幕移動距離 (Global Pixel) 轉回 Local 座標
    // 因為 Mesh 被放大了 1.5 倍，所以 local 移動量要除以 1.5，否則動畫會太快
    const localMoveY = moveY / this.cardBack.scale.y; 

    for (let i = 0; i < data.length; i += 2) {
      const originalY = original[i + 1];
      // Y 座標歸一化 (從中心點轉為 0~1)
      const ratio = (originalY + height / 2) / height; 
      
      // 從底部向上搓 (ratio 接近 1 的部分移動)
      if (ratio > 0.1) { 
        const weight = Math.pow(ratio, 3); // 越靠底部權重越大
        data[i + 1] = originalY + (localMoveY * weight);
      }
    }
    // 標記緩衝區需要更新
    positionAttribute.buffer.update();
  }

  onDragEnd(event) {
    if (!this.isSqueezing) return;
    this.isSqueezing = false;
    this.cardBack.cursor = 'grab';

    const dy = event.global.y - this.startPoint.y;
    // 判定是否開牌：拉動距離超過視覺高度的 30%
    const threshold = -(this.cardHeight * 1.5) * 0.3; 

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
    // 牌背向上飛出並消失
    gsap.to(this.cardBack, {
      alpha: 0,
      y: this.cardBack.y - 200, 
      duration: 0.5,
      ease: "power2.in",
      onComplete: () => {
        // 延遲後關閉咪牌界面
        gsap.delayedCall(0.5, () => this.close());
      }
    });
    
    // 底牌放大效果
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
        // 關閉互動，防止透明層擋住遊戲
        this.container.eventMode = 'none'; 
        
        if (this.onCompleteCallback) this.onCompleteCallback();
      }
    });
  }
}