// MAZE ESCAPE — find the exit of generated labyrinths. Params: size (cells across), fog, time, keys, levels
import { ArcadeGame, module, COL, DIR, rect, block, shuffle, irand } from './kit.js';

class Maze extends ArcadeGame {
  init() { this.controls = 'D-PAD WALK (HOLD TO RUN)'; this.bg = '#0d120f'; }
  reset() { this.level = 1; this.build(); }
  build() {
    const cw = (this.v.size || 10) + (this.level - 1) * 2;
    const ch = Math.max(5, Math.round(cw * 0.85));
    this.cw = Math.min(cw, 39); this.ch = Math.min(ch, 33);
    const W = this.cw * 2 + 1, H = this.ch * 2 + 1;
    this.W = W; this.H = H;
    this.m = Array.from({ length: H }, () => new Uint8Array(W).fill(1));
    const st = [[1, 1]]; this.m[1][1] = 0;
    while (st.length) {
      const [x, y] = st.at(-1);
      const n = shuffle([[2, 0], [-2, 0], [0, 2], [0, -2]]).find(([dx, dy]) => this.m[y + dy]?.[x + dx] === 1 && x + dx > 0 && y + dy > 0 && x + dx < W - 1 && y + dy < H - 1);
      if (!n) { st.pop(); continue; }
      this.m[y + n[1] / 2][x + n[0] / 2] = 0; this.m[y + n[1]][x + n[0]] = 0; st.push([x + n[0], y + n[1]]);
    }
    this.cs = Math.max(4, Math.min(Math.floor(312 / W), Math.floor(264 / H)));
    this.ox = Math.round((320 - W * this.cs) / 2); this.oy = Math.round((272 - H * this.cs) / 2);
    this.p = { x: 1, y: 1 }; this.exit = { x: W - 2, y: H - 2 };
    this.keys = [];
    for (let i = 0; i < (this.v.keys || 0); i++) this.keys.push({ x: irand(1, this.cw - 1) * 2 + 1, y: irand(1, this.ch - 1) * 2 + 1 });
    this.seen = new Uint8Array(W * H); this.see();
    this.limit = this.v.time ? this.v.time + this.level * 10 : 0; this.levelT = 0; this.rep = 0;
  }
  see() { const r = 3; for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const nx = this.p.x + x, ny = this.p.y + y; if (nx >= 0 && ny >= 0 && nx < this.W && ny < this.H) this.seen[nx + ny * this.W] = 1; } }
  go(b) {
    const d = DIR[b]; if (!d) return false;
    const nx = this.p.x + d[0], ny = this.p.y + d[1];
    if (this.m[ny]?.[nx] !== 0) return false;
    this.p = { x: nx, y: ny }; this.see();
    this.keys = this.keys.filter((k) => { if (k.x === nx && k.y === ny) { this.addScore(50, this.ox + nx * this.cs, this.oy + ny * this.cs - 6, COL.gold); this.sfx('golden'); return false; } return true; });
    if (nx === this.exit.x && ny === this.exit.y && !this.keys.length) {
      const bonus = 100 * this.level + (this.limit ? Math.ceil(this.limit - this.levelT) * 5 : Math.max(0, 300 - Math.floor(this.levelT) * 3));
      this.addScore(bonus, 160, 120, COL.gold); this.sfx('levelup'); this.level++;
      if (this.level > (this.v.levels || 5)) { this.end(true, 'ESCAPED!'); return true; }
      this.build();
    }
    return true;
  }
  onPress(b) { if (this.go(b)) { this.sfx('turn'); this.rep = -0.22; } }
  step(dt) {
    this.levelT += dt;
    if (this.limit && this.levelT > this.limit) return this.end(false, 'LOST IN THE MAZE');
    const held = ['up', 'down', 'left', 'right'].find((b) => this.isDown(b));
    if (held) { this.rep += dt; while (this.rep > 0.07) { this.rep -= 0.07; this.go(held); } } else this.rep = 0;
  }
  hud() { return { mid: `LV${this.level}${this.limit ? ` ${Math.max(0, Math.ceil(this.limit - this.levelT))}S` : ''}${this.keys.length ? ` KEY ${this.keys.length}` : ''}` }; }
  draw(g) {
    const { cs, ox, oy } = this;
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      if (this.v.fog && !this.seen[x + y * this.W]) continue;
      if (this.v.fog === 2 && Math.hypot(x - this.p.x, y - this.p.y) > 3.5) continue;
      rect(g, ox + x * cs, oy + y * cs, cs, cs, this.m[y][x] ? COL.gb1 : '#16221a');
    }
    for (const k of this.keys) block(g, ox + k.x * cs, oy + k.y * cs, cs, cs, COL.gold);
    block(g, ox + this.exit.x * cs, oy + this.exit.y * cs, cs, cs, this.keys.length ? COL.grey : ((this.time * 3) | 0) % 2 ? COL.mint : COL.white);
    block(g, ox + this.p.x * cs, oy + this.p.y * cs, cs, cs, COL.red);
  }
}
export default module(Maze);
