// Logic puzzles:
//   kind 'sudoku'     NUMBER PLACE  params: size (4|6|9), clues
//   kind 'nonogram'   PIXEL PICTURE params: size, density
//   kind 'code'       CODE BREAKER  params: len, colors, tries, dupes
//   kind 'pegs'       PEG JUMP      params: board ('cross'|'french'|'square')
import { ArcadeGame, COL, PIECES, DIR, rect, block, text, disc, moveCursor, cursorFrame, shuffle, irand } from './kit.js';

// ---------------------------------------------------------------- SUDOKU
class Sudoku extends ArcadeGame {
  init() {
    this.controls = 'D-PAD MOVE  A NEXT NUMBER  B PREVIOUS';
    this.n = this.v.size || 9; [this.bw, this.bh] = { 4: [2, 2], 6: [3, 2], 9: [3, 3] }[this.n];
    this.cs = Math.floor(252 / this.n); this.ox = (320 - this.cs * this.n) / 2; this.oy = (272 - this.cs * this.n) / 2;
  }
  ok(g, i, v) {
    const n = this.n, x = i % n, y = (i / n) | 0;
    for (let k = 0; k < n; k++) { if (g[x + k * n] === v && k !== y) return false; if (g[k + y * n] === v && k !== x) return false; }
    const bx = x - (x % this.bw), by = y - (y % this.bh);
    for (let yy = by; yy < by + this.bh; yy++) for (let xx = bx; xx < bx + this.bw; xx++) if ((xx !== x || yy !== y) && g[xx + yy * n] === v) return false;
    return true;
  }
  fill(g, i = 0) {
    if (i === g.length) return true;
    if (g[i]) return this.fill(g, i + 1);
    for (const v of shuffle([...Array(this.n)].map((_, k) => k + 1))) { if (this.ok(g, i, v)) { g[i] = v; if (this.fill(g, i + 1)) return true; } }
    g[i] = 0; return false;
  }
  reset() {
    const n = this.n, sol = new Array(n * n).fill(0);
    this.fill(sol);
    const clues = this.v.clues || Math.round(n * n * 0.45);
    this.given = new Array(n * n).fill(false);
    for (const i of shuffle([...sol.keys()]).slice(0, clues)) this.given[i] = true;
    this.grid = sol.map((v, i) => (this.given[i] ? v : 0));
    this.cur = { x: 0, y: 0 };
  }
  onPress(b) {
    if (moveCursor(this.cur, b, this.n, this.n)) return this.sfx('turn');
    const i = this.cur.x + this.cur.y * this.n;
    if (this.given[i] || (b !== 'a' && b !== 'b')) return;
    this.grid[i] = (this.grid[i] + (b === 'a' ? 1 : this.n)) % (this.n + 1);
    this.sfx('move');
    if (this.grid.every((v, k) => v && this.ok(this.grid, k, v))) { this.score = Math.max(200, Math.round(this.n * this.n * 30 - this.t * 2)); this.end(true, 'SOLVED!'); }
  }
  step() {}
  hud() { return { left: `${Math.floor(this.t / 60)}:${String(Math.floor(this.t % 60)).padStart(2, '0')}`, mid: `${this.grid.filter((v) => !v).length} EMPTY` }; }
  draw(g) {
    const { cs, ox, oy, n } = this;
    rect(g, ox - 2, oy - 2, cs * n + 4, cs * n + 4, COL.gb3);
    for (let i = 0; i < n * n; i++) {
      const x = i % n, y = (i / n) | 0, px = ox + x * cs, py = oy + y * cs;
      const boxShade = (Math.floor(x / this.bw) + Math.floor(y / this.bh)) % 2;
      rect(g, px, py, cs - 1, cs - 1, boxShade ? '#16221a' : '#1d2f22');
      const v = this.grid[i];
      if (v) text(g, String(v), px + cs / 2, py + cs / 2 - (cs > 26 ? 8 : 4), { size: cs > 26 ? 16 : 8, align: 'center', color: this.given[i] ? COL.white : this.ok(this.grid, i, v) ? COL.mint : COL.red });
    }
    for (let k = 0; k <= n; k += this.bw) rect(g, ox + k * cs - 1, oy, 2, cs * n, COL.gb3);
    for (let k = 0; k <= n; k += this.bh) rect(g, ox, oy + k * cs - 1, cs * n, 2, COL.gb3);
    cursorFrame(g, ox + this.cur.x * cs, oy + this.cur.y * cs, cs - 1, cs - 1, this.time);
  }
}

