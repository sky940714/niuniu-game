class SoundManager {
    constructor() {
        this.enabled = localStorage.getItem('prestige_sound') !== 'false';
        this._ctx = null;
    }

    _getCtx() {
        if (!this._ctx) {
            this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        // Safari requires resuming context after user gesture
        if (this._ctx.state === 'suspended') {
            this._ctx.resume().catch(() => {});
        }
        return this._ctx;
    }

    _tone(freq, type, duration, vol = 0.25, freqEnd = null) {
        if (!this.enabled) return;
        try {
            const c = this._getCtx();
            const osc = c.createOscillator();
            const g = c.createGain();
            osc.connect(g);
            g.connect(c.destination);
            osc.type = type;
            osc.frequency.setValueAtTime(freq, c.currentTime);
            if (freqEnd) {
                osc.frequency.exponentialRampToValueAtTime(freqEnd, c.currentTime + duration);
            }
            g.gain.setValueAtTime(vol, c.currentTime);
            g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
            osc.start(c.currentTime);
            osc.stop(c.currentTime + duration + 0.01);
        } catch (_) {}
    }

    // 下注音效 - 短促清脆
    chip() {
        this._tone(900, 'triangle', 0.07, 0.3);
    }

    // 獲勝音效 - 上行琶音
    win() {
        if (!this.enabled) return;
        [523, 659, 784, 1047].forEach((f, i) => {
            setTimeout(() => this._tone(f, 'sine', 0.35, 0.22), i * 110);
        });
    }

    // 虧損音效 - 下滑音
    lose() {
        this._tone(280, 'sawtooth', 0.5, 0.12, 140);
    }

    // 新局開始 - 短鐘聲
    newRound() {
        this._tone(660, 'sine', 0.28, 0.15);
    }

    // 切換開關，回傳新狀態
    toggle() {
        this.enabled = !this.enabled;
        try { localStorage.setItem('prestige_sound', this.enabled); } catch (_) {}
        return this.enabled;
    }
}

export const soundManager = new SoundManager();
