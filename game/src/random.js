// random.js — small seeded RNG and helpers, so world layout is stable per seed.

// Mulberry32: a tiny fast seeded generator.
function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One shared generator for the live game (seeded from the clock at boot).
const rng = makeRng((Date.now() % 2147483647) | 1);

function randRange(r, lo, hi) { return lo + r() * (hi - lo); }
function randInt(r, lo, hi) { return Math.floor(randRange(r, lo, hi + 1)); }
function pickOne(r, arr) { return arr[Math.floor(r() * arr.length)]; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
