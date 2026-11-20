// world.js — the city of Solmar and everything that moves in it.
// One job: build the deterministic world from a seed (buildings,
// traffic, parked cars, pedestrians, the player), then step traffic,
// pedestrians, police, the helicopter and roadblocks each frame.
// Missions/races/jobs live in their own modules and read this state.

import {
  WORLD_SIZE, BLOCK, ROAD_W, clamp, dist, turnToward, roadLine,
} from './config.js';
import { makeRng } from './random.js';
import { buildProps } from './props.js';
import { LANDMARKS } from './landmarks.js';
import { makeWeather, stepWeather, trafficDensity } from './weather.js';
import { makeCoins, makePickups } from './collectibles.js';
import { makeTurf } from './turf.js';
import { makeMods, engineFactor, armorFactor, tireFactor } from './modshop.js';

export const CAR_TYPES = {
  sedan:   { name: 'Meridian Sedan', len: 46, wid: 23, top: 132, accel: 62, colors: ['#c8ccd4', '#5d7fa8', '#8a8f98', '#37414f'] },
  coupe:   { name: 'Vireo Coupe', len: 44, wid: 22, top: 152, accel: 74, colors: ['#e8b93e', '#3d7bd9', '#e8e8e8', '#22262c'] },
  sports:  { name: 'Falco S', len: 47, wid: 24, top: 208, accel: 104, colors: ['#d9a521', '#c22e2e', '#20242c'] },
  taxi:    { name: 'Vento Taxi', len: 46, wid: 23, top: 138, accel: 64, colors: ['#f2b21b'] },
  vento:   { name: 'Vento', len: 46, wid: 23, top: 140, accel: 66, colors: ['#d23b2e', '#7a8899'] },
  van:     { name: 'Harbor Van', len: 52, wid: 25, top: 118, accel: 54, colors: ['#d8d8d2', '#6b7f8c', '#a33f2e'] },
  truck:   { name: 'Dock Truck', len: 58, wid: 26, top: 108, accel: 46, colors: ['#7d8a94', '#4d6b54', '#98653a'] },
  pickup:  { name: 'Dune Pickup', len: 50, wid: 25, top: 136, accel: 62, colors: ['#b08954', '#54687a', '#77372a'] },
  muscle:  { name: 'Marlin Muscle', len: 49, wid: 24, top: 172, accel: 88, colors: ['#7a2e8f', '#1f6f54', '#101216'] },
  compact: { name: 'Pico Compact', len: 38, wid: 21, top: 122, accel: 66, colors: ['#7ec8e3', '#e88bb0', '#9fd66a'] },
  limo:    { name: 'Regal Limo', len: 62, wid: 25, top: 142, accel: 56, colors: ['#14161a', '#e6e6e6'] },
  police:  { name: 'SCPD Cruiser', len: 48, wid: 24, top: 188, accel: 96, colors: ['#eef1f4'] },
};
const TRAFFIC_TYPES = ['sedan', 'coupe', 'taxi', 'vento', 'van', 'truck', 'pickup', 'muscle', 'compact', 'limo'];
const PED_COLORS = ['#e8e3d8', '#3d7bd9', '#e05555', '#59b06a', '#e8b93e', '#b388ff', '#ff7847', '#4dd0e1', '#f2f2f2', '#37414f'];
const SKIN_TONES = ['#f2c79b', '#d9a066', '#a06a3a', '#6e4520', '#ffe0bd'];
const BUILDING_HUES = [36, 26, 44, 18, 200, 160, 48, 30];

export const TRAFFIC_BASE = 42;
export const PARKED_COUNT = 34;
export const PED_COUNT = 72;

// ---------------------------------------------------------------- cars

