// world.js — the city of Solmar: its streets, buildings, traffic, pedestrians
// and police. Everything here is geometry and movement; the story, the wanted
// level and the HUD live in main.js, the drawing in render.js.

import { CITY, PALETTE, VEHICLES, PLACES } from './config.js';
import { makeRng } from './random.js';

// --- City layout ------------------------------------------------------------

// Pixel rect of block (i, j): the buildable ground between four streets.
export function blockRect(i, j) {
  const x = i * CITY.pitch + CITY.roadHalf;
  const y = j * CITY.pitch + CITY.roadHalf;
  return { x, y, w: CITY.block, h: CITY.block };
}

// World centre of a named place.
export function placeCenter(key) {
  const p = PLACES[key];
  const r = blockRect(p.block[0], p.block[1]);
  return { x: r.x + r.w / 2, y: r.y + r.h / 2, name: p.name };
}

// Intersection point (i, j) on the street grid.
export function nodePoint(i, j) {
  return { x: i * CITY.pitch, y: j * CITY.pitch };
}

// Is this world point on a street (not inside a block)?
export function onRoad(x, y) {
  const m = ((v) => {
    const r = v % CITY.pitch;
    return r < CITY.roadHalf || r > CITY.pitch - CITY.roadHalf;
  });
  return m(x) || m(y);
}

// Nearest intersection to a world point.
export function nearestNode(x, y) {
  return {
    i: Math.max(0, Math.min(CITY.blocks, Math.round(x / CITY.pitch))),
    j: Math.max(0, Math.min(CITY.blocks, Math.round(y / CITY.pitch))),
  };
}

// Breadth-first path over the street grid, from node a to node b.
// Returns an array of {i, j} nodes, start included, goal last.
export function bfsPath(a, b) {
  const key = (i, j) => i + ',' + j;
  const prev = new Map();
  const seen = new Set([key(a.i, a.j)]);
  const queue = [{ i: a.i, j: a.j }];
  while (queue.length) {
    const n = queue.shift();
    if (n.i === b.i && n.j === b.j) {
      const path = [];
      let cur = n;
      while (cur) {
        path.unshift(cur);
        cur = prev.get(key(cur.i, cur.j));
      }
      return path;
    }
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = n.i + di, nj = n.j + dj;
      if (ni < 0 || nj < 0 || ni > CITY.blocks || nj > CITY.blocks) continue;
      if (seen.has(key(ni, nj))) continue;
      seen.add(key(ni, nj));
      prev.set(key(ni, nj), n);
      queue.push({ i: ni, j: nj });
    }
  }
  return [{ i: a.i, j: a.j }];
}

// --- Buildings --------------------------------------------------------------

function buildCity(rng) {
  const buildings = [];
  const trees = [];
  const crates = [];
  const special = {};
  for (const key of Object.keys(PLACES)) special[PLACES[key].block.join(',')] = key;

  for (let i = 0; i < CITY.blocks; i++) {
    for (let j = 0; j < CITY.blocks; j++) {
      const r = blockRect(i, j);
      const kind = special[i + ',' + j];
      if (kind === 'park') {
        for (let t = 0; t < 14; t++) {
          trees.push({ x: r.x + rng.range(14, r.w - 14), y: r.y + rng.range(14, r.h - 14), r: rng.range(9, 16), c: rng.pick(PALETTE.tree) });
        }
        buildings.push({ x: r.x + r.w / 2 - 40, y: r.y + r.h / 2 - 26, w: 80, h: 52, hgt: 10, roof: '#7d9b76', wall: '#e8dcc8', kind: 'bandstand', label: 'Bandstand' });
        continue;
      }
      if (kind === 'beach' || kind === 'pier' || kind === 'docks') {
        // Open ground: sand, crates and containers instead of towers.
        const n = kind === 'docks' ? 8 : 4;
        for (let c = 0; c < n; c++) {
          crates.push({ x: r.x + rng.range(10, r.w - 50), y: r.y + rng.range(10, r.h - 30), w: rng.range(26, 44), h: 22, c: rng.pick(['#b5533c', '#5b7d8c', '#d9a05b', '#7d9b76']) });
        }
        if (kind === 'pier') {
          buildings.push({ x: r.x + r.w - 60, y: r.y + 30, w: 46, h: 90, hgt: 8, roof: '#8a6a4a', wall: '#a8875f', kind: 'shack', label: 'Pier 9 Hut' });
        }
        continue;
      }
      // Ordinary block: one landmark tower or a cluster of smaller buildings.
      const landmark = kind === 'bank' || kind === 'hospital' || kind === 'motel' || kind === 'paintshop' || kind === 'safehouse';
      if (landmark) {
        const label = PLACES[kind].name;
        const w = kind === 'bank' ? 130 : kind === 'hospital' ? 150 : 110;
        const h = kind === 'bank' ? 100 : kind === 'hospital' ? 90 : 80;
        buildings.push({
          x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, w, h,
          hgt: kind === 'bank' ? 46 : kind === 'hospital' ? 34 : 22,
          roof: kind === 'bank' ? '#5b7d8c' : kind === 'hospital' ? '#e8e4d2' : '#c96f4a',
          wall: '#f0e6d2', kind: 'landmark', label,
        });
        continue;
      }
      const count = rng.int(2, 4);
      for (let b = 0; b < count; b++) {
        const w = rng.range(46, 78), h = rng.range(40, 70);
        const x = r.x + rng.range(6, r.w - w - 6);
        const y = r.y + rng.range(6, r.h - h - 6);
        const cand = { x, y, w, h, hgt: rng.range(12, 52), roof: rng.pick(PALETTE.buildingRoof), wall: rng.pick(PALETTE.buildingWall), kind: 'tower', label: '' };
        if (buildings.some((o) => rectsOverlap(o, cand, 8))) continue;
        buildings.push(cand);
      }
    }
  }
  return { buildings, trees, crates };
}

