// Solmar Heat — world.js
// Builds the city and steps its ambient life: traffic, pedestrians,
// police pursuit (BFS over the street grid), roadblocks, the AIR-1
// helicopter and the wanted/heat system. All randomness flows from the
// world's seeded rng — a world is fully reproducible from its seed.

import {
  WORLD_SIZE, CAR_TYPES, TRAFFIC_COUNT, PARKED_COUNT, PED_COUNT,
  HEAT_MAX, HEAT_DECAY_PER_SEC, SIGHT_RANGE, rankFor,
} from './config.js';
import { makeRng, clamp, dist, angleTo, turnToward, hash2 } from './random.js';
import { LANDMARKS, BEACH, PARK, isWaterAt } from './landmarks.js';
import { buildProps } from './props.js';
import { createWeather } from './weather.js';
import { createCollectibles } from './collectibles.js';
import { createTurf } from './turf.js';
import { createModState } from './modshop.js';

export const SEED = 20251115;

let carSeq = 0;
let pedSeq = 0;

export function streetCoord(i) { return i * 400; } // street centrelines: 0,400,...,3600

export function nearestStreet(v) {
  return clamp(Math.round(v / 400) * 400, 0, WORLD_SIZE);
}

// BFS over the 10x10 intersection grid; returns the next intersection a
// pursuer should aim for to reach the target intersection.
const BFS_Q = [];
export function nextHop(fromX, fromY, toX, toY) {
  const sx = clamp(Math.round(fromX / 400), 0, 9), sy = clamp(Math.round(fromY / 400), 0, 9);
  const tx = clamp(Math.round(toX / 400), 0, 9), ty = clamp(Math.round(toY / 400), 0, 9);
  if (sx === tx && sy === ty) return { x: toX, y: toY };
  const prev = new Map();
  const seen = new Set([sx + ',' + sy]);
  BFS_Q.length = 0; BFS_Q.push([sx, sy]);
  while (BFS_Q.length) {
    const [cx, cy] = BFS_Q.shift();
    if (cx === tx && cy === ty) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy, key = nx + ',' + ny;
      if (nx < 0 || ny < 0 || nx > 9 || ny > 9 || seen.has(key)) continue;
      seen.add(key); prev.set(key, cx + ',' + cy); BFS_Q.push([nx, ny]);
    }
  }
  let key = tx + ',' + ty;
  if (!prev.has(key)) return { x: toX, y: toY };
  let parent = prev.get(key);
  while (parent !== sx + ',' + sy && prev.has(parent)) { key = parent; parent = prev.get(key); }
  const [hx, hy] = key.split(',').map(Number);
  return { x: hx * 400, y: hy * 400 };
}

export function makeCar(rng, typeId, x, y, angle, opts) {
  const type = CAR_TYPES.find((t) => t.id === typeId) || CAR_TYPES[0];
  carSeq += 1;
  return Object.assign({
    id: carSeq, type: type.id, name: type.name, w: type.w, h: type.h,
    topSpeed: type.topSpeed, accel: type.accel, grip: type.grip, color: type.color,
    x, y, angle: angle || 0, speed: 0, hp: 100, wrecked: false,
    driver: null, parked: false, police: false, sirenPhase: (carSeq * 1.7) % 6.28,
    ai: null, nearMissCool: 0, smoke: 0,
  }, opts || {});
}

export function makePed(rng, x, y, opts) {
  pedSeq += 1;
  const colors = ['#d96f4e', '#4e79d9', '#5cb85c', '#d9c84e', '#b45ed9', '#4ed9c3', '#d94e79', '#e8e3d8'];
  return Object.assign({
    id: pedSeq, x, y, angle: rng() * 6.28, speed: 0, color: colors[pedSeq % colors.length],
    skin: ['#f2c9a0', '#c98d5f', '#8a5a34', '#ffe0bd'][pedSeq % 4],
    tx: x, ty: y, wait: rng() * 2, flee: false, armsUp: false, role: 'ped', hp: 100,
  }, opts || {});
}

