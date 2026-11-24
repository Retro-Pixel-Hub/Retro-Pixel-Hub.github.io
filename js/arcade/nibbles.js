// NIBBLES — classic snake in walled arenas. Params: layout, speed, speedUp, wrap, grow, poison
import { ArcadeGame, module, COL, DIR, OPP, rect, block, irand } from './kit.js';

const C = 16, COLS = 20, ROWS = 17;

function layout(name) {
  const w = new Uint8Array(COLS * ROWS);
  const set = (x, y) => { if (x >= 0 && y >= 0 && x < COLS && y < ROWS) w[x + y * COLS] = 1; };
  const box = () => { for (let x = 0; x < COLS; x++) { set(x, 0); set(x, ROWS - 1); } for (let y = 0; y < ROWS; y++) { set(0, y); set(COLS - 1, y); } };
  switch (name) {
    case 'box': box(); break;
    case 'cross': box(); for (let x = 5; x < 15; x++) set(x, 8); for (let y = 3; y < 14; y++) set(10, y); break;
    case 'rooms': box(); for (let x = 0; x < COLS; x++) if (x < 4 || x > 6 && x < 13 || x > 15) set(x, 8); for (let y = 0; y < ROWS; y++) if (y < 3 || y > 5 && y < 11 || y > 13) set(10, y); break;
    case 'pillars': box(); for (let y = 3; y < ROWS - 2; y += 4) for (let x = 3; x < COLS - 2; x += 4) { set(x, y); set(x + 1, y); } break;
    case 'tunnels': for (let x = 0; x < COLS; x++) { if (x < 8 || x > 11) { set(x, 0); set(x, ROWS - 1); } } for (let y = 4; y < 13; y++) { set(4, y); set(15, y); } break;
    case 'spiral': box(); for (let x = 3; x < 17; x++) set(x, 3); for (let y = 3; y < 14; y++) set(16, y); for (let x = 5; x < 17; x++) set(x, 13); for (let y = 6; y < 14; y++) set(3, y); for (let x = 3; x < 13; x++) set(x, 6); for (let y = 6; y < 11; y++) set(13, y); break;
    case 'hourglass': box(); for (let i = 0; i < 6; i++) { set(3 + i, 2 + i); set(16 - i, 2 + i); set(3 + i, 14 - i); set(16 - i, 14 - i); } break;
    case 'rails': for (let y = 2; y < ROWS; y += 4) for (let x = 2; x < COLS - 2; x++) if (x % 9 !== 0) set(x, y); break;
    case 'random': box(); for (let i = 0; i < 22; i++) { const x = irand(2, COLS - 3), y = irand(2, ROWS - 3); if (Math.abs(y - 8) > 1 || x > 10) set(x, y); } break;
    default: break;
  }
  // keep the spawn lane clear
  for (let x = 1; x < COLS - 3; x++) w[x + 8 * COLS] = 0;
  return w;
}

class Nibbles extends ArcadeGame {
  init() { this.controls = 'D-PAD STEER  START PAUSE'; this.bg = COL.gb0; }
  reset() {
    this.walls = layout(this.v.layout);
    this.snake = [{ x: 5, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 8 }];
    this.dir = 'right'; this.queue = []; this.grow = 0; this.acc = 0; this.eaten = 0;
    this.food = this.spawn(); this.poison = this.v.poison ? this.spawn() : null;
  }
  free(x, y) { return !this.walls[x + y * COLS] && !this.snake.some((s) => s.x === x && s.y === y); }
  spawn() { for (let i = 0; i < 500; i++) { const x = irand(0, COLS - 1), y = irand(0, ROWS - 1); if (this.free(x, y) && !(this.food && this.food.x === x && this.food.y === y)) return { x, y }; } return { x: 1, y: 1 }; }
  onPress(b) {
    if (!DIR[b]) return;
    const last = this.queue.at(-1) || this.dir;
    if (b !== last && b !== OPP[last] && this.queue.length < 3) this.queue.push(b);
  }
  speed() { return Math.min(18, (this.v.speed || 8) + (this.v.speedUp ?? 0.2) * this.eaten); }
  step(dt) {
    this.acc += dt;
    const s = 1 / this.speed();
    while (this.acc >= s && this.state === 'play') { this.acc -= s; this.tick(); }
  }
  tick() {
    if (this.queue.length) this.dir = this.queue.shift();
    const [dx, dy] = DIR[this.dir];
    let x = this.snake[0].x + dx, y = this.snake[0].y + dy;
    if (this.v.wrap !== false) { x = (x + COLS) % COLS; y = (y + ROWS) % ROWS; }
    else if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return this.end(false, 'BONK!');
    if (this.walls[x + y * COLS]) return this.end(false, 'HIT A WALL');
    const body = this.grow ? this.snake.length : this.snake.length - 1;
    for (let i = 0; i < body; i++) if (this.snake[i].x === x && this.snake[i].y === y) return this.end(false, 'BIT YOURSELF');
    this.snake.unshift({ x, y });
    if (this.grow) this.grow--; else this.snake.pop();
    if (x === this.food.x && y === this.food.y) {
      this.eaten++; this.grow += this.v.grow || 1;
      this.addScore(10 + this.eaten, x * C + 8, y * C, COL.gold);
      this.burst(x * C + 8, y * C + 8, [COL.red, COL.gold, COL.white]);
      this.sfx('eat'); this.buzz(10);
      this.food = this.spawn();
      if (this.v.poison && this.eaten % 3 === 0) this.poison = this.spawn();
    } else if (this.poison && x === this.poison.x && y === this.poison.y) {
      this.end(false, 'POISONED!');
    }
  }
  hud() { return { mid: `LEN ${this.snake.length}` }; }
  draw(g) {
    this.bg = COL.gb0;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (this.walls[x + y * COLS]) block(g, x * C, y * C, C, C, COL.gb1, '#071d07');
      else if ((x + y) % 2) rect(g, x * C, y * C, C, C, '#123f12');
    }
    const f = this.food, bob = Math.round(Math.sin(this.time * 6));
    block(g, f.x * C + 3, f.y * C + 3 + bob, 10, 10, COL.red);
    rect(g, f.x * C + 7, f.y * C + 1 + bob, 2, 3, COL.green);
    if (this.poison) { block(g, this.poison.x * C + 3, this.poison.y * C + 3, 10, 10, COL.purple); rect(g, this.poison.x * C + 6, this.poison.y * C + 6, 4, 4, COL.ink); }
    this.snake.forEach((s, i) => block(g, s.x * C + 1, s.y * C + 1, 14, 14, i === 0 ? COL.gold : i % 2 ? COL.gb3 : COL.gb2, '#071d07'));
    const h = this.snake[0], [dx, dy] = DIR[this.dir];
    rect(g, h.x * C + 6 + dx * 3 - dy * 3, h.y * C + 6 + dy * 3 - dx * 3, 2, 2, COL.ink);
    rect(g, h.x * C + 6 + dx * 3 + dy * 3, h.y * C + 6 + dy * 3 + dx * 3, 2, 2, COL.ink);
  }
}
export default module(Nibbles);
