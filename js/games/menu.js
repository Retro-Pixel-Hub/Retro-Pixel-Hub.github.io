/**
 * Cartridge menu: the first thing the console shows (index.html).
 *
 * D-pad up/down   move through the list (hold to scroll fast)
 * D-pad left/right switch shelf: ALL, ARCADE, PUZZLE, BOARD, FAVS, RECENT
 * A / START       play the highlighted game
 * SELECT          star / unstar it as a favourite
 * B               jump back to the top of the list
 * Touch: tap a row to highlight it, tap it again to play; tap a shelf name or
 * its arrows to switch; swipe up/down to move.
 */
import { GAMES } from '../catalog.js';
import { drawText, textWidth } from '../core/pixeltext.js';
import { storage, getBest, getBestAny } from '../core/storage.js';

const W = 320, H = 288;
const C = {
  bg: '#0f1410', ink: '#1b2420', panel: '#14201a', line: '#26352b',
  gb0: '#0f380f', gb1: '#306230', gb3: '#9bbc0f',
  white: '#f7f3e3', grey: '#8a948c', dim: '#5b6b5e', gold: '#ffd84a',
};
const SHELVES = [
  { key: 'all', label: 'ALL GAMES' },
  { key: 'Arcade', label: 'ARCADE' },
  { key: 'Puzzle', label: 'PUZZLE' },
  { key: 'Board', label: 'BOARD' },
  { key: 'favs', label: 'FAVOURITES' },
  { key: 'recent', label: 'RECENT' },
];

const LIST_Y = 44, ROW_H = 20, ROWS = 8;        // list area: y 44..204
const INFO_Y = LIST_Y + ROWS * ROW_H + 6;       // description panel
const STATE_KEY = 'menuState';

function wrapLines(str, max) {
  const out = [];
  let line = '';
  for (const word of String(str).toUpperCase().split(/\s+/)) {
    if ((line + ' ' + word).trim().length > max) { out.push(line); line = word; } else line = (line + ' ' + word).trim();
  }
  if (line) out.push(line);
  return out;
}

function fit(text, maxPx) {
  text = text.toUpperCase();
  if (textWidth(text) <= maxPx) return text;
  while (text.length > 1 && textWidth(`${text}..`) > maxPx) text = text.slice(0, -1);
  return `${text.trimEnd()}..`;
}

function drawIcon(g, game, x, y, s = 2) {
  const icon = (game.icon || '').padEnd(64, '0');
  g.fillStyle = '#00000099';
  for (let i = 0; i < 64; i++) if (icon[i] !== '0') g.fillRect(x + (i % 8) * s + 1, y + ((i / 8) | 0) * s + 1, s, s);
  for (let i = 0; i < 64; i++) {
    if (icon[i] === '0') continue;
    g.fillStyle = icon[i] === '2' ? C.white : game.accent;
    g.fillRect(x + (i % 8) * s, y + ((i / 8) | 0) * s, s, s);
  }
}

class Menu {
  constructor(api) {
    this.api = api;
    this.g = api.ctx;
    this.lowPower = true;
    this.time = 0;
    this.launching = null;
    this.favs = new Set(storage.get('favs', []));
    this.recent = storage.get('recent', []);
    this.held = null; this.heldT = 0;
    this.suppressA = 0;
    this.toast = null;

    const saved = storage.get(STATE_KEY, {});
    this.shelf = Math.max(0, SHELVES.findIndex((s) => s.key === saved.shelf));
    this.build();
    const idx = this.list.findIndex((g) => g.id === saved.id);
    this.sel = idx >= 0 ? idx : 0;
    this.top = 0;
    this.scrollTo();

    this.unsub = api.input.on((b, down) => this.onInput(b, down));
    // The screen captures the pointer for swipes, so listen on window in the
    // capture phase: that runs before the swipe handler turns a tap into A.
    this.downAt = null;
    this.onDown = (e) => { this.downAt = { x: e.clientX, y: e.clientY }; };
    this.onPointer = (e) => this.pointer(e);
    window.addEventListener('pointerdown', this.onDown, true);
    window.addEventListener('pointerup', this.onPointer, true);
  }

  build() {
    const key = SHELVES[this.shelf].key;
    if (key === 'all') this.list = GAMES;
    else if (key === 'favs') this.list = GAMES.filter((g) => this.favs.has(g.id));
    else if (key === 'recent') this.list = this.recent.map((id) => GAMES.find((g) => g.id === id)).filter(Boolean);
    else this.list = GAMES.filter((g) => g.cat === key || (key === 'Arcade' && g.cat === 'Featured'));
  }

  save() {
    storage.set(STATE_KEY, { shelf: SHELVES[this.shelf].key, id: this.list[this.sel]?.id });
  }

