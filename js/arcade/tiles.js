// Tile-matching puzzles:
//   kind 'match'  GEM SWAP (match-3)    params: size, colors, moves | time
//   kind 'same'   BLOCK POP (SameGame)  params: cols, rows, colors
import { ArcadeGame, module, COL, PIECES, DIR, rect, block, moveCursor, cursorFrame, irand } from './kit.js';

// ---------------------------------------------------------------- MATCH-3
class Match3 extends ArcadeGame {
  init() {
    this.controls = 'A PICK A GEM, D-PAD TO SWAP';
    this.n = this.v.size || 8; this.k = this.v.colors || 6; this.cs = Math.floor(256 / this.n);
    this.ox = (320 - this.cs * this.n) / 2; this.oy = (272 - this.cs * this.n) / 2;
  }
  reset() {
    this.b = []; for (let i = 0; i < this.n * this.n; i++) this.b.push(irand(0, this.k - 1));
    while (this.findMatches().size) for (const i of this.findMatches()) this.b[i] = irand(0, this.k - 1);
    this.cur = { x: 3, y: 3 }; this.held = false; this.phase = 'idle'; this.movesLeft = this.v.moves || 0; this.chain = 0; this.flash = new Set();
  }
  at(x, y) { return x < 0 || y < 0 || x >= this.n || y >= this.n ? -1 : this.b[x + y * this.n]; }
  findMatches() {
    const m = new Set(), n = this.n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = this.at(x, y); if (v < 0) continue;
      if (v === this.at(x + 1, y) && v === this.at(x + 2, y)) { let k = x; while (this.at(k, y) === v) m.add(k++ + y * n); }
      if (v === this.at(x, y + 1) && v === this.at(x, y + 2)) { let k = y; while (this.at(x, k) === v) m.add(x + k++ * n); }
    }
    return m;
  }
  hasMove() {
    const n = this.n;
    for (let i = 0; i < n * n; i++) for (const j of [i + 1, i + n]) {
      if (j >= n * n || (j === i + 1 && (i % n) === n - 1)) continue;
      [this.b[i], this.b[j]] = [this.b[j], this.b[i]];
      const ok = this.findMatches().size > 0;
      [this.b[i], this.b[j]] = [this.b[j], this.b[i]];
      if (ok) return true;
    }
    return false;
  }
  onPress(b) {
    if (this.phase !== 'idle') return;
    if (b === 'a' || b === 'b') { this.held = b === 'a' ? !this.held : false; this.sfx('move'); return; }
    if (!DIR[b]) return;
    if (!this.held) { moveCursor(this.cur, b, this.n, this.n); this.sfx('turn'); return; }
    const [dx, dy] = DIR[b], x2 = this.cur.x + dx, y2 = this.cur.y + dy;
    this.held = false;
    if (x2 < 0 || y2 < 0 || x2 >= this.n || y2 >= this.n) return;
    const i = this.cur.x + this.cur.y * this.n, j = x2 + y2 * this.n;
    [this.b[i], this.b[j]] = [this.b[j], this.b[i]];
    if (!this.findMatches().size) { [this.b[i], this.b[j]] = [this.b[j], this.b[i]]; this.sfx('back'); this.shake.add(1, 0.1); return; }
    this.cur = { x: x2, y: y2 }; this.chain = 0;
    if (this.v.moves) this.movesLeft--;
    this.resolve();
  }
  resolve() {
    const m = this.findMatches();
    if (!m.size) {
      this.phase = 'idle';
      if (this.v.moves && this.movesLeft <= 0) return this.end(true, 'OUT OF MOVES');
      if (!this.hasMove()) { this.reset(); this.popups.add('SHUFFLE!', 160, 120, COL.blue); }
      return;
    }
    this.chain++;
    this.flash = m; this.phase = 'clear'; this.timer = 0.22;
    const pts = m.size * 10 * this.chain;
    let sx = 0, sy = 0; for (const i of m) { sx += i % this.n; sy += (i / this.n) | 0; }
    this.addScore(pts, this.ox + (sx / m.size) * this.cs + this.cs / 2, this.oy + (sy / m.size) * this.cs, this.chain > 1 ? COL.gold : COL.white);
    this.sfx(this.chain > 1 ? 'combo' : 'eat');
  }
  step(dt) {
    if (this.v.time && this.t >= this.v.time) return this.end(true, "TIME'S UP!");
    if (this.phase !== 'clear') return;
    this.timer -= dt; if (this.timer > 0) return;
    const n = this.n;
    for (const i of this.flash) { this.burst(this.ox + (i % n) * this.cs + this.cs / 2, this.oy + ((i / n) | 0) * this.cs + this.cs / 2, PIECES[this.b[i]], 3, 40); this.b[i] = -1; }
    for (let x = 0; x < n; x++) {
      const col = []; for (let y = n - 1; y >= 0; y--) if (this.b[x + y * n] >= 0) col.push(this.b[x + y * n]);
      for (let y = n - 1, k = 0; y >= 0; y--, k++) this.b[x + y * n] = k < col.length ? col[k] : irand(0, this.k - 1);
    }
    this.flash = new Set();
    this.resolve();
  }
  hud() { return { mid: this.v.moves ? `MOVES ${this.movesLeft}` : this.v.time ? `${Math.max(0, Math.ceil(this.v.time - this.t))}S` : 'GEMS' }; }
  draw(g) {
    const { cs, ox, oy, n } = this;
    rect(g, ox - 3, oy - 3, cs * n + 6, cs * n + 6, '#1d2a22');
    for (let i = 0; i < n * n; i++) {
      const v = this.b[i]; if (v < 0) continue;
      const x = ox + (i % n) * cs, y = oy + ((i / n) | 0) * cs;
      if ((i + ((i / n) | 0)) % 2) rect(g, x, y, cs, cs, '#16221a');
      const fl = this.flash.has(i) && ((this.time * 20) | 0) % 2;
      const c = fl ? COL.white : PIECES[v];
      const s = cs - 8, m = 4;
      if (v % 3 === 0) block(g, x + m, y + m, s, s, c);
      else if (v % 3 === 1) { for (let r = 0; r < s / 2; r++) rect(g, x + cs / 2 - r - 1, y + m + r, r * 2 + 2, 1, c); for (let r = 0; r < s / 2; r++) rect(g, x + m + r, y + cs / 2 + r, s - r * 2, 1, c); }
      else { rect(g, x + m + 2, y + m, s - 4, s, c); rect(g, x + m, y + m + 2, s, s - 4, c); rect(g, x + m + 3, y + m + 2, 3, 3, '#ffffff90'); }
    }
    cursorFrame(g, ox + this.cur.x * cs + 1, oy + this.cur.y * cs + 1, cs - 2, cs - 2, this.held ? this.time * 3 : this.time, this.held ? COL.white : COL.gold);
  }
}

