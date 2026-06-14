import { Container, Sprite, Texture, Graphics, Text, TextStyle } from 'pixi.js';

// ── 常數 ──────────────────────────────────────────────────────────
const SPRING_K     = 0.13;   // 彈力係數
const SPRING_DAMP  = 0.70;   // 阻尼（0~1，越小越彈）
const REVEAL_RATIO = 0.75;   // 放手揭牌門檻（佔可視牌高）
const FLICK_VEL    = -1.2;   // 快速上撥速度閾值（px/ms）
const FADE_HEIGHT  = 0.90;   // 拖到此比例時卡背完全消失（alpha=0）
const REVEAL_ACCEL = -1.1;   // 揭牌後卡背向上加速度（px/frame^2）

export class SqueezeController {
    constructor(app) {
        this.app = app;

        this.container = new Container();
        this.container.visible    = false;
        this.container.eventMode = 'none';
        this.container.zIndex     = 2000;
        this.container.sortableChildren = true;
        this.app.stage.addChild(this.container);

        // 背景遮罩 (z0)
        this.bg = new Sprite(Texture.WHITE);
        this.bg.tint      = 0x000000;
        this.bg.alpha     = 0.82;
        this.bg.eventMode = 'static';
        this.bg.zIndex    = 0;
        this.container.addChild(this.bg);

        // 黃金邊框 (z3)
        this.glowBorder = new Graphics();
        this.glowBorder.zIndex = 3;
        this.container.addChild(this.glowBorder);

        // 提示文字 (z4)
        this.hintText = new Text({
            text: '↑  上滑揭牌',
            style: new TextStyle({
                fontFamily: 'Arial',
                fontSize: 22,
                fontWeight: 'bold',
                fill: '#FFD700',
                stroke: { color: '#000000', width: 3 },
            })
        });
        this.hintText.anchor.set(0.5);
        this.hintText.zIndex = 4;
        this.container.addChild(this.hintText);

        // 每局重建
        this.cardFace           = null;  // 牌面 (z1，固定不動)
        this.cardBack           = null;  // 卡背 Sprite (z2，向上滑動消失)
        this.onCompleteCallback = null;
        this._cx = 0;
        this._cy = 0;
        this._cardVisualH = 0; // 牌的可視高度（含 scale）

        // 狀態機: 'enter'|'idle'|'drag'|'spring'|'reveal'|'pop'|'wait'|'fadeout'
        this._state = 'idle';

        // 卡背當前偏移量（相對於 _cy，負 = 向上）
        this._offsetY    = 0;
        this._springVelY = 0;

        // 拖曳輸入
        this._isDragging  = false;
        this.startPoint   = { x: 0, y: 0 };
        this._rawDragY    = 0;
        this._lastPtrY    = 0;
        this._lastPtrTime = 0;
        this._velocityY   = 0;

        // 揭牌飛出速度
        this._revealVelY = 0;

        // 牌面 pop 縮放
        this._popPhase = 0;

        // 淡入淡出
        this._containerAlpha = 0;
        this._waitMs         = 0;

        // 邊框 / 提示脈動
        this._glowAlpha = 1;
        this._glowDir   = -1;
        this._hintBaseY = 0;
        this._hintPhase = 0;

        this._tickerFn = null;
    }

    // ═══════════════════════════════════════════════════════════════
    //  PUBLIC: start
    // ═══════════════════════════════════════════════════════════════

    start(textureName, onComplete) {
        this.onCompleteCallback = onComplete;
        this.container.visible    = true;
        this.container.eventMode = 'auto';

        const W  = this.app.screen.width;
        const H  = this.app.screen.height;
        this._cx = W / 2;
        this._cy = H / 2;

        this.bg.width  = W;
        this.bg.height = H;

        // ── 牌面 Sprite (z1，固定在中央) ──
        if (this.cardFace) { this.cardFace.destroy(); this.cardFace = null; }
        this.cardFace = Sprite.from(textureName);
        this.cardFace.anchor.set(0.5);
        this.cardFace.scale.set(1.5);
        this.cardFace.x      = this._cx;
        this.cardFace.y      = this._cy;
        this.cardFace.zIndex = 1;
        this.container.addChild(this.cardFace);

        // ── 卡背 Sprite (z2，蓋在牌面上，隨手指上滑消失) ──
        if (this.cardBack) { this.cardBack.destroy(); this.cardBack = null; }
        const backTex = Texture.from('card_back');
        this.cardBack = Sprite.from('card_back');
        this.cardBack.anchor.set(0.5);
        this.cardBack.scale.set(1.5);
        this.cardBack.x       = this._cx;
        this.cardBack.y       = this._cy;
        this.cardBack.alpha   = 1;
        this.cardBack.zIndex  = 2;
        this.cardBack.visible = true;
        this.cardBack.eventMode = 'static';
        this.cardBack.cursor    = 'grab';
        this.container.addChild(this.cardBack);

        this._cardVisualH = backTex.height * 1.5;

        // ── 邊框 & 提示 ──
        const cardW = backTex.width  * 1.5;
        const cardH = this._cardVisualH;
        this._drawBorder(this._cx, this._cy, cardW, cardH, 0xFFD700);
        this._hintBaseY    = this._cy + cardH / 2 + 36;
        this.hintText.x    = this._cx;
        this.hintText.y    = this._hintBaseY;
        this.hintText.alpha   = 0;
        this.glowBorder.alpha = 0;
        this.container.alpha  = 0;

        // ── 重置狀態 ──
        this._state            = 'enter';
        this._containerAlpha   = 0;
        this._offsetY          = 0;
        this._springVelY       = 0;
        this._rawDragY         = 0;
        this._isDragging       = false;
        this._velocityY        = 0;
        this._glowAlpha        = 0;
        this._glowDir          = 1;
        this._hintPhase        = 0;

        // ── 指標事件 ──
        this.cardBack.on('pointerdown',      this._onDown.bind(this));
        this.cardBack.on('pointermove',      this._onMove.bind(this));
        this.cardBack.on('pointerup',        this._onUp.bind(this));
        this.cardBack.on('pointerupoutside', this._onUp.bind(this));

        this._startTicker();
    }

