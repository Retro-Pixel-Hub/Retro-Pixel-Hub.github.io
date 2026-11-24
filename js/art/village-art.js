/**
 * Village art — all tiles are pixel art defined in code, so the whole hub
 * works offline with zero image downloads and stays perfectly crisp.
 *
 *  - Hand-drawn sprites (houses, trees, apples) are 16x16 string grids where
 *    each character maps to a palette colour.
 *  - Ground tiles (grass, flowers, dirt roads) are painted procedurally with a
 *    seeded RNG, so every cell gets a little variation but the same seed always
 *    looks identical.
 *  - Road tiles are "autotiled" from their N/E/S/W connection mask, so a single
 *    painter covers straights, corners, T-junctions and crossings.
 */

import { RNG, hashString } from '../core/rng.js';
import { KIND } from '../village.js';

export const TILE = 16;

export const PAL = {
  ink: '#1b2420',
  grass: '#5fae3f', grassDark: '#4a9233', grassLight: '#7cc85a', grassShadow: '#428a2f',
  dirt: '#cf9f5f', dirtDark: '#b4844a', dirtEdge: '#8e6234', dirtLight: '#e2b97e',
  roof: '#d24a3c', roofDark: '#9a2e2a', roofLight: '#ee7a5a',
  roof2: '#b8343a', roof2Dark: '#7e2228', roof2Light: '#dc5a52',
  wall: '#f3e3c3', wallShade: '#c9a77c',
  door: '#7a4a2a', doorDark: '#4e2e1a',
  glass: '#8fd3f0', glassDark: '#3a7aa8',
  leaf: '#34903a', leafDark: '#1f6a2e', leafLight: '#62bd4e', treeInk: '#173a1e',
  pine: '#2a7d52', pineDark: '#185238', pineLight: '#47a86a',
  trunk: '#7a4a2a', trunkDark: '#4e2e1a',
  stone: '#9aa3a8', stoneDark: '#6b7378', stoneLight: '#c9d0d3', brick: '#8a8f94',
  petal: '#f6f2e8', petalPink: '#ff8fb1', petalBlue: '#9cc2ff', pollen: '#ffd84a',
  apple: '#e43b44', appleDark: '#a22633', appleLight: '#ff9a8a', appleInk: '#3a1420',
  gold: '#ffcc33', goldDark: '#d08a1a', goldLight: '#fff2a8', goldInk: '#5a3a08',
  stem: '#5a3a1e',
};

// ---------------------------------------------------------------------------
//  Sprite helpers
// ---------------------------------------------------------------------------

