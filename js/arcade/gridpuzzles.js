// Small grid puzzles sharing one file to keep requests low:
//   kind 'lights'  LIGHTS OUT   params: size, wrap, scramble
//   kind 'slide'   SLIDING TILES params: size
//   kind 'memory'  MEMORY MATCH  params: cols, rows, time
//   kind 'simon'   ECHO (Simon) params: speed, colors, target
import { ArcadeGame, module, COL, PIECES, rect, block, text, disc, moveCursor, cursorFrame, shuffle, irand } from './kit.js';

// ---------------------------------------------------------------- LIGHTS OUT
class Lights extends ArcadeGame {
  init() { this.controls = 'D-PAD MOVE  A TOGGLE'; this.n = this.v.size || 5; this.cs = Math.floor(240 / this.n); this.ox = (320 - this.cs * this.n) / 2; this.oy = (272 - this.cs * this.n) / 2; }
  reset() { this.level = 1; this.build(); }
  build() {
    this.on = new Uint8Array(this.n * this.n); this.moves = 0; this.cur = { x: this.n >> 1, y: this.n >> 1 };
    const k = (this.v.scramble || 6) + this.level * 2;
    for (let i = 0; i < k; i++) this.toggle(irand(0, this.n - 1), irand(0, this.n - 1));
    if (!this.on.some(Boolean)) this.toggle(0, 0);
  }
  toggle(x, y) {
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let nx = x + dx, ny = y + dy;
      if (this.v.wrap) { nx = (nx + this.n) % this.n; ny = (ny + this.n) % this.n; } else if (nx < 0 || ny < 0 || nx >= this.n || ny >= this.n) continue;
      this.on[nx + ny * this.n] ^= 1;
    }
  }
  onPress(b) {
    if (moveCursor(this.cur, b, this.n, this.n)) return this.sfx('turn');
    if (b !== 'a') return;
    this.toggle(this.cur.x, this.cur.y); this.moves++; this.sfx('move');
    if (!this.on.some(Boolean)) {
      this.addScore(Math.max(30, 200 - this.moves * 5) * this.level, 160, 120, COL.gold); this.sfx('levelup'); this.level++;
      if (this.level > (this.v.levels || 5)) return this.end(true, 'LIGHTS OUT!');
      this.build();
    }
  }
  step() {}
  hud() { return { mid: `LV${this.level} MOVES ${this.moves}` }; }
  draw(g) {
    const { cs, ox, oy, n } = this;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const on = this.on[x + y * n];
      block(g, ox + x * cs + 3, oy + y * cs + 3, cs - 6, cs - 6, on ? COL.gold : '#2a3a2e');
      if (on) rect(g, ox + x * cs + 8, oy + y * cs + 8, 4, 4, COL.white);
    }
    cursorFrame(g, ox + this.cur.x * cs + 3, oy + this.cur.y * cs + 3, cs - 6, cs - 6, this.time, COL.blue);
  }
}

// ---------------------------------------------------------------- SLIDING TILES
class Slide extends ArcadeGame {
  init() { this.controls = 'D-PAD SLIDE A TILE INTO THE GAP'; this.n = this.v.size || 4; this.cs = Math.floor(244 / this.n); this.ox = (320 - this.cs * this.n) / 2; this.oy = (272 - this.cs * this.n) / 2; }
  reset() {
    const n = this.n; this.t2 = [...Array(n * n).keys()].map((i) => (i + 1) % (n * n)); this.moves = 0;
    this.hole = n * n - 1;
    for (let i = 0; i < n * n * 30; i++) this.shift(['up', 'down', 'left', 'right'][irand(0, 3)], true);
  }
  shift(b, quiet) {
    const n = this.n, hx = this.hole % n, hy = (this.hole / n) | 0;
    const src = { up: [hx, hy + 1], down: [hx, hy - 1], left: [hx + 1, hy], right: [hx - 1, hy] }[b];
    if (!src) return false;
    const [sx, sy] = src;
    if (sx < 0 || sy < 0 || sx >= n || sy >= n) return false;
    const si = sx + sy * n;
    this.t2[this.hole] = this.t2[si]; this.t2[si] = 0; this.hole = si;
    if (!quiet) { this.moves++; this.sfx('turn'); }
    return true;
  }
  onPress(b) {
    if (!this.shift(b)) return;
    if (this.t2.every((v, i) => v === (i + 1) % (this.n * this.n))) {
      this.score = Math.max(100, Math.round(this.n * this.n * 120 - this.moves * 3 - this.t * 2));
      this.end(true, 'SOLVED!');
    }
  }
  step() {}
  hud() { return { left: `${Math.floor(this.t)}S`, mid: `MOVES ${this.moves}` }; }
  draw(g) {
    const { cs, ox, oy, n } = this;
    rect(g, ox - 4, oy - 4, cs * n + 8, cs * n + 8, '#2a3a2e');
    this.t2.forEach((v, i) => {
      if (!v) return;
      const x = i % n, y = (i / n) | 0, right = v === i + 1;
      block(g, ox + x * cs + 2, oy + y * cs + 2, cs - 4, cs - 4, right ? COL.mint : PIECES[Math.floor((v - 1) / n) % 7]);
      text(g, String(v), ox + x * cs + cs / 2, oy + y * cs + cs / 2 - (cs > 50 ? 8 : 4), { size: cs > 50 ? 16 : 8, color: COL.ink, align: 'center' });
    });
  }
}

