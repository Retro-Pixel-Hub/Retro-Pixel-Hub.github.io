/**
 * ============================================================================
 *  Wave Function Collapse (simple tiled model)
 * ============================================================================
 *
 *  A small, dependency-free WFC engine based on Maxim Gumin's original
 *  algorithm (github.com/mxgmn/WaveFunctionCollapse) and the socket-based
 *  "village" approach popularised by SpriteCook.
 *
 *  HOW IT WORKS
 *  ------------
 *  1. Every cell of the grid starts in a "superposition": any tile may go there.
 *  2. Each tile ("module") has a socket label on each of its four edges
 *     [north, east, south, west]. Two tiles may sit next to each other only if
 *     the touching sockets are compatible (see `socketRules`).
 *  3. Loop:
 *       a. Observe — pick the undecided cell with the LOWEST entropy (fewest,
 *          least-balanced options; a little noise breaks ties).
 *       b. Collapse — choose one of its remaining tiles at random, weighted by
 *          each tile's `weight`.
 *       c. Propagate — remove every option in the neighbouring cells that is no
 *          longer supported, and keep rippling outward until stable.
 *  4. If any cell runs out of options we hit a contradiction: the engine
 *     restarts with a derived seed (up to `maxAttempts`).
 *
 *  Propagation uses Gumin's support counting (AC-4 style): for every cell,
 *  tile and direction we count how many neighbouring options still "support"
 *  the tile. When that count hits zero the tile is banned. This is much faster
 *  than re-checking every pair after each change.
 *
 *  USAGE
 *  -----
 *    import { WFC } from './wfc.js';
 *
 *    const wfc = new WFC({
 *      width: 20, height: 15, seed: 1234,
 *      tiles: [
 *        { id: 'grass', weight: 10, sockets: ['G', 'G', 'G', 'G'] },
 *        { id: 'road_h', weight: 2, sockets: ['s', 'R', 's', 'R'] },
 *        ...
 *      ],
 *      socketRules: { G: ['G', 's'], s: ['G'], R: ['R'] },
 *      // optional: which sockets may face the outside of the map
 *      boundary: (socket, dir) => socket !== 'D',
 *    });
 *    wfc.restrict(x, y, ['grass']);   // optional pre-constraints
 *    const result = wfc.run();         // { ok, grid: [[tileId]], order: [cellIndex] }
 *
 *  `grid[y][x]` holds tile ids. `order` lists cells in the order they were
 *  collapsed, which is handy for "watch it build" animations.
 * ============================================================================
 */

import { mulberry32, toSeed } from './core/rng.js';

/** Direction helpers. Index order is N, E, S, W everywhere in the engine. */
export const DIRS = [
  { name: 'N', dx: 0, dy: -1 },
  { name: 'E', dx: 1, dy: 0 },
  { name: 'S', dx: 0, dy: 1 },
  { name: 'W', dx: -1, dy: 0 },
];
export const OPPOSITE = [2, 3, 0, 1];

export class WFC {
  /**
   * @param {object} opts
   * @param {number} opts.width
   * @param {number} opts.height
   * @param {Array<{id:string, weight?:number, sockets:string[]}>} opts.tiles
   * @param {Object<string,string[]>} opts.socketRules  socket -> compatible sockets.
   *        Rules are made symmetric automatically (if A fits B, B fits A).
   * @param {number|string} [opts.seed]
   * @param {(socket:string, dir:number, tile:object)=>boolean} [opts.boundary]
   *        Return false to forbid a socket from facing off the map edge.
   * @param {number} [opts.maxAttempts=12]
   * @param {boolean} [opts.periodic=false]  wrap edges (for tiling backgrounds)
   */
  constructor(opts) {
    const { width, height, tiles, socketRules } = opts;
    if (!width || !height) throw new Error('WFC: width and height are required');
    if (!tiles?.length) throw new Error('WFC: at least one tile is required');

    this.width = width;
    this.height = height;
    this.tiles = tiles;
    this.T = tiles.length;
    this.N = width * height;
    this.seed = toSeed(opts.seed ?? 1);
    this.boundary = opts.boundary || null;
    this.maxAttempts = opts.maxAttempts ?? 12;
    this.periodic = !!opts.periodic;

    this.weights = tiles.map((t) => Math.max(t.weight ?? 1, 1e-6));
    this.wLogW = this.weights.map((w) => w * Math.log(w));
    this.idIndex = new Map(tiles.map((t, i) => [t.id, i]));

    this.propagator = this.#buildPropagator(this.#symmetrise(socketRules));
    this.constraints = []; // [{cell, allowed:Set<number>}] applied on every attempt
  }