export function rectsOverlap(a, b, pad = 0) {
  return a.x - pad < b.x + b.w + pad && a.x + a.w + pad > b.x - pad &&
    a.y - pad < b.y + b.h + pad && a.y + a.h + pad > b.y - pad;
}

// Push a circle out of every building rect it overlaps. Returns corrected {x, y}.
export function resolveBuildingCollision(x, y, radius, buildings) {
  for (const b of buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx, dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * radius;
        y = cy + (dy / d) * radius;
      } else {
        // Centre inside the rect: shove out along the shortest side.
        const left = x - b.x, right = b.x + b.w - x;
        const top = y - b.y, bottom = b.y + b.h - y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = b.x - radius;
        else if (m === right) x = b.x + b.w + radius;
        else if (m === top) y = b.y - radius;
        else y = b.y + b.h + radius;
      }
    }
  }
  return { x, y };
}

// --- Vehicles ---------------------------------------------------------------

export function makeCar(typeId, x, y, angle, opts = {}) {
  const def = VEHICLES.find((v) => v.id === typeId);
  return {
    def, x, y, angle, speed: 0,
    parked: !!opts.parked,
    driver: opts.driver || null, // 'player' | 'traffic' | 'police' | null
    color: opts.color || def.color,
    node: opts.node || null, // traffic: current graph node
    next: opts.next || null, // traffic: next graph node
    brake: false,
    id: opts.id || Math.random().toString(36).slice(2, 8),
  };
}

// A roadside parking spot near a named place, facing along the street.
export function parkingSpotNear(rng, placeKey, side = 1) {
  const c = placeCenter(placeKey);
  const streetX = Math.round(c.x / CITY.pitch) * CITY.pitch;
  const along = rng.range(-70, 70);
  const lane = side * (CITY.roadHalf - 16);
  return { x: streetX + lane, y: c.y + along, angle: side > 0 ? Math.PI / 2 : -Math.PI / 2 };
}

// --- Traffic ----------------------------------------------------------------

export function spawnTraffic(rng, count, buildings) {
  const cars = [];
  const used = new Set();
  for (let n = 0; n < count; n++) {
    const i = rng.int(0, CITY.blocks);
    const j = rng.int(0, CITY.blocks);
    if (used.has(i + ',' + j)) continue;
    used.add(i + ',' + j);
    const dir = rng.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
    const ni = Math.max(0, Math.min(CITY.blocks, i + dir[0]));
    const nj = Math.max(0, Math.min(CITY.blocks, j + dir[1]));
    const type = rng.pick(VEHICLES.filter((v) => v.kind !== 'police'));
    const p = nodePoint(i, j);
    const q = nodePoint(ni, nj);
    const car = makeCar(type.id, p.x, p.y, Math.atan2(q.y - p.y, q.x - p.x), {
      driver: 'traffic', node: { i, j }, next: { i: ni, j: nj },
    });
    car.speed = type.speed * rng.range(0.45, 0.65);
    cars.push(car);
  }
  return cars;
}

// Advance one traffic car along the street graph (right-hand lane).
export function stepTraffic(car, dt, rng) {
  if (!car.next) return;
  const target = nodePoint(car.next.i, car.next.j);
  // Right-hand lane offset: perpendicular to travel, to the right.
  const dx = target.x - car.x, dy = target.y - car.y;
  const dist = Math.hypot(dx, dy);
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
  const cruise = car.def.speed * 0.55;
  car.speed += (cruise - car.speed) * Math.min(1, dt * 1.5);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (dist < 26) {
    // Reached the node: pick a new direction (never a U-turn if avoidable).
    const from = car.node;
    car.node = car.next;
    const options = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([a, b]) => ({ i: car.node.i + a, j: car.node.j + b }))
      .filter((n) => n.i >= 0 && n.j >= 0 && n.i <= CITY.blocks && n.j <= CITY.blocks)
      .filter((n) => !(n.i === from.i && n.j === from.j));
    const next = options.length ? rng.pick(options) : { i: from.i, j: from.j };
    car.next = next;
  }
}

// --- Pedestrians ------------------------------------------------------------

const PED_COLORS = ['#d94f3d', '#3d7ad9', '#e8b13c', '#7a4a8c', '#3d8a5a', '#d97ab0', '#5b7d8c', '#c96f4a'];