export function makeCar(world, type, x, y, angle, driver) {
  const spec = CAR_TYPES[type];
  const id = world.carSeq++;
  return {
    id, type, name: spec.name,
    x, y, angle, speed: 0,
    hp: 100, maxHp: 100, wrecked: false,
    color: world.rng.pick(spec.colors),
    driver,             // 'traffic' | 'parked' | 'cop' | 'player'
    role: null,         // cops: 'pursuit' | 'roadblock'
    tx: x, ty: y,       // navigation waypoint
    sirenPhase: (id * 1.7) % 6.28,   // deterministic (was Math.random)
    nearMissCd: 0,
  };
}

function randomRoadPoint(rng, minX = 60, maxX = WORLD_SIZE - 60) {
  // A point on a road: snap one axis to a road line.
  if (rng.chance(0.5)) {
    return { x: roadLine(rng.range(minX, maxX)), y: rng.range(60, WORLD_SIZE - 60) };
  }
  return { x: rng.range(minX, maxX), y: roadLine(rng.range(60, WORLD_SIZE - 60)) };
}

function nextWaypoint(world, car) {
  // At an intersection: mostly straight on, sometimes a turn.
  const cx = roadLine(car.x), cy = roadLine(car.y);
  const dx = Math.sign(car.tx - cx), dy = Math.sign(car.ty - cy);
  let ndx = dx, ndy = dy;
  const roll = world.rng();
  if (roll < 0.38) { const t = ndx; ndx = ndy; ndy = t; if (world.rng.chance(0.5)) { ndx = -ndx; ndy = -ndy; } }
  if (ndx === 0 && ndy === 0) ndx = 1;
  let nx = cx + ndx * BLOCK, ny = cy + ndy * BLOCK;
  if (nx < 0 || nx > WORLD_SIZE) { nx = cx - ndx * BLOCK; }
  if (ny < 0 || ny > WORLD_SIZE) { ny = cy - ndy * BLOCK; }
  car.tx = clamp(nx, 0, WORLD_SIZE);
  car.ty = clamp(ny, 0, WORLD_SIZE);
}

function laneTarget(car) {
  // Right-hand traffic: offset the waypoint to the car's right side.
  const dx = Math.sign(car.tx - car.x), dy = Math.sign(car.ty - car.y);
  if (dx !== 0) return { x: car.tx, y: car.ty + dx * 15 };
  return { x: car.tx - dy * 15, y: car.ty };
}

function spawnTraffic(world, farFrom) {
  for (let tries = 0; tries < 10; tries++) {
    const pt = randomRoadPoint(world.rng);
    if (farFrom && dist(pt.x, pt.y, farFrom.x, farFrom.y) < 520) continue;
    const car = makeCar(world, world.rng.pick(TRAFFIC_TYPES), pt.x, pt.y, 0, 'traffic');
    car.tx = roadLine(pt.x); car.ty = roadLine(pt.y);
    nextWaypoint(world, car);
    car.angle = Math.atan2(car.ty - car.y, car.tx - car.x);
    world.cars.push(car);
    return car;
  }
  return null;
}

// ------------------------------------------------------------ buildings

