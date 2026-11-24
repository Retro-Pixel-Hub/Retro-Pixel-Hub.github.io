// ROCK BLASTER — drift, rotate and shoot space rocks. Params: rocks, speed, lives, ufo, drag
import { ArcadeGame, module, COL, rect, rand } from './kit.js';

const wrapX = (x) => (x + 320) % 320, wrapY = (y) => (y + 272) % 272;

class Rocks extends ArcadeGame {
  init() { this.controls = 'L/R TURN  UP THRUST  A FIRE'; this.bg = '#05070d'; }
  reset() {
    this.ship = { x: 160, y: 136, vx: 0, vy: 0, a: -Math.PI / 2 };
    this.lives = this.v.lives ?? 3; this.wave = 0; this.shots = []; this.rocks = []; this.inv = 2; this.cool = 0;
    this.nextWave();
  }
  nextWave() {
    this.wave++;
    const n = (this.v.rocks || 4) + this.wave - 1;
    for (let i = 0; i < n; i++) {
      let x, y;
      do { x = rand(0, 320); y = rand(0, 272); } while (Math.hypot(x - this.ship.x, y - this.ship.y) < 80);
      this.addRock(x, y, 3);
    }
  }
  addRock(x, y, size) {
    const a = rand(0, Math.PI * 2), sp = (this.v.speed || 30) * (4 - size) * rand(0.6, 1.2);
    const pts = Array.from({ length: 9 }, (_, i) => [(i / 9) * Math.PI * 2, rand(0.7, 1.1)]);
    this.rocks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: size * 7, size, pts });
  }
  onPress(b) {
    if (b === 'a' && this.cool <= 0 && this.shots.length < 5) {
      const s = this.ship;
      this.shots.push({ x: s.x + Math.cos(s.a) * 8, y: s.y + Math.sin(s.a) * 8, vx: Math.cos(s.a) * 220 + s.vx, vy: Math.sin(s.a) * 220 + s.vy, life: 0.9 });
      this.cool = 0.15; this.sfx('move');
    }
  }
  step(dt) {
    const s = this.ship;
    if (this.isDown('left')) s.a -= 4 * dt;
    if (this.isDown('right')) s.a += 4 * dt;
    this.thrust = this.isDown('up');
    if (this.thrust) { s.vx += Math.cos(s.a) * 160 * dt; s.vy += Math.sin(s.a) * 160 * dt; }
    const drag = this.v.drag ?? 0.6;
    s.vx *= 1 - drag * dt; s.vy *= 1 - drag * dt;
    s.x = wrapX(s.x + s.vx * dt); s.y = wrapY(s.y + s.vy * dt);
    this.cool -= dt; this.inv -= dt;
    for (const b of this.shots) { b.x = wrapX(b.x + b.vx * dt); b.y = wrapY(b.y + b.vy * dt); b.life -= dt; }
    for (const r of this.rocks) { r.x = wrapX(r.x + r.vx * dt); r.y = wrapY(r.y + r.vy * dt); }
    const split = [];
    for (const r of this.rocks) {
      for (const b of this.shots) if (b.life > 0 && Math.hypot(b.x - r.x, b.y - r.y) < r.r) {
        b.life = 0; r.dead = true;
        this.addScore([0, 100, 50, 20][r.size], r.x, r.y - 6);
        this.burst(r.x, r.y, [COL.grey, COL.white, COL.brown], 6 + r.size * 3, 60); this.sfx('pop');
        if (r.size > 1) split.push(r);
        break;
      }
      if (!r.dead && this.inv <= 0 && Math.hypot(s.x - r.x, s.y - r.y) < r.r + 4) {
        this.lives--; this.inv = 2; this.shake.add(5, 0.3); this.burst(s.x, s.y, [COL.orange, COL.gold], 24, 100); this.sfx('die'); this.buzz(40);
        s.x = 160; s.y = 136; s.vx = s.vy = 0;
        if (this.lives <= 0) return this.end(false, 'SHIP DESTROYED');
      }
    }
    for (const r of split) { this.addRock(r.x, r.y, r.size - 1); this.addRock(r.x, r.y, r.size - 1); }
    this.rocks = this.rocks.filter((r) => !r.dead);
    this.shots = this.shots.filter((b) => b.life > 0);
    if (!this.rocks.length) { this.addScore(250 * this.wave, 160, 120, COL.gold); this.sfx('levelup'); this.inv = 1.5; this.nextWave(); }
  }
  hud() { return { mid: `W${this.wave} SHIP ${this.lives}` }; }
  line(g, x0, y0, x1, y1, c) {
    g.fillStyle = c;
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
    for (let i = 0; i <= n; i++) g.fillRect(Math.round(x0 + ((x1 - x0) * i) / (n || 1)), Math.round(y0 + ((y1 - y0) * i) / (n || 1)), 1, 1);
  }
  draw(g) {
    for (const r of this.rocks) {
      for (let i = 0; i < r.pts.length; i++) {
        const [a0, m0] = r.pts[i], [a1, m1] = r.pts[(i + 1) % r.pts.length];
        this.line(g, r.x + Math.cos(a0) * r.r * m0, r.y + Math.sin(a0) * r.r * m0, r.x + Math.cos(a1) * r.r * m1, r.y + Math.sin(a1) * r.r * m1, COL.grey);
      }
    }
    for (const b of this.shots) rect(g, b.x, b.y, 2, 2, COL.gold);
    const s = this.ship;
    if (this.inv > 0 && ((this.time * 10) | 0) % 2) return;
    const p = (ang, d) => [s.x + Math.cos(s.a + ang) * d, s.y + Math.sin(s.a + ang) * d];
    const [ax, ay] = p(0, 8), [bx, by] = p(2.5, 7), [cx, cy] = p(-2.5, 7);
    this.line(g, ax, ay, bx, by, COL.blue); this.line(g, ax, ay, cx, cy, COL.blue); this.line(g, bx, by, cx, cy, COL.blue);
    if (this.thrust && ((this.time * 20) | 0) % 2) { const [fx, fy] = p(Math.PI, 9); rect(g, fx - 1, fy - 1, 3, 3, COL.orange); }
  }
}
export default module(Rocks);
