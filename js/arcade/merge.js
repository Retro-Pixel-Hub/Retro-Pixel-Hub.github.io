// 2048-style merge puzzle. Params: size, target, start (tiles), fours (chance), blockers
import { ArcadeGame, module, COL, rect, block, text, irand, pick } from './kit.js';

const COLORS = ['#3a4a3e', '#e8e0c8', '#ecd29a', COL.orange, '#ff7a4a', COL.red, '#ff4060', COL.gold, '#ffe36a', COL.mint, COL.blue, COL.purple, COL.pink, '#ffffff'];

class Merge extends ArcadeGame {
  init() {
    this.controls = 'D-PAD SLIDE ALL TILES';
    this.n = this.v.size || 4; this.cs = Math.floor(240 / this.n); this.ox = (320 - this.cs * this.n) / 2; this.oy = (272 - this.cs * this.n) / 2;
  }
  reset() {
    this.b = Array.from({ length: this.n }, () => new Array(this.n).fill(0));
    this.won = false;
    for (let i = 0; i < (this.v.blockers || 0); i++) { const e = this.empties(); const [x, y] = pick(e); this.b[y][x] = -1; }
    for (let i = 0; i < (this.v.start || 2); i++) this.add();
    this.pop = new Map();
  }
  empties() { const e = []; for (let y = 0; y < this.n; y++) for (let x = 0; x < this.n; x++) if (!this.b[y][x]) e.push([x, y]); return e; }
  add() { const e = this.empties(); if (!e.length) return; const [x, y] = pick(e); this.b[y][x] = Math.random() < (this.v.fours ?? 0.1) ? 4 : 2; this.pop = new Map([[`${x},${y}`, this.time]]); }
  slide(line) {
    // blockers (-1) split a line into independent segments
    const out = []; let gained = 0; let seg = [];
    const flush = () => {
      const t = seg.filter((v) => v);
      const res = [];
      for (let i = 0; i < t.length; i++) { if (t[i] === t[i + 1]) { res.push(t[i] * 2); gained += t[i] * 2; i++; } else res.push(t[i]); }
      while (res.length < seg.length) res.push(0);
      out.push(...res); seg = [];
    };
    for (const v of line) { if (v === -1) { flush(); out.push(-1); } else seg.push(v); }
    flush();
    return [out, gained];
  }
  onPress(btn) {
    const d = { left: [1, 0], right: [-1, 0], up: [0, 1], down: [0, -1] }[btn];
    if (!d) return;
    const n = this.n; let moved = false, gained = 0;
    for (let k = 0; k < n; k++) {
      const coords = [];
      for (let i = 0; i < n; i++) {
        if (btn === 'left') coords.push([i, k]); if (btn === 'right') coords.push([n - 1 - i, k]);
        if (btn === 'up') coords.push([k, i]); if (btn === 'down') coords.push([k, n - 1 - i]);
      }
      const line = coords.map(([x, y]) => this.b[y][x]);
      const [res, g] = this.slide(line);
      gained += g;
      coords.forEach(([x, y], i) => { if (this.b[y][x] !== res[i]) moved = true; this.b[y][x] = res[i]; });
    }
    if (!moved) return;
    this.score += gained;
    this.sfx(gained ? 'eat' : 'turn');
    if (gained >= 128) this.shake.add(1, 0.1);
    this.add();
    const target = this.v.target || 2048;
    if (this.b.some((r) => r.some((v) => v >= target))) { this.score += 1000; return this.end(true, `${target}!`); }
    if (!this.canMove()) this.end(false, 'NO MOVES');
  }
  canMove() {
    const n = this.n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = this.b[y][x]; if (v === 0) return true; if (v === -1) continue;
      if (x + 1 < n && this.b[y][x + 1] === v) return true;
      if (y + 1 < n && this.b[y + 1][x] === v) return true;
    }
    return false;
  }
  step() {}
  hud() { return { mid: `GOAL ${this.v.target || 2048}` }; }
  draw(g) {
    const { cs, ox, oy, n } = this;
    rect(g, ox - 4, oy - 4, cs * n + 8, cs * n + 8, '#2a3a2e');
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = this.b[y][x], px = ox + x * cs + 2, py = oy + y * cs + 2, s = cs - 4;
      if (v === -1) { block(g, px, py, s, s, COL.grey); continue; }
      if (!v) { rect(g, px, py, s, s, '#3a4a3e'); continue; }
      const lvl = Math.log2(v);
      const popT = this.time - (this.pop.get(`${x},${y}`) ?? -9);
      const sh = popT < 0.12 ? Math.round((1 - popT / 0.12) * s * 0.3) : 0;
      block(g, px + sh, py + sh, s - sh * 2, s - sh * 2, COLORS[Math.min(lvl, COLORS.length - 1)]);
      const str = String(v);
      text(g, str, px + s / 2, py + s / 2 - (s > 40 && str.length < 4 ? 8 : 4), { size: s > 40 && str.length < 4 ? 16 : 8, color: lvl < 3 ? COL.ink : COL.white, align: 'center', outline: lvl < 3 ? null : COL.ink });
    }
  }
}
export default module(Merge);