// ---------------------------------------------------------------- MEMORY
const SYMBOLS = ['00011000011111101111111111111111011111100011110000011000', '0001100000111100011111101111111111111111000110000011110001111110', '0000000001100110111111111111111101111110001111000001100000000000', '0001100000011000111111110111111000111100011001101100001100000000', '0011110001111110110110111111111111111111011001100011110000000000', '1111111110000001101111011010010110100101101111011000000111111111', '0001100000111100011001101100001111000011011001100011110000011000', '0000000000111100011111100111111001111110011111100011110000000000', '1000000111000011011001100011110000111100011001101100001110000001', '0001100000111100011111101111111100011000000110000001100000011000', '0011100001111100011111000011111000011110001111100111110001111000', '0110011011111111111111111111111101111110001111000001100000000000'];
class Memory extends ArcadeGame {
  init() {
    this.controls = 'D-PAD MOVE  A FLIP';
    this.cols = this.v.cols || 4; this.rows = this.v.rows || 4;
    this.cw = Math.min(56, Math.floor(300 / this.cols)); this.ch = Math.min(56, Math.floor(260 / this.rows));
    this.ox = (320 - this.cw * this.cols) / 2; this.oy = (272 - this.ch * this.rows) / 2;
  }
  reset() {
    const pairs = (this.cols * this.rows) / 2;
    this.cards = shuffle([...Array(pairs).keys(), ...Array(pairs).keys()]).map((s) => ({ s, up: false, done: false }));
    this.sel = []; this.cur = { x: 0, y: 0 }; this.wait = 0; this.tries = 0; this.combo = 0;
  }
  onPress(b) {
    if (moveCursor(this.cur, b, this.cols, this.rows)) return this.sfx('turn');
    if (b !== 'a' || this.wait > 0) return;
    const c = this.cards[this.cur.x + this.cur.y * this.cols];
    if (c.up || c.done) return;
    c.up = true; this.sel.push(c); this.sfx('move');
    if (this.sel.length === 2) {
      this.tries++;
      const [a, d] = this.sel;
      if (a.s === d.s) {
        a.done = d.done = true; this.sel = []; this.combo++;
        this.addScore(20 * this.combo, 160, 20, COL.gold); this.sfx('eat');
        if (this.cards.every((k) => k.done)) { this.score += Math.max(0, Math.round(this.cards.length * 20 - this.t * 2)); this.end(true, 'ALL PAIRS!'); }
      } else { this.wait = 0.7; this.combo = 0; }
    }
  }
  step(dt) {
    if (this.v.time && this.t > this.v.time) return this.end(false, "TIME'S UP");
    if (this.wait > 0) { this.wait -= dt; if (this.wait <= 0) { for (const c of this.sel) c.up = false; this.sel = []; this.sfx('back'); } }
  }
  hud() { return { mid: this.v.time ? `${Math.max(0, Math.ceil(this.v.time - this.t))}S` : `TRIES ${this.tries}` }; }
  draw(g) {
    const { cw, ch, ox, oy } = this;
    this.cards.forEach((c, i) => {
      const x = ox + (i % this.cols) * cw + 3, y = oy + Math.floor(i / this.cols) * ch + 3, w = cw - 6, h = ch - 6;
      if (c.up || c.done) {
        block(g, x, y, w, h, c.done ? '#2a3a2e' : '#f7f3e3');
        const sym = SYMBOLS[c.s % SYMBOLS.length], col = PIECES[c.s % 7], s = Math.max(2, Math.floor(Math.min(w, h) / 12));
        for (let k = 0; k < sym.length; k++) if (sym[k] === '1') rect(g, x + w / 2 - 4 * s + (k % 8) * s, y + h / 2 - 4 * s + Math.floor(k / 8) * s, s, s, c.done ? COL.dim : col);
        if (c.s >= SYMBOLS.length) rect(g, x + 3, y + 3, 4, 4, col);
      } else { block(g, x, y, w, h, COL.navy); rect(g, x + 4, y + 4, w - 8, h - 8, '#2c5f88'); }
    });
    cursorFrame(g, ox + this.cur.x * cw + 3, oy + this.cur.y * ch + 3, cw - 6, ch - 6, this.time);
  }
}