function buildBuildings(rng) {
  const buildings = [];
  const commercial = new Set(['2,0', '4,1', '1,0', '1,1', '4,4']);
  for (let bx = 0; bx < 9; bx++) for (let by = 0; by < 9; by++) {
    const key = bx + ',' + by;
    const cx = bx * 400 + 200, cy = by * 400 + 200;
    if (cx > BEACH.x0 - 60 && cy < BEACH.y1) continue;              // beach blocks stay open sand
    if (bx * 400 >= PARK.x0 && bx * 400 < PARK.x1 && by * 400 >= PARK.y0 && by * 400 < PARK.y1) continue; // park
    const landmark = LANDMARKS.find((l) => Math.abs(l.x - cx) < 10 && Math.abs(l.y - cy) < 10);
    const count = landmark ? 1 : 2 + Math.floor(hash2(bx * 3, by * 5) * 3);
    for (let i = 0; i < count; i++) {
      const w = landmark ? 190 : 92 + hash2(bx * 7 + i, by * 11) * 92;
      const h = landmark ? 150 : 84 + hash2(bx * 13, by * 7 + i) * 88;
      const ox = count === 1 ? 0 : (i % 2 === 0 ? -78 : 78);
      const oy = count === 1 ? 0 : (i < 2 ? -72 : 72);
      const huePick = hash2(bx * 19 + i, by * 23);
      buildings.push({
        x: cx + ox - w / 2, y: cy + oy - h / 2, w, h,
        floors: 2 + Math.floor(hash2(bx + i * 3, by) * 6),
        hue: ['#e8dcc4', '#dcc7a8', '#cfe0e4', '#e4c9b8', '#d8d2e8', '#f0e6d2'][Math.floor(huePick * 6) % 6],
        roof: ['#b09a78', '#9a8a72', '#8d9aa5', '#a5856b'][Math.floor(hash2(bx, by + i) * 4) % 4],
        landmark: landmark ? landmark.id : null,
        storefront: commercial.has(key) || !!landmark,
        sign: landmark ? landmark.short : null,
      });
    }
  }
  return buildings;
}

export function createWorld(seed) {
  const rng = makeRng(seed === undefined ? SEED : seed);
  carSeq = 0; pedSeq = 0;
  const world = {
    rng, time: 0, seed: seed === undefined ? SEED : seed,
    buildings: [], props: [], cars: [], peds: [], cops: [], gang: [],
    bullets: [], particles: [], pickups: [],
    player: null, weather: createWeather(rng),
    collectibles: null, turf: null, mods: createModState(),
    heat: 0, peakStars: 0, chaseTime: 0, sighted: false, sightTimer: 0,
    heli: null, roadblock: null, radioIdx: 0, radioTimer: 24,
    mission: null, race: null, fare: null, delivery: null,
    stats: null, flags: {},
  };
  world.buildings = buildBuildings(rng);
  world.props = buildProps(rng);
  world.collectibles = createCollectibles(rng);
  world.turf = createTurf();
  world.radioIdx = rng.int(0, 2);
  world.stats = {
    money: 120, rp: 0, score: 0, carsStolen: 0, fares: 0, deliveries: 0,
    nearMisses: 0, kmDriven: 0, copsEscaped: 0, longestChase: 0,
    racesWon: 0, missionsDone: 0, playTime: 0, shotsFired: 0,
  };
  world.player = {
    x: 336, y: 1000, angle: 0, hp: 100, armour: 0, car: null,
    ammo: 24, reserve: 48, weapon: 1, reloading: 0, punchCool: 0,
    dead: false, rank: rankFor(0).name, safehouseSpawn: { x: 336, y: 1000 },
  };
  // Traffic on the streets.
  for (let i = 0; i < TRAFFIC_COUNT; i++) {
    const horiz = rng.chance(0.5);
    const line = streetCoord(rng.int(0, 9));
    const along = rng.range(60, 3540);
    const lane = rng.chance(0.5) ? -26 : 26;
    const car = makeCar(rng, rng.pick(['sedan', 'coupe', 'taxi', 'vento', 'van', 'truck', 'pickup', 'muscle', 'compact', 'limo']),
      horiz ? along : line + lane, horiz ? line + lane : along, horiz ? (lane < 0 ? Math.PI : 0) : (lane < 0 ? -Math.PI / 2 : Math.PI / 2));
    car.ai = { traffic: true };
    car.speed = car.topSpeed * 0.45;
    world.cars.push(car);
  }
  // Parked cars along the curbs.
  for (let i = 0; i < PARKED_COUNT; i++) {
    const horiz = rng.chance(0.5);
    const line = streetCoord(rng.int(0, 9));
    const along = rng.range(120, 3480);
    const car = makeCar(rng, rng.pick(['sedan', 'coupe', 'vento', 'van', 'pickup', 'compact', 'muscle']),
      horiz ? along : line + 52, horiz ? line + 52 : along, horiz ? 0 : Math.PI / 2, { parked: true });
    world.cars.push(car);
  }
  // Rex's own red Vento, parked at the west curb clear of the safehouse.
  const vento = makeCar(rng, 'vento', 368, 1032, Math.PI / 2, { parked: true });
  vento.color = '#c33d2e';
  world.cars.push(vento);
  world.playerCarId = vento.id;
  // Pedestrians on the sidewalks.
  for (let i = 0; i < PED_COUNT; i++) {
    const horiz = rng.chance(0.5);
    const line = streetCoord(rng.int(0, 9));
    const along = rng.range(40, 3560);
    const ped = makePed(rng, horiz ? along : line + 56, horiz ? line + 56 : along);
    ped.tx = ped.x + rng.range(-260, 260); ped.ty = ped.y + rng.range(-60, 60);
    world.peds.push(ped);
  }
  // A few ammo/health pickups near landmarks.
  for (const lm of [LANDMARKS[3], LANDMARKS[6], LANDMARKS[7], LANDMARKS[9]]) {
    world.pickups.push({ kind: 'ammo', x: lm.x + 130, y: lm.y + 96, taken: false });
    world.pickups.push({ kind: 'health', x: lm.x - 130, y: lm.y + 96, taken: false });
  }
  return world;
}

