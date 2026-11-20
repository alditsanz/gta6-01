// world.js — Solmar city generation and road-grid pathfinding.
// A 9x9 grid of roads over a 2440x2440 world. Blocks between roads hold
// buildings and parks. Canal Row (south-east) has water canals crossed
// by bridges exactly where the roads run.

import { WORLD_SIZE, ROAD_CENTERS, ROAD_WIDTH, CAR_MODELS } from './config.js';
import { createRng, randInt, pick } from './random.js';

export function isOnRoad(x, y) {
  for (const c of ROAD_CENTERS) {
    if (Math.abs(x - c) <= ROAD_WIDTH / 2) return true;
    if (Math.abs(y - c) <= ROAD_WIDTH / 2) return true;
  }
  return false;
}

export function isCanal(x, y) {
  // Two canals cut Canal Row: a vertical and a horizontal channel that
  // are NOT on road lines, so roads crossing them act as bridges.
  const inCanalRow = x >= 1560 && y >= 1560;
  if (!inCanalRow) return false;
  const vCanal = Math.abs(x - 1830) < 34;
  const hCanal = Math.abs(y - 1830) < 34;
  if (isOnRoad(x, y)) return false; // bridge deck over the canal
  return vCanal || hCanal;
}

export function isBridge(x, y) {
  const inCanalRow = x >= 1560 && y >= 1560;
  if (!inCanalRow || !isOnRoad(x, y)) return false;
  return Math.abs(x - 1830) < 70 || Math.abs(y - 1830) < 70;
}

export function nearestRoadCenter(v) {
  let best = ROAD_CENTERS[0], bd = Infinity;
  for (const c of ROAD_CENTERS) { const d = Math.abs(v - c); if (d < bd) { bd = d; best = c; } }
  return best;
}

export function nearestIntersection(x, y) {
  return { x: nearestRoadCenter(x), y: nearestRoadCenter(y) };
}

// Breadth-first search over the 9x9 intersection graph. Returns the list
// of intersection points from start to goal (inclusive of goal).
export function findPath(sx, sy, tx, ty) {
  const start = nearestIntersection(sx, sy);
  const goal = nearestIntersection(tx, ty);
  const key = (x, y) => x + ',' + y;
  const queue = [start];
  const seen = new Map([[key(start.x, start.y), null]]);
  while (queue.length) {
    const cur = queue.shift();
    if (cur.x === goal.x && cur.y === goal.y) {
      const path = [];
      let node = cur;
      while (node) { path.unshift(node); node = seen.get(key(node.x, node.y)); }
      path.push({ x: tx, y: ty });
      return path;
    }
    for (const c of ROAD_CENTERS) {
      const neighbours = [{ x: c, y: cur.y }, { x: cur.x, y: c }];
      for (const n of neighbours) {
        if (n.x === cur.x && n.y === cur.y) continue;
        const k = key(n.x, n.y);
        if (!seen.has(k)) { seen.set(k, cur); queue.push(n); }
      }
    }
  }
  return [{ x: tx, y: ty }];
}

const BUILDING_COLORS = ['#d9a05b', '#c97b4a', '#e0c084', '#a8b8c8', '#d98c8c', '#8fb8a8', '#e8d8b0', '#b08968'];

export function generateWorld(seed) {
  const rng = createRng(seed || 20261117);
  const buildings = [];
  const parks = [];
  const trees = [];
  for (let i = 0; i < ROAD_CENTERS.length - 1; i++) {
    for (let j = 0; j < ROAD_CENTERS.length - 1; j++) {
      const x0 = ROAD_CENTERS[i] + ROAD_WIDTH / 2 + 10;
      const y0 = ROAD_CENTERS[j] + ROAD_WIDTH / 2 + 10;
      const w = ROAD_CENTERS[i + 1] - ROAD_CENTERS[i] - ROAD_WIDTH - 20;
      const h = ROAD_CENTERS[j + 1] - ROAD_CENTERS[j] - ROAD_WIDTH - 20;
      if (rng() < 0.18) {
        parks.push({ x: x0, y: y0, w, h });
        for (let t = 0; t < 5; t++) trees.push({ x: x0 + 14 + rng() * (w - 28), y: y0 + 14 + rng() * (h - 28), r: 9 + rng() * 7 });
      } else {
        // One or two buildings per block, kept off the landmark plots.
        const count = rng() < 0.5 ? 1 : 2;
        for (let b = 0; b < count; b++) {
          const bw = count === 1 ? w : (w / 2 - 6);
          buildings.push({
            x: x0 + (count === 1 ? 0 : b * (w / 2 + 2)), y: y0,
            w: bw, h, color: pick(rng, BUILDING_COLORS),
            floors: randInt(rng, 2, 9),
          });
        }
      }
    }
  }
  return { buildings, parks, trees, size: WORLD_SIZE };
}

export function buildingAt(world, x, y, pad) {
  const p = pad || 0;
  for (const b of world.buildings) {
    if (x >= b.x - p && x <= b.x + b.w + p && y >= b.y - p && y <= b.y + b.h + p) return b;
  }
  return null;
}

export function collidesBuilding(world, x, y, r) {
  return !!buildingAt(world, x, y, r || 0);
}

// Spawn the twelve stealable cars on roads spread across the districts.
export function spawnParkedCars() {
  const spots = [
    [140, 300], [660, 140], [1180, 400], [1960, 660], [400, 920],
    [1700, 1180], [920, 1440], [2220, 1700], [660, 1960], [1440, 2220],
    [1960, 1960], [400, 2220],
  ];
  return spots.map((s, i) => {
    const m = CAR_MODELS[i % CAR_MODELS.length];
    const horizontal = i % 2 === 0;
    return {
      id: 'car' + i, model: m.model, color: m.color,
      x: s[0], y: s[1], angle: horizontal ? 0 : Math.PI / 2,
      vx: 0, vy: 0, speed: 0, health: 100, wrecked: false,
      topSpeed: m.speed, accel: m.accel, grip: m.grip,
      stolen: false, isPlayerCar: false, mods: null,
    };
  });
}

export function spawnTraffic(rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const horizontal = rng() < 0.5;
    const lane = pick(rng, ROAD_CENTERS);
    const along = 80 + rng() * (WORLD_SIZE - 160);
    const dir = rng() < 0.5 ? 1 : -1;
    const m = pick(rng, CAR_MODELS);
    cars.push({
      id: 'traffic' + i, model: m.model, color: m.color,
      x: horizontal ? along : lane + (dir > 0 ? 22 : -22),
      y: horizontal ? lane + (dir > 0 ? -22 : 22) : along,
      angle: horizontal ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
      dir, horizontal, speed: 95 + rng() * 55, health: 100, wrecked: false,
    });
  }
  return cars;
}

export function spawnPedestrians(rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const road = pick(rng, ROAD_CENTERS);
    const along = 80 + rng() * (WORLD_SIZE - 160);
    const side = rng() < 0.5 ? -62 : 62;
    const horizontal = rng() < 0.5;
    peds.push({
      id: 'ped' + i,
      x: horizontal ? along : road + side,
      y: horizontal ? road + side : along,
      angle: rng() * Math.PI * 2, speed: 26 + rng() * 22,
      color: pick(rng, ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#fd79a8']),
      wander: rng() * 10,
    });
  }
  return peds;
}
