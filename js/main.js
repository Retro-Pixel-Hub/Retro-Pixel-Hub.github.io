/**
 * Landing page: live WFC village banner, game cards, WFC explainer.
 */
import { GAMES, CATEGORIES, ENGINE_COUNT } from './catalog.js';
import { generateVillage, KIND } from './village.js';
import { renderVillage, sprites, paintCell, TILE, PAL } from './art/village-art.js';
import { randomSeed, seedLabel } from './core/rng.js';
import { getBest, getBestAny, storage } from './core/storage.js';
import { registerPWA } from './pwa.js';

const $ = (s) => document.querySelector(s);

// ---------------------------------------------------------------------------
//  Brand icon
// ---------------------------------------------------------------------------
{
  const g = $('#brandIcon').getContext('2d');
  g.drawImage(sprites().apple, 0, 0);
}

// ---------------------------------------------------------------------------
//  Hero banner: a village that builds itself, cell by cell, in WFC order
// ---------------------------------------------------------------------------
const banner = $('#banner');
const bctx = banner.getContext('2d');
let buildToken = 0;

function bannerGeometry() {
  const w = window.innerWidth;
  const dpr = window.devicePixelRatio || 1;
  const cssTile = w < 700 ? 32 : w < 1400 ? 40 : 48;
  // keep whole device pixels per art pixel
  const scale = Math.max(1, Math.round((cssTile * dpr) / TILE)) / dpr;
  const tileCss = TILE * scale;
  const cols = Math.ceil(w / tileCss) + 1;
  const rows = w < 700 ? 13 : 11;
  return { cols, rows, scale };
}

function blankLike(v) {
  return { ...v, kinds: v.kinds.map((r) => r.map(() => KIND.GRASS)) };
}

function buildBanner(seed = randomSeed()) {
  const token = ++buildToken;
  const { cols, rows, scale } = bannerGeometry();
  const v = generateVillage({ width: cols, height: rows, seed, houses: 1.3, trees: 1.1 });
  banner.width = cols * TILE;
  banner.height = rows * TILE;
  banner.style.width = `${cols * TILE * scale}px`;
  banner.style.height = `${rows * TILE * scale}px`;
  banner.style.marginLeft = `${(window.innerWidth - cols * TILE * scale) / 2}px`;
  $('#seedChip').textContent = `SEED ${seedLabel(v.seed)}`;

  const grass = renderVillage(blankLike(v), { layoutOnly: true });
  const layout = renderVillage(v, { layoutOnly: true });
  const full = renderVillage(v);
  bctx.drawImage(grass, 0, 0);

  const roadCells = v.layoutOrder.filter((i) => v.kinds[(i / cols) | 0][i % cols] === KIND.ROAD);
  const detailCells = v.order.filter((i) => v.kinds[(i / cols) | 0][i % cols] !== KIND.ROAD);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { bctx.drawImage(full, 0, 0); return; }

  const copy = (src, i) => {
    const x = (i % cols) * TILE, y = ((i / cols) | 0) * TILE;
    bctx.drawImage(src, x, y, TILE, TILE, x, y, TILE, TILE);
  };
  const t0 = performance.now();
  let a = 0, b = 0;
  const step = (now) => {
    if (token !== buildToken) return;
    const t = (now - t0) / 1000;
    const ra = Math.min(roadCells.length, Math.floor((t / 0.9) * roadCells.length));
    while (a < ra) copy(layout, roadCells[a++]);
    if (t > 1.0) {
      const rb = Math.min(detailCells.length, Math.floor(((t - 1.0) / 1.4) * detailCells.length));
      while (b < rb) copy(full, detailCells[b++]);
    }
    if (a < roadCells.length || b < detailCells.length) requestAnimationFrame(step);
    else bctx.drawImage(full, 0, 0);
  };
  requestAnimationFrame(step);
  buildExplainer(seed);
}

let lastCols = 0;
window.addEventListener('resize', () => {
  const { cols } = bannerGeometry();
  if (cols !== lastCols) { lastCols = cols; clearTimeout(buildBanner.t); buildBanner.t = setTimeout(() => buildBanner(), 250); }
});
$('#rerollBtn').addEventListener('click', () => buildBanner());

// ---------------------------------------------------------------------------
//  WFC explainer canvases
// ---------------------------------------------------------------------------
function buildExplainer(seed) {
  const v = generateVillage({ width: 12, height: 8, seed: seed ^ 0x51ed, houses: 1.6 });
  $('#wfcLayout').getContext('2d').drawImage(renderVillage(v, { layoutOnly: true }), 0, 0);
  $('#wfcDetail').getContext('2d').drawImage(renderVillage(v), 0, 0);
}

