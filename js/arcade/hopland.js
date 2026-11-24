// HOP LAND — side-scrolling platformer with generated levels.
// Params: length (columns), gaps, enemies, coins, theme ('field'|'snow'|'cave'|'night'), stages, timer
import { ArcadeGame, module, COL, rect, block, disc, rand, irand } from './kit.js';

const T = 16, ROWS = 17;
const THEMES = {
  field: { sky: '#7cc8e8', top: '#5fae3f', dirt: '#8e6234', deco: '#eaf6ff' },
  snow: { sky: '#b8d8f0', top: '#f7f3e3', dirt: '#6b7378', deco: '#ffffff' },
  cave: { sky: '#1a1210', top: '#a8763f', dirt: '#4a3020', deco: '#3a2a20' },
  night: { sky: '#101830', top: '#306230', dirt: '#3a2a1e', deco: '#f7f3e3' },
};

class HopLand extends ArcadeGame {
  init() { this.controls = 'L/R RUN  A JUMP  B DASH'; this.th = THEMES[this.v.theme] || THEMES.field; this.bg = this.th.sky; }
  reset() { this.stage = 1; this.lives = 3; this.build(); }
  build() {
    const L = (this.v.length || 120) + this.stage * 20;
    this.L = L;
    this.solid = Array.from({ length: L }, () => new Uint8Array(ROWS));
    this.coins = []; this.foes = [];
    let h = 3, x = 0;
    const fill = (cx, height) => { for (let y = ROWS - height; y < ROWS; y++) this.solid[cx][y] = 1; };
    while (x < L) {
      const seg = irand(3, 8);
      for (let i = 0; i < seg && x < L; i++, x++) {
        fill(x, h);
        if (x > 12 && x < L - 10 && Math.random() < (this.v.coins ?? 0.25)) this.coins.push({ x: x * T + 4, y: (ROWS - h - 2) * T + 4 });
      }
      if (x > 10 && x < L - 12 && Math.random() < (this.v.gaps ?? 0.35)) {
        const gap = irand(2, 3);
        for (let i = 0; i < gap; i++) x++;
      }
      h = Math.max(2, Math.min(7, h + irand(-2, 2)));
      if (x > 10 && x < L - 12 && Math.random() < 0.3) {
        const px = x - irand(2, 5), py = ROWS - h - irand(3, 4);
        for (let i = 0; i < 3; i++) if (px + i >= 0 && px + i < L && py > 2) { this.solid[px + i][py] = 2; if (Math.random() < 0.6) this.coins.push({ x: (px + i) * T + 4, y: (py - 1) * T + 4 }); }
      }
      if (x > 14 && x < L - 10 && Math.random() < (this.v.enemies ?? 0.35)) this.foes.push({ x: (x - 2) * T, y: 0, vx: -30, alive: true, vy: 0 });
    }
    for (let cx = L - 8; cx < L; cx++) { for (let y = 0; y < ROWS; y++) this.solid[cx][y] = 0; fill(cx, 3); }
    for (let cx = 0; cx < 6; cx++) { for (let y = 0; y < ROWS; y++) this.solid[cx][y] = 0; fill(cx, 3); }
    this.flagX = (L - 4) * T;
    for (const f of this.foes) f.y = this.groundY(Math.floor(f.x / T)) - 14;
    this.p = { x: 40, y: (ROWS - 3) * T - 16, vx: 0, vy: 0, w: 12, h: 15, ground: false, face: 1 };
    this.cam = 0; this.timer = this.v.timer || 200;
    this.clouds = Array.from({ length: 8 }, () => [rand(0, L * T), rand(10, 90)]);
  }
  groundY(cx) { for (let y = 0; y < ROWS; y++) if (this.solid[cx]?.[y]) return y * T; return ROWS * T + 100; }
  hit(x, y) { const cx = Math.floor(x / T), cy = Math.floor(y / T); if (cx < 0 || cx >= this.L) return true; if (cy < 0) return false; if (cy >= ROWS) return false; return !!this.solid[cx][cy]; }
  onPress(b) {
    if ((b === 'a' || b === 'up') && this.p.ground) { this.p.vy = -310; this.p.ground = false; this.sfx('move'); }
  }
  onRelease(b) { if ((b === 'a' || b === 'up') && this.p.vy < -120 && this.state === 'play') this.p.vy = -120; }
  step(dt) {
    const p = this.p;
    this.timer -= dt;
    if (this.timer <= 0) return this.lose('OUT OF TIME');
    const run = this.isDown('b') ? 150 : 95;
    const dir = (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
    p.vx += (dir * run - p.vx) * Math.min(1, dt * (p.ground ? 12 : 5));
    if (dir) p.face = dir;
    p.vy = Math.min(420, p.vy + 900 * dt);
    // horizontal
    p.x += p.vx * dt;
    if (p.vx > 0 && (this.hit(p.x + p.w, p.y + 1) || this.hit(p.x + p.w, p.y + p.h - 1))) p.x = Math.floor((p.x + p.w) / T) * T - p.w - 0.01;
    if (p.vx < 0 && (this.hit(p.x, p.y + 1) || this.hit(p.x, p.y + p.h - 1))) p.x = Math.floor(p.x / T) * T + T + 0.01;
    p.x = Math.max(this.cam, p.x);
    // vertical
    p.y += p.vy * dt; p.ground = false;
    if (p.vy > 0 && (this.hit(p.x + 1, p.y + p.h) || this.hit(p.x + p.w - 1, p.y + p.h))) { p.y = Math.floor((p.y + p.h) / T) * T - p.h; p.vy = 0; p.ground = true; }
    if (p.vy < 0 && (this.hit(p.x + 1, p.y) || this.hit(p.x + p.w - 1, p.y))) { p.y = Math.floor(p.y / T) * T + T; p.vy = 0; }
    if (p.y > 300) return this.lose('FELL!');
    this.cam = Math.max(this.cam, Math.min(p.x - 120, this.L * T - 320));
    for (const c of this.coins) if (!c.got && Math.abs(c.x + 4 - (p.x + 6)) < 10 && Math.abs(c.y + 4 - (p.y + 8)) < 12) { c.got = true; this.addScore(10); this.sfx('eat'); this.burst(c.x + 4, c.y + 4, COL.gold, 5, 40); }
    for (const f of this.foes) {
      if (!f.alive || Math.abs(f.x - p.x) > 400) continue;
      f.x += f.vx * dt;
      const ahead = f.vx > 0 ? f.x + 14 : f.x;
      if (this.hit(ahead, f.y + 7) || !this.hit(ahead, f.y + 16)) f.vx = -f.vx;
      if (p.x + p.w > f.x + 1 && p.x < f.x + 13 && p.y + p.h > f.y + 2 && p.y < f.y + 14) {
        if (p.vy > 0 && p.y + p.h - f.y < 10) { f.alive = false; p.vy = -220; this.addScore(50, f.x + 7, f.y - 6, COL.gold); this.burst(f.x + 7, f.y + 7, [COL.purple, COL.white], 10, 60); this.sfx('pop'); }
        else return this.lose('OUCH!');
      }
    }
    if (p.x > this.flagX) {
      this.addScore(100 + Math.ceil(this.timer) * 2, p.x - this.cam, p.y, COL.gold); this.sfx('levelup');
      this.stage++;
      if (this.stage > (this.v.stages || 4)) return this.end(true, 'COURSE CLEAR!');
      this.build();
    }
  }
  lose(msg) {
    this.lives--; this.shake.add(3, 0.2); this.sfx('die'); this.buzz(30);
    if (this.lives <= 0) return this.end(false, msg);
    const keep = this.score; this.build(); this.score = keep;
  }
  hud() { return { mid: `${this.stage}-${this.v.stages || 4} LIFE ${this.lives} T${Math.ceil(this.timer)}` }; }
  draw(g) {
    const cam = Math.round(this.cam), th = this.th;
    for (const [x, y] of this.clouds) { const cx = x - cam * 0.5; if (cx > -40 && cx < 340) { rect(g, cx, y, 30, 8, th.deco); rect(g, cx + 6, y - 5, 14, 6, th.deco); } }
    if (this.v.theme === 'night') for (let i = 0; i < 40; i++) rect(g, (i * 83 - cam * 0.2 + 3200) % 320, (i * 41) % 140, 1, 1, COL.white);
    const c0 = Math.max(0, Math.floor(cam / T)), c1 = Math.min(this.L - 1, c0 + 21);
    for (let cx = c0; cx <= c1; cx++) for (let y = 0; y < ROWS; y++) {
      const s = this.solid[cx][y]; if (!s) continue;
      const x = cx * T - cam, py = y * T;
      if (s === 2) { block(g, x, py, T, T, COL.brown); rect(g, x + 2, py + 6, 12, 2, '#6a4428'); continue; }
      const top = !this.solid[cx][y - 1];
      rect(g, x, py, T, T, th.dirt);
      if (top) { rect(g, x, py, T, 4, th.top); rect(g, x, py + 4, T, 1, '#00000040'); }
      else if ((cx + y) % 3 === 0) rect(g, x + 5, py + 6, 2, 2, '#00000030');
    }
    for (const c of this.coins) if (!c.got) { const w = Math.abs(Math.sin(this.time * 4 + c.x)) * 4 + 1; rect(g, c.x - cam + 4 - w / 2, c.y, w, 8, COL.gold); }
    for (const f of this.foes) if (f.alive) { const x = f.x - cam; block(g, x, f.y + 2, 14, 12, COL.purple); rect(g, x + 3, f.y + 5, 2, 3, COL.white); rect(g, x + 9, f.y + 5, 2, 3, COL.white); rect(g, x + 2 + (((this.time * 8) | 0) % 2) * 6, f.y + 13, 4, 2, COL.ink); }
    const fx = this.flagX - cam;
    rect(g, fx, (ROWS - 3) * T - 96, 2, 96, COL.white); rect(g, fx + 2, (ROWS - 3) * T - 96, 18, 12, COL.red);
    const p = this.p, x = Math.round(p.x - cam), y = Math.round(p.y);
    block(g, x, y, 12, 6, COL.orange); rect(g, x + (p.face > 0 ? 6 : 2), y + 6, 4, 3, '#f3e3c3'); rect(g, x + 1, y + 6, 10, 0, COL.ink);
    rect(g, x, y + 6, 12, 4, '#f3e3c3'); rect(g, x + (p.face > 0 ? 7 : 3), y + 7, 2, 2, COL.ink);
    block(g, x, y + 10, 12, 5, COL.navy);
  }
}
export default module(HopLand);