/** Build a canvas from rows of characters + a palette map ('.' = transparent). */
export function spriteFromRows(rows, palette, name = 'sprite') {
  const h = rows.length;
  const w = rows[0].length;
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  rows.forEach((row, y) => {
    if (row.length !== w) console.warn(`[art] ${name} row ${y} is ${row.length}px, expected ${w}`);
    for (let x = 0; x < row.length; x++) {
      const col = palette[row[x]];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  });
  return c;
}

export function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// ---------------------------------------------------------------------------
//  Hand-drawn sprites (16x16)
// ---------------------------------------------------------------------------

const HOUSE_ROWS = [
  '................',
  '..kkkkkkkkkkkk..',
  '.khhhhhhhhhhhhk.',
  '.krrrrrrrrrrrrk.',
  'krrrrrrrrrrrrrrk',
  'krRrRrRrRrRrRrrk',
  'krrrrrrrrrrrrrrk',
  'kRrRrRrRrRrRrRrk',
  'kRRRRRRRRRRRRRRk',
  'kkkkkkkkkkkkkkkk',
  '.kwwwwwwwwwwwwk.',
  '.kwbbwwkkwwbbwk.',
  '.kwBBwkddkwBBwk.',
  '.kWwwwkddkwwwWk.',
  '.kWWWWkdDkWWWWk.',
  '..ssssssssssss..',
];
// Same cottage with a chimney (smoke is animated by the game).
const HOUSE_B_ROWS = HOUSE_ROWS.slice();
HOUSE_B_ROWS[0] = '..........kkk...';
HOUSE_B_ROWS[1] = '..kkkkkkkkkckk..';
HOUSE_B_ROWS[11] = '.kwbbwwkkwwwwwk.';
HOUSE_B_ROWS[12] = '.kwBBwkddkwbbwk.';
HOUSE_B_ROWS[13] = '.kWwwwkddkwBBWk.';

const TREE_ROWS = [
  '.....kkkkkk.....',
  '...kkllllggkk...',
  '..kllllllgggGk..',
  '.klllllggggggGk.',
  '.kllllggggggGGk.',
  'kllllgggggggGGGk',
  'klllggggggggGGGk',
  'kllgggggggGGGGGk',
  'kggggggggGGGGGGk',
  '.kgggggGGGGGGGk.',
  '.kGGgGGGGGGGGGk.',
  '..kkGGGGGGGGkk..',
  '....kkktTkkk....',
  '......ktTk......',
  '.....sktTks.....',
  '....ssssssss....',
];

const APPLE_ROWS = [
  '................',
  '........kkk.....',
  '.......ktk.kkk..',
  '....kkkktkkLLLk.',
  '...kaaaakaakkk..',
  '..kahhaaaaaaaak.',
  '.kahhaaaaaaaaaak',
  '.kahaaaaaaaaaaAk',
  '.kaaaaaaaaaaaaAk',
  '.kaaaaaaaaaaaAAk',
  '.kaaaaaaaaaaaAAk',
  '..kaaaaaaaaaAAk.',
  '..kAaaaaaaaAAAk.',
  '...kAAaaaAAAAk..',
  '....kkkk.kkkk...',
  '................',
];

export function buildSprites() {
  const P = PAL;
  const house = {
    k: P.ink, r: P.roof, R: P.roofDark, h: P.roofLight, w: P.wall, W: P.wallShade,
    d: P.door, D: P.doorDark, b: P.glass, B: P.glassDark, s: P.grassShadow, c: P.brick,
  };
  const house2 = { ...house, r: P.roof2, R: P.roof2Dark, h: P.roof2Light };
  const tree = { k: P.treeInk, l: P.leafLight, g: P.leaf, G: P.leafDark, t: P.trunk, T: P.trunkDark, s: P.grassShadow };
  const pine = { ...tree, l: P.pineLight, g: P.pine, G: P.pineDark };
  const apple = { k: P.appleInk, a: P.apple, A: P.appleDark, h: P.appleLight, t: P.stem, L: P.leafLight };
  const gold = { ...apple, k: P.goldInk, a: P.gold, A: P.goldDark, h: P.goldLight };
  return {
    house_a: spriteFromRows(HOUSE_ROWS, house, 'house_a'),
    house_b: spriteFromRows(HOUSE_B_ROWS, house2, 'house_b'),
    tree_a: spriteFromRows(TREE_ROWS, tree, 'tree_a'),
    tree_b: spriteFromRows(TREE_ROWS, pine, 'tree_b'),
    apple: spriteFromRows(APPLE_ROWS, apple, 'apple'),
    golden: spriteFromRows(APPLE_ROWS, gold, 'golden'),
  };
}

let SPRITES = null;
export function sprites() { return (SPRITES ??= buildSprites()); }

// ---------------------------------------------------------------------------
//  Procedural ground painters
// ---------------------------------------------------------------------------

const px = (g, x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };

function paintGrass(g, ox, oy, rng, variant) {
  const P = PAL;
  g.fillStyle = P.grass;
  g.fillRect(ox, oy, TILE, TILE);
  // speckles
  for (let i = 0; i < 4; i++) px(g, ox + rng.int(0, 15), oy + rng.int(0, 15), P.grassDark);
  for (let i = 0; i < 2; i++) px(g, ox + rng.int(0, 15), oy + rng.int(0, 15), P.grassLight);

  const tuft = (x, y) => {
    px(g, ox + x, oy + y, P.grassDark);
    px(g, ox + x + 2, oy + y, P.grassDark);
    px(g, ox + x + 1, oy + y + 1, P.grassDark);
    px(g, ox + x + 1, oy + y, P.grassLight);
  };
  if (variant === 'grass_tuft') {
    tuft(rng.int(1, 5), rng.int(2, 6));
    tuft(rng.int(8, 12), rng.int(8, 12));
  }
  if (variant === 'flowers' || variant === 'flowers_b') {
    const petal = variant === 'flowers' ? P.petal : rng.pick([P.petalPink, P.petalBlue]);
    const spots = [[3, 3], [10, 5], [5, 11], [12, 12]];
    rng.shuffle(spots);
    for (let i = 0; i < 3; i++) {
      const [fx, fy] = spots[i];
      const x = ox + fx + rng.int(-1, 1), y = oy + fy + rng.int(-1, 1);
      px(g, x, y - 1, petal); px(g, x - 1, y, petal); px(g, x + 1, y, petal); px(g, x, y + 1, petal);
      px(g, x, y, P.pollen);
      px(g, x, y + 2, P.grassDark);
    }
  }
  if (variant === 'pebbles') {
    for (let i = 0; i < 2; i++) {
      const x = ox + rng.int(2, 11), y = oy + rng.int(3, 12);
      g.fillStyle = P.stoneDark; g.fillRect(x, y + 1, 3, 1);
      g.fillStyle = P.stone; g.fillRect(x, y, 3, 1);
      px(g, x, y, P.stoneLight);
    }
  }
}

/** Is local pixel (x,y) on the road surface for a tile with this mask? */
function roadAt(mask, x, y) {
  const A = 3, B = 12; // road spans pixels 3..12 (10px wide)
  if (x >= A && x <= B && y >= A && y <= B) {
    // round the outer corners where neither side connects
    const n = mask & 1, e = mask & 2, s = mask & 4, w = mask & 8;
    if (x === A && y === A && !n && !w) return false;
    if (x === B && y === A && !n && !e) return false;
    if (x === A && y === B && !s && !w) return false;
    if (x === B && y === B && !s && !e) return false;
    return true;
  }
  if (y < A && x >= A && x <= B) return !!(mask & 1);
  if (x > B && y >= A && y <= B) return !!(mask & 2);
  if (y > B && x >= A && x <= B) return !!(mask & 4);
  if (x < A && y >= A && y <= B) return !!(mask & 8);
  return false;
}

function paintRoad(g, ox, oy, mask, rng) {
  const P = PAL;
  paintGrass(g, ox, oy, rng, 'grass');
  const inside = (x, y) => {
    // pixels past the tile edge continue the road if that side is connected
    if (x < 0) return !!(mask & 8) && y >= 3 && y <= 12;
    if (x > 15) return !!(mask & 2) && y >= 3 && y <= 12;
    if (y < 0) return !!(mask & 1) && x >= 3 && x <= 12;
    if (y > 15) return !!(mask & 4) && x >= 3 && x <= 12;
    return roadAt(mask, x, y);
  };
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      const shadeTop = !inside(x, y - 1) || !inside(x - 1, y);
      px(g, ox + x, oy + y, edge ? (shadeTop ? P.dirtEdge : P.dirtDark) : P.dirt);
    }
  }
  // texture: specks & pebbles on the dirt
  for (let i = 0; i < 7; i++) {
    const x = rng.int(0, 15), y = rng.int(0, 15);
    if (roadAt(mask, x, y) && roadAt(mask, x + 1, y) && roadAt(mask, x, y + 1) && roadAt(mask, x - 1, y) && roadAt(mask, x, y - 1)) {
      px(g, ox + x, oy + y, i % 3 === 0 ? P.dirtLight : P.dirtDark);
    }
  }
}

