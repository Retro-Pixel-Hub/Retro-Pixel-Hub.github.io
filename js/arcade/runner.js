// DESERT DASH — endless runner. Params: speed, accel, birds, night, double (double jump), gravity
import { ArcadeGame, module, COL, rect, block, rand, irand } from './kit.js';

class Runner extends ArcadeGame {
  init() { this.controls = 'A/UP JUMP  DOWN DUCK'; this.animatedIdle = true; }
  reset() { this.y = 0; this.vy = 0; this.jumps = 0; this.obs = []; this.dist = 0; this.next = 1; this.dunes = Array.from({ length: 6 }, (_, i) => [i * 70, irand(10, 30)]); }
  onPress(b) {
    if ((b === 'a' || b === 'up') && (this.y === 0 || (this.v.double && this.jumps < 2))) { this.vy = 330; this.jumps++; this.sfx('move'); }
  }
  step(dt) {
    const sp = (this.v.speed || 140) + this.t * (this.v.accel ?? 4);
    this.dist += sp * dt;
    this.score = Math.floor(this.dist / 10);
    const grav = this.v.gravity || 1000;
    this.vy -= grav * dt * (this.isDown('down') ? 2.5 : 1);
    this.y = Math.max(0, this.y + this.vy * dt);
    if (this.y === 0) { this.vy = 0; this.jumps = 0; }
    this.duck = this.isDown('down') && this.y === 0;
    this.next -= dt;
    if (this.next <= 0) {
      const bird = this.v.birds && this.t > 5 && Math.random() < 0.35;
      this.obs.push(bird ? { x: 330, y: pickH(), w: 16, h: 10, bird: true } : { x: 330, y: 0, w: irand(1, 3) * 8, h: irand(14, 26), bird: false });
      this.next = rand(0.7, 1.6) * Math.max(0.55, 1 - this.t / 120);
    }
    for (const d of this.dunes) { d[0] -= sp * 0.2 * dt; if (d[0] < -70) d[0] += 420; }
    const pw = 14, ph = this.duck ? 10 : 18;
    for (const o of this.obs) {
      o.x -= sp * dt;
      if (40 + pw > o.x + 2 && 40 < o.x + o.w - 2 && this.y < o.y + o.h - 2 && this.y + ph > o.y + 2) return this.end(false, `RAN ${this.score}M`);
    }
    this.obs = this.obs.filter((o) => o.x > -40);
    if (this.score && this.score % 100 === 0 && this.score !== this.lastBeep) { this.lastBeep = this.score; this.sfx('eat'); }
  }
  hud() { return { left: String(this.score).padStart(6, '0'), mid: this.v.night ? 'NIGHT RUN' : 'DASH' }; }
  draw(g) {
    const night = this.v.night;
    this.bg = night ? '#0d1030' : '#f6e2b0';
    const ground = 220;
    for (const [x, h] of this.dunes) { rect(g, x, ground - h, 60, h, night ? '#1d2050' : '#ecd29a'); rect(g, x + 10, ground - h - 6, 40, 6, night ? '#1d2050' : '#ecd29a'); }
    if (night) for (let i = 0; i < 30; i++) rect(g, (i * 97 + 13) % 320, (i * 53) % 150, 1, 1, COL.white);
    rect(g, 0, ground, 320, 52, night ? '#2a2550' : '#d9b46a');
    for (let x = -(this.dist % 24); x < 320; x += 24) rect(g, x, ground + 6, 6, 2, night ? '#3a3570' : '#b8914a');
    for (const o of this.obs) {
      if (o.bird) { const f = ((this.time * 8) | 0) % 2; block(g, o.x, ground - o.y - o.h, o.w, 6, COL.grey); rect(g, o.x + 4, ground - o.y - o.h + (f ? -4 : 6), 8, 4, COL.grey); }
      else { block(g, o.x, ground - o.h, o.w, o.h, '#3f8a3a'); rect(g, o.x - 3, ground - o.h + 6, 3, 6, '#3f8a3a'); rect(g, o.x + o.w, ground - o.h + 4, 3, 6, '#3f8a3a'); }
    }
    const h = this.duck ? 10 : 18, x = 40, y = ground - this.y - h;
    block(g, x, y, 14, h, night ? COL.blue : COL.orange);
    rect(g, x + 9, y + 3, 3, 3, COL.white);
    if (this.y === 0) { const f = ((this.time * 12) | 0) % 2; rect(g, x + 2 + f * 6, ground - 2, 4, 2, COL.ink); }
  }
}
const pickH = () => [4, 14, 26][irand(0, 2)];
export default module(Runner);
