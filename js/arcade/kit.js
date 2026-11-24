/**
 * Arcade kit — the shared base every catalogue game is built on.
 *
 * A game extends `ArcadeGame` and only implements the fun parts:
 *
 *   reset()          set up a fresh round (also drawn, dimmed, behind the intro)
 *   step(dt)         advance the simulation while playing
 *   draw(g)          draw the playfield (origin = top-left of the 320x272 area
 *                    under the HUD bar)
 *   onPress(btn)     a button went down while playing
 *   hud()            optional { mid } text for the HUD centre
 *
 * The kit handles the intro card, pause menu, game-over panel, HUD, best
 * scores, juice (particles / shake / pop-ups) and sound hooks, so every game
 * looks and feels like part of the same console.
 *
 * Variant parameters from the catalogue arrive as `this.v`.
 */
import { drawText } from '../core/pixeltext.js';
import { Particles, Shake, Popups } from '../core/fx.js';
import { getBest, submitScore, bumpStat } from '../core/storage.js';

export const W = 320, H = 288, HUD = 16, PW = 320, PH = 272;

export const COL = {
  bg: '#0f1410', ink: '#1b2420', panel: '#14201a',
  gb0: '#0f380f', gb1: '#306230', gb2: '#8bac0f', gb3: '#9bbc0f',
  white: '#f7f3e3', grey: '#8a948c', dim: '#5b6b5e',
  red: '#ff5964', orange: '#ff8f5a', gold: '#ffd84a', mint: '#b8f28a',
  green: '#5fae3f', blue: '#7cc8e8', navy: '#3a7aa8', purple: '#b48cff', pink: '#ff8fb1', brown: '#a8763f',
};
/** Seven bright piece colours used across puzzle games. */
export const PIECES = [COL.red, COL.orange, COL.gold, COL.mint, COL.blue, COL.purple, COL.pink];

export const DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };

export const rand = (a, b) => a + Math.random() * (b - a);
export const irand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
export const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** Bevelled block, the basic "tile" look used by many games. */
export function block(g, x, y, w, h, color, ink = COL.ink) {
  x = Math.round(x); y = Math.round(y);
  g.fillStyle = ink; g.fillRect(x, y, w, h);
  g.fillStyle = color; g.fillRect(x + 1, y + 1, w - 2, h - 2);
  if (w > 4 && h > 4) {
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + 1, y + 1, w - 2, 1); g.fillRect(x + 1, y + 1, 1, h - 2);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 1, y + h - 2, w - 2, 1); g.fillRect(x + w - 2, y + 1, 1, h - 2);
  }
}
export function rect(g, x, y, w, h, color) { g.fillStyle = color; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
/** Pixel circle (filled), no anti-aliasing. */
export function disc(g, cx, cy, r, color) {
  g.fillStyle = color;
  cx = Math.round(cx); cy = Math.round(cy);
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(r * r - y * y + r * 0.6));
    g.fillRect(cx - w, cy + y, w * 2 + 1, 1);
  }
}
export function text(g, s, x, y, o) { return drawText(g, s, x, y, o); }

/** Word-wrap for the 8px font (8px per character). */
export function wrap(str, max = 34) {
  const out = [];
  let line = '';
  for (const word of String(str).toUpperCase().split(/\s+/)) {
    if ((line + ' ' + word).trim().length > max) { out.push(line); line = word; } else line = (line + ' ' + word).trim();
  }
  if (line) out.push(line);
  return out;
}

