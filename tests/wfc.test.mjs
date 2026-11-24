// Run with:  node tests/wfc.test.mjs
// Generates many villages and checks the WFC guarantees:
//   - every road piece connects (no dead ends, no broken joins)
//   - every house door faces the side of a road
//   - the same seed always produces the same map
import { generateVillage, validateVillage, KIND } from '../js/village.js';
import { WFC } from '../js/wfc.js';

let failures = 0;
const assert = (cond, msg) => { if (!cond) { failures++; console.error('  ✗', msg); } };

// 1) Tiny sanity check of the bare engine: a checkerboard must alternate.
{
  const wfc = new WFC({
    width: 6, height: 6, seed: 7,
    tiles: [
      { id: 'a', sockets: ['a', 'a', 'a', 'a'] },
      { id: 'b', sockets: ['b', 'b', 'b', 'b'] },
    ],
    socketRules: { a: ['b'] },
  });
  const r = wfc.run();
  assert(r.ok, 'checkerboard solves');
  for (let y = 0; y < 6; y++) for (let x = 0; x < 5; x++) {
    assert(r.grid[y][x] !== r.grid[y][x + 1], `checkerboard alternates at ${x},${y}`);
  }
}

// 2) Villages
const SIZES = [[20, 17], [40, 8], [12, 12]];
let total = 0, roads = 0, houses = 0, trees = 0, cells = 0, attempts = 0;
const t0 = performance.now();
for (const [w, h] of SIZES) {
  for (let seed = 1; seed <= 150; seed++) {
    const v = generateVillage({ width: w, height: h, seed });
    total++;
    assert(v.ok, `village ${w}x${h} seed ${seed} generated`);
    const problems = validateVillage(v);
    assert(problems.length === 0, `village ${w}x${h} seed ${seed}: ${problems.slice(0, 3).join('; ')}`);
    for (const row of v.kinds) for (const k of row) {
      cells++;
      if (k === KIND.ROAD) roads++;
      if (k === KIND.HOUSE) houses++;
      if (k === KIND.TREE) trees++;
    }
  }
}
const ms = performance.now() - t0;

// 3) Determinism
const a = generateVillage({ width: 20, height: 17, seed: 'hello' });
const b = generateVillage({ width: 20, height: 17, seed: 'hello' });
assert(JSON.stringify(a.tiles) === JSON.stringify(b.tiles), 'same seed -> same map');

// 4) keepClear is respected
const clear = [{ x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 }];
for (let s = 0; s < 50; s++) {
  const v = generateVillage({ width: 20, height: 17, seed: s, keepClear: clear });
  for (const c of clear) {
    const k = v.kinds[c.y][c.x];
    assert(k === KIND.ROAD || k === KIND.GRASS, `keepClear cell ${c.x},${c.y} walkable (seed ${s}) got ${k}`);
  }
}

console.log(`Generated ${total} villages in ${ms.toFixed(0)} ms (${(ms / total).toFixed(1)} ms each)`);
console.log(`Mix: roads ${(100 * roads / cells).toFixed(1)}%  houses ${(100 * houses / cells).toFixed(1)}%  trees ${(100 * trees / cells).toFixed(1)}%`);
if (failures) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('All WFC checks passed ✓');
