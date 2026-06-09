// backend/managers/BankerManager.js
const UserService  = require('../services/userService');
const BankerService = require('../services/bankerService');

const SAFETY_DIVISOR      = 34.4;   // 4門 × (1 + 8 × 0.95)
const QUEUE_LIMIT         = 5;
const ROUNDS_PER_SESSION  = 10;
const FORCE_OUT_THRESHOLD = 10000;  // 凍結金低於此值強制下莊
const MIN_FROZEN          = 100000; // 最低上莊門檻

class BankerManager {
    constructor() {
        this.io            = null;
        this.queue         = [];    // [{ queueId, userId, username, frozenAmount }]
        this.activeSession = null;  // 見 _buildSession()
    }

    init(io) {
        this.io = io;
    }

    // ── 計算每門上限 ─────────────────────────────────────────────
    _calcCap(frozenAmount) {
        return Math.floor(frozenAmount / SAFETY_DIVISOR);
    }

    // ── 狀態查詢 ─────────────────────────────────────────────────
    isActive()        { return !!this.activeSession; }
    getBankerUserId() { return this.activeSession?.userId ?? null; }
    getPerZoneCap()   { return this.activeSession?.perZoneCap ?? null; }

    getStatus() {
        return {
            hasBanker: !!this.activeSession,
            banker: this.activeSession ? {
                userId:        this.activeSession.userId,
                username:      this.activeSession.username,
                initialFrozen: this.activeSession.initialFrozen,
                currentFrozen: this.activeSession.currentFrozen,
                perZoneCap:    this.activeSession.perZoneCap,
                roundsPlayed:  this.activeSession.roundsPlayed,
                roundsLeft:    ROUNDS_PER_SESSION - this.activeSession.roundsPlayed,
                netPnl:        this.activeSession.currentFrozen - this.activeSession.initialFrozen,
            } : null,
            queue: this.queue.map((q, i) => ({
                position:     i + 1,
                username:     q.username,
                frozenAmount: q.frozenAmount,
                perZoneCap:   this._calcCap(q.frozenAmount),
            })),
            queueCount: this.queue.length,
            queueLimit: QUEUE_LIMIT,
            minFrozen:  MIN_FROZEN,
        };
    }

    // ── 申請上莊 ─────────────────────────────────────────────────
    async apply(socket, frozenAmount) {
        if (!socket.user) return { success: false, msg: '請先登入' };

        const { db_id, username, balance } = socket.user;
        const amount = Math.floor(Number(frozenAmount));

        if (isNaN(amount) || amount < MIN_FROZEN)
            return { success: false, msg: `凍結金最低 $${MIN_FROZEN.toLocaleString()}` };
        if (amount > balance)
            return { success: false, msg: '餘額不足' };
        if (this.activeSession?.userId === db_id)
            return { success: false, msg: '您已在莊家位' };
        if (this.queue.find(q => q.userId === db_id))
            return { success: false, msg: '您已在排隊中' };
        if (this.queue.length >= QUEUE_LIMIT)
            return { success: false, msg: `排隊已滿（${this.queue.length}/${QUEUE_LIMIT}）` };

        // 凍結金額（從餘額扣除）
        const ok = await UserService.updateBalance(db_id, -amount);
        if (!ok) return { success: false, msg: '扣款失敗' };
        socket.user.balance -= amount;
        socket.emit('update_balance', { balance: socket.user.balance });

        const queueId = await BankerService.addToQueue(db_id, username, amount);
        this.queue.push({ queueId, userId: db_id, username, frozenAmount: amount });

        console.log(`👑 [Banker] ${username} 加入排隊，凍結 $${amount.toLocaleString()}，隊列 ${this.queue.length}/${QUEUE_LIMIT}`);

        // 統一等新局開始才上莊，避免局中插入
        this._broadcast();

        return { success: true, perZoneCap: this._calcCap(amount) };
    }

    // ── 取消排隊 ─────────────────────────────────────────────────
    async cancelApply(socket) {
        if (!socket.user) return { success: false, msg: '請先登入' };
        const idx = this.queue.findIndex(q => q.userId === socket.user.db_id);
        if (idx === -1) return { success: false, msg: '您不在排隊中' };

        const q = this.queue.splice(idx, 1)[0];
        await UserService.updateBalance(socket.user.db_id, q.frozenAmount);
        socket.user.balance += q.frozenAmount;
        socket.emit('update_balance', { balance: socket.user.balance });

        await BankerService.setQueueStatus(q.queueId, 'cancelled');
        console.log(`👑 [Banker] ${q.username} 取消排隊，退還 $${q.frozenAmount.toLocaleString()}`);
        this._broadcast();
        return { success: true };
    }

    // ── 新局開始：接班或重算 cap ──────────────────────────────────
    async onNewRound() {
        if (!this.activeSession) {
            // 佇列有人 → 現在才正式啟動
            if (this.queue.length > 0) await this._startNext();
            return;
        }
        // 已有莊家 → 只重算每門上限
        this.activeSession.perZoneCap = this._calcCap(this.activeSession.currentFrozen);
        this._broadcast();
    }

