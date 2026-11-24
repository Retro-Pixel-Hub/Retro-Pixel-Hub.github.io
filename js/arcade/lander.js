// MOON LANDER — land softly on the pad. Params: gravity, fuel, pad (width), wind, rough (terrain)
import { ArcadeGame, module, COL, rect, block, rand } from './kit.js';

class Lander extends ArcadeGame {
  init() { this.controls = 'UP THRUST  LEFT/RIGHT STEER'; this.bg = '#04050c'; this.stars = Array.from({ length: 60 }, () => [rand(0, 320), rand(0, 200)]); }
  reset() { this.level = 1; this.build(); }
  build() {
    this.x = rand(40, 280); this.y = 20; this.vx = rand(-20, 20); this.vy = 0; this.fuel = this.v.fuel || 100;
    const pw = Math.max(24, (this.v.pad || 50) - (this.level - 1) * 4);
    this.padX = rand(20, 300 - pw); this.padW = pw;
    this.ground = [];
    let h = 230;
    for (let x = 0; x <= 320; x += 8) {
      if (x >= this.padX - 8 && x <= this.padX + pw) { this.padY = this.padY ?? h; this.ground.push(this.padY); continue; }
      h = Math.max(170, Math.min(262, h + rand(-1, 1) * (this.v.rough || 12)));
      this.ground.push(h);
    }
    this.padY = this.ground[Math.floor((this.padX + 4) / 8)];
    for (let x = 0; x <= 320; x += 8) if (x >= this.padX - 8 && x <= this.padX + pw) this.ground[x / 8] = this.padY;
    this.wind = this.v.wind ? rand(-this.v.wind, this.v.wind) : 0;
  }
  groundAt(x) { const i = Math.max(0, Math.min(this.ground.length - 2, Math.floor(x / 8))); const t = (x - i * 8) / 8; return this.ground[i] * (1 - t) + this.ground[i + 1] * t; }
  step(dt) {
    const g = (this.v.gravity || 30) * (1 + (this.level - 1) * 0.1);
    this.vy += g * dt; this.vx += this.wind * dt;
    this.thr = this.isDown('up') && this.fuel > 0;
    if (this.thr) { this.vy -= 75 * dt; this.fuel -= 12 * dt; }
    if (this.fuel > 0 && this.isDown('left')) { this.vx -= 40 * dt; this.fuel -= 4 * dt; }
    if (this.fuel > 0 && this.isDown('right')) { this.vx += 40 * dt; this.fuel -= 4 * dt; }
    this.fuel = Math.max(0, this.fuel);
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.x < 0 || this.x > 312) this.vx = -this.vx * 0.5, this.x = Math.max(0, Math.min(312, this.x));
    const gy = Math.min(this.groundAt(this.x + 2), this.groundAt(this.x + 6));
    if (this.y + 10 >= gy) {
      const onPad = this.x >= this.padX && this.x + 8 <= this.padX + this.padW;
      if (onPad && this.vy < 40 && Math.abs(this.vx) < 22) {
        const pts = 200 + Math.round(this.fuel * 5) + Math.round((40 - this.vy) * 3);
        this.addScore(pts, this.x + 4, this.y - 10, COL.gold); this.sfx('levelup');
        this.level++;
        if (this.level > (this.v.levels || 5)) return this.end(true, 'MISSION COMPLETE');
        return this.build();
      }
      this.burst(this.x + 4, this.y + 8, [COL.orange, COL.gold, COL.white], 30, 110);
      return this.end(false, onPad ? 'TOO FAST!' : 'MISSED THE PAD');
    }
  }
  hud() { return { mid: `LV${this.level} FUEL ${Math.ceil(this.fuel)}` }; }
  draw(g) {
    for (const [x, y] of this.stars) rect(g, x, y, 1, 1, '#8a948c');
    for (let i = 0; i < this.ground.length - 1; i++) {
      const x = i * 8;
      for (let k = 0; k < 8; k++) { const y = this.groundAt(x + k); rect(g, x + k, y, 1, 272 - y, '#5b5f66'); rect(g, x + k, y, 1, 1, '#9aa3a8'); }
    }
    rect(g, this.padX, this.padY - 2, this.padW, 3, ((this.time * 3) | 0) % 2 ? COL.gold : COL.orange);
    block(g, this.x, this.y, 8, 7, COL.white);
    rect(g, this.x + 2, this.y + 2, 4, 2, COL.blue);
    rect(g, this.x - 1, this.y + 7, 2, 3, COL.grey); rect(g, this.x + 7, this.y + 7, 2, 3, COL.grey);
    if (this.thr && ((this.time * 20) | 0) % 2) rect(g, this.x + 3, this.y + 8, 2, 5, COL.orange);
    const v = Math.round(this.vy);
    this.g.save();
    rect(g, 4, 4, 76, 12, '#0a0f1c');
    rect(g, 6, 8, Math.min(70, Math.abs(v)), 4, v < 40 ? COL.mint : COL.red);
    this.g.restore();
  }
}
export default module(Lander);
