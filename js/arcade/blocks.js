// BLOCKS — falling-block puzzle.
// Params: cols, rows, set ('tetro'|'tri'|'pento'), mode ('marathon'|'sprint'|'ultra'|'zen'),
//         goal (lines), limit (seconds), level (start), invisible, cascade, rise (sec), preview
import { ArcadeGame, module, COL, PIECES, rect, block, text, shuffle, irand } from './kit.js';

const SETS = {
  tetro: ['0000111100000000', '11001100', '010111000', '001111000', '100111000', '011110000', '110011000'],
  tri: ['111000000', '110100000', '1111'],
  pento: ['0100011100010000000000000', '1111100000000000000000000', '1000010000100001100000000', '0100001000010001100000000',
    '1100001100001000000000000', '1110001000010000000000000', '1010011100000000000000000', '1000010000111000000000000',
    '1000011000011000000000000', '0110011000010000000000000', '0100011000110000000000000', '0010011110000000000000000'],
};
function parse(str) {
  const n = Math.round(Math.sqrt(str.length));
  const cells = [];
  for (let i = 0; i < str.length; i++) if (str[i] === '1') cells.push([i % n, (i / n) | 0]);
  return { n, cells };
}
const rotate = (p, dir) => ({ n: p.n, cells: p.cells.map(([x, y]) => (dir > 0 ? [p.n - 1 - y, x] : [y, p.n - 1 - x])) });

