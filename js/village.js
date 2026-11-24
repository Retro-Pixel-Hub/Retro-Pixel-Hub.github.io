/**
 * Village map generator — a two-pass Wave Function Collapse setup that
 * produces little top-down villages: dirt roads, red-roofed houses, trees and
 * grass, all on a clean grid.
 *
 *  PASS 1 — layout
 *    Tiles: road pieces + an abstract "lot" tile. Decides where the road
 *    network goes. Road pieces only come as straight / corner / T / cross, so
 *    the network can never contain a dead end: every road either loops or
 *    leaves the map.
 *
 *  PASS 2 — details
 *    Road cells from pass 1 are locked in place. Every lot cell is collapsed
 *    again using detail modules: grass, flowers, trees and houses. A house has
 *    a door socket 'D' on its south edge which is ONLY compatible with the
 *    side of a road ('s'), so every front door faces a road.
 *
 *  SOCKETS
 *    R  road surface continues across this edge
 *    s  side (verge) of a road
 *    G  grass / open ground
 *    D  a house front door
 *    H  house wall (houses may stand in a row)
 *    L  abstract lot (pass 1 only)
 */

import { WFC } from './wfc.js';
import { RNG, toSeed } from './core/rng.js';

/** Road connection bits: N=1, E=2, S=4, W=8. */
export const ROAD_MASKS = {
  straight: [5, 10],
  corner: [3, 6, 12, 9],
  tee: [7, 14, 13, 11],
  cross: [15],
};

const roadSockets = (mask) => [0, 1, 2, 3].map((d) => ((mask >> d) & 1 ? 'R' : 's'));

const SOCKET_RULES = {
  R: ['R'],
  s: ['G', 'D', 'H', 'L'], // s-s is NOT allowed: keeps grass between parallel roads
  G: ['G', 'H'],
  D: ['s'],
  H: ['H'],
  L: ['L'],
};

/** Tile kinds used by games to decide collisions & art. */
export const KIND = { ROAD: 'road', GRASS: 'grass', HOUSE: 'house', TREE: 'tree' };

function roadTiles(density) {
  const w = { straight: 3, corner: 0.55, tee: 0.45, cross: 0.22 };
  const tiles = [];
  for (const [type, masks] of Object.entries(ROAD_MASKS)) {
    for (const m of masks) {
      tiles.push({ id: `road_${m}`, kind: KIND.ROAD, mask: m, weight: w[type] * density, sockets: roadSockets(m) });
    }
  }
  return tiles;
}

function detailTiles({ houses = 1, trees = 1, solid = true }) {
  const list = [
    { id: 'grass', kind: KIND.GRASS, weight: 9, sockets: ['G', 'G', 'G', 'G'] },
    { id: 'grass_tuft', kind: KIND.GRASS, weight: 4, sockets: ['G', 'G', 'G', 'G'] },
    { id: 'flowers', kind: KIND.GRASS, weight: 1.6, sockets: ['G', 'G', 'G', 'G'] },
    { id: 'flowers_b', kind: KIND.GRASS, weight: 1.0, sockets: ['G', 'G', 'G', 'G'] },
    { id: 'pebbles', kind: KIND.GRASS, weight: 0.5, sockets: ['G', 'G', 'G', 'G'] },
  ];
  if (solid) {
    if (houses > 0) {
      // A house: walls on N/E/W, front door on S.
      list.push({ id: 'house_a', kind: KIND.HOUSE, weight: 4.5 * houses, sockets: ['G', 'H', 'D', 'H'] });
      list.push({ id: 'house_b', kind: KIND.HOUSE, weight: 3 * houses, sockets: ['G', 'H', 'D', 'H'] });
    }
    if (trees > 0) {
      list.push({ id: 'tree_a', kind: KIND.TREE, weight: 2.4 * trees, sockets: ['G', 'G', 'G', 'G'] });
      list.push({ id: 'tree_b', kind: KIND.TREE, weight: 1.0 * trees, sockets: ['G', 'G', 'G', 'G'] });
    }
  }
  return list;
}

/** Off-map rules: roads may run off the edge, doors may not face off-map. */
const boundary = (socket) => socket !== 'D';

/**
 * Generate a village.
 * @param {object} o
 * @param {number} o.width
 * @param {number} o.height
 * @param {number|string} o.seed
 * @param {number} [o.roadDensity=1]  multiplier on road weights in pass 1
 * @param {number} [o.houses=1]       multiplier on house weight
 * @param {number} [o.trees=1]        multiplier on tree weight
 * @param {boolean} [o.solid=true]    include houses/trees at all
 * @param {Array<{x:number,y:number}>} [o.keepClear]  cells that must stay walkable
 * @returns {{ok:boolean, width:number, height:number, seed:number, tiles:string[][],
 *            kinds:string[][], masks:number[][], order:number[], tileDefs:Map}}
 */
