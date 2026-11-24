// Board games vs the CPU:
//   kind 'row'      N IN A ROW (tic-tac-toe .. gomoku)  params: size, k, ai (0..1)
//   kind 'four'     DROP FOUR (connect four)            params: cols, rows, k, depth
//   kind 'reversi'  FLIP SIDES (reversi)                params: size, depth
import { ArcadeGame, COL, rect, block, disc, text, moveCursor, cursorFrame, shuffle } from './kit.js';

class BoardBase extends ArcadeGame {
  finish(winner) {
    if (winner === 1) { this.score = 1000 + this.bonus(); this.end(true, 'YOU WIN!'); }
    else if (winner === 2) { this.score = Math.max(0, this.bonus() / 4); this.end(false, 'CPU WINS'); }
    else { this.score = 300; this.end(true, 'DRAW'); }
  }
  bonus() { return 0; }
  step(dt) {
    if (this.turn === 2 && this.state === 'play') {
      this.think -= dt;
      if (this.think <= 0) { this.cpuMove(); }
    }
  }
}

// ---------------------------------------------------------------- N IN A ROW
class Row extends BoardBase {
  init() { this.n = this.v.size || 3; this.k = this.v.k || 3; this.cs = Math.floor(250 / this.n); this.ox = (320 - this.cs * this.n) / 2; this.oy = (272 - this.cs * this.n) / 2; this.controls = 'D-PAD MOVE  A PLACE'; }
  reset() { this.b = new Array(this.n * this.n).fill(0); this.turn = 1; this.cur = { x: this.n >> 1, y: this.n >> 1 }; this.winLine = null; this.moves = 0; }
  line(b, i, p) {
    const n = this.n, x = i % n, y = (i / n) | 0;
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      let c = 1, cells = [i];
      for (const s of [1, -1]) { let nx = x + dx * s, ny = y + dy * s; while (nx >= 0 && ny >= 0 && nx < n && ny < n && b[nx + ny * n] === p) { c++; cells.push(nx + ny * n); nx += dx * s; ny += dy * s; } }
      if (c >= this.k) return cells;
    }
    return null;
  }
  place(i, p) {
    this.b[i] = p; this.moves++; this.sfx(p === 1 ? 'move' : 'turn');
    const w = this.line(this.b, i, p);
    if (w) { this.winLine = w; return this.finish(p); }
    if (this.b.every(Boolean)) return this.finish(0);
    this.turn = 3 - p; this.think = 0.45;
  }
  bonus() { return Math.max(0, 300 - this.moves * 10); }
  onPress(b) {
    if (moveCursor(this.cur, b, this.n, this.n)) return this.sfx('turn');
    if (b === 'a' && this.turn === 1) { const i = this.cur.x + this.cur.y * this.n; if (!this.b[i]) this.place(i, 1); }
  }
  minimax(b, p, depth) {
    let best = p === 2 ? -9 : 9, any = false;
    for (let i = 0; i < b.length; i++) {
      if (b[i]) continue; any = true;
      b[i] = p;
      const v = this.line(b, i, p) ? (p === 2 ? 10 - depth : depth - 10) : this.minimax(b, 3 - p, depth + 1);
      b[i] = 0;
      best = p === 2 ? Math.max(best, v) : Math.min(best, v);
    }
    return any ? best : 0;
  }
  cpuMove() {
    const empty = this.b.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    const ai = this.v.ai ?? 0.8;
    let pickI;
    if (Math.random() > ai) pickI = shuffle(empty)[0];
    else if (this.n === 3) {
      let best = -99;
      for (const i of shuffle(empty)) { this.b[i] = 2; const v = this.line(this.b, i, 2) ? 10 : this.minimax(this.b, 1, 1); this.b[i] = 0; if (v > best) { best = v; pickI = i; } }
    } else {
      let best = -1;
      for (const i of shuffle(empty)) { const v = this.heur(i, 2) * 1.1 + this.heur(i, 1); if (v > best) { best = v; pickI = i; } }
    }
    this.place(pickI, 2);
  }
  heur(i, p) {
    const n = this.n, x = i % n, y = (i / n) | 0; let total = 0;
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      let c = 0, open = 0;
      for (const s of [1, -1]) { let nx = x + dx * s, ny = y + dy * s; while (nx >= 0 && ny >= 0 && nx < n && ny < n && this.b[nx + ny * n] === p) { c++; nx += dx * s; ny += dy * s; } if (nx >= 0 && ny >= 0 && nx < n && ny < n && !this.b[nx + ny * n]) open++; }
      if (c + 1 >= this.k) total += 100000; else total += (open ? 1 : 0.1) * 10 ** c * (open === 2 ? 2 : 1);
    }
    return total + (n - Math.abs(x - n / 2) - Math.abs(y - n / 2)) * 0.01;
  }
  hud() { return { mid: this.turn === 1 ? 'YOUR MOVE (X)' : 'CPU THINKING' }; }
  draw(g) {
    const { cs, ox, oy, n } = this;
    for (let k = 1; k < n; k++) { rect(g, ox + k * cs - 1, oy, 2, cs * n, COL.gb1); rect(g, ox, oy + k * cs - 1, cs * n, 2, COL.gb1); }
    this.b.forEach((v, i) => {
      const cx = ox + (i % n) * cs + cs / 2, cy = oy + ((i / n) | 0) * cs + cs / 2, r = Math.floor(cs * 0.32);
      const hl = this.winLine?.includes(i) && ((this.time * 6) | 0) % 2;
      if (v === 1) for (let k = -r; k <= r; k++) { rect(g, cx + k - 1, cy + k - 1, 3, 3, hl ? COL.white : COL.gold); rect(g, cx + k - 1, cy - k - 1, 3, 3, hl ? COL.white : COL.gold); }
      if (v === 2) { disc(g, cx, cy, r, hl ? COL.white : COL.red); disc(g, cx, cy, Math.max(1, r - 3), this.bg || COL.bg); }
    });
    if (this.turn === 1) cursorFrame(g, ox + this.cur.x * cs + 3, oy + this.cur.y * cs + 3, cs - 6, cs - 6, this.time);
  }
}

