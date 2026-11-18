// Solmar Heat — random: small deterministic RNG so the city layout
// is the same on every run, plus plain helpers for chance and picking.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One shared RNG for the city layout, seeded once per page load.
const cityRand = mulberry32(20261119);

function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function randInt(rng, lo, hi) { return Math.floor(randRange(rng, lo, hi + 1)); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function chance(rng, p) { return rng() < p; }

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
function angleTo(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); }
function lerp(a, b, t) { return a + (b - a) * t; }

// Shortest signed turn from angle a toward angle b.
function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