function buildTileSheet() {
  const g = $('#wfcTiles').getContext('2d');
  g.fillStyle = PAL.grassShadow;
  g.fillRect(0, 0, 192, 128);
  const modules = [
    ['road_10', 10], ['road_6', 6], ['road_14', 14], ['road_15', 15],
    ['house_a', 0], ['house_b', 0], ['tree_a', 0], ['tree_b', 0],
    ['grass_tuft', 0], ['flowers', 0], ['flowers_b', 0], ['pebbles', 0],
  ];
  const tmp = document.createElement('canvas');
  tmp.width = tmp.height = TILE;
  const tg = tmp.getContext('2d');
  modules.forEach(([id, mask], i) => {
    const col = i % 4, row = (i / 4) | 0;
    tg.clearRect(0, 0, TILE, TILE);
    paintCell(tg, id, mask, 0, 0, 7, col, row);
    const x = 12 + col * 44, y = 8 + row * 40;
    g.fillStyle = '#000';
    g.fillRect(x - 2, y - 2, 36, 36);
    g.imageSmoothingEnabled = false;
    g.drawImage(tmp, x, y, 32, 32);
  });
}

// ---------------------------------------------------------------------------
//  Game cards
// ---------------------------------------------------------------------------
function drawSnakeThumb(g) {
  const v = generateVillage({ width: 10, height: 9, seed: 2024, houses: 1.4, keepClear: [3, 4, 5, 6, 7].map((x) => ({ x, y: 5 })) });
  g.drawImage(renderVillage(v), 0, 0);
  const ink = '#2a1a08';
  g.fillStyle = ink; g.fillRect(3 * 16 + 1, 5 * 16 + 1, 5 * 16 - 2, 14);
  g.fillStyle = '#f2c94c'; g.fillRect(3 * 16 + 2, 5 * 16 + 2, 5 * 16 - 4, 12);
  g.fillStyle = '#c9802a'; [4, 6].forEach((x) => g.fillRect(x * 16 + 6, 5 * 16 + 6, 4, 4));
  g.fillStyle = '#f7f3e3'; g.fillRect(7 * 16 + 9, 5 * 16 + 3, 4, 4); g.fillRect(7 * 16 + 9, 5 * 16 + 9, 4, 4);
  g.fillStyle = ink; g.fillRect(7 * 16 + 11, 5 * 16 + 4, 2, 2); g.fillRect(7 * 16 + 11, 5 * 16 + 10, 2, 2);
  g.drawImage(sprites().apple, 9 * 16 - 4, 5 * 16);
}

// ---------------------------------------------------------------------------
//  Catalogue: icons, featured card, search, filters, favourites, recent
// ---------------------------------------------------------------------------
const CAT_BG = { Arcade: ['#1b1430', '#241a40'], Puzzle: ['#0f2a1a', '#153a24'], Board: ['#2a1a10', '#3a2416'], Featured: ['#0f380f', '#306230'] };
function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

/** 40x36 pixel icon: an engine glyph on a category-coloured, per-game patterned tile. */
function drawIcon(canvas, game) {
  const g = canvas.getContext('2d');
  const [bg, bg2] = CAT_BG[game.cat] || CAT_BG.Arcade;
  g.fillStyle = bg; g.fillRect(0, 0, 40, 36);
  let h = hash(game.id);
  g.fillStyle = bg2;
  for (let i = 0; i < 14; i++) { h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; g.fillRect(h % 40, (h >>> 8) % 36, 2, 2); }
  const icon = game.icon.padEnd(64, '0');
  const s = 3, ox = 8, oy = 6;
  g.fillStyle = '#00000080';
  for (let i = 0; i < 64; i++) if (icon[i] !== '0') g.fillRect(ox + (i % 8) * s + 1, oy + ((i / 8) | 0) * s + 1, s, s);
  for (let i = 0; i < 64; i++) {
    if (icon[i] === '0') continue;
    g.fillStyle = icon[i] === '2' ? '#f7f3e3' : game.accent;
    g.fillRect(ox + (i % 8) * s, oy + ((i / 8) | 0) * s, s, s);
  }
}

const favs = new Set(storage.get('favs', []));
const STAR = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M5 0h2v3h3v1h2v2h-2v1H9v2h1v3H8v-1H7v-1H5v1H4v1H2V9h1V7H2V6H0V4h2V3h3z"/></svg>';

function tile(game) {
  const el = document.createElement('article');
  el.className = 'tile';
  el.style.setProperty('--accent', game.accent);
  const best = game.id === 'snake' ? getBestAny('snake', ['classic', 'endless', 'timed', 'village']) : getBest(game.id, 'default');
  el.innerHTML = `
    <a href="play.html?game=${game.id}">
      <canvas width="40" height="36" aria-hidden="true"></canvas>
      <div class="tile-body">
        <h3>${game.title}</h3>
        <span class="meta">${game.how}</span>
        <span class="best">${best ? `BEST <b>${best}</b>` : game.cat.toUpperCase()}</span>
      </div>
    </a>
    <button type="button" class="fav" aria-pressed="${favs.has(game.id)}" aria-label="Favourite ${game.title}">${STAR}</button>`;
  el.querySelector('.fav').addEventListener('click', (e) => {
    e.preventDefault();
    if (favs.has(game.id)) favs.delete(game.id); else favs.add(game.id);
    storage.set('favs', [...favs]);
    e.currentTarget.setAttribute('aria-pressed', String(favs.has(game.id)));
    if (filter.cat === 'Favourites') renderGrid();
  });
  iconObserver.observe(el.querySelector('canvas'));
  el.querySelector('canvas').dataset.id = game.id;
  return el;
}
const byId = new Map(GAMES.map((g) => [g.id, g]));
const iconObserver = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const canvas = e.target, game = byId.get(canvas.dataset.id);
    iconObserver.unobserve(canvas);
    drawIcon(canvas, game);
    // swap in a real in-game screenshot when one exists (assets/thumbs/<id>.png)
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { canvas.width = img.width; canvas.height = img.height; const g = canvas.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0); };
    img.src = `assets/thumbs/${game.id}.png`;
  }
}, { rootMargin: '300px' });

