// Solmar Heat — the city itself. Builds a deterministic world from a
// seed (buildings, traffic, crowds, police), then steps the ambient
// simulation: traffic flow, wandering peds, SCPD pursuit with grid
// pathfinding, the AIR-1 helicopter, roadblocks and the heat system.

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

const PED_COATS = ['#d95f43', '#4370c9', '#4da653', '#c9a83c', '#8a4fc9', '#3fbfae', '#c94f7d', '#ddd6c4'];
const PED_SKINS = ['#f0c08e', '#c98a54', '#7d4c26', '#ffd9ae'];
const ROOF_TONES = ['#9c8468', '#87755c', '#767c84', '#a08b6d', '#6d7a72'];
const WALL_TONES = ['#d9c9a8', '#cbb491', '#b8c4c6', '#dfc0a8', '#c3bcd4', '#ecdfc6'];

export function streetCoord(i) {
  return i * 400;
}

export function nearestStreet(v) {
  return clamp(Math.round(v / 400) * 400, 0, WORLD_SIZE);
}

// Breadth-first hop across the 10x10 intersection lattice: pursuers
// aim at the next junction on a shortest street path, not at walls.
export function nextHop(fromX, fromY, toX, toY) {
  const sx = clamp(Math.round(fromX / 400), 0, 9);
  const sy = clamp(Math.round(fromY / 400), 0, 9);
  const tx = clamp(Math.round(toX / 400), 0, 9);
  const ty = clamp(Math.round(toY / 400), 0, 9);
  if (sx === tx && sy === ty) return { x: toX, y: toY };

  const prev = new Map();
  const seen = new Set([sx + ',' + sy]);
  const queue = [[sx, sy]];
  while (queue.length) {
    const [cx, cy] = queue.shift();
    if (cx === tx && cy === ty) break;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + ox;
      const ny = cy + oy;
      const key = nx + ',' + ny;
      if (nx < 0 || ny < 0 || nx > 9 || ny > 9 || seen.has(key)) continue;
      seen.add(key);
      prev.set(key, cx + ',' + cy);
      queue.push([nx, ny]);
    }
  }

  let key = tx + ',' + ty;
  if (!prev.has(key)) return { x: toX, y: toY };
  let parent = prev.get(key);
  while (parent !== sx + ',' + sy && prev.has(parent)) {
    key = parent;
    parent = prev.get(key);
  }
  const [hx, hy] = key.split(',').map(Number);
  return { x: hx * 400, y: hy * 400 };
}

export function makeCar(rng, typeId, x, y, angle, opts) {
  void rng;
  const spec = CAR_TYPES.find((t) => t.id === typeId) || CAR_TYPES[0];
  carSeq += 1;
  const car = {
    id: carSeq,
    type: spec.id,
    name: spec.name,
    w: spec.w,
    h: spec.h,
    topSpeed: spec.topSpeed,
    accel: spec.accel,
    grip: spec.grip,
    color: spec.color,
    x, y,
    angle: angle || 0,
    speed: 0,
    hp: 100,
    wrecked: false,
    driver: null,
    parked: false,
    police: false,
    sirenPhase: (carSeq * 1.7) % 6.28,
    ai: null,
    nearMissCool: 0,
    smoke: 0,
  };
  return Object.assign(car, opts || {});
}

export function makePed(rng, x, y, opts) {
  pedSeq += 1;
  const ped = {
    id: pedSeq,
    x, y,
    angle: rng() * 6.28,
    speed: 0,
    color: PED_COATS[pedSeq % PED_COATS.length],
    skin: PED_SKINS[pedSeq % PED_SKINS.length],
    tx: x,
    ty: y,
    wait: rng() * 2,
    flee: false,
    armsUp: false,
    role: 'ped',
    hp: 100,
    muzzle: 0,
    fireTimer: 0,
    behaviour: null,
  };
  return Object.assign(ped, opts || {});
}