// ---------------------------------------------------------------- CONNECT FOUR
class Four extends BoardBase {
  init() { this.C = this.v.cols || 7; this.R = this.v.rows || 6; this.k = this.v.k || 4; this.cs = Math.min(34, Math.floor(300 / this.C), Math.floor(230 / this.R)); this.ox = (320 - this.cs * this.C) / 2; this.oy = 272 - this.cs * this.R - 8; this.controls = 'LEFT/RIGHT AIM  A DROP'; this.bg = '#0b1238'; }
  reset() { this.b = Array.from({ length: this.C }, () => []); this.turn = 1; this.col = this.C >> 1; this.win = null; this.moves = 0; }
  drop(b, c, p) { if (b[c].length >= this.R) return false; b[c].push(p); return true; }
  wins(b, c) {
    const r = b[c].length - 1, p = b[c][r];
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      const cells = [[c, r]];
      for (const s of [1, -1]) { let x = c + dx * s, y = r + dy * s; while (b[x]?.[y] === p) { cells.push([x, y]); x += dx * s; y += dy * s; } }
      if (cells.length >= this.k) return cells;
    }
    return null;
  }
  play(c, p) {
    if (!this.drop(this.b, c, p)) return false;
    this.moves++; this.sfx(p === 1 ? 'move' : 'turn'); this.lastDrop = { c, t: this.time };
    const w = this.wins(this.b, c);
    if (w) { this.win = w; this.finish(p); return true; }
    if (this.b.every((col) => col.length >= this.R)) { this.finish(0); return true; }
    this.turn = 3 - p; this.think = 0.5;
    return true;
  }
  bonus() { return Math.max(0, 400 - this.moves * 8); }
  onPress(b) {
    if (this.turn !== 1) return;
    if (b === 'left') { this.col = (this.col + this.C - 1) % this.C; this.sfx('turn'); }
    if (b === 'right') { this.col = (this.col + 1) % this.C; this.sfx('turn'); }
    if (b === 'a' || b === 'down') this.play(this.col, 1);
  }
  evalBoard(b) {
    let s = 0;
    const get = (x, y) => b[x]?.[y] ?? 0;
    for (let x = 0; x < this.C; x++) for (let y = 0; y < this.R; y++) for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      let a = 0, h = 0, ok = true;
      for (let i = 0; i < this.k; i++) { const xx = x + dx * i, yy = y + dy * i; if (xx < 0 || yy < 0 || xx >= this.C || yy >= this.R) { ok = false; break; } const v = get(xx, yy); if (v === 2) a++; else if (v === 1) h++; }
      if (!ok || (a && h)) continue;
      s += a ? 4 ** a : 0; s -= h ? 4 ** h * 1.2 : 0;
    }
    return s;
  }
  search(b, depth, p, alpha, beta) {
    let best = p === 2 ? -Infinity : Infinity, move = -1;
    const order = [...Array(this.C).keys()].sort((a, c) => Math.abs(a - this.C / 2) - Math.abs(c - this.C / 2));
    for (const c of order) {
      if (b[c].length >= this.R) continue;
      b[c].push(p);
      let v;
      if (this.wins(b, c)) v = p === 2 ? 1e6 + depth : -1e6 - depth;
      else if (depth === 0) v = this.evalBoard(b);
      else v = this.search(b, depth - 1, 3 - p, alpha, beta).v;
      b[c].pop();
      if (move < 0) move = c;
      if (p === 2 ? v > best : v < best) { best = v; move = c; }
      if (p === 2) alpha = Math.max(alpha, v); else beta = Math.min(beta, v);
      if (beta <= alpha) break;
    }
    return { v: move < 0 ? 0 : best, move };
  }
  cpuMove() {
    const { move } = this.search(this.b, this.v.depth ?? 4, 2, -Infinity, Infinity);
    const opts = [...Array(this.C).keys()].filter((c) => this.b[c].length < this.R);
    this.play(Math.random() < (this.v.blunder ?? 0) ? shuffle(opts)[0] : move, 2);
  }
  hud() { return { mid: this.turn === 1 ? 'YOUR DROP' : 'CPU THINKING' }; }
  draw(g) {
    const { cs, ox, oy } = this;
    rect(g, ox - 4, oy - 4, cs * this.C + 8, cs * this.R + 8, '#2a4cd0');
    for (let x = 0; x < this.C; x++) for (let y = 0; y < this.R; y++) {
      const v = this.b[x][y], cx = ox + x * cs + cs / 2, cy = oy + (this.R - 1 - y) * cs + cs / 2;
      let fall = 0;
      if (this.lastDrop?.c === x && y === this.b[x].length - 1) fall = Math.max(0, 1 - (this.time - this.lastDrop.t) * 6) * (this.R - y) * cs;
      const hl = this.win?.some(([a, b]) => a === x && b === y) && ((this.time * 6) | 0) % 2;
      disc(g, cx, cy, Math.floor(cs * 0.4), '#0b1238');
      if (v) disc(g, cx, cy - fall, Math.floor(cs * 0.4), hl ? COL.white : v === 1 ? COL.gold : COL.red);
    }
    if (this.turn === 1 && this.state === 'play') disc(g, ox + this.col * cs + cs / 2, oy - 14, Math.floor(cs * 0.35), COL.gold);
  }
}

