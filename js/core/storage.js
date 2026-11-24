/**
 * Tiny localStorage wrapper (namespaced, JSON, never throws).
 * Private browsing or full storage simply falls back to memory.
 */
const NS = 'pixelhub:';
const memory = new Map();

function raw(key) {
  try { return localStorage.getItem(NS + key); } catch { return memory.get(key) ?? null; }
}
function write(key, value) {
  try { localStorage.setItem(NS + key, value); } catch { memory.set(key, value); }
}

export const storage = {
  get(key, fallback = null) {
    const v = raw(key);
    if (v === null) return fallback;
    try { return JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) { write(key, JSON.stringify(value)); },
};

// ---- Settings --------------------------------------------------------------

export const DEFAULT_SETTINGS = {
  sound: true,
  music: false,
  vibration: true,
  scanlines: true,
  daily: false,      // use the daily seed for procedural maps
  showControls: 'auto', // 'auto' | 'always' | 'never'
};

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...storage.get('settings', {}) };
}
export function saveSettings(s) { storage.set('settings', s); }

// ---- High scores ------------------------------------------------------------

export function getBest(gameId, mode = 'default') {
  return storage.get(`best:${gameId}:${mode}`, 0);
}
/** Saves when it is a new record. Returns true if it was. */
export function submitScore(gameId, mode, score) {
  const best = getBest(gameId, mode);
  if (score > best) { storage.set(`best:${gameId}:${mode}`, score); return true; }
  return false;
}
/** Highest score across all modes of a game (for the hub cards). */
export function getBestAny(gameId, modes) {
  return Math.max(0, ...modes.map((m) => getBest(gameId, m)));
}

export function bumpStat(key, by = 1) {
  const v = storage.get(`stat:${key}`, 0) + by;
  storage.set(`stat:${key}`, v);
  return v;
}
export function getStat(key) { return storage.get(`stat:${key}`, 0); }
