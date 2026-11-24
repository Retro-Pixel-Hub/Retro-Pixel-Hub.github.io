/**
 * Player shell: index.html (cartridge menu) and play.html?game=<id>
 *
 * Owns everything that is the same for every game: the canvas and its integer
 * scaling, the game loop, input devices, audio, settings, pause-on-blur,
 * full screen and the boot screen. A game module only has to draw and react.
 *
 * GAME MODULE CONTRACT
 *   export default {
 *     id, title, width, height,
 *     create(api) -> {
 *       update(dt),          // seconds since last frame (clamped)
 *       render(),            // draw the frame (interpolate with your own accumulator)
 *       pause?(),            // called when the tab/app loses focus
 *       destroy?(),
 *       lowPower?: boolean,  // true = shell may drop to 30 fps (menus)
 *     }
 *   }
 *   api = { ctx, canvas, input, audio, settings, vibrate(pattern), exit(),
 *           meta (catalogue entry), variant (its params) }
 */

import { GAMES, getGame } from './catalog.js';
import { Input } from './core/input.js';
import { audio } from './core/audio.js';
import { loadSettings, saveSettings, storage } from './core/storage.js';
import { loadPixelFont, drawText } from './core/pixeltext.js';
import { registerPWA } from './pwa.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
// No ?game= means the console boots into the cartridge menu (index.html).
const MENU = {
  id: 'menu', title: 'Retro Pixel Hub', module: './games/menu.js', p: {},
};
const isMenu = !params.get('game');
const meta = isMenu ? MENU : getGame(params.get('game')) || GAMES[0];

const canvas = $('#game');
const ctx = canvas.getContext('2d', { alpha: false });
const settings = loadSettings();

if (isMenu) {
  // The top-left button opens the full game library page instead of "back".
  const back = $('#backBtn');
  back.href = 'games.html';
  back.setAttribute('aria-label', 'Open the game library');
  back.title = 'Game library';
  back.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 1h6v6H1zm8 0h6v6H9zM1 9h6v6H1zm8 0h6v6H9z"/></svg>';
} else {
  document.title = `${meta.title} · Retro Pixel Hub`;
  // remember recently played games for the menu and the library
  storage.set('recent', [meta.id, ...storage.get('recent', []).filter((id) => id !== meta.id)].slice(0, 12));
}
$('#gameTitle').textContent = meta.title;

// ---------------------------------------------------------------------------
//  Settings
// ---------------------------------------------------------------------------

function applySettings() {
  audio.setSfx(settings.sound);
  audio.setMusic(settings.music && settings.sound);
  document.body.classList.toggle('no-scanlines', !settings.scanlines);
  document.body.dataset.controls = settings.showControls;
  $('#muteBtn').classList.toggle('is-muted', !settings.sound);
  $('#muteBtn').setAttribute('aria-pressed', String(!settings.sound));
  saveSettings(settings);
  requestAnimationFrame(fit);
}

const dialog = $('#settingsDialog');
$('#settingsBtn').addEventListener('click', () => {
  for (const el of dialog.querySelectorAll('input[type=checkbox]')) el.checked = !!settings[el.name];
  dialog.querySelector('select').value = settings.showControls;
  game?.pause?.();
  dialog.showModal();
});
dialog.addEventListener('change', (e) => {
  const el = e.target;
  settings[el.name] = el.type === 'checkbox' ? el.checked : el.value;
  if (el.name === 'music' && el.checked && !settings.sound) settings.sound = true;
  applySettings();
});

function toggleMute() {
  settings.sound = !settings.sound;
  audio.unlock();
  applySettings();
}
$('#muteBtn').addEventListener('click', toggleMute);

function toggleFullscreen() {
  const el = $('#player');
  if (document.fullscreenElement) document.exitFullscreen?.();
  else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el, { navigationUI: 'hide' })?.catch?.(() => {});
}
$('#fsBtn').addEventListener('click', toggleFullscreen);
if (!document.fullscreenEnabled && !document.webkitFullscreenEnabled) $('#fsBtn').hidden = true;

window.addEventListener('keydown', (e) => {
  if (dialog.open) return;
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'KeyF') toggleFullscreen();
});

// ---------------------------------------------------------------------------
//  Input
// ---------------------------------------------------------------------------

const vibrate = (pattern) => {
  if (settings.vibration && navigator.vibrate) try { navigator.vibrate(pattern); } catch { /* ignore */ }
};
const input = new Input({ onFirstGesture: () => audio.unlock(), haptic: vibrate });
input.bindDpad($('#dpad'));
for (const el of document.querySelectorAll('[data-btn]')) input.bindButton(el, el.dataset.btn);
input.bindSwipe($('#screen'));
// Any first pointer interaction unlocks audio, even outside the controls.
window.addEventListener('pointerdown', () => audio.unlock(), { once: true });

// ---------------------------------------------------------------------------
//  Crisp integer scaling
// ---------------------------------------------------------------------------

