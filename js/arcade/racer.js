// LANE RACER — weave through traffic. Params: lanes, speed, accel, oil, fuel (collect cans or run dry)
import { ArcadeGame, module, COL, PIECES, rect, block, rand, irand, pick } from './kit.js';

class Racer extends ArcadeGame {
  init() { this.controls = 'LEFT/RIGHT CHANGE LANE'; this.bg = '#3a7a2a'; this.animatedIdle = true; }
  reset() {
    this.n = this.v.lanes || 4; this.lw = 40; this.rx = 160 - (this.n * this.lw) / 2;
    this.lane = Math.floor(this.n / 2); this.x = this.laneX(this.lane); this.cars = []; this.dist = 0; this.spawnT = 0; this.fuel = 100; this.passed = 0;
  }
  laneX(l) { return this.rx + l * this.lw + this.lw / 2 - 8; }
  onPress(b) {
    if (b === 'left' && this.lane > 0) { this.lane--; this.sfx('turn'); }
    if (b === 'right' && this.lane < this.n - 1) { this.lane++; this.sfx('turn'); }
  }
  step(dt) {
    const sp = (this.v.speed || 150) + this.t * (this.v.accel ?? 3);
    this.dist += sp * dt;
    this.x += (this.laneX(this.lane) - this.x) * Math.min(1, dt * 14);
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      const kind = this.v.fuel && Math.random() < 0.15 ? 'fuel' : this.v.oil && Math.random() < 0.15 ? 'oil' : 'car';
      this.cars.push({ lane: irand(0, this.n - 1), y: -30, sp: kind === 'car' ? rand(0.3, 0.6) : 0, kind, c: pick(PIECES) });
      this.spawnT = rand(0.35, 0.9) * Math.max(0.5, 1 - this.t / 150);
    }
    if (this.v.fuel) { this.fuel -= dt * 4; if (this.fuel <= 0) return this.end(false, 'OUT OF FUEL'); }
    for (const c of this.cars) {
      c.y += sp * (1 - c.sp) * dt;
      const cx = this.laneX(c.lane);
      if (!c.hit && Math.abs(cx - this.x) < 13 && c.y + 26 > 226 && c.y < 252) {
        if (c.kind === 'car') { this.burst(this.x + 8, 236, [COL.orange, COL.gold, COL.white], 24, 90); return this.end(false, 'CRASH!'); }
        c.hit = true;
        if (c.kind === 'fuel') { this.fuel = Math.min(100, this.fuel + 35); this.addScore(50, cx + 8, c.y, COL.gold); this.sfx('golden'); }
        if (c.kind === 'oil') { this.lane = Math.max(0, Math.min(this.n - 1, this.lane + pick([-1, 1]))); this.shake.add(3, 0.2); this.sfx('back'); }
      }
      if (!c.counted && c.y > 260 && c.kind === 'car') { c.counted = true; this.passed++; }
    }
    this.cars = this.cars.filter((c) => c.y < 300 && !(c.hit && c.kind === 'fuel'));
    this.score = Math.floor(this.dist / 20) + this.passed * 5;
  }
  hud() { return { mid: this.v.fuel ? `FUEL ${Math.ceil(this.fuel)}%` : `${Math.round(((this.v.speed || 150) + this.t * (this.v.accel ?? 3)) * 0.6)} KM/H` }; }
  car(g, x, y, c) { block(g, x, y, 16, 26, c); rect(g, x + 3, y + 5, 10, 5, '#cfeaff'); rect(g, x + 3, y + 17, 10, 4, '#cfeaff'); rect(g, x - 2, y + 3, 2, 6, COL.ink); rect(g, x + 16, y + 3, 2, 6, COL.ink); rect(g, x - 2, y + 17, 2, 6, COL.ink); rect(g, x + 16, y + 17, 2, 6, COL.ink); }
  draw(g) {
    rect(g, this.rx - 6, 0, this.n * this.lw + 12, 272, '#c9c9b0');
    rect(g, this.rx, 0, this.n * this.lw, 272, '#3b3f45');
    for (let l = 1; l < this.n; l++) for (let y = -(40 - (this.dist % 40)); y < 272; y += 40) rect(g, this.rx + l * this.lw - 1, y, 2, 20, COL.white);
    for (let y = -(32 - (this.dist % 32)); y < 272; y += 32) { rect(g, this.rx - 20, y, 6, 6, '#2e6a22'); rect(g, this.rx + this.n * this.lw + 16, y + 14, 6, 6, '#2e6a22'); }
    for (const c of this.cars) {
      const x = this.laneX(c.lane);
      if (c.kind === 'car') this.car(g, x, c.y, c.c);
      else if (c.kind === 'fuel') { block(g, x + 2, c.y + 6, 12, 14, COL.red); rect(g, x + 5, c.y + 3, 6, 3, COL.grey); }
      else if (!c.hit) { rect(g, x - 2, c.y + 8, 20, 10, '#111'); rect(g, x + 2, c.y + 10, 6, 3, '#333a55'); }
    }
    this.car(g, this.x, 226, COL.gold);
  }
}
export default module(Racer);
