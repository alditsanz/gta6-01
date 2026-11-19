// Solmar Heat — world.js
// The city itself: the 9x9 road grid, districts, canals and bridges,
// buildings, parks, and the traffic-density clock. Everything here is a
// pure function of position or time, so the logic test can check it
// without running the game loop.

import { WORLD, ROADS, ROAD_W, districtAt, TURF_ZONES } from './config.js';

// ------------------------------------------------------------------- roads
// Distance from a point to the nearest vertical or horizontal road line.
export function distToRoad(x, y) {
  let best = Infinity;
  for (const r of ROADS) {
    best = Math.min(best, Math.abs(x - r), Math.abs(y - r));
  }
  return best;
}

// True when the point sits on a street (within half a road width).
export function onRoad(x, y) {
  return distToRoad(x, y) <= ROAD_W / 2;
}

// The nearest intersection to a point (snapped to the grid).
export function nearestIntersection(x, y) {
  let bx = ROADS[0];
  let by = ROADS[0];
  for (const r of ROADS) {
    if (Math.abs(x - r) < Math.abs(x - bx)) bx = r;
    if (Math.abs(y - r) < Math.abs(y - by)) by = r;
  }
  return { x: bx, y: by };
}

// ------------------------------------------------------------------ canals
// Canal Row (the north-east district) has two canals running east-west.
// They block movement everywhere except at the bridges where a road
// crosses them. The bridges sit on road 8 (x = 2151).
export const CANALS = [
  { y0: 380, y1: 430, x0: 1952, x1: WORLD },
  { y0: 760, y1: 810, x0: 1952, x1: WORLD },
];
const BRIDGE_X = 2151;
const BRIDGE_HALF = 44;

export function isWater(x, y) {
  for (const c of CANALS) {
    if (x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1) {
      // On a bridge crossing the canal: dry land.
      if (Math.abs(x - BRIDGE_X) <= BRIDGE_HALF) return false;
      return true;
    }
  }
  return false;
}

export function isBridge(x, y) {
  for (const c of CANALS) {
    if (x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1) {
      return Math.abs(x - BRIDGE_X) <= BRIDGE_HALF;
    }
  }
  return false;
}

// --------------------------------------------------------------- buildings
// Deterministic buildings: one or two per city block, never on a road,
// never on a canal, never on a landmark square. The same seed always
// builds the same city, so replays match.
export function buildCity(seed) {
  let a = seed >>> 0;
  const rnd = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const buildings = [];
  const trees = [];
  const parks = [];
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const bx = ROADS[i] + ROAD_W / 2 + 8;
      const by = ROADS[j] + ROAD_W / 2 + 8;
      const bw = ROADS[i + 1] - ROADS[i] - ROAD_W - 16;
      const bh = ROADS[j + 1] - ROADS[j] - ROAD_W - 16;
      if (bw <= 0 || bh <= 0) continue;
      const cx = bx + bw / 2;
      const cy = by + bh / 2;
      // The plaza block in Cactus Court stays open, and so does the HQ block.
      const isPlaza = Math.abs(cx - 891) < 130 && Math.abs(cy - 387) < 130;
      const isHq = Math.abs(cx - 1143) < 130 && Math.abs(cy - 1143) < 130;
      if (isPlaza || isHq) {
        parks.push({ x: bx, y: by, w: bw, h: bh });
        continue;
      }
      if (rnd() < 0.22) {
        // A park with trees instead of buildings.
        parks.push({ x: bx, y: by, w: bw, h: bh });
        const n = 3 + Math.floor(rnd() * 4);
        for (let k = 0; k < n; k++) {
          trees.push({ x: bx + 20 + rnd() * (bw - 40), y: by + 20 + rnd() * (bh - 40) });
        }
        continue;
      }
      const count = rnd() < 0.6 ? 1 : 2;
      for (let k = 0; k < count; k++) {
        const w = 60 + rnd() * 70;
        const h = 60 + rnd() * 70;
        const x = bx + (count === 1 ? (bw - w) / 2 : k === 0 ? 6 : bw - w - 6);
        const y = by + (bh - h) / 2;
        // Keep buildings out of the canals.
        if (x + w > 1952 && y < 830 && y + h > 380) continue;
        buildings.push({
          x,
          y,
          w,
          h,
          color: ['#c9a37a', '#b98d68', '#a87f6d', '#8fa3b5', '#b5a38f', '#7d8a99'][Math.floor(rnd() * 6)],
          roof: rnd(),
        });
      }
      // A couple of street trees on the block corners.
      trees.push({ x: bx + 8, y: by + 8 });
      trees.push({ x: bx + bw - 8, y: by + bh - 8 });
    }
  }
  return { buildings, trees, parks };
}

// Circle-vs-building collision: true when a circle of radius r at (x, y)
// overlaps any building. Used for cars, the player and traffic.
export function hitsBuilding(buildings, x, y, r) {
  for (const b of buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) {
      return true;
    }
  }
  return false;
}

// ------------------------------------------------------------ traffic clock
// Rush-hour traffic: density is a pure function of the in-game hour.
// Peaks (07:00-09:00 and 17:00-19:00) run about twice the usual traffic;
// quiet night hours (00:00-05:00) run about half.
export function trafficDensityFactor(hour) {
  const h = ((hour % 24) + 24) % 24;
  if ((h >= 7 && h < 9) || (h >= 17 && h < 19)) return 2;
  if (h >= 0 && h < 5) return 0.5;
  return 1;
}

// How many traffic cars the city should hold at this hour.
export function trafficTarget(hour, base = 14) {
  return Math.round(base * trafficDensityFactor(hour));
}

// -------------------------------------------------------------- pathfinding
// Breadth-first search over the 9x9 intersection graph. Police cars use
// it to chase the player along real roads instead of cutting through
// buildings. Returns a list of intersections from start to goal.
export function findPath(startX, startY, goalX, goalY) {
  const s = nearestIntersection(startX, startY);
  const g = nearestIntersection(goalX, goalY);
  const si = ROADS.indexOf(s.x);
  const sj = ROADS.indexOf(s.y);
  const gi = ROADS.indexOf(g.x);
  const gj = ROADS.indexOf(g.y);
  if (si === gi && sj === gj) return [{ x: g.x, y: g.y }];
  const prev = new Map();
  const key = (i, j) => i * 9 + j;
  const queue = [[si, sj]];
  prev.set(key(si, sj), null);
  while (queue.length) {
    const [i, j] = queue.shift();
    if (i === gi && j === gj) break;
    for (const [ni, nj] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
      if (ni < 0 || ni > 8 || nj < 0 || nj > 8) continue;
      if (prev.has(key(ni, nj))) continue;
      prev.set(key(ni, nj), [i, j]);
      queue.push([ni, nj]);
    }
  }
  if (!prev.has(key(gi, gj))) return [{ x: g.x, y: g.y }];
  const path = [];
  let cur = [gi, gj];
  while (cur) {
    path.unshift({ x: ROADS[cur[0]], y: ROADS[cur[1]] });
    cur = prev.get(key(cur[0], cur[1]));
  }
  return path;
}

// The turf zone a point sits in, or null outside every zone.
export function turfAt(x, y) {
  for (const z of TURF_ZONES) {
    if (x >= z.rect.x && x <= z.rect.x + z.rect.w && y >= z.rect.y && y <= z.rect.y + z.rect.h) {
      return z;
    }
  }
  return null;
}

export { districtAt };
