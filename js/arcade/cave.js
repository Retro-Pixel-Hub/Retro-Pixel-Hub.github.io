// CAVE FLYER — hold to climb through a narrowing cave. Params: speed, width (start gap), narrow, blocks
import { ArcadeGame, module, COL, rect, block, rand } from './kit.js';

class Cave extends ArcadeGame {
  init() { this.controls = 'HOLD A OR UP TO CLIMB'; this.bg = '#140d08'; this.animatedIdle = true; }
  reset() {
    this.y = 130; this.vy = 0; this.dist = 0; this.cols = []; this.mid = 136; this.obs = [];
    for (let x = 0; x < 340; x += 4) this.cols.push(this.makeCol());
  }
  gap() { return Math.max(60, (this.v.width || 150) - this.dist / (this.v.narrow || 60)); }
  makeCol() {
    this.mid += rand(-6, 6); const half = this.gap() / 2;
    this.mid = Math.max(half + 6, Math.min(266 - half, this.mid));
    return { top: this.mid - half, bot: this.mid + half };
  }
  step(dt) {
    const sp = (this.v.speed || 110) + this.t * 1.5;
    const up = this.isDown('a') || this.isDown('up');
    this.vy += (up ? -420 : 380) * dt; this.vy = Math.max(-170, Math.min(200, this.vy));
    this.y += this.vy * dt;
    this.scroll = (this.scroll || 0) + sp * dt; this.dist += sp * dt;
    while (this.scroll >= 4) { this.scroll -= 4; this.cols.shift(); this.cols.push(this.makeCol()); }
    if (this.v.blocks && Math.random() < dt * 0.8) { const c = this.cols.at(-1); this.obs.push({ x: 330, y: rand(c.top + 10, c.bot - 30), h: rand(16, 28) }); }
    for (const o of this.obs) o.x -= sp * dt;
    this.obs = this.obs.filter((o) => o.x > -10);
    this.score = Math.floor(this.dist / 10);
    const c = this.cols[Math.floor((60 + this.scroll) / 4)];
    if (this.y < c.top || this.y + 8 > c.bot) return this.crash();
    for (const o of this.obs) if (o.x < 72 && o.x + 8 > 60 && this.y + 8 > o.y && this.y < o.y + o.h) return this.crash();
    this.trail = [...(this.trail || []).slice(-14), this.y];
  }
  crash() { this.burst(66, this.y + 4, [COL.orange, COL.gold, COL.white], 20, 90); this.end(false, `FLEW ${this.score}M`); }
  hud() { return { left: String(this.score).padStart(6, '0'), mid: 'CAVE' }; }
  draw(g) {
    this.cols.forEach((c, i) => {
      const x = i * 4 - (this.scroll || 0);
      rect(g, x, 0, 4, c.top, '#7a4a2a'); rect(g, x, c.top - 3, 4, 3, '#a8763f');
      rect(g, x, c.bot, 4, 272 - c.bot, '#7a4a2a'); rect(g, x, c.bot, 4, 3, '#a8763f');
    });
    for (const o of this.obs) block(g, o.x, o.y, 8, o.h, COL.grey);
    (this.trail || []).forEach((ty, i, a) => rect(g, 60 - (a.length - i) * 4, ty + 3, 2, 2, '#5b6b5e'));
    block(g, 60, this.y, 14, 8, COL.mint); rect(g, 70, this.y + 2, 3, 3, COL.white);
    rect(g, 58, this.y - 2, 18, 1, ((this.time * 30) | 0) % 2 ? COL.grey : COL.white);
  }
}
export default module(Cave);