let gameW = 320, gameH = 288;
const sideBySide = matchMedia('(orientation: landscape) and (max-height: 600px)');
function fit() {
  const dpr = window.devicePixelRatio || 1;
  let availW, availH;
  if (sideBySide.matches && settings.showControls !== 'never') {
    // landscape phone: the bezel fills its grid cell, measure the wrap
    const wrap = $('#screenWrap');
    availW = wrap.clientWidth; availH = wrap.clientHeight;
  } else {
    // portrait / desktop: the bezel hugs the screen, so measure what's left
    const con = $('#console');
    const cs = getComputedStyle(con);
    const controls = $('#controls'), hint = $('#kbdHint');
    const used = (controls.offsetParent ? controls.offsetHeight : 0) + (hint.offsetParent ? hint.offsetHeight + 12 : 0);
    availW = con.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 34;
    availH = con.clientHeight - parseFloat(cs.paddingBottom) - used - 52;
  }
  if (availW <= 0 || availH <= 0) return;
  const maxScale = Math.min((availW * dpr) / gameW, (availH * dpr) / gameH);
  // Whole device pixels per game pixel when possible = no shimmering.
  const scale = maxScale >= 1 ? Math.floor(maxScale) : maxScale;
  const cssW = (gameW * scale) / dpr, cssH = (gameH * scale) / dpr;
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  $('#screen').style.setProperty('--px', `${cssH / gameH}px`);
  $('#screen').classList.toggle('lowres', cssH / gameH < 2);
}
new ResizeObserver(fit).observe($('#console'));
sideBySide.addEventListener?.('change', fit);
window.addEventListener('orientationchange', () => setTimeout(fit, 250));

// ---------------------------------------------------------------------------
//  Boot screen + loop
// ---------------------------------------------------------------------------

let game = null;
let paused = false;

function bootFrame(t) {
  ctx.fillStyle = '#0f1410';
  ctx.fillRect(0, 0, gameW, gameH);
  const y = Math.min(118, -20 + t * 220);
  drawText(ctx, 'PIXEL HUB', gameW / 2, y, { size: 16, color: '#9bbc0f', align: 'center' });
  if (y >= 118) {
    drawText(ctx, isMenu ? 'INSERT CARTRIDGE' : meta.title.toUpperCase(), gameW / 2, 146, { color: '#f7f3e3', align: 'center' });
    const dots = '.'.repeat(1 + (Math.floor(t * 4) % 3));
    drawText(ctx, `LOADING${dots}`, gameW / 2 - 28, 250, { color: '#306230' });
  }
}

async function boot() {
  applySettings();
  ctx.imageSmoothingEnabled = false;
  await loadPixelFont();
  fit();

  const start = performance.now();
  let booting = true;
  const bootLoop = (now) => {
    if (!booting) return;
    bootFrame((now - start) / 1000);
    requestAnimationFrame(bootLoop);
  };
  requestAnimationFrame(bootLoop);

  let mod;
  try {
    mod = (await import(meta.module)).default;
  } catch (err) {
    booting = false;
    console.error(err);
    ctx.fillStyle = '#0f1410';
    ctx.fillRect(0, 0, gameW, gameH);
    drawText(ctx, 'COULD NOT LOAD GAME', gameW / 2, 130, { color: '#ff5964', align: 'center' });
    drawText(ctx, 'CHECK YOUR CONNECTION', gameW / 2, 146, { color: '#f7f3e3', align: 'center' });
    return;
  }
  // Let the logo land (short; skipped instantly on a revisit within the session).
  const minBoot = sessionStorage.getItem('booted') ? 150 : 900;
  sessionStorage.setItem('booted', '1');
  await new Promise((r) => setTimeout(r, Math.max(0, minBoot - (performance.now() - start))));
  booting = false;
  if (!sessionStorage.getItem('dinged')) { audio.play('boot'); sessionStorage.setItem('dinged', '1'); }

  if (mod.width !== gameW || mod.height !== gameH) {
    gameW = canvas.width = mod.width;
    gameH = canvas.height = mod.height;
    ctx.imageSmoothingEnabled = false;
    fit();
  }
  game = mod.create({
    ctx, canvas, input, audio, settings, vibrate,
    meta, variant: meta.p || {},
    exit: () => { location.href = './'; },
  });
  if (params.has('debug')) window.__game = game; // handy for testing & screenshots
  $('#led').classList.add('on');
  requestAnimationFrame(loop);
}

let last = performance.now();
let frame = 0;
function loop(now) {
  if (paused) return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  frame++;
  game.update(dt);
  // Battery saver: menus render at 30 fps.
  if (!game.lowPower || frame % 2 === 0) game.render();
  requestAnimationFrame(loop);
}

function setPaused(p) {
  if (!game) return;
  if (p && !paused) {
    paused = true;
    game.pause?.();
    input.releaseAll();
    audio.suspend();
  } else if (!p && paused) {
    paused = false;
    last = performance.now();
    audio.resume();
    requestAnimationFrame(loop);
  }
}
document.addEventListener('visibilitychange', () => setPaused(document.hidden));
window.addEventListener('pagehide', () => setPaused(true));
window.addEventListener('blur', () => game?.pause?.());

registerPWA();
boot();