export class ArcadeGame {
  constructor(api) {
    this.api = api;
    this.g = api.ctx;
    this.v = api.variant || {};
    this.meta = api.meta || { id: 'game', title: 'Game' };
    this.fx = new Particles(400);
    this.shake = new Shake();
    this.popups = new Popups();
    this.state = 'intro';
    this.time = 0;
    this.t = 0;
    this.score = 0;
    this.unsub = api.input.on((b, down) => (down ? this.#press(b) : this.onRelease?.(b)));
    this.init?.();
    this.reset();
  }

  // ---- lifecycle ------------------------------------------------------------
  get id() { return this.meta.id; }
  get lowPower() { return this.state !== 'play' && !this.animatedIdle; }
  isDown(b) { return this.api.input.isDown(b); }
  sfx(name) { this.api.audio.play(name); }
  buzz(ms) { this.api.vibrate(ms); }
  pause() { if (this.state === 'play') this.state = 'paused'; }
  destroy() { this.unsub?.(); }

  #begin() {
    this.score = 0;
    this.t = 0;
    this.fx.clear();
    this.popups.clear();
    this.reset();
    this.state = 'play';
    this.onStart?.();
  }

  #press(b) {
    switch (this.state) {
      case 'intro':
        if (b === 'a' || b === 'start') { this.sfx('select'); this.#begin(); }
        else if (b === 'b') { this.sfx('back'); this.api.exit(); }
        break;
      case 'play':
        if (b === 'start') { this.state = 'paused'; this.sfx('pause'); }
        else this.onPress(b);
        break;
      case 'paused':
        if (b === 'start' || b === 'a') { this.state = 'play'; this.sfx('pause'); }
        else if (b === 'b') { this.state = 'intro'; this.reset(); this.sfx('back'); }
        break;
      case 'over':
        if (this.overT < 0.6) return;
        if (b === 'a' || b === 'start') { this.sfx('select'); this.#begin(); }
        else if (b === 'b') { this.state = 'intro'; this.score = 0; this.reset(); this.sfx('back'); }
        break;
    }
  }

  onPress() {}
  step() {}
  draw() {}

  /** Finish the round. */
  end(won = false, msg = null) {
    if (this.state !== 'play') return;
    this.won = won;
    this.endMsg = msg || (won ? 'YOU WIN!' : 'GAME OVER');
    this.state = 'over';
    this.overT = 0;
    this.score = Math.max(0, Math.round(this.score));
    this.newBest = this.score > 0 && submitScore(this.id, 'default', this.score);
    this.best = getBest(this.id, 'default');
    bumpStat('plays');
    this.sfx(won ? 'levelup' : 'die');
    if (!won) { this.shake.add(4, 0.3); this.buzz([30, 30, 50]); }
    if (this.newBest) setTimeout(() => this.sfx('record'), 650);
  }

  addScore(n, x, y, color = COL.white) {
    this.score += n;
    if (x !== undefined) this.popups.add(`+${n}`, x, y, color);
  }
  burst(x, y, colors, count = 12, speed = 70) {
    this.fx.burst(x, y, { count, colors: Array.isArray(colors) ? colors : [colors], speed, life: 0.5, gravity: 140, up: 20 });
  }

  update(dt) {
    this.time += dt;
    this.fx.update(dt);
    this.popups.update(dt);
    this.shake.update(dt);
    if (this.state === 'play') { this.t += dt; this.step(dt); }
    else if (this.state === 'over') this.overT += dt;
  }

  // ---- drawing --------------------------------------------------------------
  render() {
    const g = this.g;
    g.fillStyle = this.bg || COL.bg;
    g.fillRect(0, 0, W, H);
    const [sx, sy] = this.shake.offset();
    g.save();
    g.translate(sx, sy + HUD);
    g.beginPath(); g.rect(0, 0, PW, PH); g.clip();
    this.draw(g);
    this.fx.draw(g);
    this.popups.draw(g);
    g.restore();
    this.#hud(g);
    if (this.state === 'intro') this.#intro(g);
    else if (this.state === 'paused') this.#paused(g);
    else if (this.state === 'over') this.#over(g);
  }

  #hud(g) {
    rect(g, 0, 0, W, HUD, COL.panel);
    rect(g, 0, HUD - 1, W, 1, COL.gb1);
    const h = this.hud?.() || {};
    text(g, h.left ?? String(this.score).padStart(6, '0'), 6, 4, { color: COL.white });
    if (h.mid) text(g, h.mid, W / 2, 4, { color: h.midColor || COL.mint, align: 'center' });
    const best = Math.max(getBest(this.id, 'default'), this.state === 'over' ? 0 : this.score);
    text(g, h.right ?? `HI ${String(best).padStart(6, '0')}`, W - 6, 4, { color: COL.gb3, align: 'right' });
  }

  #dim(g) {
    if (!this._dither) {
      const c = document.createElement('canvas'); c.width = c.height = 2;
      const cg = c.getContext('2d'); cg.fillStyle = '#0a110c'; cg.fillRect(0, 0, 1, 1); cg.fillRect(1, 1, 1, 1);
      this._dither = g.createPattern(c, 'repeat');
    }
    g.fillStyle = this._dither;
    g.fillRect(0, HUD, W, H - HUD);
  }

  panel(g, x, y, w, h) {
    rect(g, x + 1, y, w - 2, h, COL.ink); rect(g, x, y + 1, w, h - 2, COL.ink);
    rect(g, x + 2, y + 1, w - 4, h - 2, COL.gb3); rect(g, x + 1, y + 2, w - 2, h - 4, COL.gb3);
    rect(g, x + 3, y + 3, w - 6, h - 6, COL.gb0);
    rect(g, x + 3, y + 3, w - 6, 1, COL.gb1);
  }