    // ═══════════════════════════════════════════════════════════════
    //  TICKER
    // ═══════════════════════════════════════════════════════════════

    _startTicker() {
        this._stopTicker();
        this._tickerFn = (ticker) => this._tick(ticker.deltaMS);
        this.app.ticker.add(this._tickerFn);
    }

    _stopTicker() {
        if (this._tickerFn) {
            this.app.ticker.remove(this._tickerFn);
            this._tickerFn = null;
        }
    }

    _tick(dt) {
        const f = dt / 16.667; // 1.0 = 60fps 單幀

        switch (this._state) {

            // ── 進場淡入 ──────────────────────────────────────────
            case 'enter':
                this._containerAlpha = Math.min(1, this._containerAlpha + f * 0.09);
                this.container.alpha  = this._containerAlpha;
                this.glowBorder.alpha = this._containerAlpha;
                this.hintText.alpha   = this._containerAlpha;
                if (this._containerAlpha >= 1) {
                    this._state     = 'idle';
                    this._glowAlpha = 1;
                    this._glowDir   = -1;
                }
                break;

            // ── 靜止（邊框 + 提示脈動）────────────────────────────
            case 'idle':
                this._tickPulse(f);
                break;

            // ── 跟手：卡背跟著手指往上移，同步 alpha 淡出 ──────────
            case 'drag':
                this._offsetY = this._rawDragY; // 直接更新，無延遲
                this._syncCardBack();
                break;

            // ── 彈回：卡背回到原位，alpha 還原 ─────────────────────
            case 'spring':
                this._springVelY += (-SPRING_K * this._offsetY) * f;
                this._springVelY *= Math.pow(SPRING_DAMP, f);
                this._offsetY    += this._springVelY * f;
                this._syncCardBack();
                this._tickPulse(f);

                if (Math.abs(this._offsetY) < 0.5 && Math.abs(this._springVelY) < 0.1) {
                    this._offsetY    = 0;
                    this._springVelY = 0;
                    this._syncCardBack();
                    this._state = 'idle';
                    this._redrawBorder(0xFFD700);
                }
                break;

            // ── 揭牌：卡背繼續向上飛出 ─────────────────────────────
            case 'reveal':
                this._revealVelY += REVEAL_ACCEL * f;
                this._offsetY    += this._revealVelY * f;
                // 快速淡出（不依賴 _syncCardBack 的 alpha 計算）
                this.cardBack.alpha = Math.max(0, this.cardBack.alpha - 0.07 * f);
                this.cardBack.y     = this._cy + this._offsetY;
                if (this.cardBack.alpha <= 0) {
                    this.cardBack.visible = false;
                    this._state    = 'pop';
                    this._popPhase = 0;
                }
                break;

            // ── 牌面放大 pop ────────────────────────────────────────
            case 'pop':
                this._popPhase = Math.min(1, this._popPhase + f * 0.05);
                if (this.cardFace) {
                    const s = Math.sin(this._popPhase * Math.PI);
                    this.cardFace.scale.set(1.5 + s * 0.42);
                }
                if (this._popPhase >= 1) {
                    if (this.cardFace) this.cardFace.scale.set(1.5);
                    this._state  = 'wait';
                    this._waitMs = 300;
                }
                break;

            // ── 等待 → 淡出 ────────────────────────────────────────
            case 'wait':
                this._waitMs -= dt;
                if (this._waitMs <= 0) {
                    this._state          = 'fadeout';
                    this._containerAlpha = 1;
                }
                break;

            // ── 整體淡出 ────────────────────────────────────────────
            case 'fadeout':
                this._containerAlpha = Math.max(0, this._containerAlpha - f * 0.06);
                this.container.alpha = this._containerAlpha;
                if (this._containerAlpha <= 0) {
                    this._stopTicker();
                    this.container.visible    = false;
                    this.container.eventMode = 'none';
                    if (this.onCompleteCallback) this.onCompleteCallback();
                }
                break;
        }
    }