  /** Make socket rules symmetric so propagation stays consistent. */
  #symmetrise(rules) {
    const map = new Map();
    const add = (a, b) => {
      if (!map.has(a)) map.set(a, new Set());
      map.get(a).add(b);
    };
    for (const [a, list] of Object.entries(rules)) {
      for (const b of list) { add(a, b); add(b, a); }
    }
    return map;
  }

  /** propagator[d][t] = list of tiles allowed in direction d next to tile t. */
  #buildPropagator(rules) {
    const fits = (a, b) => rules.get(a)?.has(b) ?? false;
    const prop = [];
    for (let d = 0; d < 4; d++) {
      prop[d] = [];
      for (let t1 = 0; t1 < this.T; t1++) {
        const s1 = this.tiles[t1].sockets[d];
        const list = [];
        for (let t2 = 0; t2 < this.T; t2++) {
          const s2 = this.tiles[t2].sockets[OPPOSITE[d]];
          if (fits(s1, s2)) list.push(t2);
        }
        prop[d][t1] = list;
      }
    }
    return prop;
  }

  /**
   * Limit a cell to a set of tile ids before running. Can be called many
   * times; constraints persist across retry attempts.
   */
  restrict(x, y, allowedIds) {
    const allowed = new Set();
    for (const id of allowedIds) {
      const i = this.idIndex.get(id);
      if (i === undefined) throw new Error(`WFC: unknown tile id "${id}"`);
      allowed.add(i);
    }
    this.constraints.push({ cell: x + y * this.width, allowed });
    return this;
  }

  /** Run to completion, retrying on contradiction. */
  run() {
    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      // Derive a new seed per attempt so retries explore different layouts
      // while staying fully reproducible.
      const rand = mulberry32((this.seed + Math.imul(attempt, 0x9e3779b1)) >>> 0);
      const result = this.#attempt(rand);
      if (result) return { ok: true, attempts: attempt + 1, ...result };
    }
    return { ok: false, attempts: this.maxAttempts, grid: null, order: [] };
  }

  // --------------------------------------------------------------------------
  //  Core algorithm
  // --------------------------------------------------------------------------

  #neighbor(i, d) {
    let x = (i % this.width) + DIRS[d].dx;
    let y = Math.floor(i / this.width) + DIRS[d].dy;
    if (this.periodic) {
      x = (x + this.width) % this.width;
      y = (y + this.height) % this.height;
    } else if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return -1;
    }
    return x + y * this.width;
  }

  #attempt(rand) {
    const { N, T, propagator } = this;

    // wave[i*T + t] = 1 if tile t is still possible in cell i
    const wave = new Uint8Array(N * T).fill(1);
    // compatible[(i*T + t)*4 + d] = supports for tile t in cell i from dir d
    const compatible = new Int32Array(N * T * 4);
    const counts = new Int32Array(N).fill(T);
    const sumW = new Float64Array(N);
    const sumWLogW = new Float64Array(N);
    const entropy = new Float64Array(N);
    const stack = [];
    const order = [];

    let totalW = 0, totalWLogW = 0;
    for (let t = 0; t < T; t++) { totalW += this.weights[t]; totalWLogW += this.wLogW[t]; }
    const startEntropy = Math.log(totalW) - totalWLogW / totalW;

    for (let i = 0; i < N; i++) {
      sumW[i] = totalW;
      sumWLogW[i] = totalWLogW;
      entropy[i] = startEntropy;
      for (let t = 0; t < T; t++) {
        for (let d = 0; d < 4; d++) {
          compatible[(i * T + t) * 4 + d] = propagator[OPPOSITE[d]][t].length;
        }
      }
    }

    let contradiction = false;
    const ban = (i, t) => {
      const k = i * T + t;
      if (!wave[k]) return;
      wave[k] = 0;
      for (let d = 0; d < 4; d++) compatible[k * 4 + d] = 0;
      stack.push(i, t);
      counts[i]--;
      sumW[i] -= this.weights[t];
      sumWLogW[i] -= this.wLogW[t];
      entropy[i] = sumW[i] > 0 ? Math.log(sumW[i]) - sumWLogW[i] / sumW[i] : 0;
      if (counts[i] === 0) contradiction = true;
    };

    const propagate = () => {
      while (stack.length && !contradiction) {
        const t1 = stack.pop();
        const i1 = stack.pop();
        for (let d = 0; d < 4; d++) {
          const i2 = this.#neighbor(i1, d);
          if (i2 < 0) continue;
          const list = propagator[d][t1];
          for (let n = 0; n < list.length; n++) {
            const t2 = list[n];
            const k = (i2 * T + t2) * 4 + d;
            if (compatible[k] > 0) {
              compatible[k]--;
              if (compatible[k] === 0) ban(i2, t2);
            }
          }
        }
      }
      return !contradiction;
    };

    // 1) Boundary rules: forbid sockets that may not face the outside.
    if (this.boundary && !this.periodic) {
      for (let i = 0; i < N; i++) {
        for (let d = 0; d < 4; d++) {
          if (this.#neighbor(i, d) >= 0) continue;
          for (let t = 0; t < T; t++) {
            if (wave[i * T + t] && !this.boundary(this.tiles[t].sockets[d], d, this.tiles[t])) ban(i, t);
          }
        }
      }
    }
    // 2) User constraints (fixed cells, masks, ...)
    for (const { cell, allowed } of this.constraints) {
      for (let t = 0; t < T; t++) if (!allowed.has(t)) ban(cell, t);
    }
    if (!propagate()) return null;

    // Cells already decided by constraints count as collapsed.
    for (let i = 0; i < N; i++) if (counts[i] === 1) order.push(i);

    // 3) Observe / collapse / propagate until every cell has one option.
    for (;;) {
      let best = -1;
      let bestE = Infinity;
      for (let i = 0; i < N; i++) {
        if (counts[i] <= 1) continue;
        const e = entropy[i] + rand() * 1e-6; // noise breaks ties randomly
        if (e < bestE) { bestE = e; best = i; }
      }
      if (best < 0) break; // fully collapsed

      // Weighted random choice among remaining tiles.
      let r = rand() * sumW[best];
      let chosen = -1;
      for (let t = 0; t < T; t++) {
        if (!wave[best * T + t]) continue;
        chosen = t;
        r -= this.weights[t];
        if (r <= 0) break;
      }
      for (let t = 0; t < T; t++) if (t !== chosen && wave[best * T + t]) ban(best, t);
      order.push(best);
      if (!propagate()) return null;

      // Record any cells that propagation forced to a single option.
      // (cheap: only needed for nice reveal animations)
    }

    // Build the output grid of tile ids.
    const grid = [];
    for (let y = 0; y < this.height; y++) {
      const row = [];
      for (let x = 0; x < this.width; x++) {
        const i = x + y * this.width;
        let id = null;
        for (let t = 0; t < T; t++) if (wave[i * T + t]) { id = this.tiles[t].id; break; }
        row.push(id);
      }
      grid.push(row);
    }
    // Make `order` cover every cell exactly once (forced cells appended).
    const seen = new Uint8Array(N);
    const fullOrder = [];
    for (const i of order) if (!seen[i]) { seen[i] = 1; fullOrder.push(i); }
    for (let i = 0; i < N; i++) if (!seen[i]) fullOrder.push(i);

    return { grid, order: fullOrder };
  }
}

/**
 * Helper: rotate a socket list clockwise `times` quarter turns.
 * Useful for generating rotated variants of a module:
 *   rotateSockets(['R','R','s','s'], 1) -> ['s','R','R','s']
 */
export function rotateSockets(sockets, times = 1) {
  const s = sockets.slice();
  for (let i = 0; i < times; i++) s.unshift(s.pop());
  return s;
}