function buildBuildings(world) {
  const rng = world.rng;
  const buildings = [];
  const skipBlocks = new Set(['1,6', '6,1', '7,1', '6,2', '7,2', '2,2', '8,1', '8,2']); // park, beach, plaza, marina water
  for (let bi = 0; bi < 9; bi++) {
    for (let bj = 0; bj < 9; bj++) {
      if (skipBlocks.has(`${bi},${bj}`)) continue;
      const x0 = bi * BLOCK + 60, y0 = bj * BLOCK + 60, inner = BLOCK - 120;
      const n = rng.chance(0.45) ? 3 : 2;
      const rects = [];
      if (n === 2) {
        rects.push([x0, y0, inner * 0.46, inner], [x0 + inner * 0.54, y0, inner * 0.46, inner]);
        if (rng.chance(0.5)) rects.forEach((r) => { const t = r[2]; r[2] = r[3]; r[3] = t; r[3] = inner * 0.46; });
      } else {
        rects.push([x0, y0, inner, inner * 0.4]);
        rects.push([x0, y0 + inner * 0.48, inner * 0.46, inner * 0.52]);
        rects.push([x0 + inner * 0.54, y0 + inner * 0.48, inner * 0.46, inner * 0.52]);
      }
      for (const [rx, ry, rw, rh] of rects) {
        // Never swallow a landmark point itself — but a landmark at a
        // block's centre must not empty the whole block (the bank
        // plaza needs its neighbours), so only the rect that actually
        // contains the point is skipped.
        const hit = LANDMARKS.some((l) => l.x > rx - 18 && l.x < rx + rw + 18 && l.y > ry - 18 && l.y < ry + rh + 18);
        if (hit) continue;
        buildings.push({
          x: rx + rng.range(-4, 4), y: ry + rng.range(-4, 4),
          w: rw, h: rh,
          floors: rng.int(2, 7),
          hue: rng.pick(BUILDING_HUES),
          bi, bj,
        });
      }
    }
  }
  return buildings;
}

export function pointInBuilding(world, x, y, pad = 0) {
  for (const b of world.buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  }
  return null;
}

// Push a circle (x, y, r) out of any building it overlaps. Mutates and
// returns the object; `hit` reports whether a push happened.
export function collideBuildings(world, e, r) {
  let hit = false;
  for (const b of world.buildings) {
    const nx = clamp(e.x, b.x, b.x + b.w), ny = clamp(e.y, b.y, b.y + b.h);
    const dx = e.x - nx, dy = e.y - ny, d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        e.x = nx + (dx / d) * r;
        e.y = ny + (dy / d) * r;
      } else {
        // Centre inside the rect: push out along the smallest exit.
        const left = e.x - b.x, right = b.x + b.w - e.x, top = e.y - b.y, bot = b.y + b.h - e.y;
        const m = Math.min(left, right, top, bot);
        if (m === left) e.x = b.x - r; else if (m === right) e.x = b.x + b.w + r;
        else if (m === top) e.y = b.y - r; else e.y = b.y + b.h + r;
      }
    }
  }
  e.x = clamp(e.x, 16, WORLD_SIZE - 16);
  e.y = clamp(e.y, 16, WORLD_SIZE - 16);
  return hit;
}

// ---------------------------------------------------------------- world

export function createWorld(seed = 20261121) {
  const rng = makeRng(seed);
  const world = {
    seed, rng,
    time: 0, playTime: 0, clock: 9,
    carSeq: 0,
    buildings: [], props: [], cars: [], peds: [], copsFoot: [], gang: [],
    bullets: [], particles: [], floaters: [],
    coins: makeCoins(), pickups: makePickups(),
    turf: makeTurf(), mods: makeMods(), weather: makeWeather(rng),
    heat: 0, wanted: 0, calmT: 0, bust: 0,
    heli: null, roadblock: null, danger: null,
    mission: null, race: null, fare: null, delivery: null,
    dialogue: null, notice: null,
    radioIdx: 0, radioT: 0,
    storyDone: false, raceWins: 0, saveExists: false,
    player: null, ventoCar: null,
  };
  world.radioIdx = rng.int(0, 2);
  world.buildings = buildBuildings(world);
  world.props = buildProps(world);

  const p = {
    name: 'Rex Kane', x: 420, y: 486, angle: -Math.PI / 2,
    hp: 100, armor: 0, money: 250, score: 0,
    ammo: 12, reserve: 96, reloading: 0, fireCd: 0, punchCd: 0,
    car: null, walk: 0, rank: 'Nobody',
    carsStolen: 0, fares: 0, deliveries: 0, nearMisses: 0, shots: 0,
  };
  world.player = p;

  // The red Vento from mission 1, parked on the road east of the
  // safehouse corner (never inside a block — buildings live there).
  const vento = makeCar(world, 'vento', 492, 402, 0, 'parked');
  vento.color = '#d23b2e';
  world.cars.push(vento);
  world.ventoCar = vento;

  for (let i = 0; i < PARKED_COUNT; i++) {
    const pt = randomRoadPoint(rng);
    const alongX = pt.x === roadLine(pt.x) && pt.y !== roadLine(pt.y) ? false : true;
    const car = makeCar(world, rng.pick(TRAFFIC_TYPES), pt.x, pt.y, 0, 'parked');
    // Park parallel to the road, at the kerb.
    if (Math.abs(pt.x - roadLine(pt.x)) < 2) { car.x += 34; car.angle = Math.PI / 2; }
    else { car.y += 34; car.angle = 0; }
    car.angle += rng.chance(0.5) ? 0 : Math.PI;
    void alongX;
    world.cars.push(car);
  }
  for (let i = 0; i < TRAFFIC_BASE; i++) spawnTraffic(world, null);
  for (let i = 0; i < PED_COUNT; i++) world.peds.push(makePed(world));
  return world;
}

