// config.js — Solmar Heat shared constants and tiny math helpers.
// One job: every magic number the rest of the game agrees on lives here.

export const WORLD_SIZE = 3600;      // the city is a square, 3600 x 3600
export const GRID = 9;               // 9 x 9 blocks
export const BLOCK = 400;            // one block is 400 x 400
export const ROAD_W = 92;            // road band width around each block
export const VIEW_W = 1280;          // canvas size the game renders at
export const VIEW_H = 720;
export const SEED = 20261121;        // fixed world seed (deterministic city)

// District names, row-major over a 3 x 3 super-grid of block groups.
export const DISTRICTS = [
  'Sunset Mile', 'Cactus Court', 'Neon Strip',
  'Old Market', 'Downtown Solmar', 'Canal Row',
  'Palm Heights', 'The Marina', 'Pier 9 Docks',
];

// Rank ladder, worst to best. Story and turf wins climb it.
export const RANKS = [
  'Nobody', 'Runner', 'Wheelman', 'Shot Caller',
  'King of the Mile', 'Solmar Legend',
];

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

// Shortest signed angle from a to b, in (-PI, PI].
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Turn `angle` toward `target` by at most `maxStep` radians.
export function turnToward(angle, target, maxStep) {
  const d = angleDelta(angle, target);
  if (Math.abs(d) <= maxStep) return target;
  return angle + Math.sign(d) * maxStep;
}

// Is this point on a road band? Roads run along block borders:
// a point is on a road when either coordinate sits within ROAD_W/2
// of a multiple of BLOCK.
export function onRoad(x, y) {
  const mx = ((x % BLOCK) + BLOCK) % BLOCK;
  const my = ((y % BLOCK) + BLOCK) % BLOCK;
  const half = ROAD_W / 2;
  return mx < half || mx > BLOCK - half || my < half || my > BLOCK - half;
}

// Road centre-line coordinate nearest to v (roads centre on multiples
// of BLOCK, wrapped so the far edge road sits at WORLD_SIZE too).
export function roadLine(v) {
  return Math.round(v / BLOCK) * BLOCK;
}
