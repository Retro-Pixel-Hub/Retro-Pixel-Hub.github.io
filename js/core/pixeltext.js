/**
 * Crisp pixel text for canvases.
 *
 * Canvas text is normally anti-aliased, which looks blurry when scaled up. We
 * draw each string once with the "Press Start 2P" font at its native 8px grid,
 * snap every pixel to fully on/off, then cache the result as a sprite. Drawing
 * text after that is just a drawImage call.
 */

import { makeCanvas } from '../art/village-art.js';

export const FONT_FAMILY = '"Press Start 2P", ui-monospace, monospace';
const cache = new Map();

/** Wait for the bundled pixel font (call once at boot). */
export async function loadPixelFont() {
  try {
    if (document.fonts?.load) {
      await Promise.race([
        document.fonts.load(`8px ${FONT_FAMILY}`),
        new Promise((r) => setTimeout(r, 2500)),
      ]);
    }
  } catch { /* fall back to monospace */ }
  cache.clear();
}

function renderText(text, color, size) {
  const key = `${size}|${color}|${text}`;
  let spr = cache.get(key);
  if (spr) return spr;
  const font = `${size}px ${FONT_FAMILY}`;
  const probe = makeCanvas(1, 1).getContext('2d');
  probe.font = font;
  const w = Math.max(1, Math.ceil(probe.measureText(text).width));
  const h = size + 2;
  spr = makeCanvas(w, h);
  const g = spr.getContext('2d');
  g.font = font;
  g.textBaseline = 'top';
  g.fillStyle = '#fff';
  g.fillText(text, 0, 0);
  // Threshold alpha -> pure pixels, then tint.
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const on = d[i + 3] > 110;
    d[i] = d[i + 1] = d[i + 2] = 255;
    d[i + 3] = on ? 255 : 0;
  }
  g.putImageData(img, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, w, h);
  if (cache.size > 600) cache.clear();
  cache.set(key, spr);
  return spr;
}

/** Width in pixels of a string at a given size (8 or 16 recommended). */
export function textWidth(text, size = 8) {
  return renderText(String(text), '#fff', size).width;
}

/**
 * Draw pixel text.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {object} [o]
 * @param {string} [o.color='#fff']
 * @param {number} [o.size=8]
 * @param {'left'|'center'|'right'} [o.align='left']
 * @param {string|null} [o.shadow]  colour of a 1px drop shadow
 * @param {string|null} [o.outline] colour of a 1px outline
 */
export function drawText(ctx, text, x, y, o = {}) {
  const { color = '#fff', size = 8, align = 'left', shadow = null, outline = null } = o;
  text = String(text);
  const spr = renderText(text, color, size);
  let dx = Math.round(x);
  if (align === 'center') dx = Math.round(x - spr.width / 2);
  if (align === 'right') dx = Math.round(x - spr.width);
  const dy = Math.round(y);
  if (outline) {
    const o2 = renderText(text, outline, size);
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) ctx.drawImage(o2, dx + ox, dy + oy);
  } else if (shadow) {
    ctx.drawImage(renderText(text, shadow, size), dx + 1, dy + 1);
  }
  ctx.drawImage(spr, dx, dy);
  return spr.width;
}