  scrollTo() {
    if (this.sel < this.top) this.top = this.sel;
    if (this.sel >= this.top + ROWS) this.top = this.sel - ROWS + 1;
    this.top = Math.max(0, Math.min(this.top, Math.max(0, this.list.length - ROWS)));
  }

  move(d, wrapAround = true) {
    const n = this.list.length;
    if (!n) return;
    let s = this.sel + d;
    if (wrapAround) s = (s + n) % n; else s = Math.max(0, Math.min(n - 1, s));
    if (s === this.sel) return;
    this.sel = s;
    this.scrollTo();
    this.api.audio.play('move');
    this.save();
  }

  switchShelf(d) {
    const cur = this.list[this.sel]?.id;
    this.shelf = (this.shelf + d + SHELVES.length) % SHELVES.length;
    this.build();
    const idx = this.list.findIndex((g) => g.id === cur);
    this.sel = idx >= 0 ? idx : 0;
    this.top = 0;
    this.scrollTo();
    this.api.audio.play('move');
    this.save();
  }

  toggleFav() {
    const game = this.list[this.sel];
    if (!game) return;
    if (this.favs.has(game.id)) { this.favs.delete(game.id); this.flash('REMOVED FROM FAVOURITES'); } else { this.favs.add(game.id); this.flash('ADDED TO FAVOURITES'); }
    storage.set('favs', [...this.favs]);
    this.api.audio.play('select');
    if (SHELVES[this.shelf].key === 'favs') { this.build(); this.sel = Math.min(this.sel, Math.max(0, this.list.length - 1)); this.scrollTo(); }
    this.save();
  }

  flash(msg) { this.toast = { msg, t: 1.4 }; }

  launch() {
    const game = this.list[this.sel];
    if (!game || this.launching) return;
    this.save();
    this.launching = { game, t: 0 };
    this.lowPower = false;
    this.api.audio.play('select');
    this.api.vibrate(15);
  }

  onInput(b, down) {
    if (!down) { if (b === this.held) this.held = null; return; }
    if (this.launching) return;
    switch (b) {
      case 'up': this.move(-1); this.held = 'up'; this.heldT = -0.28; break;
      case 'down': this.move(1); this.held = 'down'; this.heldT = -0.28; break;
      case 'left': this.switchShelf(-1); break;
      case 'right': this.switchShelf(1); break;
      case 'a':
        if (performance.now() - this.suppressA < 120) return;
        this.launch(); break;
      case 'start': this.launch(); break;
      case 'select': this.toggleFav(); break;
      case 'b':
        if (this.sel !== 0) { this.sel = 0; this.top = 0; this.api.audio.play('back'); this.save(); }
        break;
      default: break;
    }
  }

