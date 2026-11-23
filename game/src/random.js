// Solmar Heat — seeded randomness and small math helpers.
// Every random draw in the game flows through a mulberry32 stream so a
// world rebuilt from the same seed comes out identical, every time.

export function makeRng(seed) {
  let state = seed >>> 0;
  const next = function () {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (lo, hi) => lo + next() * (hi - lo);
  next.int = (lo, hi) => Math.floor(next.range(lo, hi + 1));
  next.pick = (arr) => arr[Math.floor(next() * arr.length) % arr.length];
  next.chance = (p) => next() < p;
  return next;
}

// Cheap stable 2D hash into [0,1) — used for per-block variation that
// must not disturb the main rng stream.
export function hash2(a, b) {
  let h = (a | 0) * 374761393 + (b | 0) * 668265263;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function clamp(v, lo, hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

// Rotate `a` toward `b` along the short arc, at most maxStep radians.
export function turnToward(a, b, maxStep) {
  let delta = b - a;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  if (delta > maxStep) return a + maxStep;
  if (delta < -maxStep) return a - maxStep;
  return b;
}