// ---------------------------------------------------------------- SAME GAME
class Same extends ArcadeGame {
  init() {
    this.controls = 'D-PAD MOVE  A POP A GROUP';
    this.cols = this.v.cols || 15; this.rows = this.v.rows || 10; this.k = this.v.colors || 4;
    this.cs = Math.min(20, Math.floor(308 / this.cols), Math.floor(260 / this.rows));
    this.ox = (320 - this.cs * this.cols) / 2; this.oy = 272 - this.cs * this.rows - 6;
  }
  reset() { this.b = Array.from({ length: this.cols }, () => Array.from({ length: this.rows }, () => irand(0, this.k - 1))); this.cur = { x: 0, y: this.rows - 1 }; }
  group(x, y) {
    const v = this.b[x]?.[y]; if (v === undefined || v < 0) return [];
    const seen = new Set([x + ',' + y]), out = [[x, y]], st = [[x, y]];
    while (st.length) { const [cx, cy] = st.pop(); for (const [dx, dy] of Object.values(DIR)) { const nx = cx + dx, ny = cy + dy, k = nx + ',' + ny; if (!seen.has(k) && this.b[nx]?.[ny] === v) { seen.add(k); out.push([nx, ny]); st.push([nx, ny]); } } }
    return out;
  }
  onPress(b) {
    if (moveCursor(this.cur, b, this.cols, this.rows)) return this.sfx('turn');
    if (b !== 'a') return;
    const grp = this.group(this.cur.x, this.cur.y);
    if (grp.length < 2) { this.sfx('back'); return; }
    for (const [x, y] of grp) { this.burst(this.ox + x * this.cs + 8, this.oy + y * this.cs + 8, PIECES[this.b[x][y]], 2, 40); this.b[x][y] = -1; }
    const pts = (grp.length - 1) ** 2;
    this.addScore(pts, this.ox + this.cur.x * this.cs + 8, this.oy + this.cur.y * this.cs, grp.length > 8 ? COL.gold : COL.white);
    this.sfx(grp.length > 8 ? 'combo' : 'eat');
    // gravity: blocks fall down (bottom is high y), empty columns close up
    this.b = this.b.map((col) => { const keep = col.filter((v) => v >= 0); return [...Array(this.rows - keep.length).fill(-1), ...keep]; });
    const full = this.b.filter((col) => col.some((v) => v >= 0));
    while (full.length < this.cols) full.push(Array(this.rows).fill(-1));
    this.b = full;
    const left = this.b.flat().filter((v) => v >= 0).length;
    let any = false;
    for (let x = 0; x < this.cols && !any; x++) for (let y = 0; y < this.rows && !any; y++) if (this.b[x][y] >= 0 && this.group(x, y).length > 1) any = true;
    if (!left) { this.score += 1000; return this.end(true, 'BOARD CLEARED!'); }
    if (!any) { this.score = Math.max(0, this.score - left * 5); this.end(false, `${left} LEFT OVER`); }
  }
  step() {}
  hud() { return { mid: `${this.b.flat().filter((v) => v >= 0).length} BLOCKS` }; }
  draw(g) {
    const { cs, ox, oy } = this;
    const hl = new Set(this.group(this.cur.x, this.cur.y).map(([x, y]) => x + ',' + y));
    for (let x = 0; x < this.cols; x++) for (let y = 0; y < this.rows; y++) {
      const v = this.b[x][y]; if (v < 0) continue;
      block(g, ox + x * cs, oy + y * cs, cs, cs, hl.size > 1 && hl.has(x + ',' + y) && ((this.time * 6) | 0) % 2 ? COL.white : PIECES[v]);
    }
    cursorFrame(g, ox + this.cur.x * cs, oy + this.cur.y * cs, cs, cs, this.time);
  }
}

const KINDS = { match: Match3, same: Same };
export default { width: 320, height: 288, create: (api) => new (KINDS[api.variant?.kind] || Match3)(api) };
void module;