  /** Taps on the screen: shelf arrows / rows. Runs before the swipe handler's "tap = A". */
  pointer(e) {
    if (this.launching || !this.downAt) return;
    const moved = Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y);
    this.downAt = null;
    if (moved > 12) return; // a swipe, not a tap
    const r = this.api.canvas.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    if (y >= 20 && y < LIST_Y - 2) {
      this.suppressA = performance.now();
      this.switchShelf(x < W / 2 ? -1 : 1);
      return;
    }
    if (y >= LIST_Y && y < LIST_Y + ROWS * ROW_H) {
      const i = this.top + Math.floor((y - LIST_Y) / ROW_H);
      if (i < this.list.length && i !== this.sel) {
        this.suppressA = performance.now();
        this.sel = i;
        this.api.audio.play('move');
        this.save();
      }
      return;
    }
    // taps elsewhere (info panel) do nothing; the swipe handler's A still plays
  }

  update(dt) {
    this.time += dt;
    if (this.toast && (this.toast.t -= dt) <= 0) this.toast = null;
    if (this.held && !this.launching) {
      this.heldT += dt;
      while (this.heldT >= 0.055) { this.heldT -= 0.055; this.move(this.held === 'up' ? -1 : 1, false); }
    }
    if (this.launching) {
      this.launching.t += dt;
      if (this.launching.t > 0.45 && !this.launching.gone) {
        this.launching.gone = true;
        location.href = `play.html?game=${encodeURIComponent(this.launching.game.id)}`;
      }
    }
  }

  render() {
    const g = this.g;
    g.fillStyle = C.bg; g.fillRect(0, 0, W, H);

    // header
    g.fillStyle = C.gb0; g.fillRect(0, 0, W, 18);
    drawText(g, 'PIXEL HUB', 8, 5, { color: C.gb3 });
    drawText(g, 'SELECT A GAME', W - 8, 5, { color: C.white, align: 'right' });

    // shelf tabs
    const shelf = SHELVES[this.shelf];
    g.fillStyle = C.panel; g.fillRect(0, 18, W, 22);
    const blink = Math.floor(this.time * 2) % 2 === 0;
    drawText(g, '<', 10, 25, { color: blink ? C.gold : C.dim });
    drawText(g, '>', W - 18, 25, { color: blink ? C.gold : C.dim });
    drawText(g, `${shelf.label}  ${this.list.length}`, W / 2, 25, { color: C.gold, align: 'center' });
    const dotsW = SHELVES.length * 8;
    for (let i = 0; i < SHELVES.length; i++) {
      g.fillStyle = i === this.shelf ? C.gb3 : C.line;
      g.fillRect(W / 2 - dotsW / 2 + i * 8 + 2, 36, 4, 2);
    }

    // list
    if (!this.list.length) {
      const msg = shelf.key === 'favs' ? ['NO FAVOURITES YET', '', 'PRESS SELECT ON ANY', 'GAME TO STAR IT'] : ['NOTHING PLAYED YET', '', 'PICK A GAME FROM', 'ALL GAMES'];
      msg.forEach((m, i) => drawText(g, m, W / 2, 92 + i * 14, { color: i ? C.grey : C.white, align: 'center' }));
    }
    for (let r = 0; r < ROWS; r++) {
      const i = this.top + r;
      const game = this.list[i];
      if (!game) break;
      const y = LIST_Y + r * ROW_H;
      const selected = i === this.sel;
      if (selected) {
        g.fillStyle = C.gb1; g.fillRect(4, y, W - 14, ROW_H - 2);
        g.fillStyle = C.gb3; g.fillRect(4, y, 2, ROW_H - 2);
      } else if (r % 2) {
        g.fillStyle = '#121b15'; g.fillRect(4, y, W - 14, ROW_H - 2);
      }
      drawIcon(g, game, 12, y + 1, 2);
      const best = game.id === 'snake' ? getBestAny('snake', ['classic', 'endless', 'timed', 'village']) : getBest(game.id, 'default');
      const fav = this.favs.has(game.id);
      const right = best ? String(best) : '';
      const rightW = right ? textWidth(right) + 6 : 0;
      drawText(g, fit(game.title, W - 46 - rightW - (fav ? 12 : 0)), 34, y + 5, { color: selected ? C.white : C.grey });
      if (right) drawText(g, right, W - 14, y + 5, { color: selected ? C.gold : C.dim, align: 'right' });
      if (fav) drawText(g, '*', W - 14 - rightW - 8, y + 5, { color: C.gold });
    }

    // scrollbar
    if (this.list.length > ROWS) {
      const trackH = ROWS * ROW_H - 2;
      const h = Math.max(10, (trackH * ROWS) / this.list.length);
      const y = LIST_Y + ((trackH - h) * this.top) / (this.list.length - ROWS);
      g.fillStyle = C.line; g.fillRect(W - 6, LIST_Y, 2, trackH);
      g.fillStyle = C.gb3; g.fillRect(W - 6, Math.round(y), 2, Math.round(h));
    }

    // info panel
    g.fillStyle = C.panel; g.fillRect(0, INFO_Y - 2, W, H - INFO_Y + 2);
    g.fillStyle = C.line; g.fillRect(0, INFO_Y - 2, W, 1);
    const game = this.list[this.sel];
    if (game) {
      drawText(g, `${(game.cat === 'Featured' ? 'FEATURED' : game.cat.toUpperCase())} - ${game.tagline.toUpperCase()}`, 8, INFO_Y + 4, { color: game.accent });
      wrapLines(game.how, 38).slice(0, 3).forEach((l, i) => drawText(g, l, 8, INFO_Y + 18 + i * 11, { color: C.white }));
    }
    drawText(g, 'A PLAY  <> SHELF  SELECT STAR', W / 2, H - 13, { color: C.dim, align: 'center' });

    if (this.toast) {
      const tw = textWidth(this.toast.msg) + 16;
      g.fillStyle = C.gb0; g.fillRect((W - tw) / 2, 120, tw, 20);
      g.fillStyle = C.gb3; g.fillRect((W - tw) / 2, 120, tw, 1); g.fillRect((W - tw) / 2, 139, tw, 1);
      drawText(g, this.toast.msg, W / 2, 126, { color: C.white, align: 'center' });
    }

    // cartridge insert: wipe to black
    if (this.launching) {
      const t = Math.min(1, this.launching.t / 0.4);
      g.fillStyle = C.bg;
      g.fillRect(0, 0, W, Math.round((H / 2) * t));
      g.fillRect(0, H - Math.round((H / 2) * t), W, Math.round((H / 2) * t));
      if (t > 0.6) drawText(g, this.launching.game.title.toUpperCase(), W / 2, H / 2 - 4, { color: C.gb3, align: 'center' });
    }
  }

  pause() { this.held = null; }
  destroy() {
    this.unsub?.();
    window.removeEventListener('pointerdown', this.onDown, true);
    window.removeEventListener('pointerup', this.onPointer, true);
  }
}

export default {
  id: 'menu',
  title: 'Retro Pixel Hub',
  width: W,
  height: H,
  create: (api) => new Menu(api),
};
