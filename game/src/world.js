// world.js — Solmar itself: city generation, traffic, pedestrians,
// the player, and the SCPD response (cars, foot cops, roadblocks at
// four stars, a helicopter at five). Police steer on the road grid
// with a breadth-first route, so cruisers come down real streets.
//
// Heat model: heat is a 0..500 meter, one star per 100. When a crime
// pushes heat into a new star band it is parked mid-band, so decay
// can never snatch the star back on the very next frame.

import { BLOCK, CAR_TYPES, DISTRICTS, PED_COLORS, SKIN_TONES, WORLD_SIZE } from './config.js';
import { makeRng } from './random.js';
import { buildProps } from './props.js';
import { createCoins, createPickups } from './collectibles.js';
import { createMissionState, rankFor } from './missions.js';
import { createCombat } from './combat.js';
import { createRaceState } from './races.js';
import { createSideState } from './sidejobs.js';
import { createTurf } from './turf.js';
import { createMods } from './modshop.js';
import { createWeather } from './weather.js';

let carSeq = 0;

export function districtAt(x, y) {
  const cx = Math.min(2, Math.max(0, Math.floor(x / (WORLD_SIZE / 3))));
  const cy = Math.min(2, Math.max(0, Math.floor(y / (WORLD_SIZE / 3))));
  return DISTRICTS[cy * 3 + cx];
}

export function isRoad(x, y) {
  const mx = ((x % BLOCK) + BLOCK) % BLOCK;
  const my = ((y % BLOCK) + BLOCK) % BLOCK;
  return mx < 108 || my < 108;
}

export function roadCoord(v) {
  return Math.round((v - 54) / BLOCK) * BLOCK + 54;
}

export function makeCar(rng, typeKey, x, y) {
  const type = CAR_TYPES.find((t) => t.key === typeKey) || CAR_TYPES[0];
  carSeq++;
  return {
    id: carSeq, type: type.key, name: type.name, color: type.color,
    len: type.len, wid: type.wid, topSpeed: type.speed,
    x, y, angle: rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]),
    speed: 0, hp: 100, wrecked: false, parked: false,
    sirenPhase: (carSeq * 1.7) % 6.28, driverSeed: rng(),
  };
}

function roadPoint(rng) {
  const horiz = rng.chance(0.5);
  const line = rng.int(0, 8) * BLOCK + 54;
  const along = 80 + rng() * (WORLD_SIZE - 160);
  return horiz ? [along, line] : [line, along];
}

export function createWorld(seed) {
  carSeq = 0; // per-world sequence: same seed must rebuild identical cars
  const rng = makeRng(seed || 20261121);
  const world = {
    seed: seed || 20261121, rng, time: 0, clock: 10.5,
    heat: 0, vaultProgress: 0, radioIdx: 0, radioT: 0,
    cars: [], peds: [], cops: [], footCops: [], gang: [],
    bulletsNote: '', roadblock: null, heli: null,
    stats: { carsStolen: 0, fares: 0, deliveries: 0, nearMisses: 0, coinsFound: 0, missionsDone: 0, racesWon: 0, turfHeld: 0, modsBought: 0, playTime: 0 },
  };
  world.weatherState = createWeather(rng);
  world.missions = createMissionState();
  world.combat = createCombat();
  world.race = createRaceState();
  world.side = createSideState(rng);
  world.turf = createTurf();
  world.coins = createCoins();
  world.pickups = createPickups(rng);
  world.props = buildProps(rng);
  world.buildings = buildBuildings(rng);
  world.radioIdx = rng.int(0, 2);

  world.player = {
    x: 620, y: 660, angle: 0, hp: 100, money: 40, score: 0,
    ammo: 12, reserve: 48, reloadT: 0, car: null, rank: 'Runner',
    mods: createMods(), nearMissCd: 0, name: 'Rex Kane',
  };

  // Density (Upgrade C): 42 traffic, 34 parked, 72 pedestrians.
  const trafficTypes = ['sedan', 'coupe', 'taxi', 'van', 'truck', 'pickup', 'muscle', 'compact', 'limo', 'falco', 'vento'];
  for (let i = 0; i < 42; i++) {
    const [x, y] = roadPoint(rng);
    const c = makeCar(rng, rng.pick(trafficTypes), x, y);
    c.speed = rng.range(40, 90);
    world.cars.push(c);
  }
  for (let i = 0; i < 34; i++) {
    const bx = rng.int(0, 8) * BLOCK + 170 + rng() * 160;
    const by = rng.int(0, 8) * BLOCK + 170 + rng() * 160;
    const c = makeCar(rng, rng.pick(trafficTypes), bx, by);
    c.parked = true; c.angle = rng.pick([0, Math.PI / 2]);
    world.cars.push(c);
  }
  for (let i = 0; i < 72; i++) world.peds.push(makePed(rng));
  world.addHeat = (n) => addHeat(world, n);
  return world;
}

