// MAZE MUNCHER — eat every dot, dodge the ghosts. Params: ghosts, speed, gspeed, power (sec), lives, dark, braid
import { ArcadeGame, module, COL, DIR, OPP, rect, disc, shuffle, pick } from './kit.js';

const C = 16, MW = 19, MH = 17, OX = 8;
const GHOST_COLORS = [COL.red, COL.pink, COL.blue, COL.orange, COL.purple, COL.mint];

function makeMaze(braid) {
  const m = Array.from({ length: MH }, () => new Array(MW).fill(1));
  const stack = [[1, 1]];
  m[1][1] = 0;
  while (stack.length) {
    const [x, y] = stack.at(-1);
    const opts = shuffle([[2, 0], [-2, 0], [0, 2], [0, -2]]).filter(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      return nx > 0 && nx <= 9 && ny > 0 && ny < MH - 1 && m[ny][nx] === 1;
    });
    if (!opts.length) { stack.pop(); continue; }
    const [dx, dy] = opts[0];
    m[y + dy / 2][x + dx / 2] = 0; m[y + dy][x + dx] = 0;
    stack.push([x + dx, y + dy]);
  }
  for (let y = 0; y < MH; y++) for (let x = 0; x < 9; x++) m[y][MW - 1 - x] = m[y][x];
  // braid: remove dead ends so the maze has loops
  for (let pass = 0; pass < 2; pass++) for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
    if (m[y][x]) continue;
    const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => !m[y + dy][x + dx]);
    if (open.length === 1 && Math.random() < braid) {
      const walls = shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]]).filter(([dx, dy]) => m[y + dy][x + dx] && x + dx * 2 > 0 && x + dx * 2 < MW - 1 && y + dy * 2 > 0 && y + dy * 2 < MH - 1);
      if (walls.length) { const [dx, dy] = walls[0]; m[y + dy][x + dx] = 0; m[y + dy][MW - 1 - (x + dx)] = 0; }
    }
  }
  return m;
}