// ---------------------------------------------------------------- NONOGRAM
class Nonogram extends ArcadeGame {
  init() {
    this.controls = 'D-PAD MOVE  A FILL  B MARK X';
    this.n = this.v.size || 5; this.cs = this.n <= 5 ? 26 : this.n <= 8 ? 20 : 16;
    this.ox = 320 - this.cs * this.n - 16; this.oy = 272 - this.cs * this.n - 10;
  }
  reset() {
    const n = this.n;
    do { this.sol = Array.from({ length: n * n }, () => (Math.random() < (this.v.density || 0.58) ? 1 : 0)); } while (this.sol.every((v) => !v));
    this.cell = new Uint8Array(n * n); this.cur = { x: 0, y: 0 };
    const runs = (arr) => { const r = []; let c = 0; for (const v of arr) { if (v) c++; else if (c) { r.push(c); c = 0; } } if (c) r.push(c); return r.length ? r : [0]; };
    this.rowC = [...Array(n)].map((_, y) => runs(this.sol.slice(y * n, y * n + n)));
    this.colC = [...Array(n)].map((_, x) => runs([...Array(n)].map((_, y) => this.sol[x + y * n])));
    this.mistakes = 0;
  }
  onPress(b) {
    if (moveCursor(this.cur, b, this.n, this.n)) return this.sfx('turn');
    const i = this.cur.x + this.cur.y * this.n;
    if (b === 'a') {
      if (this.cell[i] === 1) { this.cell[i] = 0; return; }
      if (!this.sol[i]) { this.mistakes++; this.cell[i] = 2; this.sfx('back'); this.shake.add(2, 0.15); if (this.v.strict && this.mistakes >= 3) return this.end(false, '3 MISTAKES'); return; }
      this.cell[i] = 1; this.sfx('move');
    }
    if (b === 'b') { this.cell[i] = this.cell[i] === 2 ? 0 : 2; this.sfx('turn'); }
    if (this.sol.every((v, k) => !v || this.cell[k] === 1)) { this.score = Math.max(100, Math.round(this.n * this.n * 25 - this.t * 2 - this.mistakes * 50)); this.end(true, 'PICTURE DONE!'); }
  }
  step() {}
  hud() { return { left: `${Math.floor(this.t)}S`, mid: `MISS ${this.mistakes}` }; }
  draw(g) {
    const { cs, ox, oy, n } = this;
    this.rowC.forEach((r, y) => text(g, r.join(' '), ox - 6, oy + y * cs + cs / 2 - 4, { color: y === this.cur.y ? COL.gold : COL.white, align: 'right' }));
    this.colC.forEach((c, x) => c.forEach((v, k) => text(g, String(v), ox + x * cs + cs / 2 + 1, oy - 10 - (c.length - 1 - k) * 10, { color: x === this.cur.x ? COL.gold : COL.white, align: 'center' })));
    for (let i = 0; i < n * n; i++) {
      const x = i % n, y = (i / n) | 0, px = ox + x * cs, py = oy + y * cs;
      rect(g, px, py, cs - 1, cs - 1, '#1d2f22');
      if (this.cell[i] === 1) block(g, px + 1, py + 1, cs - 3, cs - 3, COL.gb3);
      if (this.cell[i] === 2) { for (let k = 3; k < cs - 4; k++) { rect(g, px + k, py + k, 1, 1, COL.red); rect(g, px + cs - 2 - k, py + k, 1, 1, COL.red); } }
    }
    for (let k = 0; k <= n; k += 5) { rect(g, ox + k * cs - 1, oy, 1, cs * n, COL.gb2); rect(g, ox, oy + k * cs - 1, cs * n, 1, COL.gb2); }
    cursorFrame(g, ox + this.cur.x * cs, oy + this.cur.y * cs, cs - 1, cs - 1, this.time);
  }
}

