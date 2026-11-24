// STAR DEFENSE — fixed shooter. Params: rows, cols, speed, fire (enemy shots/sec), shields, lives, dive (divers), waves
import { ArcadeGame, module, COL, PIECES, rect, block, clamp, rand, pick } from './kit.js';

const ALIENS = [
  ['00100100', '00011000', '01111110', '11011011', '11111111', '01011010'],
  ['00011000', '00111100', '01111110', '11011011', '11111111', '00100100'],
  ['10000001', '01111110', '11011011', '11111111', '01100110', '11000011'],
];
function sprite(g, rows, x, y, c, frame) {
  g.fillStyle = c;
  rows.forEach((r, j) => { for (let i = 0; i < 8; i++) if (r[i] === '1') g.fillRect(x + i * 2, y + j * 2 + (frame && j > 4 ? 1 : 0), 2, 2); });
}

class Invaders extends ArcadeGame {
  init() { this.controls = 'LEFT/RIGHT MOVE  A FIRE'; this.bg = '#070b14'; this.stars = Array.from({ length: 50 }, () => [rand(0, 320), rand(0, 272), rand(10, 40)]); }
  reset() { this.wave = 1; this.lives = this.v.lives ?? 3; this.x = 152; this.build(); }
  build() {
    const rows = this.v.rows || 4, cols = this.v.cols || 8;
    this.aliens = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) this.aliens.push({ x: 24 + c * 28, y: 24 + r * 20, kind: r % 3, c: PIECES[(r + this.wave) % 7], alive: true, dive: null });
    this.dx = 1; this.shots = []; this.bombs = []; this.cool = 0; this.inv = 1.5;
    this.shields = [];
    const n = this.v.shields ?? 3;
    for (let s = 0; s < n; s++) {
      const sx = Math.round((320 * (s + 1)) / (n + 1));
      for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) this.shields.push({ x: sx - 12 + i * 4, y: 222 + j * 4, hp: 2 });
    }
  }
  onPress(b) {
    if ((b === 'a' || b === 'up') && this.cool <= 0 && this.shots.length < (this.v.shots || 2)) {
      this.shots.push({ x: this.x + 7, y: 246 }); this.cool = 0.25; this.sfx('move');
    }
  }
  step(dt) {
    for (const s of this.stars) { s[1] += s[2] * dt; if (s[1] > 272) s[1] = 0; }
    const dir = (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
    this.x = clamp(this.x + dir * 140 * dt, 4, 300);
    this.cool -= dt; this.inv -= dt;
    const alive = this.aliens.filter((a) => a.alive);
    const speed = (this.v.speed || 14) * (1 + (1 - alive.length / this.aliens.length) * 3) * (1 + (this.wave - 1) * 0.15);
    let edge = false;
    for (const a of alive) if (!a.dive) { a.x += this.dx * speed * dt; if (a.x < 6 || a.x > 298) edge = true; }
    if (edge) { this.dx *= -1; for (const a of alive) if (!a.dive) { a.y += 8; a.x += this.dx * 2; } }
    // divers
    if (this.v.dive && Math.random() < dt * this.v.dive) {
      const a = pick(alive); if (a && !a.dive) a.dive = { t: 0, ox: a.x, oy: a.y };
    }
    for (const a of alive) if (a.dive) {
      a.dive.t += dt; a.y += 90 * dt; a.x += Math.sin(a.dive.t * 4) * 80 * dt;
      if (a.y > 272) { a.y = a.dive.oy; a.x = a.dive.ox; a.dive = null; }
    }
    // enemy fire
    if (alive.length && Math.random() < dt * (this.v.fire || 0.8) * (1 + this.wave * 0.2)) {
      const a = pick(alive); this.bombs.push({ x: a.x + 7, y: a.y + 12 });
    }
    for (const s of this.shots) s.y -= 260 * dt;
    for (const bm of this.bombs) bm.y += 110 * dt;
    // collisions
    for (const s of this.shots) {
      for (const a of alive) if (a.alive && s.x >= a.x && s.x <= a.x + 16 && s.y >= a.y && s.y <= a.y + 12) {
        a.alive = false; s.y = -99; this.addScore((3 - a.kind) * 10 * this.wave, a.x + 8, a.y, COL.white);
        this.burst(a.x + 8, a.y + 6, a.c, 10, 70); this.sfx('pop');
      }
      for (const sh of this.shields) if (sh.hp > 0 && s.x >= sh.x && s.x < sh.x + 4 && s.y >= sh.y && s.y < sh.y + 4) { sh.hp--; s.y = -99; }
    }
    for (const bm of this.bombs) {
      for (const sh of this.shields) if (sh.hp > 0 && bm.x >= sh.x && bm.x < sh.x + 4 && bm.y >= sh.y && bm.y < sh.y + 4) { sh.hp--; bm.y = 999; }
      if (this.inv <= 0 && bm.y > 244 && bm.y < 256 && bm.x > this.x && bm.x < this.x + 16) { bm.y = 999; this.hit(); }
    }
    for (const a of alive) {
      if (a.alive && this.inv <= 0 && a.y + 12 > 244 && a.x + 16 > this.x && a.x < this.x + 16) { a.alive = false; this.hit(); }
      if (a.alive && !a.dive && a.y > 230) return this.end(false, 'INVADED!');
    }
    this.shots = this.shots.filter((s) => s.y > -10);
    this.bombs = this.bombs.filter((b) => b.y < 280);
    if (this.aliens.every((a) => !a.alive)) {
      this.addScore(200 * this.wave, 160, 120, COL.gold); this.wave++; this.sfx('levelup');
      if (this.v.waves && this.wave > this.v.waves) return this.end(true, 'GALAXY SAVED');
      this.build();
    }
  }
  hit() {
    this.lives--; this.inv = 1.5; this.shake.add(4, 0.3); this.burst(this.x + 8, 250, [COL.orange, COL.gold, COL.white], 20, 90); this.sfx('die'); this.buzz(40);
    if (this.lives <= 0) this.end(false, 'SHIP LOST');
  }
  hud() { return { mid: `W${this.wave} SHIP ${this.lives}` }; }
  draw(g) {
    for (const s of this.stars) rect(g, s[0], s[1], 1, 1, s[2] > 25 ? COL.white : COL.dim);
    const frame = ((this.time * 3) | 0) % 2;
    for (const a of this.aliens) if (a.alive) sprite(g, ALIENS[a.kind], a.x, a.y, a.c, frame);
    for (const sh of this.shields) if (sh.hp > 0) rect(g, sh.x, sh.y, 4, 4, sh.hp > 1 ? COL.green : COL.gb1);
    for (const s of this.shots) rect(g, s.x, s.y, 2, 6, COL.gold);
    for (const b of this.bombs) rect(g, b.x, b.y, 2, 5, ((this.time * 12) | 0) % 2 ? COL.red : COL.white);
    if (this.inv <= 0 || ((this.time * 10) | 0) % 2) {
      block(g, this.x, 250, 16, 6, COL.blue); rect(g, this.x + 6, 245, 4, 5, COL.blue); rect(g, this.x + 7, 244, 2, 2, COL.white);
    }
  }
}
export default module(Invaders);