// ---------------------------------------------------------------- SIMON / ECHO
class Simon extends ArcadeGame {
  init() { this.controls = 'REPEAT WITH THE D-PAD'; this.keys = ['up', 'right', 'down', 'left']; }
  reset() { this.seq = []; this.idx = 0; this.mode = 'show'; this.lit = -1; this.timer = 0.8; }
  onStart() { this.seq = [irand(0, 3)]; this.mode = 'show'; this.idx = 0; this.timer = 0.8; }
  tone(i) { if (!this.api.settings.sound) return; const f = [330, 415, 494, 554][i]; this.api.audio.tone({ freq: f, dur: 0.22, vol: 0.4, type: 'square' }); }
  onPress(b) {
    if (this.mode !== 'input') return;
    const i = this.keys.indexOf(b); if (i < 0) return;
    this.lit = i; this.litT = 0.2; this.tone(i);
    if (i !== this.seq[this.idx]) return this.end(false, `LENGTH ${this.seq.length - 1}`);
    this.idx++;
    if (this.idx >= this.seq.length) {
      this.addScore(this.seq.length * 10, 160, 120, COL.gold);
      if (this.v.target && this.seq.length >= this.v.target) return this.end(true, 'PERFECT MEMORY');
      this.seq.push(irand(0, 3)); this.mode = 'show'; this.idx = 0; this.timer = 0.9;
    }
  }
  step(dt) {
    this.litT = (this.litT || 0) - dt; if (this.litT <= 0 && this.mode === 'input') this.lit = -1;
    if (this.mode !== 'show') return;
    this.timer -= dt;
    if (this.timer <= 0) {
      const gap = Math.max(0.18, (this.v.speed || 0.55) - this.seq.length * 0.02);
      if (this.lit >= 0) { this.lit = -1; this.timer = gap * 0.4; return; }
      if (this.idx >= this.seq.length) { this.mode = 'input'; this.idx = 0; return; }
      this.lit = this.seq[this.idx++]; this.tone(this.lit); this.timer = gap;
    }
  }
  hud() { return { mid: this.mode === 'show' ? 'WATCH...' : 'YOUR TURN' }; }
  draw(g) {
    const pads = [[160, 70], [230, 136], [160, 202], [90, 136]];
    const cols = this.v.mono ? [COL.gb2, COL.gb2, COL.gb2, COL.gb2] : [COL.mint, COL.red, COL.gold, COL.blue];
    pads.forEach(([x, y], i) => disc(g, x, y, 34, this.lit === i ? COL.white : cols[i]));
    pads.forEach(([x, y], i) => { if (this.lit !== i) disc(g, x, y, 28, '#00000030'); });
    disc(g, 160, 136, 22, COL.ink);
    text(g, String(this.seq.length), 160, 132, { color: COL.white, align: 'center' });
  }
}

const KINDS = { lights: Lights, slide: Slide, memory: Memory, simon: Simon };
export default {
  width: 320, height: 288,
  create: (api) => new (KINDS[api.variant?.kind] || Lights)(api),
};