/** Paint one map cell (ground + sprite) into a 2D context. */
export function paintCell(g, id, mask, ox, oy, seed, cx, cy) {
  const rng = new RNG(hashString(`${seed}:${cx}:${cy}:${id}`));
  if (id.startsWith('road_')) return paintRoad(g, ox, oy, mask, rng);
  if (id === 'lot') return paintGrass(g, ox, oy, rng, 'grass');
  const groundVariant = id.startsWith('house') || id.startsWith('tree') ? 'grass' : id;
  paintGrass(g, ox, oy, rng, groundVariant);
  const spr = sprites()[id];
  if (spr) g.drawImage(spr, ox, oy);
}

/**
 * Render a whole village into a new canvas (1 map pixel = 1 canvas pixel).
 * @param {object} village  result of generateVillage()
 * @param {object} [opt]
 * @param {boolean} [opt.layoutOnly]  draw only the pass-1 layout (roads + bare grass)
 */
export function renderVillage(village, opt = {}) {
  const c = makeCanvas(village.width * TILE, village.height * TILE);
  const g = c.getContext('2d');
  for (let y = 0; y < village.height; y++) {
    for (let x = 0; x < village.width; x++) {
      let id = village.tiles[y][x];
      if (opt.layoutOnly && village.kinds[y][x] !== KIND.ROAD) id = 'lot';
      paintCell(g, id, village.masks[y][x], x * TILE, y * TILE, village.seed, x, y);
    }
  }
  return c;
}