class Muncher extends ArcadeGame {
  init() { this.controls = 'D-PAD STEER'; this.bg = '#05060f'; }
  reset() { this.lives = this.v.lives ?? 3; this.level = 1; this.build(); }
  build() {
    this.maze = makeMaze(this.v.braid ?? 0.8);
    this.dots = new Set();
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (!this.maze[y][x]) this.dots.add(x + y * MW);
    this.power = new Set([1 + MW, MW - 2 + MW, 1 + (MH - 2) * MW, MW - 2 + (MH - 2) * MW]);
    this.place();
  }
  place() {
    this.pl = { x: 9, y: MH - 2, px: 9 * C, py: (MH - 2) * C, dir: 'left', want: 'left' };
    if (this.maze[this.pl.y][this.pl.x]) { this.pl.y = 1; this.pl.py = C; }
    this.ghosts = Array.from({ length: this.v.ghosts ?? 4 }, (_, i) => ({ x: 9, y: 1 + (i % 2) * 0, px: 9 * C, py: C, dir: pick(['left', 'right']), c: GHOST_COLORS[i % 6], delay: i * 2, i }));
    for (const gh of this.ghosts) { if (this.maze[gh.y][gh.x]) { gh.y = 1; gh.x = 1; gh.px = C; gh.py = C; } }
    this.fright = 0; this.chain = 0;
  }
  open(x, y) { return x >= 0 && y >= 0 && x < MW && y < MH && !this.maze[y][x]; }
  onPress(b) { if (DIR[b]) this.pl.want = b; }
  moveActor(a, speed, dt, choose) {
    let dist = speed * dt;
    while (dist > 0) {
      const tx = a.x * C, ty = a.y * C;
      if (a.px === tx && a.py === ty) {
        choose(a);
        const [dx, dy] = DIR[a.dir];
        if (!this.open(a.x + dx, a.y + dy)) return;
        a.x += dx; a.y += dy;
      }
      const nx = a.x * C, ny = a.y * C;
      const ddx = nx - a.px, ddy = ny - a.py;
      const d = Math.abs(ddx) + Math.abs(ddy);
      const s = Math.min(d, dist);
      a.px += Math.sign(ddx) * s; a.py += Math.sign(ddy) * s; dist -= s;
      if (s === 0) break;
    }
  }
  step(dt) {
    const sp = (this.v.speed || 70) * (1 + (this.level - 1) * 0.05);
    const pl = this.pl;
    // allow instant reversal mid-corridor
    if (pl.want === OPP[pl.dir] && (pl.px !== pl.x * C || pl.py !== pl.y * C)) { const [dx, dy] = DIR[pl.dir]; pl.x -= dx; pl.y -= dy; pl.dir = pl.want; }
    this.moveActor(pl, sp, dt, (a) => {
      const [wx, wy] = DIR[a.want];
      if (this.open(a.x + wx, a.y + wy)) a.dir = a.want;
      const k = a.x + a.y * MW;
      if (this.dots.delete(k)) {
        if (this.power.has(k)) { this.power.delete(k); this.fright = this.v.power ?? 6; this.chain = 0; this.addScore(50); this.sfx('golden'); }
        else { this.score += 10; if (this.dots.size % 2) this.sfx('turn'); }
      }
    });
    this.fright = Math.max(0, this.fright - dt);
    for (const gh of this.ghosts) {
      if (gh.delay > 0) { gh.delay -= dt; continue; }
      const gs = (this.v.gspeed || 60) * (this.fright ? 0.55 : 1) * (1 + (this.level - 1) * 0.08);
      this.moveActor(gh, gs, dt, (a) => {
        const opts = Object.keys(DIR).filter((d) => d !== OPP[a.dir] && this.open(a.x + DIR[d][0], a.y + DIR[d][1]));
        if (!opts.length) { a.dir = OPP[a.dir]; return; }
        if (this.fright || Math.random() < 0.25 + a.i * 0.1) { a.dir = pick(opts); return; }
        const tx = pl.x + (a.i === 1 ? DIR[pl.dir][0] * 3 : 0), ty = pl.y + (a.i === 1 ? DIR[pl.dir][1] * 3 : 0);
        opts.sort((p, q) => Math.hypot(a.x + DIR[p][0] - tx, a.y + DIR[p][1] - ty) - Math.hypot(a.x + DIR[q][0] - tx, a.y + DIR[q][1] - ty));
        a.dir = opts[0];
      });
      if (Math.abs(gh.px - pl.px) < 10 && Math.abs(gh.py - pl.py) < 10) {
        if (this.fright) {
          this.chain++; const pts = 200 * 2 ** (this.chain - 1);
          this.addScore(pts, gh.px + OX + 8, gh.py, COL.blue); this.sfx('combo');
          gh.x = 9; gh.y = 1; gh.px = 9 * C; gh.py = C; gh.delay = 2;
          if (this.maze[1][9]) { gh.x = 1; gh.px = C; }
        } else {
          this.lives--; this.shake.add(4, 0.3); this.sfx('die'); this.buzz(40);
          if (this.lives <= 0) return this.end(false, 'CAUGHT!');
          return this.place();
        }
      }
    }
    if (!this.dots.size) { this.addScore(500 * this.level, 160, 120, COL.gold); this.level++; this.sfx('levelup'); if (this.v.levels && this.level > this.v.levels) return this.end(true, 'MAZE MASTER'); this.build(); }
  }
  hud() { return { mid: `LV${this.level} LIFE ${this.lives}` }; }
  draw(g) {
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      if (this.maze[y][x]) {
        rect(g, OX + x * C, y * C, C, C, '#1b2a8a');
        rect(g, OX + x * C + 2, y * C + 2, C - 4, C - 4, '#0b1240');
      }
    }
    for (const k of this.dots) {
      const x = k % MW, y = (k / MW) | 0;
      if (this.v.dark && Math.hypot(x - this.pl.x, y - this.pl.y) > 4) continue;
      if (this.power.has(k)) { if (((this.time * 4) | 0) % 2) disc(g, OX + x * C + 8, y * C + 8, 4, COL.gold); }
      else rect(g, OX + x * C + 7, y * C + 7, 2, 2, '#ffd8b0');
    }
    for (const gh of this.ghosts) {
      if (this.v.dark && !this.fright && Math.hypot(gh.px - this.pl.px, gh.py - this.pl.py) > 70) continue;
      const c = this.fright ? (this.fright < 2 && ((this.time * 8) | 0) % 2 ? COL.white : '#2a3cff') : gh.c;
      const x = OX + gh.px + 2, y = gh.py + 2;
      disc(g, x + 6, y + 5, 5, c); rect(g, x + 1, y + 5, 11, 7, c);
      for (let k = 0; k < 3; k++) rect(g, x + 1 + k * 4, y + 12, 2, 1, c);
      rect(g, x + 3, y + 4, 3, 3, COL.white); rect(g, x + 7, y + 4, 3, 3, COL.white);
      rect(g, x + 4 + DIR[gh.dir][0], y + 5 + DIR[gh.dir][1], 1, 1, COL.ink); rect(g, x + 8 + DIR[gh.dir][0], y + 5 + DIR[gh.dir][1], 1, 1, COL.ink);
    }
    const p = this.pl, mouth = Math.abs(Math.sin(this.time * 14)) * 4;
    const cx = OX + p.px + 8, cy = p.py + 8;
    disc(g, cx, cy, 6, COL.gold);
    const [dx, dy] = DIR[p.dir];
    for (let i = 0; i <= 6; i++) { const w = Math.round((i / 6) * mouth); rect(g, cx + dx * i - Math.abs(dy) * w, cy + dy * i - Math.abs(dx) * w, Math.abs(dy) * w * 2 + 1, Math.abs(dx) * w * 2 + 1, this.bg); }
  }
}
export default module(Muncher);
