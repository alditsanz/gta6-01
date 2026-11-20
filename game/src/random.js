// random.js — deterministic seeded randomness.
// One job: a mulberry32 generator plus convenience picks, so a world
// built from a seed is byte-for-byte reproducible. No Math.random
// anywhere in the game; everything flows through one of these.

export function makeRng(seed) {
  let state = (seed >>> 0) || 1;
  const rng = function () {
    state |= 0;
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Float in [a, b).
  rng.range = (a, b) => a + rng() * (b - a);
  // Integer in [a, b] inclusive.
  rng.int = (a, b) => a + Math.floor(rng() * (b - a + 1));
  // True with probability p.
  rng.chance = (p) => rng() < p;
  // One element of arr.
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  return rng;
}

// Stable 2D hash -> [0, 1). Used for per-block / per-building variety
// that must not consume the world rng stream (render-time variation).
export function hash2(a, b) {
  let h = Math.imul(a + 0x9E3779B9, 0x85EBCA6B) ^ Math.imul(b + 0xC2B2AE35, 0x27D4EB2F);
  h ^= h >>> 13;
  h = Math.imul(h, 0x165667B1);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