  #intro(g) {
    this.#dim(g);
    const m = this.meta;
    const how = wrap(m.how || m.desc || '', 32).slice(0, 6);
    const ctrl = wrap(this.controls || m.controls || 'D-PAD MOVE  A ACTION', 32).slice(0, 2);
    const h = 104 + how.length * 11 + ctrl.length * 11;
    const y = Math.max(HUD + 6, Math.round((H + HUD - h) / 2));
    this.panel(g, 16, y, W - 32, h);
    const title = m.title.toUpperCase();
    text(g, title, W / 2, y + 12, { size: title.length > 17 ? 8 : 16, color: m.accent || COL.gold, align: 'center' });
    text(g, (m.tagline || '').toUpperCase().slice(0, 34), W / 2, y + 34, { color: COL.gb2, align: 'center' });
    how.forEach((l, i) => text(g, l, W / 2, y + 52 + i * 11, { color: COL.white, align: 'center' }));
    const cy = y + 58 + how.length * 11;
    ctrl.forEach((l, i) => text(g, l, W / 2, cy + i * 11, { color: COL.blue, align: 'center' }));
    const best = getBest(this.id, 'default');
    text(g, `BEST ${String(best).padStart(6, '0')}`, W / 2, y + h - 34, { color: COL.gb3, align: 'center' });
    if (((this.time * 2) | 0) % 2 === 0) text(g, 'PRESS START', W / 2, y + h - 18, { color: COL.gold, align: 'center' });
  }

  #paused(g) {
    this.#dim(g);
    const w = 180, h = 84, x = (W - w) / 2, y = 100;
    this.panel(g, x, y, w, h);
    text(g, 'PAUSED', W / 2, y + 14, { size: 16, color: COL.white, align: 'center' });
    text(g, 'START  RESUME', W / 2, y + 44, { color: COL.gb3, align: 'center' });
    text(g, 'B      MENU  ', W / 2, y + 60, { color: COL.gb2, align: 'center' });
  }

  #over(g) {
    this.#dim(g);
    const w = 232, h = 132, x = (W - w) / 2;
    const y = Math.round(78 - Math.max(0, 1 - this.overT * 4) * 200);
    this.panel(g, x, y, w, h);
    const msg = this.endMsg.toUpperCase();
    text(g, msg, W / 2, y + 14, { size: msg.length > 12 ? 8 : 16, color: this.won ? COL.gold : COL.red, align: 'center' });
    if (this.endSub) text(g, this.endSub.toUpperCase(), W / 2, y + 36, { color: COL.grey, align: 'center' });
    text(g, 'SCORE', x + 22, y + 54, { color: COL.gb2 });
    text(g, String(this.score), x + w - 22, y + 54, { color: COL.white, align: 'right' });
    text(g, 'BEST', x + 22, y + 70, { color: COL.gb2 });
    text(g, String(this.best), x + w - 22, y + 70, { color: COL.white, align: 'right' });
    if (this.newBest && ((this.time * 4) | 0) % 2 === 0) text(g, 'NEW BEST!', W / 2, y + 88, { color: COL.gold, align: 'center' });
    if (this.overT > 0.6) text(g, 'A RETRY   B MENU', W / 2, y + 110, { color: COL.white, align: 'center' });
  }
}

/** Wrap a game class as a module the shell can load. */
export const module = (Game) => ({ width: W, height: H, create: (api) => new Game(api) });

/**
 * Grid cursor helper for puzzle/board games.
 * Moves within [0,cols) x [0,rows), wrapping around the edges.
 */
export function moveCursor(cur, btn, cols, rows, wrapAround = true) {
  const d = DIR[btn];
  if (!d) return false;
  let x = cur.x + d[0], y = cur.y + d[1];
  if (wrapAround) { x = (x + cols) % cols; y = (y + rows) % rows; }
  else { x = clamp(x, 0, cols - 1); y = clamp(y, 0, rows - 1); }
  const moved = x !== cur.x || y !== cur.y;
  cur.x = x; cur.y = y;
  return moved;
}

/** Draw a blinking selection frame around a cell. */
export function cursorFrame(g, x, y, w, h, time, color = COL.gold) {
  if (((time * 4) | 0) % 4 === 3) return;
  g.fillStyle = color;
  g.fillRect(x - 2, y - 2, w + 4, 2); g.fillRect(x - 2, y + h, w + 4, 2);
  g.fillRect(x - 2, y, 2, h); g.fillRect(x + w, y, 2, h);
}
