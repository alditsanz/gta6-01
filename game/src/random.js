// Solmar Heat — random.js
// Deterministic seeded randomness (mulberry32) so the city, the logic
// tests and the staged screenshots all build the same world.

export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
export function randInt(rng, lo, hi) { return Math.floor(randRange(rng, lo, hi + 1)); }
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.hypot(dx, dy); }
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
export function lerp(a, b, t) { return a + (b - a) * t; }
