// Solmar Heat — random.js
// A tiny seeded random-number generator (mulberry32). The whole city is
// built from one seed so a world is perfectly reproducible: two worlds
// created with the same seed are identical, which the logic tests rely on.
// Math.random is never used anywhere in the game.

export function makeRng(seed) {
  let state = seed >>> 0;
  const rng = function () {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (min, max) => min + rng() * (max - min);
  rng.int = (min, max) => Math.floor(rng.range(min, max + 1));
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length) % arr.length];
  rng.chance = (p) => rng() < p;
  return rng;
}

// Deterministic 2D hash → 0..1, for per-block variation that must not
// consume the shared rng stream (roof props, ground tints).
export function hash2(a, b) {
  let h = Math.imul(a + 0x9E3779B9, 0x85EBCA6B) ^ Math.imul(b + 0xC2B2AE35, 0x27D4EB2F);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2C1B3C6D);
  h ^= h >>> 12;
  return ((h >>> 0) % 100000) / 100000;
}

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

// Shortest signed turn from angle a toward angle b.
export function turnToward(a, b, maxStep) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  if (d > maxStep) return a + maxStep;
  if (d < -maxStep) return a - maxStep;
  return b;
}
