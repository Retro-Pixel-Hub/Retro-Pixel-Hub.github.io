// FLAPPY PIXEL — tap to flap through gaps. Params: gap, speed, gravity, spacing, moving (pipes bob), coins
import { ArcadeGame, module, COL, rect, block, rand } from './kit.js';

class Flap extends ArcadeGame {
  init() { this.controls = 'A / UP / TAP TO FLAP'; this.bg = '#7cc8e8'; this.animatedIdle = true; }
  reset() { this.y = 120; this.vy = 0; this.pipes = []; this.dist = 0; this.passed = 0; this.clouds = Array.from({ length: 5 }, () => [rand(0, 320), rand(10, 120)]); }
  onPress(b) { if (b === 'a' || b === 'up') { this.vy = -(this.v.flap || 210); this.sfx('move'); } }
  step(dt) {
    const sp = (this.v.speed || 80) * (1 + this.passed * 0.01);
    this.vy += (this.v.gravity || 600) * dt;
    this.y += this.vy * dt;
    this.dist += sp * dt;
    for (const c of this.clouds) { c[0] -= sp * 0.2 * dt; if (c[0] < -40) c[0] = 340; }
    const spacing = this.v.spacing || 120;
    if (!this.pipes.length || this.pipes.at(-1).x < 320 - spacing) {
      const gap = Math.max(52, (this.v.gap || 80) - this.passed * 0.5);
      this.pipes.push({ x: 330, top: rand(30, 220 - gap), gap, phase: rand(0, 6), coin: this.v.coins && Math.random() < 0.5 });
    }
    for (const p of this.pipes) {
      p.x -= sp * dt;
      if (this.v.moving) p.top += Math.sin(this.time * 2 + p.phase) * 30 * dt;
      if (!p.done && p.x + 24 < 60) { p.done = true; this.passed++; this.addScore(1); this.sfx('eat'); }
      const bx = 60, by = this.y;
      if (bx + 12 > p.x && bx < p.x + 24 && (by < p.top || by + 10 > p.top + p.gap)) return this.crash();
      if (p.coin && Math.abs(p.x + 12 - bx - 6) < 10 && Math.abs(p.top + p.gap / 2 - by - 5) < 12) { p.coin = false; this.addScore(5, bx, by - 8, COL.gold); this.sfx('golden'); }
    }
    this.pipes = this.pipes.filter((p) => p.x > -30);
    if (this.y > 250 || this.y < -20) this.crash();
  }
  crash() { this.burst(66, this.y + 5, [COL.gold, COL.orange, COL.white], 16, 80); this.end(false, `PASSED ${this.passed}`); }
  hud() { return { mid: `GATES ${this.passed}` }; }
  draw(g) {
    for (const [x, y] of this.clouds) { rect(g, x, y, 34, 8, '#eaf6ff'); rect(g, x + 8, y - 5, 16, 6, '#eaf6ff'); }
    for (const p of this.pipes) {
      block(g, p.x, -2, 24, p.top + 2, COL.green); block(g, p.x - 3, p.top - 10, 30, 10, COL.mint);
      block(g, p.x, p.top + p.gap, 24, 272, COL.green); block(g, p.x - 3, p.top + p.gap, 30, 10, COL.mint);
      if (p.coin) block(g, p.x + 8, p.top + p.gap / 2 - 4, 8, 8, COL.gold);
    }
    rect(g, 0, 256, 320, 16, '#c99a5b'); for (let x = -(this.dist % 16); x < 320; x += 16) rect(g, x, 256, 8, 3, '#9e6e3c');
    const tilt = this.vy > 150 ? 2 : this.vy < -50 ? -2 : 0;
    block(g, 60, this.y, 14, 11, COL.gold);
    rect(g, 68, this.y + 2 + tilt / 2, 3, 3, COL.white); rect(g, 70, this.y + 3, 1, 1, COL.ink);
    rect(g, 72, this.y + 5, 5, 3, COL.orange);
    rect(g, 61, this.y + 5 + (((this.time * 12) | 0) % 2) * 2, 6, 3, '#e0a93a');
  }
}
export default module(Flap);
