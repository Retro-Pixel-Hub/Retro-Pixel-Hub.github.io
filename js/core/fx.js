/**
 * "Juice" helpers shared by all games: pixel particles, screen shake and
 * floating score pop-ups. Everything snaps to whole pixels.
 */
import { drawText } from './pixeltext.js';

export class Particles {
  constructor(max = 400) { this.list = []; this.max = max; }

  burst(x, y, { count = 12, colors = ['#fff'], speed = 60, life = 0.6, gravity = 120, size = [1, 2], up = 0 } = {}) {
    for (let i = 0; i < count; i++) {
      if (this.list.length >= this.max) this.list.shift();
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.list.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - up,
        g: gravity,
        life: life * (0.6 + Math.random() * 0.6),
        age: 0,
        c: colors[(Math.random() * colors.length) | 0],
        s: size[0] + ((Math.random() * (size[1] - size[0] + 1)) | 0),
      });
    }
  }

  /** Slow rising puff, e.g. chimney smoke. */
  puff(x, y, color = '#d8dde0') {
    this.list.push({ x, y, vx: 4 + Math.random() * 4, vy: -10 - Math.random() * 4, g: 0, life: 1.6, age: 0, c: color, s: 2, shrink: true });
  }

  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.age += dt;
      if (p.age >= p.life) { L.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(ctx, ox = 0, oy = 0) {
    for (const p of this.list) {
      const t = p.age / p.life;
      // blink out at the end instead of alpha fading (more "8-bit")
      if (t > 0.75 && ((p.age * 30) | 0) % 2) continue;
      const s = p.shrink && t > 0.5 ? 1 : p.s;
      ctx.fillStyle = p.c;
      ctx.fillRect(Math.round(p.x + ox), Math.round(p.y + oy), s, s);
    }
  }
  clear() { this.list.length = 0; }
}

export class Shake {
  constructor() { this.t = 0; this.mag = 0; }
  add(mag, dur = 0.25) { this.mag = Math.max(this.mag, mag); this.t = Math.max(this.t, dur); this.dur = Math.max(this.dur || 0, dur); }
  update(dt) { this.t = Math.max(0, this.t - dt); if (!this.t) { this.mag = 0; this.dur = 0; } }
  offset() {
    if (!this.t) return [0, 0];
    const m = Math.ceil(this.mag * (this.t / this.dur));
    return [Math.round((Math.random() * 2 - 1) * m), Math.round((Math.random() * 2 - 1) * m)];
  }
}

export class Popups {
  constructor() { this.list = []; }
  add(text, x, y, color = '#fff', life = 0.9) { this.list.push({ text, x, y, color, life, age: 0 }); }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.age += dt;
      if (p.age >= p.life) this.list.splice(i, 1);
    }
  }
  draw(ctx, ox = 0, oy = 0) {
    for (const p of this.list) {
      const t = p.age / p.life;
      if (t > 0.7 && ((p.age * 24) | 0) % 2) continue;
      const rise = Math.round(Math.min(1, t * 2.5) * 10);
      drawText(ctx, p.text, p.x + ox, p.y + oy - rise, { color: p.color, align: 'center', outline: '#1b2420' });
    }
  }
  clear() { this.list.length = 0; }
}