function makePed(world) {
  const rng = world.rng;
  const bi = rng.int(0, 8), bj = rng.int(0, 8);
  const x = bi * BLOCK + 58, y = bj * BLOCK + 58;
  return {
    x: x + rng.range(0, 284), y: y + rng.range(0, 284),
    tx: 0, ty: 0, angle: rng.range(0, 6.28),
    speed: rng.range(32, 54),
    color: rng.pick(PED_COLORS), skin: rng.pick(SKIN_TONES),
    flee: false, fleeT: 0, walk: rng.range(0, 6.28),
  };
}

// ------------------------------------------------------------- wanted

export function wantedStars(world) {
  if (world.heat <= 0) return 0;
  return Math.min(5, Math.ceil(world.heat / 100));
}

export function addHeat(world, n) {
  world.heat = clamp(world.heat + n, 0, 500);
  world.calmT = 6;
  world.wanted = wantedStars(world);
}

// Set an exact star level, landing mid-band so decay does not drop a
// star on the next frame (the old boundary bug).
export function setWanted(world, stars) {
  world.heat = stars <= 0 ? 0 : (stars - 0.5) * 100;
  world.wanted = wantedStars(world);
  world.calmT = 6;
}

// ------------------------------------------------------------- stepping

export function stepWorld(world, dt) {
  world.time += dt;
  world.playTime += dt;
  world.clock = (world.clock + dt / 10) % 24;   // 10 real seconds = 1 game hour
  stepWeather(world, dt);

  if (world.calmT > 0) world.calmT -= dt;
  else if (world.heat > 0) {
    world.heat = Math.max(0, world.heat - dt * 3.2);
    world.wanted = wantedStars(world);
  }

  stepTraffic(world, dt);
  stepPeds(world, dt);
  stepPolice(world, dt);

  if (world.dialogue) { world.dialogue.t -= dt; if (world.dialogue.t <= 0) world.dialogue = null; }
  if (world.notice) { world.notice.t -= dt; if (world.notice.t <= 0) world.notice = null; }
  if (world.danger) { world.danger.t -= dt; if (world.danger.t <= 0) world.danger = null; }

  for (let i = world.particles.length - 1; i >= 0; i--) {
    const pt = world.particles[i];
    pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
    if (pt.life <= 0) world.particles.splice(i, 1);
  }
  for (let i = world.floaters.length - 1; i >= 0; i--) {
    const f = world.floaters[i];
    f.y -= 26 * dt; f.t -= dt;
    if (f.t <= 0) world.floaters.splice(i, 1);
  }
}

