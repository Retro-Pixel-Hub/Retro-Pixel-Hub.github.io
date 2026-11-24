// ROAD HOPPER — cross roads and rivers. Params: lanes (pattern string), speed, lives, homes
// lane codes: g grass (safe), r road (cars), w water (logs), t train (fast, rare)
import { ArcadeGame, module, COL, rect, block, rand, irand, pick } from './kit.js';

const C = 16, COLS = 20;

class Hopper extends ArcadeGame {
  init() { this.controls = 'D-PAD HOP'; }
  reset() { this.level = 1; this.lives = this.v.lives ?? 3; this.build(); }
  build() {
    const pattern = (this.v.lanes || 'grrrgwwwg').split('');
    // fill to 17 rows: home row at top, start row at bottom
    this.rows = ['h', ...pattern, ...Array(Math.max(0, 15 - pattern.length)).fill('g'), 's'].slice(0, 17);
    this.lanes = this.rows.map((type, i) => {
      const dir = i % 2 ? 1 : -1;
      const sp = (this.v.speed || 40) * rand(0.7, 1.4) * (1 + (this.level - 1) * 0.15);
      const items = [];
      if (type === 'r' || type === 'w' || type === 't') {
        const len = type === 'w' ? irand(3, 5) : type === 't' ? 12 : irand(1, 2);
        const gap = type === 'w' ? irand(3, 5) : type === 't' ? 30 : irand(3, 6);
        for (let x = rand(0, 4); x < COLS + 4; x += len + gap) items.push({ x: x * C, w: len * C, c: pick([COL.red, COL.blue, COL.gold, COL.purple, COL.orange]) });
      }
      return { type, dir, sp: type === 't' ? sp * 4 : sp, items };
    });
    this.homes = Array.from({ length: this.v.homes || 5 }, (_, i) => ({ x: Math.round((i + 0.5) * (COLS / (this.v.homes || 5))), filled: false }));
    this.respawn();
  }
  respawn() { this.fx_ = 0; this.px = 10; this.py = 16; this.ox = 0; this.maxY = 16; this.timer = 30; }
  onPress(b) {
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[b];
    if (!d) return;
    const nx = Math.round((this.px * C + this.ox) / C) + d[0], ny = this.py + d[1];
    if (nx < 0 || nx >= COLS || ny > 16) return;
    this.px = nx; this.ox = 0; this.py = ny; this.sfx('turn'); this.hopT = 0.1;
    if (ny < this.maxY) { this.maxY = ny; this.addScore(10); }
    if (ny === 0) this.reachHome();
  }
  reachHome() {
    const h = this.homes.find((h) => !h.filled && Math.abs(h.x - this.px) <= 1);
    if (!h) return this.die('MISSED THE NEST');
    h.filled = true; this.addScore(100 + Math.ceil(this.timer) * 5, h.x * C + 8, 4, COL.gold); this.sfx('golden');
    if (this.homes.every((x) => x.filled)) { this.level++; this.sfx('levelup'); if (this.v.levels && this.level > this.v.levels) return this.end(true, 'ALL HOME!'); this.build(); }
    else this.respawn();
  }
  die(msg) {
    this.lives--; this.shake.add(3, 0.2); this.burst(this.px * C + this.ox + 8, this.py * C + 8, [COL.mint, COL.green, COL.white], 14, 70); this.sfx('die'); this.buzz(30);
    if (this.lives <= 0) return this.end(false, msg);
    this.respawn();
  }
  step(dt) {
    this.timer -= dt; this.hopT = Math.max(0, (this.hopT || 0) - dt);
    if (this.timer <= 0) return this.die('TOO SLOW');
    for (const lane of this.lanes) for (const it of lane.items) {
      it.x += lane.dir * lane.sp * dt;
      const span = (COLS + 8) * C;
      if (lane.dir > 0 && it.x > COLS * C + 32) it.x -= span;
      if (lane.dir < 0 && it.x + it.w < -32) it.x += span;
    }
    const lane = this.lanes[this.py];
    const fx = this.px * C + this.ox + 3, fw = 10;
    if (lane.type === 'r' || lane.type === 't') {
      if (lane.items.some((it) => fx < it.x + it.w - 2 && fx + fw > it.x + 2)) return this.die('SPLAT!');
    } else if (lane.type === 'w') {
      const log = lane.items.find((it) => fx + fw / 2 > it.x && fx + fw / 2 < it.x + it.w);
      if (!log) return this.die('SPLASH!');
      this.ox += lane.dir * lane.sp * dt;
      const ax = this.px * C + this.ox;
      if (ax < -6 || ax > (COLS - 1) * C + 6) return this.die('SWEPT AWAY');
    }
  }
  hud() { return { mid: `LV${this.level} LIFE ${this.lives} T${Math.ceil(this.timer)}` }; }
  draw(g) {
    this.lanes.forEach((lane, y) => {
      const col = { g: COL.green, s: COL.green, h: '#2f6e2a', r: '#3b3f45', w: '#2a5d9c', t: '#5a4a3a' }[lane.type];
      rect(g, 0, y * C, 320, C, col);
      if (lane.type === 'r') for (let x = 4; x < 320; x += 24) rect(g, x, y * C + 7, 10, 2, '#c9c9b0');
      if (lane.type === 't') for (let x = 0; x < 320; x += 8) rect(g, x, y * C + 3, 4, 10, '#7a5a3a');
      if (lane.type === 'g' || lane.type === 's') for (let x = (y * 7) % 13; x < 320; x += 29) rect(g, x, y * C + 5, 2, 2, '#4a9233');
      for (const it of lane.items) {
        if (lane.type === 'w') { block(g, it.x, y * C + 2, it.w, 12, '#8e6234'); for (let k = 8; k < it.w; k += 16) rect(g, it.x + k, y * C + 5, 4, 1, '#6a4428'); }
        else if (lane.type === 't') block(g, it.x, y * C + 1, it.w, 14, COL.grey);
        else { block(g, it.x + 1, y * C + 2, it.w - 2, 12, it.c); rect(g, it.x + (lane.dir > 0 ? it.w - 6 : 3), y * C + 4, 3, 8, '#cfeaff'); }
      }
    });
    for (const h of this.homes) { rect(g, h.x * C - 2, 0, 20, 16, '#1f4a1c'); if (h.filled) block(g, h.x * C + 2, 2, 12, 12, COL.mint); }
    const x = this.px * C + this.ox, y = this.py * C - (this.hopT > 0 ? 3 : 0);
    block(g, x + 3, y + 3, 10, 10, COL.mint);
    rect(g, x + 4, y + 4, 2, 2, COL.ink); rect(g, x + 10, y + 4, 2, 2, COL.ink);
  }
}
export default module(Hopper);
