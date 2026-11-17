// The city of Solmar: a 9x9 street grid, buildings, parks, traffic,
// pedestrians, parked cars and the police pursuit graph. Pure data and
// movement math — nothing here touches the DOM or the canvas.

import { WORLD, roadAt, clampToWorld, CAR_MODELS, COLORS } from './config.js';
import { range, int, pick, chance } from './random.js';

/** Is (x, y) on a road (within half the road width of a road centre)? */
export function onRoad(x, y) {
  const half = WORLD.roadWidth / 2;
  for (let i = 0; i < WORLD.roads; i++) {
    const r = roadAt(i);
    if (Math.abs(x - r) <= half || Math.abs(y - r) <= half) return true;
  }
  return false;
}

/** Nearest road index to a coordinate on one axis. */
export function nearestRoadIndex(v) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < WORLD.roads; i++) {
    const d = Math.abs(v - roadAt(i));
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * Breadth-first path over the road grid from road cell (ax, ay) to
 * (bx, by). Police follow it intersection by intersection, so a pursuit
 * never cuts through buildings.
 */
export function gridPath(ax, ay, bx, by) {
  const key = (x, y) => y * WORLD.roads + x;
  const prev = new Map();
  const seen = new Set([key(ax, ay)]);
  const queue = [[ax, ay]];
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    if (x === bx && y === by) {
      const path = [];
      let cur = key(x, y);
      let cx = x;
      let cy = y;
      while (cur !== key(ax, ay)) {
        path.unshift([cx, cy]);
        const p = prev.get(cur);
        cx = p[0];
        cy = p[1];
        cur = key(cx, cy);
      }
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= WORLD.roads || ny >= WORLD.roads) continue;
      const k = key(nx, ny);
      if (seen.has(k)) continue;
      seen.add(k);
      prev.set(k, [x, y]);
      queue.push([nx, ny]);
    }
  }
  return [[bx, by]];
}

/** Build the static city: buildings, parks and trees, from the seed. */
export function buildCity(rng) {
  const buildings = [];
  const trees = [];
  const parks = [];
  for (let cx = 0; cx < WORLD.roads - 1; cx++) {
    for (let cy = 0; cy < WORLD.roads - 1; cy++) {
      const x0 = roadAt(cx) + WORLD.roadWidth / 2 + 8;
      const x1 = roadAt(cx + 1) - WORLD.roadWidth / 2 - 8;
      const y0 = roadAt(cy) + WORLD.roadWidth / 2 + 8;
      const y1 = roadAt(cy + 1) - WORLD.roadWidth / 2 - 8;
      const bx = (x0 + x1) / 2;
      const by = (y0 + y1) / 2;
      // One in five blocks is a park; the rest hold one or two buildings.
      if (chance(rng, 0.2)) {
        parks.push({ x: bx, y: by, w: x1 - x0, h: y1 - y0 });
        const n = int(rng, 4, 8);
        for (let i = 0; i < n; i++) {
          trees.push({ x: range(rng, x0 + 14, x1 - 14), y: range(rng, y0 + 14, y1 - 14), r: range(rng, 7, 12) });
        }
        continue;
      }
      const w = range(rng, 60, Math.min(150, x1 - x0 - 20));
      const h = range(rng, 60, Math.min(150, y1 - y0 - 20));
      buildings.push({
        x: bx + range(rng, -8, 8),
        y: by + range(rng, -8, 8),
        w,
        h,
        color: pick(rng, [COLORS.building, COLORS.building2, COLORS.building3]),
        roof: pick(rng, ['#a5673f', '#5f7488', '#b39a5e', '#7d8a96']),
      });
      if (chance(rng, 0.45)) {
        buildings.push({
          x: bx + range(rng, -40, 40),
          y: by + range(rng, -40, 40),
          w: range(rng, 40, 70),
          h: range(rng, 40, 70),
          color: pick(rng, [COLORS.building, COLORS.building2, COLORS.building3]),
          roof: pick(rng, ['#a5673f', '#5f7488', '#b39a5e']),
        });
      }
      const n = int(rng, 0, 3);
      for (let i = 0; i < n; i++) {
        trees.push({ x: range(rng, x0 + 10, x1 - 10), y: range(rng, y0 + 10, y1 - 10), r: range(rng, 6, 10) });
      }
    }
  }
  return { buildings, trees, parks };
}

/** Does a circle at (x, y) with radius r hit any building? */
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x - b.w / 2, Math.min(x, b.x + b.w / 2));
    const cy = Math.max(b.y - b.h / 2, Math.min(y, b.y + b.h / 2));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return b;
  }
  return null;
}

/** Parked, stealable cars scattered around the city. */
export function spawnParkedCars(rng) {
  const cars = [];
  const spots = [];
  for (let i = 0; i < WORLD.roads; i++) {
    for (let j = 0; j < WORLD.roads; j++) {
      spots.push([roadAt(i), roadAt(j)]);
    }
  }
  // Shuffle the intersections and take ten, one per model.
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = spots[i];
    spots[i] = spots[j];
    spots[j] = t;
  }
  for (let k = 0; k < CAR_MODELS.length; k++) {
    const [ix, iy] = spots[k];
    const model = CAR_MODELS[k];
    const alongX = chance(rng, 0.5);
    const off = range(rng, -60, 60);
    cars.push({
      id: k + 1,
      model: model.name,
      color: model.color,
      taxi: model.taxi,
      x: alongX ? ix + off : ix + (chance(rng, 0.5) ? 26 : -26),
      y: alongX ? iy + (chance(rng, 0.5) ? 26 : -26) : iy + off,
      angle: alongX ? (chance(rng, 0.5) ? 0 : Math.PI) : (chance(rng, 0.5) ? Math.PI / 2 : -Math.PI / 2),
      speed: 0,
      health: 100,
      wrecked: false,
      stolen: false,
      driver: null,
    });
  }
  return cars;
}

