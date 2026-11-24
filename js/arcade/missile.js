// SKY GUARD — move the crosshair, fire interceptors to protect the cities. Params: rate, speed, cities, split
import { ArcadeGame, module, COL, rect, block, disc, clamp, rand, pick } from './kit.js';

class Missile extends ArcadeGame {
  init() { this.controls = 'D-PAD AIM  A FIRE'; this.bg = '#0a0d24'; }
  reset() {
    const n = this.v.cities || 6;
    this.cities = Array.from({ length: n }, (_, i) => ({ x: 20 + ((i + 0.5) * 280) / n, alive: true }));
    this.cx = 160; this.cy = 120; this.enemy = []; this.mine = []; this.booms = []; this.spawnT = 1; this.wave = 1; this.left = 10; this.ammo = 30;
  }
  onPress(b) {
    if (b === 'a' && this.ammo > 0) { this.ammo--; this.mine.push({ x: 160, y: 252, tx: this.cx, ty: this.cy }); this.sfx('move'); }
  }
  step(dt) {
    const mv = 170;
    this.cx = clamp(this.cx + ((this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0)) * mv * dt, 4, 316);
    this.cy = clamp(this.cy + ((this.isDown('down') ? 1 : 0) - (this.isDown('up') ? 1 : 0)) * mv * dt, 4, 230);
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.left > 0) {
      const targets = this.cities.filter((c) => c.alive);
      const t = pick(targets.length ? targets : [{ x: 160 }]);
      this.enemy.push({ sx: rand(0, 320), sy: 0, x: 0, y: 0, tx: t.x, ty: 250, p: 0, sp: (this.v.speed || 22) * (1 + this.wave * 0.12) });
      this.left--; this.spawnT = rand(0.6, 1.6) / (this.v.rate || 1);
    }
    for (const m of this.mine) {
      const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy);
      const s = 260 * dt;
      if (d <= s) { m.done = true; this.booms.push({ x: m.tx, y: m.ty, r: 0, t: 0 }); this.sfx('pop'); }
      else { m.x += (dx / d) * s; m.y += (dy / d) * s; }
    }
    this.mine = this.mine.filter((m) => !m.done);
    for (const b of this.booms) { b.t += dt; b.r = b.t < 0.5 ? b.t * 40 : Math.max(0, 20 - (b.t - 0.5) * 30); }
    this.booms = this.booms.filter((b) => b.t < 1.2);
    for (const e of this.enemy) {
      const len = Math.hypot(e.tx - e.sx, e.ty - e.sy);
      e.p += (e.sp * dt) / len;
      e.x = e.sx + (e.tx - e.sx) * e.p; e.y = e.sy + (e.ty - e.sy) * e.p;
      if (this.v.split && !e.split && e.p > 0.35 && Math.random() < dt * 0.6) {
        e.split = true; const t = pick(this.cities);
        this.enemy.push({ sx: e.x, sy: e.y, x: e.x, y: e.y, tx: t.x, ty: 250, p: 0, sp: e.sp, split: true });
      }
      if (this.booms.some((b) => Math.hypot(b.x - e.x, b.y - e.y) < b.r)) { e.dead = true; this.addScore(25, e.x, e.y - 6, COL.gold); this.burst(e.x, e.y, [COL.orange, COL.gold], 8, 50); }
      else if (e.p >= 1) {
        e.dead = true; this.booms.push({ x: e.x, y: e.y, r: 0, t: 0, bad: true });
        const c = this.cities.find((c) => c.alive && Math.abs(c.x - e.x) < 16);
        if (c) { c.alive = false; this.shake.add(4, 0.3); this.sfx('die'); this.buzz(30); }
      }
    }
    this.enemy = this.enemy.filter((e) => !e.dead);
    if (!this.cities.some((c) => c.alive)) return this.end(false, 'CITIES LOST');
    if (this.left <= 0 && !this.enemy.length) {
      const bonus = this.cities.filter((c) => c.alive).length * 100 + this.ammo * 5;
      this.addScore(bonus, 160, 120, COL.gold); this.sfx('levelup');
      this.wave++; this.left = 10 + this.wave * 3; this.ammo = 30 + this.wave * 2;
      if (this.v.waves && this.wave > this.v.waves) return this.end(true, 'SKIES SECURED');
    }
  }
  hud() { return { mid: `W${this.wave} AMMO ${this.ammo}` }; }
  draw(g) {
    rect(g, 0, 256, 320, 16, '#4a3a2a');
    block(g, 148, 244, 24, 12, COL.grey);
    for (const c of this.cities) if (c.alive) { block(g, c.x - 10, 246, 6, 10, COL.blue); block(g, c.x - 4, 240, 7, 16, COL.purple); block(g, c.x + 3, 244, 6, 12, COL.blue); }
    else rect(g, c.x - 10, 252, 20, 4, '#2a2a2a');
    for (const e of this.enemy) {
      g.strokeStyle = '#c84a4a'; g.lineWidth = 1; g.beginPath(); g.moveTo(e.sx + 0.5, e.sy + 0.5); g.lineTo(e.x + 0.5, e.y + 0.5); g.stroke();
      rect(g, e.x - 1, e.y - 1, 3, 3, COL.white);
    }
    for (const m of this.mine) rect(g, m.x - 1, m.y - 1, 2, 2, COL.mint);
    for (const b of this.booms) if (b.r > 0) disc(g, b.x, b.y, Math.round(b.r), ((this.time * 20) | 0) % 2 ? (b.bad ? COL.red : COL.gold) : COL.white);
    rect(g, this.cx - 6, this.cy, 4, 1, COL.white); rect(g, this.cx + 3, this.cy, 4, 1, COL.white);
    rect(g, this.cx, this.cy - 6, 1, 4, COL.white); rect(g, this.cx, this.cy + 3, 1, 4, COL.white);
  }
}
export default module(Missile);
