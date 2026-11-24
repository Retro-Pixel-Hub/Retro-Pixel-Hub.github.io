// FRUIT CATCH — catch fruit, dodge bombs. Params: speed, bombs, miss (misses allowed), wide, rain (spawn rate)
import { ArcadeGame, module, COL, rect, block, disc, clamp, rand, pick } from './kit.js';

const FRUIT = [[COL.red, 10], [COL.orange, 15], [COL.gold, 20], [COL.purple, 30], [COL.pink, 25]];

class Catcher extends ArcadeGame {
  init() { this.controls = 'LEFT/RIGHT MOVE BASKET'; this.bg = '#123a2a'; }
  reset() { this.x = 140; this.items = []; this.spawnT = 0.5; this.missed = 0; this.streak = 0; }
  step(dt) {
    const dir = (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
    const w = this.v.wide || 40;
    this.x = clamp(this.x + dir * 200 * dt, 0, 320 - w);
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      const bomb = Math.random() < (this.v.bombs ?? 0.15);
      const [c, pts] = pick(FRUIT);
      this.items.push({ x: rand(10, 300), y: -12, vy: (this.v.speed || 70) * rand(0.8, 1.3) * (1 + this.t / 90), bomb, c, pts, wob: rand(0, 6) });
      this.spawnT = rand(0.4, 1.0) / (this.v.rain || 1) / (1 + this.t / 120);
    }
    for (const it of this.items) {
      it.y += it.vy * dt;
      if (this.v.wind) it.x += Math.sin(this.time * 2 + it.wob) * 30 * dt;
      if (!it.done && it.y + 8 > 238 && it.y < 250 && it.x + 8 > this.x && it.x < this.x + w) {
        it.done = true;
        if (it.bomb) { this.burst(it.x + 4, 240, [COL.orange, COL.red, COL.white], 24, 100); return this.end(false, 'KABOOM!'); }
        this.streak++;
        const pts = it.pts * (1 + Math.floor(this.streak / 10));
        this.addScore(pts, it.x + 4, 230, it.c); this.burst(it.x + 4, 240, it.c, 6, 40); this.sfx('eat');
      }
      if (!it.done && it.y > 272) {
        it.done = true;
        if (!it.bomb) { this.missed++; this.streak = 0; this.sfx('back'); this.shake.add(2, 0.15); if (this.missed >= (this.v.miss ?? 5)) return this.end(false, 'TOO MANY DROPS'); }
      }
    }
    this.items = this.items.filter((it) => !it.done);
  }
  hud() { return { mid: `MISS ${this.missed}/${this.v.miss ?? 5}` }; }
  draw(g) {
    for (let i = 0; i < 9; i++) { rect(g, i * 40 + 12, 0, 8, 24, '#5a3a1e'); disc(g, i * 40 + 16, 8, 18, '#1f6a2e'); }
    rect(g, 0, 254, 320, 18, '#2e6a22');
    for (const it of this.items) {
      if (it.bomb) { disc(g, it.x + 5, it.y + 6, 6, '#222'); rect(g, it.x + 5, it.y - 3, 2, 4, COL.grey); if (((this.time * 10) | 0) % 2) rect(g, it.x + 6, it.y - 5, 2, 2, COL.gold); }
      else { disc(g, it.x + 5, it.y + 5, 5, it.c); rect(g, it.x + 5, it.y - 2, 2, 3, COL.green); }
    }
    const w = this.v.wide || 40;
    block(g, this.x, 240, w, 12, COL.brown); for (let k = 4; k < w; k += 6) rect(g, this.x + k, 242, 2, 8, '#6a4428');
  }
}
export default module(Catcher);
