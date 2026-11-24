/**
 * Unified input: keyboard, on-screen D-pad / buttons and swipe gestures all
 * become the same eight virtual buttons:
 *
 *    up  down  left  right   a  b   start  select
 *
 * Games subscribe with `input.on((button, pressed) => ...)` or poll
 * `input.isDown(button)`.
 */

export const BUTTONS = ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select'];

const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  KeyZ: 'a', KeyJ: 'a', Space: 'a',
  KeyX: 'b', KeyK: 'b', Backspace: 'b',
  Enter: 'start', Escape: 'start', KeyP: 'start',
  ShiftLeft: 'select', ShiftRight: 'select', Tab: 'select',
};

export class Input {
  constructor({ onFirstGesture, haptic } = {}) {
    this.down = new Set();
    this.listeners = new Set();
    this.onFirstGesture = onFirstGesture;
    this.haptic = haptic || (() => {});
    this.enabled = true;
    this._gestured = false;
    this._bindKeyboard();
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  isDown(btn) { return this.down.has(btn); }

  press(btn) {
    this._gesture();
    if (this.down.has(btn)) return;
    this.down.add(btn);
    if (this.enabled) for (const fn of this.listeners) fn(btn, true);
  }
  release(btn) {
    if (!this.down.has(btn)) return;
    this.down.delete(btn);
    if (this.enabled) for (const fn of this.listeners) fn(btn, false);
  }
  tap(btn) { this.press(btn); this.release(btn); }
  releaseAll() { for (const b of [...this.down]) this.release(b); }

  _gesture() {
    if (this._gestured) return;
    this._gestured = true;
    this.onFirstGesture?.();
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      const btn = KEYMAP[e.code];
      if (!btn) return;
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, dialog')) return;
      e.preventDefault();
      if (!e.repeat) this.press(btn);
    });
    window.addEventListener('keyup', (e) => {
      const btn = KEYMAP[e.code];
      if (btn) this.release(btn);
    });
    window.addEventListener('blur', () => this.releaseAll());
  }

  /** Bind a D-pad element: direction follows the finger, sliding works. */
  bindDpad(el) {
    let active = null;
    let pointerId = null;
    const update = (e) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const dead = r.width * 0.12;
      let dir = null;
      if (Math.hypot(dx, dy) > dead) dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      if (dir !== active) {
        if (active) this.release(active);
        active = dir;
        if (dir) { this.press(dir); this.haptic(8); }
        el.dataset.dir = dir || '';
      }
    };
    const end = () => {
      if (active) this.release(active);
      active = null; pointerId = null;
      el.dataset.dir = '';
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      pointerId = e.pointerId;
      el.setPointerCapture?.(e.pointerId);
      update(e);
    });
    el.addEventListener('pointermove', (e) => { if (e.pointerId === pointerId) update(e); });
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Bind a simple button element (data-btn="a" etc). */
  bindButton(el, btn) {
    const down = (e) => {
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      el.classList.add('is-down');
      this.press(btn);
      this.haptic(8);
    };
    const up = () => { el.classList.remove('is-down'); this.release(btn); };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /**
   * Swipe anywhere on an element to steer. Fires as soon as the finger has
   * travelled far enough (no need to lift), and can chain several swipes in
   * one touch. A quick tap counts as the A button.
   */
  bindSwipe(el, { threshold = 18, tapButton = 'a' } = {}) {
    let start = null;
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false, id: e.pointerId };
      el.setPointerCapture?.(e.pointerId);
      this._gesture();
    });
    el.addEventListener('pointermove', (e) => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      this.tap(dir);
      this.haptic(6);
      start.x = e.clientX; start.y = e.clientY; start.moved = true;
    });
    const end = (e) => {
      if (!start || e.pointerId !== start.id) return;
      if (!start.moved && performance.now() - start.t < 300 && tapButton) this.tap(tapButton);
      start = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', () => { start = null; });
  }
}