function renderFeatured() {
  const game = GAMES[0];
  const best = getBestAny('snake', ['classic', 'endless', 'timed', 'village']);
  $('#featured').innerHTML = `
    <a class="card featured" href="play.html?game=snake" style="--accent:${game.accent}">
      <div class="card-thumb"><canvas width="160" height="144" aria-hidden="true"></canvas><span class="card-badge">FEATURED</span></div>
      <div class="card-main">
        <div class="card-body">
          <h3>Snake</h3><p class="tagline">Village Edition</p>
          <p>Slither through villages generated live with Wave Function Collapse. Classic, Endless, Timed and Village modes, plus combos and golden apples.</p>
          <div class="modes"><span>CLASSIC</span><span>ENDLESS</span><span>TIMED</span><span>VILLAGE</span></div>
        </div>
        <div class="card-foot"><span class="best">BEST <b>${String(best).padStart(5, '0')}</b></span><span class="btn btn-primary">Play</span></div>
      </div>
    </a>`;
  const g = $('#featured canvas').getContext('2d');
  g.imageSmoothingEnabled = false;
  drawSnakeThumb(g);
}

function renderRecent() {
  const ids = storage.get('recent', []).filter((id) => byId.has(id)).slice(0, 10);
  $('#recentWrap').hidden = !ids.length;
  const row = $('#recentRow'); row.innerHTML = '';
  for (const id of ids) row.append(tile(byId.get(id)));
}

const filter = { cat: 'All', q: '' };
function renderChips() {
  const chips = $('#chips'); chips.innerHTML = '';
  for (const c of [...CATEGORIES, 'Favourites']) {
    const b = document.createElement('button');
    b.className = 'chip-btn'; b.type = 'button'; b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(filter.cat === c));
    const n = c === 'All' ? GAMES.length : c === 'Favourites' ? favs.size : GAMES.filter((g) => g.cat === c).length;
    b.textContent = `${c === 'Favourites' ? 'FAVS' : c.toUpperCase()} ${n}`;
    b.addEventListener('click', () => { filter.cat = c; renderChips(); renderGrid(); });
    chips.append(b);
  }
}
function matches(g) {
  if (filter.cat === 'Favourites' && !favs.has(g.id)) return false;
  if (filter.cat !== 'All' && filter.cat !== 'Favourites' && g.cat !== filter.cat) return false;
  if (!filter.q) return true;
  const hay = `${g.title} ${g.tagline} ${g.how} ${g.cat}`.toLowerCase();
  return filter.q.split(/\s+/).every((w) => hay.includes(w));
}
function renderGrid() {
  const grid = $('#gameGrid'); grid.innerHTML = '';
  const list = GAMES.slice(1).filter(matches);
  $('#resultCount').textContent = `${list.length} game${list.length === 1 ? '' : 's'}${filter.q ? ` matching “${filter.q}”` : ''}`;
  if (!list.length) { grid.innerHTML = `<p class="empty">${filter.cat === 'Favourites' ? 'Tap the star on any game to keep it here.' : 'No games match that search.'}</p>`; return; }
  const frag = document.createDocumentFragment();
  for (const g of list) frag.append(tile(g));
  grid.append(frag);
}

function renderCards() {
  $('#gameCount').textContent = GAMES.length;
  $('#engineCount').textContent = ENGINE_COUNT;
  $('#search').placeholder = `Search ${GAMES.length} games…`;
  renderFeatured(); renderRecent(); renderChips(); renderGrid();
}
$('#search').addEventListener('input', (e) => { filter.q = e.target.value.trim().toLowerCase(); renderGrid(); });
$('#randomBtn').addEventListener('click', () => {
  const list = GAMES.filter(matches);
  const g = (list.length ? list : GAMES)[Math.floor(Math.random() * (list.length || GAMES.length))];
  location.href = `play.html?game=${g.id}`;
});

// ---------------------------------------------------------------------------
renderCards();
buildTileSheet();
lastCols = bannerGeometry().cols;
buildBanner();
registerPWA({ installButton: $('#installBtn') });
// refresh best scores when returning from a game via the back button
window.addEventListener('pageshow', (e) => { if (e.persisted) renderCards(); });