// Buildings rise per block: a landmark block carries one big signed
// building; the rest get a small cluster sized and toned by hash.
function buildBuildings() {
  const buildings = [];
  const shopBlocks = new Set(['2,0', '4,1', '1,0', '1,1', '4,4']);
  for (let bx = 0; bx < 9; bx++) {
    for (let by = 0; by < 9; by++) {
      const cx = bx * 400 + 200;
      const cy = by * 400 + 200;
      if (cx > BEACH.x0 - 60 && cy < BEACH.y1) continue;
      if (bx * 400 >= PARK.x0 && bx * 400 < PARK.x1 && by * 400 >= PARK.y0 && by * 400 < PARK.y1) continue;
      const landmark = LANDMARKS.find((l) => Math.abs(l.x - cx) < 10 && Math.abs(l.y - cy) < 10);
      if (landmark) {
        buildings.push({
          x: cx - 95, y: cy - 75, w: 190, h: 150,
          floors: 6, hue: '#e6d9bd', roof: '#8d7c62',
          landmark: landmark.id, storefront: true, sign: landmark.short,
        });
        continue;
      }
      const count = 2 + Math.floor(hash2(bx * 3, by * 5) * 3);
      for (let i = 0; i < count; i++) {
        const w = 92 + hash2(bx * 7 + i, by * 11) * 92;
        const h = 84 + hash2(bx * 13, by * 7 + i) * 88;
        const ox = count === 1 ? 0 : (i % 2 === 0 ? -78 : 78);
        const oy = count === 1 ? 0 : (i < 2 ? -72 : 72);
        buildings.push({
          x: cx + ox - w / 2, y: cy + oy - h / 2, w, h,
          floors: 2 + Math.floor(hash2(bx + i * 3, by) * 6),
          hue: WALL_TONES[Math.floor(hash2(bx * 19 + i, by * 23) * WALL_TONES.length) % WALL_TONES.length],
          roof: ROOF_TONES[Math.floor(hash2(bx, by + i) * ROOF_TONES.length) % ROOF_TONES.length],
          landmark: null,
          storefront: shopBlocks.has(bx + ',' + by),
          sign: null,
        });
      }
    }
  }
  return buildings;
}

export function createWorld(seed) {
  const useSeed = seed === undefined ? SEED : seed;
  const rng = makeRng(useSeed);
  carSeq = 0;
  pedSeq = 0;

  const world = {
    rng,
    time: 0,
    seed: useSeed,
    buildings: buildBuildings(),
    props: [],
    cars: [],
    peds: [],
    cops: [],
    gang: [],
    footCops: [],
    bullets: [],
    particles: [],
    pickups: [],
    events: [],
    player: null,
    weather: createWeather(rng),
    collectibles: null,
    turf: null,
    mods: createModState(),
    heat: 0,
    peakStars: 0,
    chaseTime: 0,
    sighted: false,
    sightTimer: 0,
    heli: null,
    roadblock: null,
    radioIdx: 0,
    radioTimer: 24,
    mission: null,
    race: null,
    fare: null,
    delivery: null,
    stats: {
      money: 120, rp: 0, score: 0, carsStolen: 0, fares: 0, deliveries: 0,
      nearMisses: 0, kmDriven: 0, copsEscaped: 0, longestChase: 0,
      racesWon: 0, missionsDone: 0, playTime: 0, shotsFired: 0,
    },
    flags: {},
    dialogue: null,
    trafficDensity: 1,
    playerCarId: 0,
  };

  world.props = buildProps(rng);
  world.collectibles = createCollectibles(rng);
  world.turf = createTurf();
  world.radioIdx = rng.int(0, 2);

  world.player = {
    x: 336, y: 1000, angle: 0, hp: 100, armour: 0, car: null,
    ammo: 24, reserve: 48, weapon: 1, reloading: 0, punchCool: 0,
    dead: false, rank: 'Nobody', safehouseSpawn: { x: 336, y: 1000 }, speed: 0,
  };

  const trafficTypes = ['sedan', 'coupe', 'taxi', 'vento', 'van', 'truck', 'pickup', 'muscle', 'compact', 'limo'];
  for (let i = 0; i < TRAFFIC_COUNT; i++) {
    const eastWest = rng.chance(0.5);
    const line = streetCoord(rng.int(0, 9));
    const along = rng.range(60, 3540);
    const lane = rng.chance(0.5) ? -26 : 26;
    const car = makeCar(
      rng, rng.pick(trafficTypes),
      eastWest ? along : line + lane,
      eastWest ? line + lane : along,
      eastWest ? (lane < 0 ? Math.PI : 0) : (lane < 0 ? -Math.PI / 2 : Math.PI / 2),
    );
    car.ai = { traffic: true };
    car.speed = car.topSpeed * 0.45;
    world.cars.push(car);
  }

  const parkedTypes = ['sedan', 'coupe', 'vento', 'van', 'pickup', 'compact', 'muscle'];
  for (let i = 0; i < PARKED_COUNT; i++) {
    const eastWest = rng.chance(0.5);
    const line = streetCoord(rng.int(0, 9));
    const along = rng.range(120, 3480);
    const car = makeCar(
      rng, rng.pick(parkedTypes),
      eastWest ? along : line + 52,
      eastWest ? line + 52 : along,
      eastWest ? 0 : Math.PI / 2,
      { parked: true },
    );
    world.cars.push(car);
  }

  // Rex's own red Vento waits by the safehouse kerb.
  const vento = makeCar(rng, 'vento', 368, 1032, Math.PI / 2, { parked: true });
  vento.color = '#c33d2e';
  world.cars.push(vento);
  world.playerCarId = vento.id;

  for (let i = 0; i < PED_COUNT; i++) {
    const eastWest = rng.chance(0.5);
    const line = streetCoord(rng.int(0, 9));
    const along = rng.range(40, 3560);
    const ped = makePed(rng, eastWest ? along : line + 56, eastWest ? line + 56 : along);
    ped.tx = ped.x + rng.range(-260, 260);
    ped.ty = ped.y + rng.range(-60, 60);
    world.peds.push(ped);
  }

  for (const lm of [LANDMARKS[3], LANDMARKS[6], LANDMARKS[7], LANDMARKS[9]]) {
    world.pickups.push({ kind: 'ammo', x: lm.x + 130, y: lm.y + 96, taken: false });
    world.pickups.push({ kind: 'health', x: lm.x - 130, y: lm.y + 96, taken: false });
  }

  return world;
}

