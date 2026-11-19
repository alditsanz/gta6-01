// Solmar Heat — world.js
// The city itself: the 9x9 road grid, blocks, buildings, parks and the
// Canal Row water with its bridges. Everything is built from a fixed seed,
// so the city is identical on every load. Pure geometry — no DOM.

import { WORLD, GRID, BLOCK, ROAD_HALF, roadPos, clampWorld } from './config.js';
import { mulberry32, range, intRange, pick } from './random.js';

export const CANAL_Y0 = 1920; // the canal band across Canal Row
export const CANAL_Y1 = 2000;
export const BRIDGE_XS = [1000, 1350]; // x positions of the two bridges

/** Is a point on a road (within the road's half-width of a road line)? */
export function isOnRoad(x, y) {
  for (let i = 0; i < GRID; i++) {
    if (Math.abs(x - roadPos(i)) <= ROAD_HALF + 6) return true;
    if (Math.abs(y - roadPos(i)) <= ROAD_HALF + 6) return true;
  }
  return false;
}

/** Nearest road index along one axis. */
export function nearestRoadIndex(v) {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < GRID; i++) {
    const d = Math.abs(v - roadPos(i));
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

/** Is a point inside the canal water (and not on a bridge)? */
export function inCanal(x, y) {
  if (y < CANAL_Y0 || y > CANAL_Y1) return false;
  return !BRIDGE_XS.some((bx) => Math.abs(x - bx) < 46);
}

/** Build the city's blocks: buildings, parks and trees, from a fixed seed. */
export function buildCity(seed = 20261119) {
  const rng = mulberry32(seed);
  const buildings = [];
  const parks = [];
  const trees = [];
  const palette = ['#b08d57', '#8d9db6', '#a67c52', '#7d8c9c', '#c2a878', '#6e7f80', '#9c7b54', '#5d6d7e'];
  for (let cx = 0; cx < GRID - 1; cx++) {
    for (let cy = 0; cy < GRID - 1; cy++) {
      const x0 = roadPos(cx) + ROAD_HALF + 8;
      const y0 = roadPos(cy) + ROAD_HALF + 8;
      const x1 = roadPos(cx + 1) - ROAD_HALF - 8;
      const y1 = roadPos(cy + 1) - ROAD_HALF - 8;
      // The canal band cuts through the southern blocks: leave it water.
      if (y0 < CANAL_Y1 && y1 > CANAL_Y0 && cx >= 3 && cx <= 5) continue;
      const roll = rng();
      if (roll < 0.16) {
        // A park with trees.
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const n = intRange(rng, 4, 8);
        for (let t = 0; t < n; t++) {
          trees.push({ x: range(rng, x0 + 14, x1 - 14), y: range(rng, y0 + 14, y1 - 14), r: range(rng, 7, 12) });
        }
        continue;
      }
      // One or two buildings per block.
      const nB = rng() < 0.45 ? 2 : 1;
      for (let b = 0; b < nB; b++) {
        const bw = range(rng, 60, 110);
        const bh = range(rng, 60, 110);
        const bx = nB === 1 ? x0 + (x1 - x0 - bw) / 2 : x0 + 6 + b * ((x1 - x0) / 2 - 6);
        const by = y0 + (y1 - y0 - bh) / 2 + range(rng, -8, 8);
        buildings.push({
          x: bx, y: by, w: bw, h: bh,
          color: pick(rng, palette),
          hgt: intRange(rng, 1, 4), // storeys, for the lit-window look at night
          lit: rng() < 0.7,
        });
      }
      if (rng() < 0.5) {
        trees.push({ x: range(rng, x0 + 10, x1 - 10), y: range(rng, y0 + 10, y1 - 10), r: range(rng, 6, 10) });
      }
    }
  }
  return { buildings, parks, trees };
}

/**
 * Breadth-first path over the road grid from (ax,ay) to (bx,by), as a list
 * of {x, y} road-intersection waypoints. Police cars follow this.
 * Returns [] when start and target share a node.
 */
export function bfsPath(ax, ay, bx, by) {
  const sx = nearestRoadIndex(ax);
  const sy = nearestRoadIndex(ay);
  const tx = nearestRoadIndex(bx);
  const ty = nearestRoadIndex(by);
  const key = (x, y) => y * GRID + x;
  const prev = new Map();
  const queue = [[sx, sy]];
  prev.set(key(sx, sy), null);
  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    if (cx === tx && cy === ty) break;
    for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
      if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
      if (prev.has(key(nx, ny))) continue;
      prev.set(key(nx, ny), [cx, cy]);
      queue.push([nx, ny]);
    }
  }
  if (!prev.has(key(tx, ty))) return [];
  const nodes = [];
  let cur = [tx, ty];
  while (cur) {
    nodes.unshift(cur);
    cur = prev.get(key(cur[0], cur[1]));
  }
  // Drop the start node (the car is already there) and convert to points.
  return nodes.slice(1).map(([ix, iy]) => ({ x: roadPos(ix), y: roadPos(iy) }));
}

/** Move a point, clamping it inside the world (road 8 must stay reachable). */
export function moveClamped(x, y, dx, dy) {
  return { x: clampWorld(x + dx), y: clampWorld(y + dy) };
}

/** Is a circle (x, y, r) hitting any building? Returns the building or null. */
export function hitBuilding(buildings, x, y, r) {
  for (const b of buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

export { WORLD, BLOCK };
