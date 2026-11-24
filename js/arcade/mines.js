// MINE SWEEP. Params: cols, rows, mines, wrap (toroidal neighbours)
import { ArcadeGame, module, COL, rect, block, text, moveCursor, cursorFrame } from './kit.js';

const NUM = ['', COL.blue, COL.mint, COL.red, COL.purple, COL.orange, COL.pink, COL.white, COL.grey];

class Mines extends ArcadeGame {
  init() {
    this.controls = 'D-PAD MOVE  A OPEN  B FLAG';
    this.cols = this.v.cols || 9; this.rows = this.v.rows || 9;
    this.cs = Math.min(16, Math.floor(304 / this.cols), Math.floor(256 / this.rows));
    this.ox = Math.round((320 - this.cols * this.cs) / 2); this.oy = Math.round((272 - this.rows * this.cs) / 2);
  }
  reset() {
    const n = this.cols * this.rows;
    this.mine = new Uint8Array(n); this.open = new Uint8Array(n); this.flag = new Uint8Array(n);
    this.placed = false; this.cur = { x: this.cols >> 1, y: this.rows >> 1 };
  }
  nb(i) {
    const x = i % this.cols, y = (i / this.cols) | 0, out = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      let nx = x + dx, ny = y + dy;
      if (this.v.wrap) { nx = (nx + this.cols) % this.cols; ny = (ny + this.rows) % this.rows; }
      else if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
      out.push(nx + ny * this.cols);
    }
    return out;
  }
  count(i) { return this.nb(i).reduce((s, j) => s + this.mine[j], 0); }
  place(safe) {
    const banned = new Set([safe, ...this.nb(safe)]);
    let k = Math.min(this.v.mines || 10, this.cols * this.rows - 10);
    while (k > 0) { const i = Math.floor(Math.random() * this.mine.length); if (!this.mine[i] && !banned.has(i)) { this.mine[i] = 1; k--; } }
    this.placed = true;
  }
  reveal(i) {
    const stack = [i];
    while (stack.length) {
      const j = stack.pop();
      if (this.open[j] || this.flag[j]) continue;
      this.open[j] = 1;
      if (!this.count(j) && !this.mine[j]) stack.push(...this.nb(j));
    }
  }
  onPress(b) {
    if (moveCursor(this.cur, b, this.cols, this.rows)) return this.sfx('turn');
    const i = this.cur.x + this.cur.y * this.cols;
    if (b === 'b' && !this.open[i]) { this.flag[i] ^= 1; this.sfx('move'); }
    if (b === 'a') {
      if (!this.placed) this.place(i);
      if (this.flag[i]) return;
      if (this.open[i]) { // chord: open neighbours if flags match
        const f = this.nb(i).reduce((s, j) => s + this.flag[j], 0);
        if (f !== this.count(i)) return;
        for (const j of this.nb(i)) if (!this.flag[j]) { if (this.mine[j]) return this.boom(j); this.reveal(j); }
      } else {
        if (this.mine[i]) return this.boom(i);
        this.reveal(i);
      }
      this.sfx('pop');
      this.check();
    }
  }
  boom(i) {
    this.open[i] = 1; this.burst(this.ox + (i % this.cols) * this.cs + 8, this.oy + ((i / this.cols) | 0) * this.cs + 8, [COL.red, COL.orange, COL.gold], 30, 120);
    this.score = this.open.reduce((s, o, j) => s + (o && !this.mine[j] ? 1 : 0), 0) * 2;
    this.end(false, 'BOOM!');
  }
  check() {
    for (let i = 0; i < this.mine.length; i++) if (!this.mine[i] && !this.open[i]) return;
    const m = this.v.mines || 10;
    this.score = Math.max(100, Math.round(m * 60 + this.cols * this.rows * 3 - this.t * 4));
    this.end(true, 'FIELD CLEARED');
  }
  hud() { return { left: `${Math.floor(this.t)}S`, mid: `MINES ${(this.v.mines || 10) - this.flag.reduce((a, b) => a + b, 0)}` }; }
  draw(g) {
    const { cs, ox, oy } = this;
    const reveal = this.state === 'over';
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
      const i = x + y * this.cols, px = ox + x * cs, py = oy + y * cs;
      if (this.open[i] || (reveal && this.mine[i])) {
        rect(g, px, py, cs, cs, '#1d2a22'); rect(g, px, py, cs, 1, '#26372c'); rect(g, px, py, 1, cs, '#26372c');
        if (this.mine[i]) { rect(g, px + cs / 2 - 3, py + cs / 2 - 3, 6, 6, this.open[i] ? COL.red : COL.white); }
        else { const n = this.count(i); if (n) text(g, String(n), px + cs / 2 + 1, py + cs / 2 - 3, { color: NUM[n], align: 'center' }); }
      } else {
        block(g, px, py, cs, cs, '#4a6a52', '#14201a');
        if (this.flag[i]) { rect(g, px + cs / 2 - 1, py + 3, 2, cs - 6, COL.white); rect(g, px + cs / 2 + 1, py + 3, Math.max(3, cs / 3), 4, COL.red); }
      }
    }
    if (this.state === 'play' || this.state === 'intro') cursorFrame(g, ox + this.cur.x * cs, oy + this.cur.y * cs, cs, cs, this.time);
  }
}
export default module(Mines);
