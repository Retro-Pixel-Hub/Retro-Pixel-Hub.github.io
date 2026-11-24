// MOLE WHACK — move the mallet to the mole and hit A. Params: holes (3|4), time, up (seconds a mole stays), gold, bombs
import { ArcadeGame, module, COL, rect, block, disc, rand, irand, cursorFrame, moveCursor } from './kit.js';

class Whack extends ArcadeGame {
  init() { this.controls = 'D-PAD AIM  A WHACK'; this.bg = '#5fae3f'; this.n = this.v.holes || 3; }
  reset() { this.cur = { x: 1, y: 1 }; this.moles = []; this.spawnT = 0.6; this.hits = 0; this.misses = 0; }
  cellXY(x, y) { const s = 240 / this.n; return [40 + x * s + s / 2, 24 + y * s + s / 2]; }
  onPress(b) {
    if (moveCursor(this.cur, b, this.n, this.n, false)) { this.sfx('turn'); return; }
    if (b !== 'a') return;
    const m = this.moles.find((m) => m.x === this.cur.x && m.y === this.cur.y && m.t < m.up);
    const [cx, cy] = this.cellXY(this.cur.x, this.cur.y);
    this.whackT = 0.12;
    if (!m) { this.misses++; this.sfx('back'); return; }
    m.t = 99;
    if (m.kind === 'bomb') { this.burst(cx, cy, [COL.orange, COL.red], 20, 90); return this.end(false, 'HIT A BOMB'); }
    const pts = m.kind === 'gold' ? 50 : 10;
    this.hits++; this.addScore(pts, cx, cy - 20, m.kind === 'gold' ? COL.gold : COL.white); this.burst(cx, cy, [COL.brown, COL.white], 10, 60); this.sfx(m.kind === 'gold' ? 'golden' : 'eat'); this.shake.add(1, 0.08);
  }
  step(dt) {
    const limit = this.v.time || 45;
    if (this.t >= limit) return this.end(true, "TIME'S UP!");
    this.whackT = Math.max(0, (this.whackT || 0) - dt);
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      const x = irand(0, this.n - 1), y = irand(0, this.n - 1);
      if (!this.moles.some((m) => m.x === x && m.y === y)) {
        const r = Math.random();
        const kind = this.v.bombs && r < 0.15 ? 'bomb' : this.v.gold !== false && r > 0.9 ? 'gold' : 'mole';
        this.moles.push({ x, y, t: 0, up: Math.max(0.5, (this.v.up || 1.3) - this.t / 60), kind });
      }
      this.spawnT = rand(0.3, 0.8) * Math.max(0.5, 1 - this.t / 90);
    }
    for (const m of this.moles) m.t += dt;
    this.moles = this.moles.filter((m) => m.t < m.up + 0.2 && m.t < 50);
  }
  hud() { return { mid: `${Math.max(0, Math.ceil((this.v.time || 45) - this.t))}S  HITS ${this.hits}` }; }
  draw(g) {
    const s = 240 / this.n;
    for (let y = 0; y < this.n; y++) for (let x = 0; x < this.n; x++) {
      const [cx, cy] = this.cellXY(x, y);
      rect(g, cx - s * 0.32, cy + 4, s * 0.64, 10, '#3a2414');
      disc(g, cx, cy + 9, Math.round(s * 0.3), '#3a2414');
    }
    for (const m of this.moles) {
      if (m.t > m.up) continue;
      const [cx, cy] = this.cellXY(m.x, m.y);
      const rise = Math.min(1, m.t * 8, (m.up - m.t) * 8);
      const top = cy + 8 - rise * 22;
      g.save(); g.beginPath(); g.rect(cx - 30, cy - 40, 60, 48); g.clip();
      const c = m.kind === 'bomb' ? '#222' : m.kind === 'gold' ? COL.gold : '#8e6234';
      disc(g, cx, top + 10, 11, c); rect(g, cx - 11, top + 10, 23, 16, c);
      if (m.kind !== 'bomb') { rect(g, cx - 5, top + 6, 3, 3, COL.ink); rect(g, cx + 3, top + 6, 3, 3, COL.ink); rect(g, cx - 2, top + 11, 5, 3, COL.pink); }
      else rect(g, cx - 1, top - 4, 2, 5, COL.gold);
      g.restore();
    }
    const [cx, cy] = this.cellXY(this.cur.x, this.cur.y);
    cursorFrame(g, cx - s / 2 + 6, cy - s / 2 + 6, s - 12, s - 12, this.time);
    const ang = this.whackT > 0 ? 10 : 0;
    block(g, cx + 8, cy - 30 + ang, 22, 12, COL.red); rect(g, cx + 17, cy - 18 + ang, 4, 18, COL.brown);
  }
}
export default module(Whack);
