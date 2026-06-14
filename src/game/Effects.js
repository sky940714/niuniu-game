import { Container, Graphics, Sprite, Assets } from 'pixi.js';
import gsap from 'gsap';

// ── 牌型 type → 圖片別名 ──────────────────────────────────────────
const TYPE_TO_ALIAS = {
    'FIVE_SMALL':     'effect_wuxiao',
    'BOMB':           'effect_tiezhi',
    'FULL_HOUSE':     'effect_hulu',
    'STRAIGHT_FLUSH': 'effect_tonghuashun',
    'FIVE_KNIGHTS':   'effect_wulong',
    'SILVER_NIU':     'effect_yinhua',
    'NIU_NIU':        'effect_niuniu',
};

// ── 牌型對應粒子顏色與數量 ────────────────────────────────────────
const TYPE_TO_FX = {
    'FIVE_SMALL':     { count: 90, colors: [0xFF00CC, 0x00FFFF, 0xFFD700, 0xFF4500], flash: 2 },
    'BOMB':           { count: 55, colors: [0xFF3D00, 0xFFD700, 0xFF8F00],            flash: 2 },
    'FULL_HOUSE':     { count: 55, colors: [0xFF3D00, 0xFFD700, 0xFF8F00],            flash: 1 },
    'STRAIGHT_FLUSH': { count: 55, colors: [0xFF3D00, 0xFFD700, 0xFF8F00],            flash: 1 },
    'FIVE_KNIGHTS':   { count: 38, colors: [0xFF8F00, 0xFFD700, 0xFFF9C4],            flash: 0 },
    'SILVER_NIU':     { count: 38, colors: [0xFF8F00, 0xFFD700, 0xFFF9C4],            flash: 0 },
    'NIU_NIU':        { count: 22, colors: [0xFFD700, 0xFFF59D],                      flash: 0 },
};

// ════════════════════════════════════════════════════════════════════
//  CoinRain
// ════════════════════════════════════════════════════════════════════
export class CoinRain {
    constructor(app) {
        this.app = app;
        this.container = new Container();
        this.container.zIndex = 200;
        this.container.eventMode = 'none';
        this.app.stage.addChild(this.container);
        this.coins    = [];
        this.isActive = false;
    }

    play() {
        if (this.isActive) return;
        this.isActive = true;
        this.container.visible = true;
        for (let i = 0; i < 100; i++) this._createCoin(i * 0.05);
        gsap.delayedCall(5, () => this.stop());
    }

    _createCoin(delay) {
        const coin = new Graphics();
        coin.circle(0, 0, 15 + Math.random() * 10);
        coin.fill({ color: 0xFFD700 });
        coin.stroke({ color: 0xB8860B, width: 2 });
        coin.x = Math.random() * this.app.screen.width;
        coin.y = -50;
        coin.alpha = 0;
        this.container.addChild(coin);
        this.coins.push(coin);

        const dur = 1.5 + Math.random();
        gsap.to(coin, { y: this.app.screen.height + 100, duration: dur, ease: 'power1.in', delay, onStart: () => { coin.alpha = 1; } });
        gsap.to(coin, { x: coin.x + (Math.random() - 0.5) * 200, duration: dur, delay, ease: 'sine.inOut' });
        gsap.to(coin.scale, { x: Math.random() > 0.5 ? 1 : -1, y: 0.1, duration: 0.2 + Math.random() * 0.3, repeat: -1, yoyo: true, delay });
    }

    stop() {
        this.isActive = false;
        this.coins.forEach(c => { gsap.killTweensOf(c); gsap.killTweensOf(c.scale); });
        this.container.removeChildren();
        this.coins = [];
        this.container.visible = false;
    }
}

// ════════════════════════════════════════════════════════════════════
//  HighHandEffect — 顯示牌型特效圖 + 粒子爆發
// ════════════════════════════════════════════════════════════════════
export class HighHandEffect {
    constructor(app) {
        this.app = app;
        this.container = new Container();
        this.container.zIndex    = 300;
        this.container.eventMode = 'none';
        this.app.stage.addChild(this.container);
        this._activeSprites = [];
    }

