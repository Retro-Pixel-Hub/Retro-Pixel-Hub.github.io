// LIGHT CYCLES — leave a trail, trap the CPU riders. Params: rivals, speed, smart (0..1), rounds, wrap
import { ArcadeGame, module, COL, DIR, OPP, rect, pick } from './kit.js';

const C = 4, CW = 80, CH = 68;
const RIVAL = [COL.red, COL.pink, COL.purple];

class Cycles extends ArcadeGame {
  init() { this.controls = 'D-PAD TURN'; this.bg = '#050912'; }
  reset() { this.round = 1; this.wins = 0; this.build(); }
  build() {
    this.grid = new Uint8Array(CW * CH);
    const n = this.v.rivals || 1;
    this.riders = [{ x: 10, y: CH / 2, dir: 'right', c: COL.blue, alive: true, you: true, q: [] }];
    const starts = [[CW - 11, CH / 2, 'left'], [CW / 2, 6, 'down'], [CW / 2, CH - 7, 'up']];
    for (let i = 0; i < n; i++) this.riders.push({ x: starts[i][0], y: starts[i][1], dir: starts[i][2], c: RIVAL[i], alive: true, id: i + 2 });
    this.riders[0].id = 1;
    for (const r of this.riders) this.grid[r.x + r.y * CW] = r.id;
    this.acc = 0; this.pauseT = 0.6;
  }
  onPress(b) { const me = this.riders[0]; if (DIR[b]) { const last = me.q.at(-1) || me.dir; if (b !== OPP[last] && b !== last && me.q.length < 2) me.q.push(b); } }
  cell(x, y) {
    if (this.v.wrap) { x = (x + CW) % CW; y = (y + CH) % CH; } else if (x < 0 || y < 0 || x >= CW || y >= CH) return 255;
    return this.grid[x + y * CW];
  }
  look(x, y, d, n) { let k = 0; for (let i = 1; i <= n; i++) { if (this.cell(x + DIR[d][0] * i, y + DIR[d][1] * i)) break; k++; } return k; }
  step(dt) {
    if (this.pauseT > 0) { this.pauseT -= dt; return; }
    this.acc += dt;
    const s = 1 / (this.v.speed || 18);
    while (this.acc >= s && this.state === 'play') { this.acc -= s; this.tick(); }
  }
  tick() {
    for (const r of this.riders) {
      if (!r.alive) continue;
      if (r.you) { if (r.q.length) r.dir = r.q.shift(); }
      else {
        const opts = Object.keys(DIR).filter((d) => d !== OPP[r.dir]);
        const smart = this.v.smart ?? 0.7;
        if (this.look(r.x, r.y, r.dir, 3) < 3 || Math.random() < 0.05 * smart) {
          opts.sort((a, b) => this.look(r.x, r.y, b, 20) - this.look(r.x, r.y, a, 20));
          r.dir = Math.random() < smart ? opts[0] : pick(opts);
        }
      }
      let x = r.x + DIR[r.dir][0], y = r.y + DIR[r.dir][1];
      if (this.v.wrap) { x = (x + CW) % CW; y = (y + CH) % CH; }
      if (this.cell(x, y)) { r.alive = false; this.burst(r.x * C, r.y * C, [r.c, COL.white], 16, 80); this.sfx('pop'); continue; }
      r.x = x; r.y = y; this.grid[x + y * CW] = r.id;
    }
    if (this.riders[0].alive) this.score += 1;
    const alive = this.riders.filter((r) => r.alive);
    if (!this.riders[0].alive) { this.shake.add(4, 0.3); return this.end(false, `ROUND ${this.round}`); }
    if (alive.length === 1) {
      this.wins++; this.addScore(500 * this.round, 160, 120, COL.gold); this.sfx('levelup');
      this.round++;
      if (this.round > (this.v.rounds || 5)) return this.end(true, 'GRID CHAMPION');
      this.build();
    }
  }
  hud() { return { mid: `ROUND ${this.round}/${this.v.rounds || 5}` }; }
  draw(g) {
    for (let x = 0; x < 320; x += 20) rect(g, x, 0, 1, 272, '#0d1830');
    for (let y = 0; y < 272; y += 20) rect(g, 0, y, 320, 1, '#0d1830');
    const colors = [null, COL.blue, ...RIVAL];
    for (let i = 0; i < this.grid.length; i++) if (this.grid[i]) rect(g, (i % CW) * C, ((i / CW) | 0) * C, C, C, colors[this.grid[i]]);
    for (const r of this.riders) if (r.alive) rect(g, r.x * C - 1, r.y * C - 1, 6, 6, COL.white);
  }
}
export default module(Cycles);