export function starsOf(world) {
  return Math.min(5, Math.floor(world.heat / 100));
}

export function addHeat(world, amount) {
  // A fresh star must land mid-band so decay cannot strip it next frame.
  const before = starsOf(world);
  world.heat = clamp(world.heat + amount, 0, HEAT_MAX);
  const after = starsOf(world);
  if (after > before) world.heat = Math.max(world.heat, after * 100 + 42);
  if (after > world.peakStars) world.peakStars = after;
}

export function buildingAt(world, x, y, pad) {
  const p = pad || 0;
  for (const b of world.buildings) {
    if (x > b.x - p && x < b.x + b.w + p && y > b.y - p && y < b.y + b.h + p) return b;
  }
  return null;
}

export function blockedAt(world, x, y, forCar) {
  if (x < 8 || y < 8 || x > WORLD_SIZE - 8 || y > WORLD_SIZE - 8) return true;
  if (isWaterAt(x, y)) return true;
  if (buildingAt(world, x, y, forCar ? 4 : 2)) return true;
  return false;
}

export function moveEntity(world, e, nx, ny, forCar) {
  // Axis-separated slide so walls feel solid but never sticky.
  if (!blockedAt(world, nx, e.y, forCar)) e.x = nx;
  if (!blockedAt(world, e.x, ny, forCar)) e.y = ny;
}

// Shared arcade car physics (player + AI use the same feel).
export function stepCarPhysics(car, throttle, steer, dt, gripMul) {
  const grip = car.grip * (gripMul || 1);
  const drag = car.speed > 0 ? 26 : 30;
  car.speed += throttle * car.accel * dt;
  car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), drag * dt);
  if (throttle === 0) car.speed -= car.speed * 0.35 * dt;
  car.speed = clamp(car.speed, -car.topSpeed * 0.38, car.topSpeed);
  const speedRatio = clamp(Math.abs(car.speed) / 160, 0, 1);
  car.angle += steer * grip * speedRatio * dt * (car.speed < 0 ? -1 : 1);
  return { dx: Math.cos(car.angle) * car.speed * dt, dy: Math.sin(car.angle) * car.speed * dt };
}