    /**
     * 播放特效
     * @param {string} handType  - 後端 type 字串，例如 'NIU_NIU', 'FIVE_SMALL'
     * @param {number} x         - 顯示中心 X（該門牌堆中心）
     * @param {number} y         - 顯示中心 Y（該門牌堆中心）
     * @param {number} delay     - 延遲秒數（多門依序播放）
     */
    play(handType, x, y, delay = 0) {
        const alias = TYPE_TO_ALIAS[handType];
        const fx    = TYPE_TO_FX[handType];
        if (!alias || !fx) return;

        const run = () => {
            // ── 粒子爆發（定位在該門牌堆） ──────────────────────
            this._burst(x, y, fx);

            // ── 牌型圖片（定位在該門牌堆，縮放適合單門寬度）────
            try {
                const sprite = Sprite.from(alias);
                sprite.anchor.set(0.5);
                sprite.x = x;
                sprite.y = y;
                // 單門尺寸：螢幕寬 22%（約 82px on 375px screen）
                const targetScale = this.app.screen.width * 0.22 / 1024;
                sprite.scale.set(0);
                sprite.alpha = 1;
                this.container.addChild(sprite);
                this._activeSprites.push(sprite);

                gsap.to(sprite.scale, {
                    x: targetScale, y: targetScale,
                    duration: 0.38,
                    ease: 'back.out(2.2)',
                    onComplete: () => {
                        gsap.to(sprite, {
                            alpha: 0,
                            duration: 0.45,
                            delay: 1.2,
                            onComplete: () => {
                                const idx = this._activeSprites.indexOf(sprite);
                                if (idx !== -1) this._activeSprites.splice(idx, 1);
                                if (sprite.parent) sprite.parent.removeChild(sprite);
                                sprite.destroy();
                            }
                        });
                    }
                });

                if (fx.flash > 0) this._screenFlash(fx.colors[0], fx.flash);

            } catch (e) {
                // 圖片未載入時靜默失敗
            }
        };

        if (delay > 0) gsap.delayedCall(delay, run);
        else run();
    }

    // ── 粒子爆發 ───────────────────────────────────────────────────
    _burst(cx, cy, fx) {
        for (let i = 0; i < fx.count; i++) {
            const color = fx.colors[i % fx.colors.length];
            const g     = new Graphics();
            const size  = 3 + Math.random() * 6;
            g.circle(0, 0, size);
            g.fill({ color });
            g.x = cx; g.y = cy; g.alpha = 1;
            this.container.addChild(g);

            const angle = Math.random() * Math.PI * 2;
            const speed = 80 + Math.random() * 200;
            const dur   = 0.5 + Math.random() * 0.5;

            gsap.to(g, {
                x: cx + Math.cos(angle) * speed,
                y: cy + Math.sin(angle) * speed - speed * 0.3,
                alpha: 0, scaleX: 0.1, scaleY: 0.1,
                duration: dur, ease: 'power2.out',
                delay: Math.random() * 0.08,
                onComplete: () => { if (g.parent) g.parent.removeChild(g); g.destroy(); }
            });
        }
    }

    // ── 全螢幕閃光 ─────────────────────────────────────────────────
    _screenFlash(color, times = 1) {
        const flash = new Graphics();
        flash.rect(0, 0, this.app.screen.width, this.app.screen.height);
        flash.fill({ color });
        flash.alpha = 0;
        this.container.addChild(flash);

        gsap.to(flash, {
            alpha: 0.32,
            duration: 0.07,
            yoyo: true,
            repeat: times * 2 - 1,
            onComplete: () => { if (flash.parent) flash.parent.removeChild(flash); flash.destroy(); }
        });
    }

    stop() {
        gsap.killTweensOf(this.container.children);
        this._activeSprites.forEach(s => { try { s.destroy(); } catch (_) {} });
        this._activeSprites = [];
        this.container.removeChildren();
    }
}