export function starsOf(world) {
  return Math.min(5, Math.floor(world.heat / 100));
}

// Heat climbs in bands; crossing into a new star parks the value
// mid-band so a single quiet frame cannot strip the star back off.
export function addHeat(world, amount) {
  const before = starsOf(world);
  world.heat = clamp(world.heat + amount, 0, HEAT_MAX);
  const after = starsOf(world);
  if (after > before) world.heat = Math.max(world.heat, after * 100 + 42);
  if (after > world.peakStars) world.peakStars = after;
}

export function buildingAt(world, x, y, pad) {
  const slack = pad || 0;
  for (const b of world.buildings) {
    if (x > b.x - slack && x < b.x + b.w + slack && y > b.y - slack && y < b.y + b.h + slack) return b;
  }
  return null;
}

export function blockedAt(world, x, y, forCar) {
  if (x < 8 || y < 8 || x > WORLD_SIZE - 8 || y > WORLD_SIZE - 8) return true;
  if (isWaterAt(x, y)) return true;
  if (buildingAt(world, x, y, forCar ? 4 : 2)) return true;
  return false;
}

// Slide along walls one axis at a time so corners never snag.
export function moveEntity(world, e, nx, ny, forCar) {
  if (!blockedAt(world, nx, e.y, forCar)) e.x = nx;
  if (!blockedAt(world, e.x, ny, forCar)) e.y = ny;
}

export function stepCarPhysics(car, throttle, steer, dt, gripMul) {
  const grip = car.grip * (gripMul || 1);
  car.speed += throttle * car.accel * dt;
  const drag = car.speed > 0 ? 26 : 30;
  car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), drag * dt);
  if (throttle === 0) car.speed -= car.speed * 0.35 * dt;
  car.speed = clamp(car.speed, -car.topSpeed * 0.38, car.topSpeed);
  const authority = clamp(Math.abs(car.speed) / 160, 0, 1);
  car.angle += steer * grip * authority * dt * (car.speed < 0 ? -1 : 1);
  return { dx: Math.cos(car.angle) * car.speed * dt, dy: Math.sin(car.angle) * car.speed * dt };
}