export function stepTraffic(world, dt) {
  const density = world.trafficDensity === undefined ? 1 : world.trafficDensity;
  let active = 0;
  for (const car of world.cars) {
    if (car.parked || car.police || car === (world.player && world.player.car)) continue;
    if (!car.ai || !car.ai.traffic) continue;
    active += 1;
    if (active > Math.round(TRAFFIC_COUNT * density)) { car.speed = 0; continue; }
    if (car.wrecked) continue;
    // Drive the street line; at intersections sometimes turn.
    const onH = Math.abs(((car.y % 400) + 400) % 400) < 70 || Math.abs(((car.y % 400) + 400) % 400 - 400) < 70;
    const targetSpeed = car.topSpeed * 0.42;
    car.speed += clamp(targetSpeed - car.speed, -90 * dt, 60 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const nearCross = Math.abs(nx - nearestStreet(nx)) < 26 && Math.abs(ny - nearestStreet(ny)) < 26;
    if (nearCross && world.rng.chance(0.012)) {
      car.angle += world.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
      car.x = nearestStreet(car.x); car.y = nearestStreet(car.y);
    }
    if (!blockedAt(world, nx, ny, true)) { car.x = nx; car.y = ny; }
    else { car.angle += Math.PI / 2; car.speed = Math.max(0, car.speed * 0.4); }
    if (car.x < 20 || car.x > 3580 || car.y < 20 || car.y > 3580) car.angle += Math.PI;
    void onH;
  }
}

export function stepPeds(world, dt) {
  for (const ped of world.peds) {
    if (ped.hp <= 0) continue;
    const threat = ped.flee ? world.player : null;
    if (threat && dist(ped.x, ped.y, threat.x, threat.y) < 190) {
      const away = angleTo(threat.x, threat.y, ped.x, ped.y);
      ped.angle = turnToward(ped.angle, away, 6 * dt);
      ped.speed = 168;
      ped.armsUp = true;
    } else {
      ped.armsUp = false;
      if (ped.wait > 0) { ped.wait -= dt; ped.speed = 0; }
      else {
        if (dist(ped.x, ped.y, ped.tx, ped.ty) < 14) {
          ped.tx = clamp(ped.x + world.rng.range(-300, 300), 30, 3570);
          ped.ty = clamp(ped.y + world.rng.range(-300, 300), 30, 3570);
          ped.wait = world.rng.range(0, 2.4);
        }
        ped.angle = turnToward(ped.angle, angleTo(ped.x, ped.y, ped.tx, ped.ty), 4 * dt);
        ped.speed = 62;
      }
    }
    const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
    if (!blockedAt(world, nx, ny, false)) { ped.x = nx; ped.y = ny; }
    else ped.wait = 0.4;
  }
}

// --- Police -----------------------------------------------------------------

export function wantedCopCount(stars) {
  return [0, 2, 3, 4, 6, 7][stars] || 0;
}

export function spawnCop(world, nearPlayer) {
  const p = world.player;
  const a = world.rng() * Math.PI * 2;
  const d = nearPlayer ? 330 : 520;
  const x = clamp(p.x + Math.cos(a) * d, 40, 3560);
  const y = clamp(p.y + Math.sin(a) * d, 40, 3560);
  const car = makeCar(world.rng, 'cruiser', nearestStreet(x), nearestStreet(y), 0, { police: true });
  car.ai = { cop: true };
  world.cars.push(car); world.cops.push(car);
  return car;
}

export function ensurePolice(world) {
  const stars = starsOf(world);
  const want = wantedCopCount(stars);
  while (world.cops.filter((c) => !c.wrecked).length < want) spawnCop(world);
  if (stars >= 5 && !world.heli) {
    world.heli = { x: world.player.x + 260, y: world.player.y - 220, angle: 0, rotor: 0 };
  }
  if (stars < 5) world.heli = null;
  if (stars >= 4 && !world.roadblock) {
    const p = world.player;
    const dirx = p.car ? Math.cos(p.car.angle) : 1, diry = p.car ? Math.sin(p.car.angle) : 0;
    const bx = clamp(nearestStreet(p.x + dirx * 235), 40, 3560);
    const by = clamp(nearestStreet(p.y + diry * 235), 40, 3560);
    world.roadblock = { x: bx, y: by, angle: Math.atan2(diry, dirx) };
  }
  if (stars < 4) world.roadblock = null;
}

export function stepPolice(world, dt) {
  const p = world.player;
  const stars = starsOf(world);
  ensurePolice(world);
  for (const cop of world.cops) {
    if (cop.wrecked) continue;
    const hop = nextHop(cop.x, cop.y, p.x, p.y);
    const far = dist(cop.x, cop.y, p.x, p.y) > 210;
    const tx = far ? hop.x : p.x, ty = far ? hop.y : p.y;
    const want = angleTo(cop.x, cop.y, tx, ty);
    const steer = clamp(((want - cop.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -1, 1);
    const move = stepCarPhysics(cop, 1, steer * 1.6, dt, 1);
    const nx = cop.x + move.dx, ny = cop.y + move.dy;
    if (!blockedAt(world, nx, ny, true)) { cop.x = nx; cop.y = ny; }
    else { cop.speed *= 0.5; cop.angle += 1.4 * dt; }
    cop.behaviour = world.roadblock && dist(cop.x, cop.y, world.roadblock.x, world.roadblock.y) < 90 ? 'ROADBLOCK' : (far ? 'PURSUIT' : 'RAMMING');
  }
  // Foot cops pour out of cruisers when close and the player is on foot.
  world.footCops = world.footCops || [];
  if (stars >= 2 && !p.car && world.footCops.length < stars) {
    const cop = makePed(world.rng, p.x + world.rng.range(-300, 300), p.y + world.rng.range(-300, 300), { role: 'cop' });
    cop.color = '#274b8f'; world.footCops.push(cop);
  }
  for (const fc of world.footCops) {
    fc.angle = turnToward(fc.angle, angleTo(fc.x, fc.y, p.x, p.y), 5 * dt);
    fc.speed = 150;
    if (dist(fc.x, fc.y, p.x, p.y) > 26) {
      const nx = fc.x + Math.cos(fc.angle) * fc.speed * dt;
      const ny = fc.y + Math.sin(fc.angle) * fc.speed * dt;
      if (!blockedAt(world, nx, ny, false)) { fc.x = nx; fc.y = ny; }
    }
    fc.behaviour = 'FOOT CHASE';
  }
  if (world.heli) {
    const h = world.heli;
    h.rotor += dt * 28;
    const want = angleTo(h.x, h.y, p.x, p.y);
    h.angle = turnToward(h.angle, want, 1.8 * dt);
    const gap = dist(h.x, h.y, p.x, p.y);
    const sp = gap > 120 ? 330 : 130;
    h.x += Math.cos(h.angle) * sp * dt;
    h.y += Math.sin(h.angle) * sp * dt;
  }
  void stars;
}

export function stepWanted(world, dt) {
  const p = world.player;
  const stars = starsOf(world);
  // Sight: any live cop (or the heli) close enough keeps the chase hot.
  let seen = false;
  for (const cop of world.cops) if (!cop.wrecked && dist(cop.x, cop.y, p.x, p.y) < SIGHT_RANGE) seen = true;
  if (world.heli && dist(world.heli.x, world.heli.y, p.x, p.y) < 620) seen = true;
  world.sighted = seen;
  if (world.heat > 0) {
    if (stars > 0) {
      world.chaseTime += dt;
      if (world.chaseTime > world.stats.longestChase) world.stats.longestChase = Math.floor(world.chaseTime);
    }
    if (!seen) {
      world.heat = Math.max(0, world.heat - HEAT_DECAY_PER_SEC * dt * 3.2);
    } else if (stars > 0) {
      world.heat = Math.max(world.heat - HEAT_DECAY_PER_SEC * dt, stars * 100 + 6);
    }
    if (world.heat <= 0.01) {
      // The escape lands: credit it from the chase's PEAK stars (heat
      // decays through 1-star, so a single-tick threshold never fires).
      if (world.peakStars >= 2) {
        world.stats.copsEscaped += 1;
        world.stats.rp += 25 * world.peakStars;
        world.stats.score += 40 * world.peakStars;
      }
      world.heat = 0; world.peakStars = 0; world.chaseTime = 0;
      world.cops.length = 0; world.footCops = [];
      world.cars = world.cars.filter((c) => !c.police);
      world.heli = null; world.roadblock = null;
    }
  }
  p.rank = rankFor(world.stats.rp).name;
}

export function respawnPlayer(world) {
  const p = world.player;
  const hosp = LANDMARKS[6];
  p.x = world.flags.respawnAtSafehouse ? p.safehouseSpawn.x : hosp.x + 120;
  p.y = world.flags.respawnAtSafehouse ? p.safehouseSpawn.y : hosp.y + 130;
  p.hp = 100; p.armour = 0; p.car = null; p.dead = false;
  world.heat = 0; world.peakStars = 0; world.chaseTime = 0;
  world.cops.length = 0; world.footCops = [];
  world.cars = world.cars.filter((c) => !c.police);
  world.heli = null; world.roadblock = null;
  world.stats.money = Math.max(0, world.stats.money - 150);
}