    // 邊框脈動 + 提示浮動（idle / spring 時呼叫）
    _tickPulse(f) {
        this._glowAlpha += this._glowDir * 0.016 * f;
        if (this._glowAlpha >= 1.0) { this._glowAlpha = 1.0; this._glowDir = -1; }
        if (this._glowAlpha <= 0.3) { this._glowAlpha = 0.3; this._glowDir =  1; }
        this.glowBorder.alpha = this._glowAlpha;

        this._hintPhase += 0.038 * f;
        const s = Math.sin(this._hintPhase);
        this.hintText.y     = this._hintBaseY - s * 7;
        this.hintText.alpha = 0.55 + s * 0.45;
    }

    // 依 _offsetY 同步卡背位置（alpha 保持 1，不透明）
    _syncCardBack() {
        if (!this.cardBack) return;
        this.cardBack.y     = this._cy + this._offsetY;
        this.cardBack.alpha = 1;
    }

    // ═══════════════════════════════════════════════════════════════
    //  POINTER EVENTS
    // ═══════════════════════════════════════════════════════════════

    _onDown(event) {
        this._isDragging  = true;
        this.startPoint   = { x: event.global.x, y: event.global.y };
        this._lastPtrY    = event.global.y;
        this._lastPtrTime = Date.now();
        this._velocityY   = 0;
        this._rawDragY    = 0;
        this._state       = 'drag';
        this.cardBack.cursor  = 'grabbing';
        this.hintText.alpha   = 0;
        this.glowBorder.alpha = 0.3;
    }

    _onMove(event) {
        if (!this._isDragging) return;

        const now = Date.now();
        const dt  = Math.max(now - this._lastPtrTime, 8);
        this._velocityY   = (event.global.y - this._lastPtrY) / dt;
        this._lastPtrY    = event.global.y;
        this._lastPtrTime = now;

        const dy      = event.global.y - this.startPoint.y;
        const maxDrag = this._cardVisualH * 0.95;
        // 只允許向上滑（負值）；向下滑視為 0
        this._rawDragY = Math.min(0, Math.max(dy, -maxDrag));

        // 邊框顏色：達到揭牌門檻變白
        const progress = Math.min(1, Math.abs(this._rawDragY) / (this._cardVisualH * REVEAL_RATIO));
        this._redrawBorder(progress >= 1 ? 0xFFFFFF : 0xFFD700);
    }

    _onUp(event) {
        if (!this._isDragging) return;
        this._isDragging     = false;
        this.cardBack.cursor = 'grab';

        const dy = event.global.y - this.startPoint.y;

        if (dy < -(this._cardVisualH * REVEAL_RATIO) || this._velocityY < FLICK_VEL) {
            this._triggerReveal();
        } else {
            // 回彈，繼承手勢速度
            this._springVelY = this._velocityY * 8;
            this._state      = 'spring';
            this.hintText.alpha = 1;
            this._hintPhase     = 0;
            this._redrawBorder(0xFFD700);
        }
    }

    _triggerReveal() {
        this._state      = 'reveal';
        this._revealVelY = Math.min(-10, this._velocityY * 14);
        this.glowBorder.alpha = 0;
        this.hintText.alpha   = 0;
    }

    // ═══════════════════════════════════════════════════════════════
    //  邊框繪製
    // ═══════════════════════════════════════════════════════════════

    _drawBorder(cx, cy, cardW, cardH, color) {
        const g = this.glowBorder;
        const pad = 14, r = 14;
        g.clear();
        g.roundRect(cx - cardW/2 - pad - 6, cy - cardH/2 - pad - 6,
                    cardW + (pad+6)*2, cardH + (pad+6)*2, r + 8);
        g.stroke({ color: 0xB8860B, width: 3, alpha: 0.28 });
        g.roundRect(cx - cardW/2 - pad, cy - cardH/2 - pad,
                    cardW + pad*2, cardH + pad*2, r);
        g.stroke({ color, width: 3, alpha: 1 });
    }

    _redrawBorder(color) {
        const bTex = Texture.from('card_back');
        this._drawBorder(this._cx, this._cy,
                         bTex.width  * 1.5,
                         bTex.height * 1.5, color);
    }

    // ═══════════════════════════════════════════════════════════════
    //  PUBLIC: forceReset（換局由 GameApp 呼叫）
    // ═══════════════════════════════════════════════════════════════

    forceReset() {
        this._stopTicker();
        this._isDragging          = false;
        this._state               = 'idle';
        this.container.visible    = false;
        this.container.eventMode = 'none';
        this.container.alpha      = 1;
        this.glowBorder.alpha     = 1;
        this.hintText.alpha       = 1;
        this.onCompleteCallback   = null;
    }
}