function stepTraffic(world, dt) {
  // Rush hour: ease the live traffic count toward the clock's target.
  const target = Math.round(TRAFFIC_BASE * trafficDensity(world.clock));
  let live = 0, farthest = null, farthestD = 0;
  for (const c of world.cars) {
    if (c.driver !== 'traffic') continue;
    live++;
    const d = dist(c.x, c.y, world.player.x, world.player.y);
    if (d > farthestD) { farthestD = d; farthest = c; }
  }
  if (live < target) spawnTraffic(world, world.player);
  else if (live > target && farthest && farthestD > 760) {
    world.cars.splice(world.cars.indexOf(farthest), 1);
  }

  for (const car of world.cars) {
    if (car.nearMissCd > 0) car.nearMissCd -= dt;
    if (car.driver !== 'traffic' || car.wrecked) continue;
    const spec = CAR_TYPES[car.type];
    const tgt = laneTarget(car);
    const want = Math.atan2(tgt.y - car.y, tgt.x - car.x);
    car.angle = turnToward(car.angle, want, 2.4 * dt);
    let top = spec.top * 0.42;
    // Slow for a car ahead.
    for (const other of world.cars) {
      if (other === car) continue;
      const ahead = dist(car.x + Math.cos(car.angle) * 40, car.y + Math.sin(car.angle) * 40, other.x, other.y);
      if (ahead < 30) { top = Math.min(top, Math.max(0, other.speed)); break; }
    }
    car.speed += clamp(top - car.speed, -120 * dt, spec.accel * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (dist(car.x, car.y, car.tx, car.ty) < 42) nextWaypoint(world, car);
    car.x = clamp(car.x, 20, WORLD_SIZE - 20);
    car.y = clamp(car.y, 20, WORLD_SIZE - 20);
  }
}

function stepPeds(world, dt) {
  for (const ped of world.peds) {
    let sp = ped.speed;
    if (world.danger && dist(ped.x, ped.y, world.danger.x, world.danger.y) < 190) {
      ped.flee = true; ped.fleeT = 1.6;
    }
    if (ped.flee) {
      ped.fleeT -= dt;
      if (ped.fleeT <= 0) ped.flee = false;
      const away = Math.atan2(ped.y - world.danger.y, ped.x - world.danger.x);
      ped.angle = turnToward(ped.angle, away, 6 * dt);
      sp = 128;
    } else {
      if (ped.tx === 0 || dist(ped.x, ped.y, ped.tx, ped.ty) < 12) {
        // New target: a corner of a nearby block (sidewalk ring).
        const bi = clamp(Math.floor(ped.x / BLOCK) + world.rng.int(-1, 1), 0, 8);
        const bj = clamp(Math.floor(ped.y / BLOCK) + world.rng.int(-1, 1), 0, 8);
        ped.tx = bi * BLOCK + world.rng.pick([58, 342]);
        ped.ty = bj * BLOCK + world.rng.pick([58, 342]);
      }
      ped.angle = turnToward(ped.angle, Math.atan2(ped.ty - ped.y, ped.tx - ped.x), 5 * dt);
    }
    ped.x += Math.cos(ped.angle) * sp * dt;
    ped.y += Math.sin(ped.angle) * sp * dt;
    ped.walk += dt * (sp / 9);
    collideBuildings(world, ped, 8);
  }
}

// Move any entity on foot with building collision. Returns speed kept.
export function moveOnFoot(world, e, vx, vy, dt, r) {
  e.x += vx * dt;
  e.y += vy * dt;
  collideBuildings(world, e, r);
}

// Drive a car one frame under control input ctl {throttle -1..1,
// steer -1..1, brake bool}. Returns impact speed if it crashed.
export function driveCar(world, car, dt, ctl) {
  const spec = CAR_TYPES[car.type];
  const isPlayer = car.driver === 'player';
  const eng = isPlayer ? engineFactor(world.mods) : 1;
  const grip = world.weather.grip * (isPlayer ? tireFactor(world.mods) : 1);
  const top = spec.top * eng;
  if (ctl.throttle > 0) car.speed += spec.accel * eng * dt;
  else if (ctl.throttle < 0) car.speed -= (car.speed > 4 ? 130 : spec.accel * 0.6) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
  if (ctl.brake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 240 * dt);
  car.speed = clamp(car.speed, -top * 0.32, top);
  const steerAuthority = clamp(Math.abs(car.speed) / 60, 0, 1) * (car.speed < 0 ? -1 : 1);
  car.angle += ctl.steer * 1.9 * grip * steerAuthority * dt;
  const ox = car.x, oy = car.y;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const before = Math.abs(car.speed);
  const hit = collideBuildings(world, car, spec.wid * 0.62);
  car.x = clamp(car.x, 24, WORLD_SIZE - 24);
  car.y = clamp(car.y, 24, WORLD_SIZE - 24);
  if (hit && before > 66) {
    const dmg = 8 * (isPlayer ? armorFactor(world.mods) : 1);
    car.hp -= dmg;
    car.speed = 0;
    if (car.hp <= 0) { car.hp = 0; car.wrecked = true; }
    return before;
  }
  if (hit) car.speed *= 0.4;
  void ox; void oy;
  return 0;
}

// ------------------------------------------------------------- police

function spawnRoadPointNear(world, cx, cy, minD, maxD) {
  for (let i = 0; i < 10; i++) {
    const a = world.rng.range(0, Math.PI * 2);
    const d = world.rng.range(minD, maxD);
    let x = clamp(cx + Math.cos(a) * d, 40, WORLD_SIZE - 40);
    let y = clamp(cy + Math.sin(a) * d, 40, WORLD_SIZE - 40);
    if (world.rng.chance(0.5)) x = roadLine(x); else y = roadLine(y);
    if (dist(x, y, cx, cy) >= minD * 0.8) return { x, y };
  }
  return { x: roadLine(cx + minD), y: cy };
}

export function stepPolice(world, dt) {
  const p = world.player;
  const stars = world.wanted;
  const wantCars = stars >= 1 ? Math.min(5, stars + 1) : 0;
  const wantFoot = stars >= 2 ? Math.min(4, stars) : 0;

  let copCars = world.cars.filter((c) => c.driver === 'cop' && c.role === 'pursuit');
  while (copCars.length < wantCars) {
    const pt = spawnRoadPointNear(world, p.x, p.y, 500, 680);
    const car = makeCar(world, 'police', pt.x, pt.y, 0, 'cop');
    car.role = 'pursuit';
    car.color = '#eef1f4';
    world.cars.push(car);
    copCars.push(car);
  }
  if (copCars.length > wantCars) {
    copCars.sort((a, b) => dist(b.x, b.y, p.x, p.y) - dist(a.x, a.y, p.x, p.y));
    for (let i = 0; i < copCars.length - wantCars; i++) {
      const c = copCars[i];
      if (dist(c.x, c.y, p.x, p.y) > 420) world.cars.splice(world.cars.indexOf(c), 1);
    }
    copCars = world.cars.filter((c) => c.driver === 'cop' && c.role === 'pursuit');
  }

  // Pursuit driving: head for the player's road, then for the player.
  for (const car of copCars) {
    const spec = CAR_TYPES.police;
    let tx = p.x, ty = p.y;
    const d = dist(car.x, car.y, p.x, p.y);
    if (d > 130) {
      const cx = roadLine(car.x), cy = roadLine(car.y);
      const px = roadLine(p.x), py = roadLine(p.y);
      if (Math.abs(cx - px) > 8) { tx = px; ty = cy; }
      else { tx = cx; ty = py; }
    }
    const want = Math.atan2(ty - car.y, tx - car.x);
    car.angle = turnToward(car.angle, want, 2.8 * dt);
    const top = spec.top * (d > 420 ? 1.12 : 0.98);
    car.speed += clamp(top - car.speed, -160 * dt, spec.accel * 1.15 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    collideBuildings(world, car, spec.wid * 0.62);
    car.x = clamp(car.x, 24, WORLD_SIZE - 24);
    car.y = clamp(car.y, 24, WORLD_SIZE - 24);
    // Ram: shove the player's car and sting its health a little.
    if (p.car && dist(car.x, car.y, p.car.x, p.car.y) < 34 && Math.abs(car.speed) > 40) {
      p.car.hp -= 2.2 * dt * 10;
      p.car.x += Math.cos(car.angle) * 14 * dt * 3;
      p.car.y += Math.sin(car.angle) * 14 * dt * 3;
      if (p.car.hp <= 0) { p.car.hp = 0; p.car.wrecked = true; }
    }
  }

  // Foot cops.
  while (world.copsFoot.length < wantFoot) {
    const pt = spawnRoadPointNear(world, p.x, p.y, 360, 470);
    world.copsFoot.push({ x: pt.x, y: pt.y, angle: 0, walk: 0 });
  }
  if (world.copsFoot.length > wantFoot) world.copsFoot.length = wantFoot;
  let anyNear = false;
  for (const cop of world.copsFoot) {
    const d = dist(cop.x, cop.y, p.x, p.y);
    const want = Math.atan2(p.y - cop.y, p.x - cop.x);
    cop.angle = turnToward(cop.angle, want, 6 * dt);
    const sp = d > 26 ? 118 : 0;
    cop.x += Math.cos(cop.angle) * sp * dt;
    cop.y += Math.sin(cop.angle) * sp * dt;
    cop.walk += dt * 9;
    collideBuildings(world, cop, 9);
    if (d < 34 && (!p.car || Math.abs(p.car.speed) < 12)) anyNear = true;
  }
  if (anyNear) world.bust = Math.min(1, world.bust + dt * 0.45);
  else world.bust = Math.max(0, world.bust - dt * 0.35);

  // Roadblock at 4+ stars: two cruisers across the road ahead.
  if (stars >= 4 && !world.roadblock) {
    const dirA = p.car ? p.car.angle : p.angle;
    let bx = p.x + Math.cos(dirA) * 330, by = p.y + Math.sin(dirA) * 330;
    const horiz = Math.abs(Math.cos(dirA)) > 0.7;
    if (horiz) bx = roadLine(bx); else by = roadLine(by);
    bx = clamp(bx, 80, WORLD_SIZE - 80); by = clamp(by, 80, WORLD_SIZE - 80);
    const cars = [];
    for (const off of [-26, 26]) {
      const car = makeCar(world, 'police', horiz ? bx : bx + off, horiz ? by + off : by, horiz ? Math.PI / 2 : 0, 'cop');
      car.role = 'roadblock';
      car.color = '#eef1f4';
      world.cars.push(car);
      cars.push(car);
    }
    world.roadblock = { x: bx, y: by, cars };
  } else if (stars < 4 && world.roadblock) {
    for (const c of world.roadblock.cars) world.cars.splice(world.cars.indexOf(c), 1);
    world.roadblock = null;
  }

  // Helicopter at 5 stars.
  if (stars >= 5 && !world.heli) {
    world.heli = { x: p.x - 220, y: p.y - 170, angle: 0, phase: 0 };
  }
  if (world.heli) {
    if (stars < 5) world.heli = null;
    else {
      const h = world.heli;
      h.phase += dt;
      const tx = p.x + Math.cos(h.phase * 0.4) * 70;
      const ty = p.y + Math.sin(h.phase * 0.4) * 70 - 30;
      const want = Math.atan2(ty - h.y, tx - h.x);
      h.angle = turnToward(h.angle, want, 3 * dt);
      const d = dist(h.x, h.y, tx, ty);
      const sp = Math.min(238, d * 2);
      h.x += Math.cos(h.angle) * sp * dt;
      h.y += Math.sin(h.angle) * sp * dt;
    }
  }
}

export { trafficDensity };