// ---------------------------------------------------------------- REVERSI
const W8 = [[100, -20, 10, 5, 5, 10, -20, 100], [-20, -50, -2, -2, -2, -2, -50, -20], [10, -2, 1, 1, 1, 1, -2, 10], [5, -2, 1, 0, 0, 1, -2, 5], [5, -2, 1, 0, 0, 1, -2, 5], [10, -2, 1, 1, 1, 1, -2, 10], [-20, -50, -2, -2, -2, -2, -50, -20], [100, -20, 10, 5, 5, 10, -20, 100]];
class Reversi extends BoardBase {
  init() { this.n = this.v.size || 8; this.cs = Math.floor(256 / this.n); this.ox = (320 - this.cs * this.n) / 2; this.oy = (272 - this.cs * this.n) / 2; this.controls = 'D-PAD MOVE  A PLACE'; }
  reset() {
    const n = this.n, m = n / 2; this.b = Array.from({ length: n }, () => new Array(n).fill(0));
    this.b[m - 1][m - 1] = 2; this.b[m][m] = 2; this.b[m - 1][m] = 1; this.b[m][m - 1] = 1;
    this.turn = 1; this.cur = { x: m, y: m - 2 }; this.passes = 0;
  }
  flips(b, x, y, p) {
    if (b[y][x]) return [];
    const out = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const run = []; let nx = x + dx, ny = y + dy;
      while (b[ny]?.[nx] === 3 - p) { run.push([nx, ny]); nx += dx; ny += dy; }
      if (run.length && b[ny]?.[nx] === p) out.push(...run);
    }
    return out;
  }
  moves(b, p) { const m = []; for (let y = 0; y < this.n; y++) for (let x = 0; x < this.n; x++) { const f = this.flips(b, x, y, p); if (f.length) m.push({ x, y, f }); } return m; }
  apply(b, mv, p) { const c = b.map((r) => [...r]); c[mv.y][mv.x] = p; for (const [x, y] of mv.f) c[y][x] = p; return c; }
  count(p) { return this.b.flat().filter((v) => v === p).length; }
  advance() {
    const next = 3 - this.turn;
    if (this.moves(this.b, next).length) { this.turn = next; }
    else if (!this.moves(this.b, this.turn).length) {
      const a = this.count(1), c = this.count(2);
      this.bonusV = a * 10;
      return this.finish(a > c ? 1 : a < c ? 2 : 0);
    } else this.popups.add(next === 1 ? 'YOU PASS' : 'CPU PASSES', 160, 120, COL.blue);
    this.think = 0.5;
  }
  bonus() { return this.bonusV || 0; }
  onPress(b) {
    if (moveCursor(this.cur, b, this.n, this.n)) return this.sfx('turn');
    if (b !== 'a' || this.turn !== 1) return;
    const f = this.flips(this.b, this.cur.x, this.cur.y, 1);
    if (!f.length) { this.sfx('back'); return; }
    this.b = this.apply(this.b, { x: this.cur.x, y: this.cur.y, f }, 1); this.sfx('move');
    this.advance();
  }
  value(b) { let s = 0; for (let y = 0; y < this.n; y++) for (let x = 0; x < this.n; x++) { const w = this.n === 8 ? W8[y][x] : (x % (this.n - 1) === 0 && y % (this.n - 1) === 0 ? 50 : 1); if (b[y][x] === 2) s += w; else if (b[y][x] === 1) s -= w; } return s; }
  cpuMove() {
    const ms = this.moves(this.b, 2);
    if (!ms.length) return this.advance();
    const depth = this.v.depth ?? 2;
    let best = -Infinity, pickM = ms[0];
    for (const m of shuffle(ms)) {
      const nb = this.apply(this.b, m, 2);
      let v = this.value(nb);
      if (depth > 1) { const replies = this.moves(nb, 1); if (replies.length) v = Math.min(...replies.map((r) => this.value(this.apply(nb, r, 1)))); }
      if (depth === 0) v = m.f.length + Math.random() * 3;
      if (v > best) { best = v; pickM = m; }
    }
    this.b = this.apply(this.b, pickM, 2); this.sfx('turn');
    this.advance();
  }
  hud() { return { mid: `YOU ${this.count(1)}  CPU ${this.count(2)}` }; }
  draw(g) {
    const { cs, ox, oy, n } = this;
    rect(g, ox - 3, oy - 3, cs * n + 6, cs * n + 6, '#1a4a22');
    const hints = this.turn === 1 && this.state === 'play' ? this.moves(this.b, 1) : [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      rect(g, ox + x * cs, oy + y * cs, cs - 1, cs - 1, '#2e7a3a');
      const v = this.b[y][x], cx = ox + x * cs + cs / 2, cy = oy + y * cs + cs / 2;
      if (v) disc(g, cx, cy, Math.floor(cs * 0.38), v === 1 ? COL.white : COL.ink);
      else if (hints.some((h) => h.x === x && h.y === y)) rect(g, cx - 1, cy - 1, 3, 3, '#5fae3f');
    }
    cursorFrame(g, ox + this.cur.x * cs, oy + this.cur.y * cs, cs - 1, cs - 1, this.time);
  }
}

const KINDS = { row: Row, four: Four, reversi: Reversi };
export default { width: 320, height: 288, create: (api) => new (KINDS[api.variant?.kind] || Row)(api) };
void block; void text;