export function makePed(rng) {
  const onRoadLine = rng.int(0, 8) * BLOCK + 120;
  const along = 120 + rng() * (WORLD_SIZE - 240);
  const horiz = rng.chance(0.5);
  return {
    x: horiz ? along : onRoadLine, y: horiz ? onRoadLine : along,
    angle: rng() * Math.PI * 2, speed: rng.range(22, 46),
    color: rng.pick(PED_COLORS), skin: rng.pick(SKIN_TONES),
    flee: false, phase: rng() * 6.28,
  };
}

function buildBuildings(rng) {
  const out = [];
  for (let bx = 0; bx < 9; bx++) for (let by = 0; by < 9; by++) {
    const n = 2 + rng.int(0, 2);
    for (let i = 0; i < n; i++) {
      const x = bx * BLOCK + 130 + rng() * 150;
      const y = by * BLOCK + 130 + rng() * 150;
      out.push({
        x, y, w: 62 + rng() * 62, h: 52 + rng() * 58,
        floors: 1 + rng.int(0, 5), hue: rng(),
        roof: rng.pick(['ac', 'tank', 'vent', 'none']),
      });
    }
  }
  return out;
}

export function starsOf(world) { return Math.min(5, Math.floor(world.heat / 100)); }

export function addHeat(world, n) {
  const before = starsOf(world);
  world.heat = Math.min(500, Math.max(0, world.heat + n));
  const after = starsOf(world);
  if (after > before) world.heat = Math.min(500, after * 100 + 50); // park mid-band
}

// Breadth-first route on the intersection grid: returns the next
// intersection a cruiser should aim for on its way to the target.
export function nextGridStep(fromX, fromY, toX, toY) {
  const node = (v) => Math.max(0, Math.min(8, Math.round((v - 54) / BLOCK)));
  const sx = node(fromX); const sy = node(fromY);
  const tx = node(toX); const ty = node(toY);
  if (sx === tx && sy === ty) return [toX, toY];
  const key = (x, y) => y * 9 + x;
  const prev = new Map(); const seen = new Set([key(sx, sy)]);
  const queue = [[sx, sy]];
  while (queue.length) {
    const [cx, cy] = queue.shift();
    if (cx === tx && cy === ty) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx; const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx > 8 || ny > 8 || seen.has(key(nx, ny))) continue;
      seen.add(key(nx, ny)); prev.set(key(nx, ny), key(cx, cy)); queue.push([nx, ny]);
    }
  }
  let cur = key(tx, ty);
  if (!prev.has(cur) && cur !== key(sx, sy)) return [toX, toY];
  while (prev.get(cur) !== undefined && prev.get(cur) !== key(sx, sy)) cur = prev.get(cur);
  const gx = (cur % 9) * BLOCK + 54; const gy = Math.floor(cur / 9) * BLOCK + 54;
  return [gx, gy];
}

export function desiredCops(world) {
  const s = starsOf(world);
  return s === 0 ? 0 : 2 + s; // 3..7 cruisers as heat climbs
}

export function stepPolice(world, dt) {
  const p = world.player;
  const stars = starsOf(world);
  const want = desiredCops(world);
  while (world.cops.length < want) {
    const a = world.rng() * Math.PI * 2;
    const d = 620 + world.rng() * 200;
    const c = makeCar(world.rng, 'cruiser', roadCoord(p.x + Math.cos(a) * d), roadCoord(p.y + Math.sin(a) * d));
    c.police = true; c.speed = 90;
    world.cops.push(c);
  }
  while (world.cops.length > want) world.cops.pop();
  for (const c of world.cops) {
    const [tx, ty] = nextGridStep(c.x, c.y, p.x, p.y);
    driveToward(c, tx, ty, dt, 195);
    if (Math.hypot(p.x - c.x, p.y - c.y) < 30 && !p.car) p.hp -= dt * 4;
  }
  // Foot cops from two stars.
  const wantFoot = stars >= 2 ? stars - 1 : 0;
  while (world.footCops.length < wantFoot) {
    world.footCops.push({ x: p.x + world.rng.range(-320, 320), y: p.y + world.rng.range(-320, 320), speed: 74, color: '#274b8f' });
  }
  while (world.footCops.length > wantFoot) world.footCops.pop();
  for (const f of world.footCops) {
    const d = Math.hypot(p.x - f.x, p.y - f.y) || 1;
    if (d > 24) { f.x += (p.x - f.x) / d * f.speed * dt; f.y += (p.y - f.y) / d * f.speed * dt; }
    else p.hp -= dt * 5;
  }
  // Roadblock at four stars: two cruisers across the road ahead.
  if (stars >= 4 && !world.roadblock) {
    const bx = roadCoord(p.x + 420); const by = roadCoord(p.y);
    world.roadblock = { x: bx, y: by, cars: [ { x: bx, y: by - 26 }, { x: bx, y: by + 26 } ] };
  }
  if (stars < 4) world.roadblock = null;
  // Helicopter at five stars.
  if (stars >= 5 && !world.heli) world.heli = { x: p.x - 200, y: p.y - 160, angle: 0 };
  if (stars < 5) world.heli = null;
  if (world.heli) {
    const h = world.heli;
    const d = Math.hypot(p.x - h.x, p.y - h.y) || 1;
    const sp = 235;
    if (d > 120) { h.x += (p.x - h.x) / d * sp * dt; h.y += (p.y - h.y) / d * sp * dt; }
    h.angle = Math.atan2(p.y - h.y, p.x - h.x);
  }
  if (stars === 0) world.heat = Math.max(0, world.heat - dt * 1.2);
  else world.heat = Math.max(stars * 100, world.heat - dt * 1.6);
}

