/**
 * Seeded random numbers. Every procedural thing in the hub (maps, particles
 * that must be reproducible, daily challenges) goes through these helpers so a
 * seed always reproduces the exact same result.
 */

/** Hash any string into a 32-bit unsigned integer (FNV-1a). */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Normalise a seed (number or string) into a 32-bit unsigned integer. */
export function toSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
  return hashString(String(seed ?? ''));
}

/**
 * Mulberry32 PRNG. Small, fast and good enough for games.
 * Returns a function producing floats in [0, 1).
 */
export function mulberry32(seed) {
  let a = toSeed(seed);
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Convenience wrapper with helpers (int, pick, chance, shuffle). */
export class RNG {
  constructor(seed) {
    this.seed = toSeed(seed);
    this.next = mulberry32(this.seed);
  }
  float() { return this.next(); }
  range(min, max) { return min + this.next() * (max - min); }
  int(min, maxInclusive) { return min + Math.floor(this.next() * (maxInclusive - min + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

/** A fresh random seed, shown to players as a short code. */
export function randomSeed() {
  return (Math.random() * 0xffffffff) >>> 0;
}

/** Same seed for everyone on the same calendar day (local time). */
export function dailySeed(salt = '') {
  const d = new Date();
  const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  return hashString(key + salt);
}

/** Short, human-friendly seed label, e.g. "7F3A-91C2". */
export function seedLabel(seed) {
  const hex = (toSeed(seed) >>> 0).toString(16).toUpperCase().padStart(8, '0');
  return `${hex.slice(0, 4)}-${hex.slice(4)}`;
}