// ---------------------------------------------------------------- MASTERMIND
class Code extends ArcadeGame {
  init() { this.controls = 'L/R SLOT  UP/DOWN COLOUR  A GUESS'; this.len = this.v.len || 4; this.k = this.v.colors || 6; this.tries = this.v.tries || 10; }
  reset() {
    const pool = [...Array(this.k).keys()];
    this.secret = this.v.dupes ? [...Array(this.len)].map(() => irand(0, this.k - 1)) : shuffle(pool).slice(0, this.len);
    this.rows = []; this.guess = new Array(this.len).fill(0); this.slot = 0;
  }
  onPress(b) {
    if (b === 'left') this.slot = (this.slot + this.len - 1) % this.len;
    if (b === 'right') this.slot = (this.slot + 1) % this.len;
    if (b === 'up') this.guess[this.slot] = (this.guess[this.slot] + 1) % this.k;
    if (b === 'down') this.guess[this.slot] = (this.guess[this.slot] + this.k - 1) % this.k;
    if (b !== 'a') return this.sfx('turn');
    let exact = 0, near = 0; const s = [], gg = [];
    this.guess.forEach((v, i) => { if (v === this.secret[i]) exact++; else { s.push(this.secret[i]); gg.push(v); } });
    for (const v of gg) { const j = s.indexOf(v); if (j >= 0) { near++; s.splice(j, 1); } }
    this.rows.push({ g: [...this.guess], exact, near }); this.sfx('move');
    if (exact === this.len) { this.score = (this.tries - this.rows.length + 1) * 100 + this.len * this.k * 10; return this.end(true, 'CODE CRACKED!'); }
    if (this.rows.length >= this.tries) return this.end(false, 'OUT OF TRIES');
  }
  step() {}
  hud() { return { mid: `TRY ${this.rows.length + 1}/${this.tries}` }; }
  draw(g) {
    const rh = Math.min(22, Math.floor(232 / (this.tries + 1))), sx = 160 - this.len * 12;
    const peg = (x, y, c) => { disc(g, x, y, Math.min(8, rh / 2 - 2), PIECES[c]); rect(g, x - 2, y - 3, 2, 2, '#ffffff80'); };
    this.rows.forEach((r, i) => {
      const y = 12 + i * rh;
      r.g.forEach((c, j) => peg(sx + j * 24, y + rh / 2, c));
      for (let k = 0; k < this.len; k++) rect(g, sx + this.len * 24 + 6 + k * 7, y + rh / 2 - 2, 5, 5, k < r.exact ? COL.white : k < r.exact + r.near ? COL.grey : '#2a3a2e');
    });
    const y = 12 + this.rows.length * rh;
    if (this.state !== 'over') {
      this.guess.forEach((c, j) => peg(sx + j * 24, y + rh / 2, c));
      cursorFrame(g, sx + this.slot * 24 - 9, y + 1, 18, rh - 2, this.time);
    } else this.secret.forEach((c, j) => peg(sx + j * 24, y + rh / 2, c));
    rect(g, 8, 250, 304, 1, COL.gb1);
    for (let c = 0; c < this.k; c++) disc(g, 160 - this.k * 10 + c * 20 + 10, 262, 6, PIECES[c]);
  }
}

