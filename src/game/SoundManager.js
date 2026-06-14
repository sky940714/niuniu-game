class SoundManager {
    constructor() {
        this.enabled = localStorage.getItem('prestige_sound') !== 'false';
        this._ctx = null;

        // BGM 狀態
        this._bgmAudio = null;       // HTML Audio 元素
        this._currentBGM = null;     // 'lobby' | 'game'
        this._bgmTimeoutId = null;   // 合成音循環計時器
        this._bgmSynthActive = false;
        this._autoplayRetry = null;  // autoplay 被擋住時的重試 listener

        // SFX 緩衝（Web Audio，低延遲）
        this._sfxBuffers = {};
        this._loadSFX('deal',     '/sounds/sfx_deal.mp3');
        this._loadSFX('flip',     '/sounds/sfx_flip.mp3');
        this._loadSFX('announce', '/sounds/sfx_announce.mp3');

        // 預先載入語音列表（部分瀏覽器非同步）
        this._femaleVoice = null;
        this._initVoice();
    }

    // ─── 語音初始化 ──────────────────────────────────────────────

    _initVoice() {
        const load = () => {
            const voices = window.speechSynthesis?.getVoices() || [];
            // 優先順序：zh-TW 女聲 → zh 女聲 → zh-TW → zh
            this._femaleVoice =
                voices.find(v => v.lang === 'zh-TW' && /female|女|mei|sin/i.test(v.name)) ||
                voices.find(v => v.lang.startsWith('zh') && /female|女/i.test(v.name)) ||
                voices.find(v => v.lang === 'zh-TW') ||
                voices.find(v => v.lang.startsWith('zh')) ||
                null;
        };
        if ('speechSynthesis' in window) {
            load();
            // 部分瀏覽器需要等 voiceschanged 才有列表
            window.speechSynthesis.addEventListener?.('voiceschanged', load, { once: false });
        }
    }

    // ─── Web Audio 工具 ───────────────────────────────────────────

    _getCtx() {
        if (!this._ctx) {
            this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this._ctx.state === 'suspended') this._ctx.resume().catch(() => {});
        return this._ctx;
    }

    _tone(freq, type, duration, vol = 0.25, freqEnd = null) {
        if (!this.enabled) return;
        try {
            const c = this._getCtx();
            const osc = c.createOscillator();
            const g = c.createGain();
            osc.connect(g); g.connect(c.destination);
            osc.type = type;
            osc.frequency.setValueAtTime(freq, c.currentTime);
            if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, c.currentTime + duration);
            g.gain.setValueAtTime(vol, c.currentTime);
            g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
            osc.start(c.currentTime);
            osc.stop(c.currentTime + duration + 0.01);
        } catch (_) {}
    }

    _noise(duration, vol = 0.12) {
        if (!this.enabled) return;
        try {
            const c = this._getCtx();
            const bufSize = Math.ceil(c.sampleRate * duration);
            const buf = c.createBuffer(1, bufSize, c.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
            const src = c.createBufferSource();
            src.buffer = buf;
            const g = c.createGain();
            src.connect(g); g.connect(c.destination);
            g.gain.setValueAtTime(vol, c.currentTime);
            g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
            src.start(c.currentTime);
        } catch (_) {}
    }

    // ─── SFX 音檔 ─────────────────────────────────────────────────

    async _loadSFX(name, url) {
        try {
            const res = await fetch(url);
            if (!res.ok) return;
            const buf = await res.arrayBuffer();
            this._sfxBuffers[name] = await this._getCtx().decodeAudioData(buf);
        } catch (_) {}
    }

    _playSFXBuffer(name, vol = 0.7) {
        if (!this.enabled || !this._sfxBuffers[name]) return false;
        try {
            const c = this._getCtx();
            const src = c.createBufferSource();
            src.buffer = this._sfxBuffers[name];
            const g = c.createGain();
            src.connect(g); g.connect(c.destination);
            g.gain.setValueAtTime(vol, c.currentTime);
            src.start(c.currentTime);
            return true;
        } catch (_) { return false; }
    }

    // ─── 音效 ─────────────────────────────────────────────────────

    chip()    { this._tone(900, 'triangle', 0.07, 0.3); }
    lose()    { this._tone(280, 'sawtooth', 0.5, 0.12, 140); }
    newRound(){ this._tone(660, 'sine', 0.28, 0.15); }

    win() {
        if (!this.enabled) return;
        [523,659,784,1047].forEach((f,i) => setTimeout(() => this._tone(f,'sine',0.35,0.22), i*110));
    }

    deal() {
        if (!this.enabled) return;
        if (!this._playSFXBuffer('deal', 0.65)) {
            this._noise(0.055, 0.1);
            this._tone(380, 'triangle', 0.06, 0.07, 620);
        }
    }

    flip() {
        if (!this.enabled) return;
        if (!this._playSFXBuffer('flip', 0.7)) {
            this._tone(680, 'sine', 0.1, 0.22, 1080);
            setTimeout(() => this._tone(1080, 'sine', 0.09, 0.16), 85);
        }
    }

    // 「請下注」播報：優先用語音檔，沒有才用 Web Speech API
    placeBetAnnounce() {
        if (!this.enabled) return;
        // 先嘗試播放語音檔（sfx_announce.mp3）
        if (this._playSFXBuffer('announce', 0.9)) return;
        // 無語音檔 → 短提示音 + TTS 合成
        this._tone(880, 'sine', 0.07, 0.15);
        setTimeout(() => {
            if (!('speechSynthesis' in window)) {
                [523,659,784].forEach((f,i) => setTimeout(() => this._tone(f,'sine',0.22,0.18), i*140));
                return;
            }
            try {
                window.speechSynthesis.cancel();
                const utt = new SpeechSynthesisUtterance('請下注');
                utt.lang   = 'zh-TW';
                utt.rate   = 0.80;
                utt.volume = 1.0;
                if (this._femaleVoice) {
                    utt.voice = this._femaleVoice;
                    utt.pitch = 1.2;
                } else {
                    utt.pitch = 1.45;
                }
                window.speechSynthesis.speak(utt);
            } catch (_) {}
        }, 100);
    }

    // ─── BGM（音檔 + 自動循環 + autoplay 重試）──────────────────

    _startBGMAudio(url, volume) {
        const audio = new Audio(url);
        audio.loop   = true;
        audio.volume = volume;
        this._bgmAudio = audio;

        const tryPlay = () => {
            if (!this._bgmAudio) return;
            this._bgmAudio.play().catch(() => {
                // Autoplay 被擋 → 等下一次用戶點擊/觸碰
                this._clearAutoplayRetry();
                const retry = () => {
                    if (this._bgmAudio && this._currentBGM) {
                        this._bgmAudio.play().catch(() => {});
                    }
                };
                document.addEventListener('click',      retry, { once: true });
                document.addEventListener('touchstart', retry, { once: true });
                document.addEventListener('keydown',    retry, { once: true });
                this._autoplayRetry = retry;
            });
        };

        // 音檔載入失敗（檔案不存在）→ 改用合成音
        audio.addEventListener('error', () => {
            this._bgmAudio = null;
            if (this._currentBGM === 'lobby') this._lobbyLoop();
            else if (this._currentBGM === 'game') this._gameLoop();
        }, { once: true });

        tryPlay();
    }

    _clearAutoplayRetry() {
        if (this._autoplayRetry) {
            document.removeEventListener('click',      this._autoplayRetry);
            document.removeEventListener('touchstart', this._autoplayRetry);
            document.removeEventListener('keydown',    this._autoplayRetry);
            this._autoplayRetry = null;
        }
    }

    startLobbyBGM() {
        this.stopBGM();
        if (!this.enabled) return;
        this._currentBGM = 'lobby';
        this._startBGMAudio('/sounds/bgm_lobby.mp3', 0.38);
    }

    startGameBGM() {
        this.stopBGM();
        if (!this.enabled) return;
        this._currentBGM = 'game';
        this._startBGMAudio('/sounds/bgm_game.mp3', 0.40);
    }

    stopBGM() {
        this._clearAutoplayRetry();
        this._currentBGM = null;
        if (this._bgmAudio) {
            this._bgmAudio.pause();
            this._bgmAudio.currentTime = 0;
            this._bgmAudio = null;
        }
        // 停合成音循環
        this._bgmSynthActive = false;
        clearTimeout(this._bgmTimeoutId);
        this._bgmTimeoutId = null;
    }

    // ─── 合成音 BGM（音檔找不到時的備用，自動循環）──────────────

    _lobbyLoop() {
        if (!this.enabled || this._currentBGM !== 'lobby') return;
        this._bgmSynthActive = true;
        try {
            const c = this._getCtx();
            const now = c.currentTime;
            const bpm = 88; const beat = 60/bpm; const total = beat*16;
            const chords = [
                { bass:110.0, notes:[220.0,261.6,329.6,392.0] },
                { bass:146.8, notes:[220.0,261.6,293.7,369.9] },
                { bass:196.0, notes:[246.9,293.7,370.0,440.0] },
                { bass:130.8, notes:[261.6,329.6,392.0,493.9] },
            ];
            chords.forEach((ch,ci) => {
                const cs = now + ci*beat*4;
                ch.notes.forEach(f => {
                    const osc=c.createOscillator(),g=c.createGain();
                    osc.connect(g);g.connect(c.destination);osc.type='sine';
                    osc.frequency.setValueAtTime(f,cs);
                    g.gain.setValueAtTime(0,cs);g.gain.linearRampToValueAtTime(0.018,cs+0.08);
                    g.gain.linearRampToValueAtTime(0.014,cs+beat*3.5);g.gain.linearRampToValueAtTime(0,cs+beat*4);
                    osc.start(cs);osc.stop(cs+beat*4+0.1);
                });
            });
            const mel=[[329.6,0],[392,1],[440,2],[392,3],[349.2,4],[329.6,5],[293.7,6],[261.6,7],
                       [293.7,8],[329.6,9],[392,10],[440,11],[523.3,12],[493.9,13],[440,14],[392,15]];
            mel.forEach(([f,bi])=>{
                const t=now+bi*beat;
                const osc=c.createOscillator(),g=c.createGain();
                osc.connect(g);g.connect(c.destination);osc.type='sine';
                osc.frequency.setValueAtTime(f,t);
                g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.035,t+0.04);
                g.gain.linearRampToValueAtTime(0.02,t+beat*0.7);g.gain.linearRampToValueAtTime(0,t+beat*0.9);
                osc.start(t);osc.stop(t+beat+0.1);
            });
            this._bgmTimeoutId = setTimeout(()=>this._lobbyLoop(), (total-0.15)*1000);
        } catch(_) {}
    }

    _gameLoop() {
        if (!this.enabled || this._currentBGM !== 'game') return;
        this._bgmSynthActive = true;
        try {
            const c = this._getCtx();
            const now = c.currentTime;
            const bpm = 128; const beat = 60/bpm; const total = beat*16;
            const chords = [
                { bass:130.8, notes:[261.6,329.6,392.0] },
                { bass:196.0, notes:[293.7,392.0,493.9] },
                { bass:220.0, notes:[261.6,329.6,440.0] },
                { bass:174.6, notes:[261.6,349.2,440.0] },
            ];
            chords.forEach((ch,ci)=>{
                const cs=now+ci*beat*4;
                ch.notes.forEach(f=>{
                    const osc=c.createOscillator(),g=c.createGain();
                    osc.connect(g);g.connect(c.destination);osc.type='triangle';
                    osc.frequency.setValueAtTime(f,cs);
                    g.gain.setValueAtTime(0,cs);g.gain.linearRampToValueAtTime(0.022,cs+0.03);
                    g.gain.linearRampToValueAtTime(0.016,cs+beat*3.7);g.gain.linearRampToValueAtTime(0,cs+beat*4);
                    osc.start(cs);osc.stop(cs+beat*4+0.1);
                });
                for(let bi=0;bi<2;bi++){
                    const t=cs+bi*beat*2;
                    const osc=c.createOscillator(),g=c.createGain();
                    osc.connect(g);g.connect(c.destination);osc.type='sine';
                    osc.frequency.setValueAtTime(ch.bass,t);
                    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.08,t+0.02);
                    g.gain.linearRampToValueAtTime(0.06,t+beat*1.5);g.gain.linearRampToValueAtTime(0,t+beat*2);
                    osc.start(t);osc.stop(t+beat*2+0.1);
                }
            });
            const mel=[[523.3,0],[587.3,1],[659.3,2],[587.3,3],[523.3,4],[493.9,5],[440.0,6],[493.9,7],
                       [523.3,8],[659.3,9],[784.0,10],[659.3,11],[587.3,12],[523.3,13],[493.9,14],[523.3,15]];
            mel.forEach(([f,bi])=>{
                const t=now+bi*beat;
                const osc=c.createOscillator(),g=c.createGain();
                osc.connect(g);g.connect(c.destination);osc.type='sine';
                osc.frequency.setValueAtTime(f,t);
                g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.045,t+0.02);
                g.gain.linearRampToValueAtTime(0.03,t+beat*0.6);g.gain.linearRampToValueAtTime(0,t+beat*0.85);
                osc.start(t);osc.stop(t+beat+0.1);
            });
            this._bgmTimeoutId = setTimeout(()=>this._gameLoop(), (total-0.15)*1000);
        } catch(_) {}
    }

    // ─── 音效開關 ─────────────────────────────────────────────────

    toggle() {
        this.enabled = !this.enabled;
        try { localStorage.setItem('prestige_sound', this.enabled); } catch(_) {}
        if (!this.enabled) this.stopBGM();
        return this.enabled;
    }

    resumeBGM(type = 'game') {
        if (!this.enabled) return;
        if (type === 'lobby') this.startLobbyBGM();
        else this.startGameBGM();
    }
}

export const soundManager = new SoundManager();