export function spawnPedestrians(rng, count) {
  const peds = [];
  for (let n = 0; n < count; n++) {
    const i = rng.int(0, CITY.blocks);
    const j = rng.int(0, CITY.blocks);
    const horizontal = rng.chance(0.5);
    const along = rng.range(0, CITY.pitch);
    const side = rng.pick([-1, 1]) * (CITY.roadHalf + 8);
    const x = horizontal ? i * CITY.pitch + along : i * CITY.pitch + side;
    const y = horizontal ? j * CITY.pitch + side : j * CITY.pitch + along;
    peds.push({
      x, y, angle: rng.range(0, Math.PI * 2),
      speed: rng.range(28, 52),
      color: rng.pick(PED_COLORS),
      flee: 0, // seconds of fleeing left
      fleeX: 0, fleeY: 0,
      wander: rng.range(2, 6),
      targetX: x, targetY: y,
    });
  }
  return peds;
}

export function stepPedestrian(ped, dt, rng, gunshot) {
  if (gunshot && Math.hypot(ped.x - gunshot.x, ped.y - gunshot.y) < 320) {
    ped.flee = 2.5;
    ped.fleeX = ped.x - gunshot.x;
    ped.fleeY = ped.y - gunshot.y;
  }
  if (ped.flee > 0) {
    ped.flee -= dt;
    const len = Math.hypot(ped.fleeX, ped.fleeY) || 1;
    ped.angle = Math.atan2(ped.fleeY / len, ped.fleeX / len);
    ped.x += Math.cos(ped.angle) * 130 * dt;
    ped.y += Math.sin(ped.angle) * 130 * dt;
    return;
  }
  ped.wander -= dt;
  if (ped.wander <= 0) {
    ped.wander = rng.range(2, 6);
    // Pick a new nearby sidewalk point.
    const n = nearestNode(ped.x, ped.y);
    const dir = rng.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
    const ni = Math.max(0, Math.min(CITY.blocks, n.i + dir[0]));
    const nj = Math.max(0, Math.min(CITY.blocks, n.j + dir[1]));
    const p = nodePoint(ni, nj);
    const side = rng.pick([-1, 1]) * (CITY.roadHalf + 8);
    ped.targetX = dir[0] !== 0 ? p.x : p.x + side;
    ped.targetY = dir[1] !== 0 ? p.y : p.y + side;
  }
  const dx = ped.targetX - ped.x, dy = ped.targetY - ped.y;
  const d = Math.hypot(dx, dy);
  if (d > 6) {
    ped.angle = Math.atan2(dy, dx);
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
  }
}

// --- Police -----------------------------------------------------------------

export function makeCruiser(x, y) {
  const car = makeCar('cruiser', x, y, 0, { driver: 'police' });
  car.path = [];
  car.pathIndex = 0;
  car.repath = 0;
  car.sirenPhase = 0;
  return car;
}

// Chase the player: recompute a BFS route down the street grid, then drive it.
// Close in, the cruiser steers straight at the player instead.
export function stepCruiser(car, dt, target, rng) {
  car.repath -= dt;
  const here = nearestNode(car.x, car.y);
  const there = nearestNode(target.x, target.y);
  if (car.repath <= 0 || !car.path || car.pathIndex >= car.path.length) {
    car.path = bfsPath(here, there);
    car.pathIndex = 1;
    car.repath = 1.6;
  }
  const dPlayer = Math.hypot(target.x - car.x, target.y - car.y);
  let want;
  if (dPlayer < 130) {
    want = Math.atan2(target.y - car.y, target.x - car.x);
  } else if (car.path && car.pathIndex < car.path.length) {
    const node = nodePoint(car.path[car.pathIndex].i, car.path[car.pathIndex].j);
    const dNode = Math.hypot(node.x - car.x, node.y - car.y);
    if (dNode < 30) car.pathIndex++;
    want = Math.atan2(node.y - car.y, node.x - car.x);
  } else {
    want = car.angle;
  }
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-3.1 * dt, Math.min(3.1 * dt, diff));
  const cruise = car.def.speed * (dPlayer < 130 ? 1.0 : 0.92);
  car.speed += (cruise - car.speed) * Math.min(1, dt * 1.2);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.sirenPhase += dt;
}

export function makeFootCop(x, y) {
  return { x, y, angle: 0, speed: 235, bustTimer: 0 };
}

export function stepFootCop(cop, dt, target, buildings) {
  const d = Math.hypot(target.x - cop.x, target.y - cop.y);
  if (d > 4) {
    cop.angle = Math.atan2(target.y - cop.y, target.x - cop.x);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
  }
  const fixed = resolveBuildingCollision(cop.x, cop.y, 13, buildings);
  cop.x = fixed.x;
  cop.y = fixed.y;
}

// --- City factory -----------------------------------------------------------

export function createWorld(seed) {
  const rng = makeRng(seed);
  const { buildings, trees, crates } = buildCity(rng);
  return {
    seed,
    buildings,
    trees,
    crates,
    traffic: spawnTraffic(rng, 16, buildings),
    pedestrians: spawnPedestrians(rng, 34),
    cruisers: [],
    footCops: [],
    gangsters: [],
    pickups: [],
  };
}