    // ── 結算：更新凍結金 ─────────────────────────────────────────
    async settleRound(bankerPays, bankerReceives) {
        if (!this.activeSession) return;

        this.activeSession.currentFrozen -= bankerPays;
        this.activeSession.currentFrozen += bankerReceives;
        this.activeSession.roundsPlayed++;

        const s = this.activeSession;
        console.log(`👑 [Banker] 局結算：莊家賠 $${bankerPays.toLocaleString()} 收 $${bankerReceives.toLocaleString()}，凍結金 $${s.currentFrozen.toLocaleString()}（${s.roundsPlayed}/${ROUNDS_PER_SESSION} 局）`);

        if (s.currentFrozen < FORCE_OUT_THRESHOLD) {
            console.log(`👑 [Banker] 凍結金不足 $${FORCE_OUT_THRESHOLD}，強制下莊`);
            await this._endSession(true);
            return;
        }

        if (s.roundsPlayed >= ROUNDS_PER_SESSION) {
            await this._endSession(false);
            return;
        }

        this._broadcast();
    }

    // ── 後台強制踢莊 ─────────────────────────────────────────────
    async adminKick() {
        if (!this.activeSession) return { success: false, msg: '目前無莊家' };
        await this._endSession(true);
        return { success: true };
    }

    // ── 玩家主動下莊 ─────────────────────────────────────────────
    async playerQuit(userId) {
        if (!this.activeSession) return { success: false, msg: '目前無莊家' };
        if (this.activeSession.userId !== userId) return { success: false, msg: '您不是當前莊家' };
        await this._endSession(true);
        return { success: true };
    }

    // ── 斷線時自動取消（排隊或做莊）────────────────────────────
    async cancelOnDisconnect(userId) {
        // 在排隊中 → 退款並移除
        const idx = this.queue.findIndex(q => q.userId === userId);
        if (idx !== -1) {
            const q = this.queue.splice(idx, 1)[0];
            await UserService.updateBalance(userId, q.frozenAmount);
            await BankerService.setQueueStatus(q.queueId, 'cancelled');
            console.log(`👑 [Banker] 玩家斷線，取消排隊退還 $${q.frozenAmount.toLocaleString()}`);
            this._broadcast();
        }
        // 正在做莊 → 強制下莊（餘額仍會存入 DB，玩家重連後餘額正確）
        if (this.activeSession?.userId === userId) {
            console.log(`👑 [Banker] 莊家斷線，強制下莊`);
            await this._endSession(true);
        }
    }

    // ── 啟動下一位莊家 ───────────────────────────────────────────
    async _startNext() {
        if (this.queue.length === 0) {
            this._broadcast();
            return;
        }

        const next   = this.queue.shift();
        const cap    = this._calcCap(next.frozenAmount);
        const sessId = await BankerService.createSession(next.userId, next.username, next.frozenAmount);
        await BankerService.setQueueStatus(next.queueId, 'active');

        this.activeSession = {
            queueId:       next.queueId,
            userId:        next.userId,
            username:      next.username,
            initialFrozen: next.frozenAmount,
            currentFrozen: next.frozenAmount,
            perZoneCap:    cap,
            roundsPlayed:  0,
            sessionId:     sessId,
        };

        console.log(`👑 [Banker] ${next.username} 開始做莊，凍結 $${next.frozenAmount.toLocaleString()}，每門上限 $${cap.toLocaleString()}`);

        // 通知莊家本人
        if (this.io) {
            const sockets = await this.io.fetchSockets();
            const sock = sockets.find(s => s.user?.db_id === next.userId);
            if (sock) {
                sock.emit('banker_started', {
                    initialFrozen: next.frozenAmount,
                    perZoneCap:    cap,
                    roundsLeft:    ROUNDS_PER_SESSION,
                });
            }
        }

        this._broadcast();
    }

    // ── 結束當前場次 ─────────────────────────────────────────────
    async _endSession(isForced) {
        if (!this.activeSession) return;
        const s = this.activeSession;
        const finalFrozen = Math.max(0, Math.floor(s.currentFrozen));
        const netPnl      = finalFrozen - s.initialFrozen;

        await BankerService.endSession(s.sessionId, finalFrozen, netPnl, s.roundsPlayed, isForced);
        await BankerService.setQueueStatus(s.queueId, 'done');

        // 退還剩餘凍結金
        if (finalFrozen > 0) {
            await UserService.updateBalance(s.userId, finalFrozen);
            if (this.io) {
                const sockets = await this.io.fetchSockets();
                const sock = sockets.find(sk => sk.user?.db_id === s.userId);
                if (sock) {
                    sock.user.balance += finalFrozen;
                    sock.emit('update_balance', { balance: sock.user.balance });
                    sock.emit('banker_ended', { isForced, finalFrozen, netPnl, roundsPlayed: s.roundsPlayed });
                }
            }
        }

        console.log(`👑 [Banker] ${s.username} 下莊（${isForced ? '強制' : '任期滿'}），退還 $${finalFrozen.toLocaleString()}，盈虧 ${netPnl >= 0 ? '+' : ''}$${netPnl.toLocaleString()}`);
        this.activeSession = null;
        this._broadcast();
        await this._startNext();
    }

    // ── 廣播莊家狀態 ─────────────────────────────────────────────
    _broadcast() {
        if (this.io) this.io.emit('banker_status', this.getStatus());
    }
}

module.exports = new BankerManager();