export function stepTraffic(world, dt) {
  const density = world.trafficDensity === undefined ? 1 : world.trafficDensity;
  const cap = Math.round(TRAFFIC_COUNT * density);
  let active = 0;
  for (const car of world.cars) {
    if (car.parked || car.police || !car.ai || !car.ai.traffic) continue;
    if (world.player && world.player.car === car) continue;
    active += 1;
    if (active > cap) { car.speed = 0; continue; }
    if (car.wrecked) continue;
    const cruise = car.topSpeed * 0.42;
    car.speed += clamp(cruise - car.speed, -90 * dt, 60 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const nearCross = Math.abs(nx - nearestStreet(nx)) < 26 && Math.abs(ny - nearestStreet(ny)) < 26;
    if (nearCross && world.rng.chance(0.012)) {
      car.angle += world.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
      car.x = nearestStreet(car.x);
      car.y = nearestStreet(car.y);
      continue;
    }
    if (!blockedAt(world, nx, ny, true)) {
      car.x = nx;
      car.y = ny;
    } else {
      car.angle += Math.PI / 2;
      car.speed = Math.max(0, car.speed * 0.4);
    }
    if (car.x < 20 || car.x > 3580 || car.y < 20 || car.y > 3580) car.angle += Math.PI;
  }
}

export function stepPeds(world, dt) {
  for (const ped of world.peds) {
    if (ped.hp <= 0) continue;
    const menace = ped.flee ? world.player : null;
    if (menace && dist(ped.x, ped.y, menace.x, menace.y) < 190) {
      const away = angleTo(menace.x, menace.y, ped.x, ped.y);
      ped.angle = turnToward(ped.angle, away, 6 * dt);
      ped.speed = 168;
      ped.armsUp = true;
    } else {
      ped.armsUp = false;
      if (ped.wait > 0) {
        ped.wait -= dt;
        ped.speed = 0;
      } else {
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
    if (!blockedAt(world, nx, ny, false)) {
      ped.x = nx;
      ped.y = ny;
    } else {
      ped.wait = 0.4;
    }
  }
}

export function wantedCopCount(stars) {
  return [0, 2, 3, 4, 6, 7][stars] || 0;
}

export function spawnCop(world, nearPlayer) {
  const p = world.player;
  const bearing = world.rng() * Math.PI * 2;
  const ring = nearPlayer ? 330 : 520;
  const x = clamp(p.x + Math.cos(bearing) * ring, 40, 3560);
  const y = clamp(p.y + Math.sin(bearing) * ring, 40, 3560);
  const car = makeCar(world.rng, 'cruiser', nearestStreet(x), nearestStreet(y), 0, { police: true });
  car.ai = { cop: true };
  world.cars.push(car);
  world.cops.push(car);
  return car;
}

export function ensurePolice(world) {
  const stars = starsOf(world);
  const want = wantedCopCount(stars);
  while (world.cops.filter((c) => !c.wrecked).length < want) spawnCop(world);
  if (stars >= 5) {
    if (!world.heli) {
      world.heli = { x: world.player.x + 260, y: world.player.y - 220, angle: 0, rotor: 0 };
    }
  } else {
    world.heli = null;
  }
  if (stars >= 4) {
    if (!world.roadblock) {
      const p = world.player;
      const dirx = p.car ? Math.cos(p.car.angle) : 1;
      const diry = p.car ? Math.sin(p.car.angle) : 0;
      world.roadblock = {
        x: clamp(nearestStreet(p.x + dirx * 235), 40, 3560),
        y: clamp(nearestStreet(p.y + diry * 235), 40, 3560),
        angle: Math.atan2(diry, dirx),
      };
    }
  } else {
    world.roadblock = null;
  }
}

export function stepPolice(world, dt) {
  ensurePolice(world);
  const p = world.player;

  for (const cop of world.cops) {
    if (cop.wrecked) continue;
    const gap = dist(cop.x, cop.y, p.x, p.y);
    const hop = gap > 210 ? nextHop(cop.x, cop.y, p.x, p.y) : { x: p.x, y: p.y };
    const want = angleTo(cop.x, cop.y, hop.x, hop.y);
    let steer = ((want - cop.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    steer = clamp(steer, -1, 1);
    const move = stepCarPhysics(cop, 1, steer * 1.6, dt, 1);
    const nx = cop.x + move.dx;
    const ny = cop.y + move.dy;
    if (!blockedAt(world, nx, ny, true)) {
      cop.x = nx;
      cop.y = ny;
    } else {
      cop.speed *= 0.5;
      cop.angle += 1.4 * dt;
    }
    cop.behaviour = world.roadblock && dist(cop.x, cop.y, world.roadblock.x, world.roadblock.y) < 90
      ? 'ROADBLOCK'
      : gap > 210 ? 'PURSUIT' : 'RAMMING';
  }

  const stars = starsOf(world);
  world.footCops = world.footCops || [];
  if (stars >= 2 && !p.car && world.footCops.length < stars) {
    const fc = makePed(world.rng, p.x + world.rng.range(-300, 300), p.y + world.rng.range(-300, 300), { role: 'cop' });
    fc.color = '#274b8f';
    world.footCops.push(fc);
  }
  for (const fc of world.footCops) {
    fc.angle = turnToward(fc.angle, angleTo(fc.x, fc.y, p.x, p.y), 5 * dt);
    fc.speed = 150;
    fc.behaviour = 'FOOT CHASE';
    if (dist(fc.x, fc.y, p.x, p.y) > 26) {
      const nx = fc.x + Math.cos(fc.angle) * fc.speed * dt;
      const ny = fc.y + Math.sin(fc.angle) * fc.speed * dt;
      if (!blockedAt(world, nx, ny, false)) {
        fc.x = nx;
        fc.y = ny;
      }
    }
  }

  if (world.heli) {
    const h = world.heli;
    h.rotor += dt * 28;
    const want = angleTo(h.x, h.y, p.x, p.y);
    h.angle = turnToward(h.angle, want, 1.8 * dt);
    const gap = dist(h.x, h.y, p.x, p.y);
    const pace = gap > 120 ? 330 : 130;
    h.x += Math.cos(h.angle) * pace * dt;
    h.y += Math.sin(h.angle) * pace * dt;
  }
}

export function stepWanted(world, dt) {
  const p = world.player;
  const stars = starsOf(world);
  let seen = false;
  for (const cop of world.cops) {
    if (!cop.wrecked && dist(cop.x, cop.y, p.x, p.y) < SIGHT_RANGE) seen = true;
  }
  if (world.heli && dist(world.heli.x, world.heli.y, p.x, p.y) < 620) seen = true;
  world.sighted = seen;

  if (world.heat > 0) {
    if (stars > 0) {
      world.chaseTime += dt;
      world.stats.longestChase = Math.max(world.stats.longestChase, Math.floor(world.chaseTime));
    }
    if (!seen) {
      world.heat = Math.max(0, world.heat - HEAT_DECAY_PER_SEC * 3.2 * dt);
    } else if (stars > 0) {
      world.heat = Math.max(world.heat - HEAT_DECAY_PER_SEC * dt, stars * 100 + 6);
    }
    if (world.heat <= 0.01) {
      if (world.peakStars >= 2) {
        world.stats.copsEscaped += 1;
        world.stats.rp += 25 * world.peakStars;
        world.stats.score += 40 * world.peakStars;
      }
      world.heat = 0;
      world.peakStars = 0;
      world.chaseTime = 0;
      world.cops = [];
      world.footCops = [];
      world.cars = world.cars.filter((c) => !c.police);
      world.heli = null;
      world.roadblock = null;
    }
  }
  p.rank = rankFor(world.stats.rp).name;
}

export function respawnPlayer(world) {
  const p = world.player;
  const hospital = LANDMARKS[6];
  if (world.flags.respawnAtSafehouse) {
    p.x = p.safehouseSpawn.x;
    p.y = p.safehouseSpawn.y;
  } else {
    p.x = hospital.x + 120;
    p.y = hospital.y + 130;
  }
  p.hp = 100;
  p.armour = 0;
  p.car = null;
  p.dead = false;
  world.heat = 0;
  world.peakStars = 0;
  world.chaseTime = 0;
  world.cops = [];
  world.footCops = [];
  world.cars = world.cars.filter((c) => !c.police);
  world.heli = null;
  world.roadblock = null;
  world.stats.money = Math.max(0, world.stats.money - 150);
}