// ---------------------------------------------------------------- PEG SOLITAIRE
const BOARDS = {
  cross: ['..XXX..', '..XXX..', 'XXXXXXX', 'XXXOXXX', 'XXXXXXX', '..XXX..', '..XXX..'],
  french: ['..XXX..', '.XXXXX.', 'XXXOXXX', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..'],
  square: ['XXXXX', 'XXXXX', 'XXOXX', 'XXXXX', 'XXXXX'],
};
class Pegs extends ArcadeGame {
  init() { this.controls = 'A PICK A PEG, D-PAD TO JUMP'; this.rowsT = BOARDS[this.v.board] || BOARDS.cross; this.n = this.rowsT.length; this.cs = Math.floor(240 / this.n); this.ox = (320 - this.cs * this.n) / 2; this.oy = (272 - this.cs * this.n) / 2; }
  reset() { this.b = this.rowsT.map((r) => r.split('').map((c) => (c === 'X' ? 1 : c === 'O' ? 0 : -1))); this.cur = { x: this.n >> 1, y: this.n >> 1 }; this.held = false; }
  onPress(btn) {
    if (btn === 'a') { if (this.b[this.cur.y][this.cur.x] === 1) { this.held = !this.held; this.sfx('move'); } return; }
    if (btn === 'b') { this.held = false; return; }
    const d = DIR[btn]; if (!d) return;
    if (!this.held) { moveCursor(this.cur, btn, this.n, this.n); this.sfx('turn'); return; }
    const { x, y } = this.cur, mx = x + d[0], my = y + d[1], tx = x + d[0] * 2, ty = y + d[1] * 2;
    this.held = false;
    if (this.b[ty]?.[tx] !== 0 || this.b[my]?.[mx] !== 1) { this.sfx('back'); return; }
    this.b[y][x] = 0; this.b[my][mx] = 0; this.b[ty][tx] = 1; this.cur = { x: tx, y: ty };
    this.addScore(10, this.ox + mx * this.cs + this.cs / 2, this.oy + my * this.cs, COL.white); this.sfx('eat');
    const pegs = this.b.flat().filter((v) => v === 1).length;
    if (!this.anyMove()) {
      if (pegs === 1) { this.score += 1000 + (this.b[this.n >> 1][this.n >> 1] === 1 ? 500 : 0); return this.end(true, 'ONE PEG LEFT!'); }
      this.score += Math.max(0, (8 - pegs) * 40); this.end(false, `${pegs} PEGS LEFT`);
    }
  }
  anyMove() {
    for (let y = 0; y < this.n; y++) for (let x = 0; x < this.n; x++) if (this.b[y][x] === 1) for (const [dx, dy] of Object.values(DIR)) if (this.b[y + dy]?.[x + dx] === 1 && this.b[y + dy * 2]?.[x + dx * 2] === 0) return true;
    return false;
  }
  step() {}
  hud() { return { mid: `${this.b.flat().filter((v) => v === 1).length} PEGS` }; }
  draw(g) {
    const { cs, ox, oy } = this;
    disc(g, 160, 136, Math.round(cs * this.n * 0.62), '#5a3a1e');
    this.b.forEach((row, y) => row.forEach((v, x) => {
      if (v < 0) return;
      const cx = ox + x * cs + cs / 2, cy = oy + y * cs + cs / 2;
      disc(g, cx, cy, 5, '#2a1a10');
      if (v === 1) { disc(g, cx, cy - 1, Math.round(cs * 0.3), this.held && x === this.cur.x && y === this.cur.y ? COL.white : COL.gold); rect(g, cx - 3, cy - 5, 2, 2, '#ffffffa0'); }
    }));
    cursorFrame(g, ox + this.cur.x * cs + 2, oy + this.cur.y * cs + 2, cs - 4, cs - 4, this.time, this.held ? COL.white : COL.mint);
  }
}

const KINDS = { sudoku: Sudoku, nonogram: Nonogram, code: Code, pegs: Pegs };
export default { width: 320, height: 288, create: (api) => new (KINDS[api.variant?.kind] || Sudoku)(api) };
