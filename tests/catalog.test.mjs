// Run with:  node tests/catalog.test.mjs
// Checks the game catalogue: unique ids, every module file exists, every
// module is listed in the service worker so it works offline.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { GAMES, ENGINE_COUNT } from '../js/catalog.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sw = readFileSync(join(root, 'sw.js'), 'utf8');
let failures = 0;
const fail = (m) => { failures++; console.error('  ✗', m); };

const ids = new Set();
for (const g of GAMES) {
  if (ids.has(g.id)) fail(`duplicate id ${g.id}`);
  ids.add(g.id);
  if (!g.title || !g.how) fail(`${g.id} is missing a title or description`);
  const file = join(root, 'js', g.module.replace('./', ''));
  if (!existsSync(file)) fail(`${g.id}: module ${g.module} not found`);
  if (!sw.includes(`./js/${g.module.replace('./', '')}`)) fail(`${g.id}: ${g.module} is not precached in sw.js`);
}
console.log(`${GAMES.length} games from ${ENGINE_COUNT} engines`);
if (GAMES.length < 200) fail('fewer than 200 games');
if (failures) { console.error(`${failures} problem(s)`); process.exit(1); }
console.log('Catalogue checks passed ✓');