/** Moving traffic cars that cruise the roads. */
export function spawnTraffic(rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const horizontal = chance(rng, 0.5);
    const road = int(rng, 0, WORLD.roads - 1);
    const dir = chance(rng, 0.5) ? 1 : -1;
    const lane = dir > 0 ? 16 : -16;
    const along = range(rng, 0, WORLD.size);
    cars.push({
      x: horizontal ? along : roadAt(road) + lane,
      y: horizontal ? roadAt(road) + lane : along,
      angle: horizontal ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
      speed: range(rng, 90, 170),
      color: pick(rng, ['#c65d5d', '#5d7dc6', '#c6b25d', '#5dc68a', '#8a5dc6', '#c9c9c9']),
      horizontal,
      road,
      dir,
      wait: 0,
    });
  }
  return cars;
}

/** Pedestrians strolling the sidewalks. */
export function spawnPedestrians(rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const road = int(rng, 0, WORLD.roads - 1);
    const horizontal = chance(rng, 0.5);
    const side = chance(rng, 0.5) ? 40 : -40;
    const along = range(rng, 0, WORLD.size);
    peds.push({
      x: horizontal ? along : roadAt(road) + side,
      y: horizontal ? roadAt(road) + side : along,
      angle: horizontal ? (chance(rng, 0.5) ? 0 : Math.PI) : (chance(rng, 0.5) ? Math.PI / 2 : -Math.PI / 2),
      speed: range(rng, 22, 48),
      color: pick(rng, ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22']),
      walkPhase: range(rng, 0, Math.PI * 2),
      fare: false,
    });
  }
  return peds;
}

/** Advance traffic along its road; wrap around the far edge. */
export function updateTraffic(traffic, dt) {
  for (const t of traffic) {
    if (t.wait > 0) {
      t.wait -= dt;
      continue;
    }
    if (t.horizontal) t.x += Math.cos(t.angle) * t.speed * dt;
    else t.y += Math.sin(t.angle) * t.speed * dt;
    if (t.x < -40) t.x = WORLD.size + 40;
    if (t.x > WORLD.size + 40) t.x = -40;
    if (t.y < -40) t.y = WORLD.size + 40;
    if (t.y > WORLD.size + 40) t.y = -40;
  }
}

/** Advance pedestrians; they turn around at the city edge. */
export function updatePedestrians(peds, dt) {
  for (const p of peds) {
    p.walkPhase += dt * 6;
    p.x += Math.cos(p.angle) * p.speed * dt;
    p.y += Math.sin(p.angle) * p.speed * dt;
    if (p.x < 30 || p.x > WORLD.size - 30 || p.y < 30 || p.y > WORLD.size - 30) {
      p.angle += Math.PI;
      p.x = clampToWorld(p.x);
      p.y = clampToWorld(p.y);
    }
  }
}

/** A police cruiser, spawned off-screen-ish on the road grid, chasing the player. */
export function spawnPoliceCar(rng, px, py) {
  const gx = nearestRoadIndex(px);
  const gy = nearestRoadIndex(py);
  // Start two intersections away on a random axis.
  const axis = chance(rng, 0.5) ? 'x' : 'y';
  const dir = chance(rng, 0.5) ? 2 : -2;
  let sx = gx;
  let sy = gy;
  if (axis === 'x') sx = Math.max(0, Math.min(WORLD.roads - 1, gx + dir));
  else sy = Math.max(0, Math.min(WORLD.roads - 1, gy + dir));
  return {
    x: roadAt(sx),
    y: roadAt(sy),
    angle: 0,
    speed: 0,
    maxSpeed: 390,
    path: [],
    pathI: 0,
    repath: 0,
    siren: range(rng, 0, Math.PI * 2),
  };
}

/** Steer one police car along the grid path toward the player's road cell. */
export function updatePoliceCar(car, px, py, dt) {
  car.repath -= dt;
  const tx = nearestRoadIndex(px);
  const ty = nearestRoadIndex(py);
  const cx = nearestRoadIndex(car.x);
  const cy = nearestRoadIndex(car.y);
  if (car.repath <= 0 || car.pathI >= car.path.length) {
    car.path = gridPath(cx, cy, tx, ty);
    car.pathI = 0;
    car.repath = 1.2;
  }
  let targetX = px;
  let targetY = py;
  if (car.pathI < car.path.length) {
    targetX = roadAt(car.path[car.pathI][0]);
    targetY = roadAt(car.path[car.pathI][1]);
    if (Math.hypot(targetX - car.x, targetY - car.y) < 26) car.pathI++;
  }
  const want = Math.atan2(targetY - car.y, targetX - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
  car.speed = Math.min(car.maxSpeed, car.speed + 420 * dt);
  car.x = clampToWorld(car.x + Math.cos(car.angle) * car.speed * dt);
  car.y = clampToWorld(car.y + Math.sin(car.angle) * car.speed * dt);
  car.siren += dt * 6;
}