class Blocks extends ArcadeGame {
  init() {
    this.controls = 'L/R MOVE DOWN SOFT UP DROP A/B ROTATE';
    this.cols = this.v.cols || 10;
    this.rows = this.v.rows || 20;
    this.cell = Math.min(13, Math.floor(262 / this.rows), Math.floor(190 / this.cols));
    this.shapes = (SETS[this.v.set || 'tetro']).map(parse);
    this.ox = 12; this.oy = Math.round((272 - this.rows * this.cell) / 2);
  }
  reset() {
    this.grid = Array.from({ length: this.rows }, () => new Array(this.cols).fill(0));
    this.bag = []; this.next = this.draw1(); this.lines = 0;
    this.level = this.v.level || 1; this.fall = 0; this.lockT = 0; this.das = 0; this.riseT = 0;
    this.flashRows = null; this.spawn();
  }
  draw1() {
    if (!this.bag.length) this.bag = shuffle(this.shapes.map((_, i) => i));
    const i = this.bag.pop();
    return { ...this.shapes[i], color: PIECES[i % PIECES.length] };
  }
  spawn() {
    this.piece = this.next; this.next = this.draw1();
    this.px = Math.floor((this.cols - this.piece.n) / 2); this.py = -1;
    if (this.piece.cells.every(([, y]) => y > 0)) this.py = -1; else this.py = 0;
    if (!this.fits(this.piece, this.px, this.py)) {
      if (this.v.mode === 'zen') { this.grid.forEach((r) => r.fill(0)); this.score = Math.max(0, this.score - 500); this.sfx('back'); }
      else this.end(false, 'TOPPED OUT');
    }
  }
  fits(p, x, y) {
    return p.cells.every(([cx, cy]) => {
      const gx = x + cx, gy = y + cy;
      return gx >= 0 && gx < this.cols && gy < this.rows && (gy < 0 || !this.grid[gy][gx]);
    });
  }
  move(dx) { if (this.fits(this.piece, this.px + dx, this.py)) { this.px += dx; this.sfx('move'); return true; } return false; }
  rot(dir) {
    const r = rotate(this.piece, dir);
    r.color = this.piece.color;
    for (const [kx, ky] of [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]]) {
      if (this.fits(r, this.px + kx, this.py + ky)) { this.piece = r; this.px += kx; this.py += ky; this.sfx('turn'); return; }
    }
  }
  onPress(b) {
    if (b === 'left') { this.move(-1); this.das = -0.17; }
    if (b === 'right') { this.move(1); this.das = -0.17; }
    if (b === 'a') this.rot(1);
    if (b === 'b') this.rot(-1);
    if (b === 'up') { let d = 0; while (this.fits(this.piece, this.px, this.py + 1)) { this.py++; d++; } this.score += d * 2; this.lock(); this.shake.add(2, 0.1); }
  }
  gravity() { return Math.max(0.04, 0.8 - (this.level - 1) * 0.07); }
  step(dt) {
    if (this.v.mode === 'ultra' && this.t >= (this.v.limit || 120)) return this.end(true, "TIME'S UP!");
    if (this.flashRows) { this.flashT -= dt; if (this.flashT <= 0) this.collapse(); return; }
    // auto-repeat for held left/right
    const l = this.isDown('left'), r = this.isDown('right');
    if (l || r) { this.das += dt; while (this.das > 0.05) { this.das -= 0.05; this.move(l ? -1 : 1); } }
    if (this.v.rise) { this.riseT += dt; if (this.riseT > this.v.rise) { this.riseT = 0; this.garbage(); } }
    const g = this.isDown('down') ? Math.min(0.03, this.gravity()) : this.gravity();
    this.fall += dt;
    while (this.fall >= g && this.state === 'play' && !this.flashRows) {
      this.fall -= g;
      if (this.fits(this.piece, this.px, this.py + 1)) { this.py++; if (this.isDown('down')) this.score += 1; }
      else { this.lockT += g; if (this.lockT > 0.25 || this.isDown('down')) this.lock(); }
    }
  }
  garbage() {
    this.grid.shift();
    const hole = irand(0, this.cols - 1);
    this.grid.push(Array.from({ length: this.cols }, (_, i) => (i === hole ? 0 : COL.grey)));
    if (!this.fits(this.piece, this.px, this.py)) this.py--;
    this.sfx('pop');
  }
  lock() {
    this.lockT = 0;
    for (const [cx, cy] of this.piece.cells) {
      const gy = this.py + cy;
      if (gy < 0) return this.end(false, 'TOPPED OUT');
      this.grid[gy][this.px + cx] = this.piece.color;
    }
    this.lastLock = { cells: this.piece.cells.map(([x, y]) => [this.px + x, this.py + y]), t: this.time };
    const full = [];
    this.grid.forEach((row, y) => { if (row.every(Boolean)) full.push(y); });
    if (full.length) { this.flashRows = full; this.flashT = 0.25; this.sfx(full.length >= 4 ? 'combo' : 'eat'); }
    else { this.sfx('pop'); this.spawn(); }
  }
  collapse() {
    const n = this.flashRows.length;
    for (const y of this.flashRows) {
      for (let x = 0; x < this.cols; x++) this.burst(this.ox + x * this.cell + 6, this.oy + y * this.cell + 6, this.grid[y][x] || COL.white, 2, 50);
    }
    this.grid = this.grid.filter((_, y) => !this.flashRows.includes(y));
    while (this.grid.length < this.rows) this.grid.unshift(new Array(this.cols).fill(0));
    if (this.v.cascade) this.settle();
    this.flashRows = null;
    this.lines += n;
    const pts = [0, 100, 300, 500, 800, 1200][Math.min(n, 5)] * this.level;
    this.addScore(pts, this.ox + this.cols * this.cell / 2, 120, n >= 4 ? COL.gold : COL.white);
    this.shake.add(n, 0.2); this.buzz(15 * n);
    if (this.v.mode !== 'zen') this.level = (this.v.level || 1) + Math.floor(this.lines / 10);
    if (this.v.mode === 'sprint' && this.lines >= (this.v.goal || 40)) {
      this.score = Math.max(100, Math.round(30000 - this.t * 100));
      return this.end(true, 'FINISHED!');
    }
    this.spawn();
  }
  settle() {
    for (let x = 0; x < this.cols; x++) {
      const col = [];
      for (let y = 0; y < this.rows; y++) if (this.grid[y][x]) col.push(this.grid[y][x]);
      for (let y = this.rows - 1; y >= 0; y--) this.grid[y][x] = col.length ? col.pop() : 0;
    }
  }
  hud() {
    if (this.v.mode === 'sprint') return { mid: `${Math.max(0, (this.v.goal || 40) - this.lines)} LEFT` };
    if (this.v.mode === 'ultra') return { mid: `${Math.max(0, Math.ceil((this.v.limit || 120) - this.t))}S` };
    return { mid: `LV${this.level}` };
  }
  ghostY() { let y = this.py; while (this.fits(this.piece, this.px, y + 1)) y++; return y; }
  draw(g) {
    const { ox, oy, cell: c, cols, rows } = this;
    rect(g, ox - 3, oy - 3, cols * c + 6, rows * c + 6, COL.gb1);
    rect(g, ox, oy, cols * c, rows * c, '#0b150d');
    const showAll = !this.v.invisible || this.state === 'over' || this.state === 'intro';
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const v = this.grid[y][x];
      const flash = this.flashRows?.includes(y);
      if (flash) { rect(g, ox + x * c, oy + y * c, c, c, ((this.time * 20) | 0) % 2 ? COL.white : v); continue; }
      if (v && showAll) block(g, ox + x * c, oy + y * c, c, c, v);
      else if (v) rect(g, ox + x * c + c / 2 - 1, oy + y * c + c / 2 - 1, 2, 2, '#1d2f22');
    }
    if (this.v.invisible && this.lastLock && this.time - this.lastLock.t < 0.4) {
      for (const [x, y] of this.lastLock.cells) if (y >= 0) block(g, ox + x * c, oy + y * c, c, c, COL.white);
    }
    if (this.state === 'play' && !this.flashRows) {
      const gy = this.ghostY();
      for (const [cx, cy] of this.piece.cells) {
        const y = gy + cy; if (y >= 0) { g.strokeStyle = this.piece.color; g.lineWidth = 1; g.strokeRect(ox + (this.px + cx) * c + 1.5, oy + y * c + 1.5, c - 3, c - 3); }
      }
      for (const [cx, cy] of this.piece.cells) { const y = this.py + cy; if (y >= 0) block(g, ox + (this.px + cx) * c, oy + y * c, c, c, this.piece.color); }
    }
    // side panel
    const sx = ox + cols * c + 18;
    text(g, 'NEXT', sx, 12, { color: COL.gb3 });
    rect(g, sx, 24, 60, 60, '#0b150d');
    const n = this.next, pc = 10, offx = sx + 30 - (n.n * pc) / 2, offy = 54 - (n.n * pc) / 2;
    for (const [x, y] of n.cells) block(g, offx + x * pc, offy + y * pc, pc, pc, n.color);
    text(g, 'LINES', sx, 100, { color: COL.gb3 }); text(g, String(this.lines), sx, 112, { color: COL.white });
    text(g, 'LEVEL', sx, 132, { color: COL.gb3 }); text(g, String(this.level), sx, 144, { color: COL.white });
    if (this.v.mode === 'sprint') { text(g, 'TIME', sx, 164, { color: COL.gb3 }); text(g, this.t.toFixed(1), sx, 176, { color: COL.white }); }
  }
}
export default module(Blocks);