export function driveToward(car, tx, ty, dt, top) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
  car.speed = Math.min(top, (car.speed || 0) + 120 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = Math.max(20, Math.min(WORLD_SIZE - 20, car.x));
  car.y = Math.max(20, Math.min(WORLD_SIZE - 20, car.y));
}

export function stepTraffic(world, dt) {
  for (const c of world.cars) {
    if (c.parked || c.wrecked) continue;
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    if (c.x < 40 || c.x > WORLD_SIZE - 40 || c.y < 40 || c.y > WORLD_SIZE - 40) c.angle += Math.PI;
    // Traffic keeps to roads: snap the cross axis to the nearest lane.
    if (Math.abs(c.angle) < 0.1 || Math.abs(Math.abs(c.angle) - Math.PI) < 0.1) c.y += (roadCoord(c.y) - c.y) * dt * 2;
    else c.x += (roadCoord(c.x) - c.x) * dt * 2;
  }
  for (const ped of world.peds) {
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    if (ped.x < 60 || ped.x > WORLD_SIZE - 60 || ped.y < 60 || ped.y > WORLD_SIZE - 60) ped.angle += Math.PI;
    if (world.rng.chance(0.002)) ped.angle = world.rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
  }
}

export function nearestCar(world, maxD) {
  let best = null; let bd = maxD;
  for (const c of [...world.cars, ...world.cops]) {
    const d = Math.hypot(c.x - world.player.x, c.y - world.player.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function enterCar(world, car) {
  if (!car || car.wrecked) return false;
  world.player.car = car;
  world.player.x = car.x; world.player.y = car.y;
  if (!car.police) { world.stats.carsStolen++; addHeat(world, 34); }
  return true;
}

export function exitCar(world) {
  if (!world.player.car) return false;
  world.player.x += 30; world.player.car = null;
  return true;
}

export function damageCar(world, car, amount) {
  car.hp -= amount;
  if (car.hp <= 0) { car.hp = 0; car.wrecked = true; car.speed = 0; if (world.player.car === car) exitCar(world); }
  return car.wrecked;
}

// --- save / load (plain object; main.js persists it) ---
export function serializeWorld(world) {
  return JSON.stringify({
    money: world.player.money, hp: world.player.hp, rank: world.player.rank,
    missionsDone: world.missions.done, coins: world.coins.map((c) => c.taken),
    turf: world.turf.map((z) => z.owner), mods: world.player.mods,
    stats: world.stats, raceDone: world.race.done,
  });
}

export function restoreWorld(world, json) {
  try {
    const s = JSON.parse(json);
    world.player.money = s.money ?? world.player.money;
    world.player.hp = s.hp ?? 100;
    world.player.rank = s.rank ?? 'Runner';
    if (Array.isArray(s.missionsDone)) world.missions.done = s.missionsDone;
    if (Array.isArray(s.coins)) s.coins.forEach((t, i) => { if (world.coins[i]) world.coins[i].taken = !!t; });
    if (Array.isArray(s.turf)) s.turf.forEach((o, i) => { if (world.turf[i]) world.turf[i].owner = o; });
    if (s.mods) world.player.mods = s.mods;
    if (s.stats) world.stats = { ...world.stats, ...s.stats };
    if (s.raceDone) world.race.done = s.raceDone;
    world.stats.missionsDone = world.missions.done.filter(Boolean).length;
    world.stats.coinsFound = world.coins.filter((c) => c.taken).length;
    world.stats.turfHeld = world.turf.filter((z) => z.owner === 'Rex').length;
    return true;
  } catch { return false; }
}

export { rankFor };
