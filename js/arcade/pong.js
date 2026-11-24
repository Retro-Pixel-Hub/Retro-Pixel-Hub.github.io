// PADDLE DUEL — vs CPU. Params: ai (0..1 skill), speed, paddle, to (points to win), walls (center block), squash (solo wall)
import { ArcadeGame, module, COL, rect, block, clamp, rand } from './kit.js';

class Pong extends ArcadeGame {
  init() { this.controls = 'UP/DOWN MOVE  A SERVE'; this.bg = '#0b150d'; }
  reset() { this.p = 116; this.c = 116; this.ps = 0; this.cs = 0; this.serve(1); }
  serve(dir) { this.ball = { x: 158, y: 134, vx: 0, vy: 0 }; this.waiting = 0.8; this.sdir = dir; this.rally = 0; }
  ph() { return this.v.paddle || 40; }
  step(dt) {
    const sp = 170;
    if (this.isDown('up')) this.p -= sp * dt;
    if (this.isDown('down')) this.p += sp * dt;
    this.p = clamp(this.p, 0, 272 - this.ph());
    const b = this.ball;
    if (this.waiting > 0) {
      this.waiting -= dt;
      if (this.waiting <= 0) { const a = rand(-0.6, 0.6); const s = this.v.speed || 140; b.vx = Math.cos(a) * s * this.sdir; b.vy = Math.sin(a) * s; }
    }
    if (!this.v.squash) {
      const target = b.vx > 0 ? b.y - this.ph() / 2 + rand(-10, 10) * (1 - (this.v.ai ?? 0.6)) : 116;
      const cpuSp = 60 + (this.v.ai ?? 0.6) * 140;
      this.c += clamp(target - this.c, -cpuSp * dt, cpuSp * dt);
      this.c = clamp(this.c, 0, 272 - this.ph());
    }
    const n = 4;
    for (let i = 0; i < n; i++) {
      b.x += (b.vx * dt) / n; b.y += (b.vy * dt) / n;
      if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy); this.sfx('turn'); }
      if (b.y > 268) { b.y = 268; b.vy = -Math.abs(b.vy); this.sfx('turn'); }
      if (this.v.walls && b.x > 150 && b.x < 166 && ((b.y > 40 && b.y < 80) || (b.y > 192 && b.y < 232))) { b.vx = -b.vx; b.x += b.vx > 0 ? 6 : -6; this.sfx('turn'); }
      if (b.vx < 0 && b.x <= 14 && b.x >= 8 && b.y + 4 > this.p && b.y < this.p + this.ph()) this.bounce(this.p, 1);
      if (this.v.squash) { if (b.vx > 0 && b.x >= 312) { b.vx = -Math.abs(b.vx); this.sfx('turn'); } }
      else if (b.vx > 0 && b.x + 4 >= 306 && b.x <= 312 && b.y + 4 > this.c && b.y < this.c + this.ph()) this.bounce(this.c, -1);
    }
    if (b.x < -10) {
      if (this.v.squash) return this.end(false, `RALLY OF ${this.rally}`);
      this.cs++; this.sfx('back'); this.shake.add(3, 0.2);
      if (this.cs >= (this.v.to || 7)) return this.end(false, 'CPU WINS');
      this.serve(1);
    }
    if (b.x > 330) {
      this.ps++; this.addScore(100, 280, 120, COL.gold); this.sfx('golden');
      if (this.ps >= (this.v.to || 7)) { this.score += 500; return this.end(true, 'YOU WIN!'); }
      this.serve(-1);
    }
  }
  bounce(py, dir) {
    const b = this.ball;
    const rel = (b.y + 2 - (py + this.ph() / 2)) / (this.ph() / 2);
    const s = Math.min(380, Math.hypot(b.vx, b.vy) * 1.06);
    const a = clamp(rel, -1, 1) * 0.9;
    b.vx = Math.cos(a) * s * dir; b.vy = Math.sin(a) * s;
    this.sfx('move');
    if (dir > 0) { this.rally++; this.score += 5; }
  }
  hud() { return { mid: this.v.squash ? `RALLY ${this.rally}` : `${this.ps} - ${this.cs}` }; }
  draw(g) {
    for (let y = 0; y < 272; y += 12) rect(g, 159, y, 2, 6, COL.gb1);
    if (this.v.walls) { rect(g, 152, 40, 16, 40, COL.gb2); rect(g, 152, 192, 16, 40, COL.gb2); }
    if (this.v.squash) rect(g, 314, 0, 6, 272, COL.gb2);
    block(g, 8, this.p, 6, this.ph(), COL.gold);
    if (!this.v.squash) block(g, 306, this.c, 6, this.ph(), COL.red);
    rect(g, this.ball.x, this.ball.y, 4, 4, COL.white);
  }
}
export default module(Pong);