export function generateVillage(o) {
  const { width, height } = o;
  const seed = toSeed(o.seed);
  const density = o.roadDensity ?? 1;
  const roads = roadTiles(density);

  // ---------- PASS 1: road layout ----------
  const lot = { id: 'lot', kind: 'lot', weight: 16, sockets: ['L', 'L', 'L', 'L'] };
  const pass1 = new WFC({
    width, height, seed,
    tiles: [...roads, lot],
    socketRules: SOCKET_RULES,
    boundary,
  });
  const keep = o.keepClear || [];
  const layout = pass1.run();
  if (!layout.ok) return fallback(o, seed);

  // ---------- PASS 2: details ----------
  const details = detailTiles({ houses: o.houses ?? 1, trees: o.trees ?? 1, solid: o.solid !== false });
  const allTiles = [...roads, ...details];
  const pass2 = new WFC({
    width, height, seed: (seed ^ 0xa5a5a5a5) >>> 0,
    tiles: allTiles,
    socketRules: SOCKET_RULES,
    boundary,
  });
  const detailIds = details.map((t) => t.id);
  const walkableDetailIds = details.filter((t) => t.kind === KIND.GRASS).map((t) => t.id);
  const keepSet = new Set(keep.map((c) => c.x + c.y * width));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const id = layout.grid[y][x];
      if (id === 'lot') {
        pass2.restrict(x, y, keepSet.has(x + y * width) ? walkableDetailIds : detailIds);
      } else {
        pass2.restrict(x, y, [id]);
      }
    }
  }
  const final = pass2.run();
  if (!final.ok) return fallback(o, seed);

  return packResult(width, height, seed, final.grid, final.order, allTiles, layout.order);
}

function packResult(width, height, seed, grid, order, tileList, layoutOrder = []) {
  const defs = new Map(tileList.map((t) => [t.id, t]));
  const kinds = grid.map((row) => row.map((id) => defs.get(id)?.kind ?? KIND.GRASS));
  const masks = grid.map((row) => row.map((id) => defs.get(id)?.mask ?? 0));
  return { ok: true, width, height, seed, tiles: grid, kinds, masks, order, layoutOrder, tileDefs: defs };
}

/** Never fail the player: fall back to an open meadow if WFC gives up. */
function fallback(o, seed) {
  const rng = new RNG(seed);
  const grid = [];
  for (let y = 0; y < o.height; y++) {
    const row = [];
    for (let x = 0; x < o.width; x++) row.push(rng.chance(0.2) ? 'grass_tuft' : 'grass');
    grid.push(row);
  }
  const order = [...Array(o.width * o.height).keys()];
  return packResult(o.width, o.height, seed, grid, order, detailTiles({ solid: false }));
}

/**
 * Validate a generated village (used by tests and debug tools).
 * Returns a list of human-readable problems; empty means valid.
 */
export function validateVillage(v) {
  const problems = [];
  const at = (x, y) => (x < 0 || y < 0 || x >= v.width || y >= v.height ? null : v.tiles[y][x]);
  const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  for (let y = 0; y < v.height; y++) {
    for (let x = 0; x < v.width; x++) {
      const kind = v.kinds[y][x];
      if (kind === KIND.ROAD) {
        const m = v.masks[y][x];
        let exits = 0;
        dirs.forEach(([dx, dy], d) => {
          if (!((m >> d) & 1)) return;
          exits++;
          const n = at(x + dx, y + dy);
          if (n === null) return; // leaves the map: fine
          const nm = v.masks[y + dy][x + dx];
          if (v.kinds[y + dy][x + dx] !== KIND.ROAD || !((nm >> ((d + 2) % 4)) & 1)) {
            problems.push(`road at ${x},${y} does not connect ${'NESW'[d]}`);
          }
        });
        if (exits < 2) problems.push(`dead end at ${x},${y}`);
      }
      if (kind === KIND.HOUSE) {
        const by = y + 1;
        if (by >= v.height) { problems.push(`house at ${x},${y} has door off-map`); continue; }
        const below = v.kinds[by][x];
        const bm = v.masks[by][x];
        if (below !== KIND.ROAD || (bm & 1)) problems.push(`house at ${x},${y} door does not face a road side`);
      }
    }
  }
  return problems;
}
