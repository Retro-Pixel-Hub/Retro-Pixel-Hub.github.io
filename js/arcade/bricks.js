// BRICK BREAKER. Params: layout, speed, paddle, lives, tough (chance of 2-hit bricks), multi (extra ball every N bricks)
import { ArcadeGame, module, COL, PIECES, rect, block, clamp, rand } from './kit.js';

const BW = 24, BH = 10, COLS = 12, ROWS = 9, OX = 16, OY = 24;

const PATTERNS = {
  wall: () => true,
  pyramid: (x, y) => Math.abs(x - 5.5) <= y * 0.7 + 0.5,
  checker: (x, y) => (x + y) % 2 === 0,
  stripes: (x, y) => y % 2 === 0,
  diamond: (x, y) => Math.abs(x - 5.5) + Math.abs(y - 4) * 1.4 <= 6,
  invader: (x, y) => ['000100001000', '000010010000', '000111111000', '001101101100', '011111111110', '010111111010', '010100001010', '000011110000', '000000000000'][y][x] === '1',
  heart: (x, y) => ['001100001100', '011110011110', '111111111111', '111111111111', '011111111110', '001111111100', '000111111000', '000011110000', '000001100000'][y][x] === '1',
  fortress: (x, y) => y === 0 || x === 0 || x === COLS - 1 || (y === 4 && x > 2 && x < 9),
  columns: (x) => x % 3 !== 1,
  random: () => Math.random() < 0.6,
};

class Bricks extends ArcadeGame {
  init() { this.controls = 'LEFT/RIGHT MOVE  A LAUNCH'; }
  reset() {
    this.level = this.level && this.state === 'play' ? this.level : 1;
    this.lives = this.v.lives ?? 3;
    this.pw = this.v.paddle || 48;
    this.px = 160 - this.pw / 2;
    this.build();
  }
  onStart() { this.level = 1; this.lives = this.v.lives ?? 3; this.build(); }
  build() {
    const pat = PATTERNS[this.v.layout] || PATTERNS.wall;
    this.bricks = [];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (!pat(x, y)) continue;
      const hp = Math.random() < (this.v.tough || 0) + this.level * 0.05 ? 2 : 1;
      this.bricks.push({ x: OX + x * BW, y: OY + y * BH, hp, c: PIECES[y % PIECES.length] });
    }
    this.hits = 0;
    this.serve();
  }
  serve() { this.balls = [{ x: 0, y: 0, vx: 0, vy: 0, stuck: true }]; }
  spd() { return (this.v.speed || 150) * (1 + (this.level - 1) * 0.1); }
  onPress(b) {
    if (b === 'a' || b === 'up') for (const ball of this.balls) if (ball.stuck) {
      ball.stuck = false; const a = rand(-0.5, 0.5); ball.vx = Math.sin(a) * this.spd(); ball.vy = -Math.cos(a) * this.spd(); this.sfx('select');
    }
  }
  step(dt) {
    const dir = (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
    this.px = clamp(this.px + dir * 220 * dt, 2, 318 - this.pw);
    const py = 252;
    for (const b of this.balls) {
      if (b.stuck) { b.x = this.px + this.pw / 2; b.y = py - 4; continue; }
      const steps = 4;
      for (let s = 0; s < steps; s++) {
        b.x += (b.vx * dt) / steps; b.y += (b.vy * dt) / steps;
        if (b.x < 2) { b.x = 2; b.vx = Math.abs(b.vx); this.sfx('turn'); }
        if (b.x > 314) { b.x = 314; b.vx = -Math.abs(b.vx); this.sfx('turn'); }
        if (b.y < 2) { b.y = 2; b.vy = Math.abs(b.vy); this.sfx('turn'); }
        if (b.vy > 0 && b.y + 4 >= py && b.y + 4 <= py + 6 && b.x + 4 >= this.px && b.x <= this.px + this.pw) {
          const rel = (b.x + 2 - (this.px + this.pw / 2)) / (this.pw / 2);
          const a = clamp(rel, -1, 1) * 1.05;
          b.vx = Math.sin(a) * this.spd(); b.vy = -Math.cos(a) * this.spd();
          this.sfx('move');
        }
        for (const br of this.bricks) {
          if (br.hp <= 0) continue;
          if (b.x + 4 > br.x && b.x < br.x + BW && b.y + 4 > br.y && b.y < br.y + BH) {
            const ox = Math.min(b.x + 4 - br.x, br.x + BW - b.x), oy = Math.min(b.y + 4 - br.y, br.y + BH - b.y);
            if (ox < oy) b.vx = -b.vx; else b.vy = -b.vy;
            br.hp--;
            if (br.hp <= 0) {
              this.addScore(10 * this.level, br.x + BW / 2, br.y, COL.white);
              this.burst(br.x + BW / 2, br.y + BH / 2, br.c, 8, 60);
              this.sfx('pop'); this.hits++;
              if (this.v.multi && this.hits % this.v.multi === 0) this.balls.push({ x: b.x, y: b.y, vx: -b.vx, vy: b.vy });
            } else this.sfx('turn');
            break;
          }
        }
      }
    }
    this.balls = this.balls.filter((b) => b.y < 280);
    if (!this.balls.length) {
      this.lives--; this.shake.add(3, 0.2); this.sfx('back'); this.buzz(30);
      if (this.lives <= 0) return this.end(false, 'OUT OF BALLS');
      this.serve();
    }
    if (this.bricks.every((b) => b.hp <= 0)) {
      this.addScore(100 * this.level, 160, 140, COL.gold);
      this.level++; this.sfx('levelup');
      if (this.level > (this.v.stages || 5)) return this.end(true, 'ALL CLEAR!');
      this.build();
    }
  }
  hud() { return { mid: `ST${this.level} BALL ${this.lives}` }; }
  draw(g) {
    for (const br of this.bricks) if (br.hp > 0) block(g, br.x, br.y, BW, BH, br.hp > 1 ? COL.grey : br.c);
    block(g, this.px, 252, this.pw, 6, COL.gb3);
    for (const b of this.balls) { rect(g, b.x, b.y, 4, 4, COL.white); }
  }
}
export default module(Bricks);
