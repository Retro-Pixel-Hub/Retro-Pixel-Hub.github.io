// TOWER STACK — drop the sliding slab so it lines up. Params: width, speed, accel, perfect (snap tolerance)
import { ArcadeGame, module, COL, PIECES, rect, block } from './kit.js';

const SH = 12;

class Stacker extends ArcadeGame {
  init() { this.controls = 'A OR TAP TO DROP'; this.bg = '#101830'; this.animatedIdle = true; }
  reset() { const w = this.v.width || 120; this.stack = [{ x: 160 - w / 2, w, c: PIECES[0] }]; this.newSlab(); this.cam = 0; this.combo = 0; this.chips = []; }
  newSlab() {
    const top = this.stack.at(-1);
    this.cur = { x: this.stack.length % 2 ? 0 : 320 - top.w, w: top.w, dir: this.stack.length % 2 ? 1 : -1, c: PIECES[this.stack.length % PIECES.length] };
  }
  onPress(b) {
    if (b !== 'a' && b !== 'down' && b !== 'up') return;
    const top = this.stack.at(-1), cur = this.cur;
    let l = Math.max(top.x, cur.x), r = Math.min(top.x + top.w, cur.x + cur.w);
    if (r - l <= 0) { this.chips.push({ ...cur, y: this.stack.length, vy: 0 }); return this.end(false, `${this.stack.length - 1} FLOORS`); }
    if (Math.abs(cur.x - top.x) <= (this.v.perfect ?? 3)) {
      l = top.x; r = top.x + top.w; this.combo++;
      this.addScore(20 * this.combo, 160, 180, COL.gold); this.sfx(this.combo > 2 ? 'combo' : 'golden');
      if (this.combo >= 4 && top.w < (this.v.width || 120)) { l -= 4; r += 4; }
    } else {
      this.combo = 0; this.addScore(10); this.sfx('eat');
      const cutX = cur.x < l ? cur.x : r, cutW = cur.w - (r - l);
      this.chips.push({ x: cutX, w: cutW, c: cur.c, y: this.stack.length, vy: 0 });
    }
    this.stack.push({ x: l, w: r - l, c: cur.c }); this.shake.add(1, 0.08);
    this.newSlab();
  }
  step(dt) {
    const sp = (this.v.speed || 110) + this.stack.length * (this.v.accel ?? 4);
    this.cur.x += this.cur.dir * sp * dt;
    if (this.cur.x > 320 - this.cur.w * 0.2) this.cur.dir = -1;
    if (this.cur.x < -this.cur.w * 0.8) this.cur.dir = 1;
    const target = Math.max(0, (this.stack.length - 14) * SH);
    this.cam += (target - this.cam) * Math.min(1, dt * 5);
    for (const c of this.chips) { c.vy += 400 * dt; c.fall = (c.fall || 0) + c.vy * dt; }
    this.chips = this.chips.filter((c) => c.fall < 300);
  }
  update(dt) { super.update(dt); if (this.state !== 'play') for (const c of this.chips) { c.vy += 400 * dt; c.fall = (c.fall || 0) + c.vy * dt; } }
  hud() { return { mid: `FLOOR ${this.stack.length - 1}` }; }
  draw(g) {
    const base = 260 + this.cam;
    for (let i = 0; i < 40; i++) rect(g, (i * 71) % 320, (i * 37 + this.cam * 0.3) % 272, 1, 1, '#5b6b8e');
    this.stack.forEach((s, i) => block(g, s.x, base - (i + 1) * SH, s.w, SH, s.c));
    for (const c of this.chips) block(g, c.x, base - (c.y + 1) * SH + (c.fall || 0), c.w, SH, c.c);
    if (this.state !== 'over') block(g, this.cur.x, base - (this.stack.length + 1) * SH, this.cur.w, SH, this.cur.c);
  }
}
export default module(Stacker);
