// Solmar Heat — world.js
// The city itself: 9x9 grid over 3600x3600, buildings, traffic,
// pedestrians, parked cars, the wanted system and BFS police.
// Pure logic — no DOM — so Node tests can drive it directly.

import { WORLD_SIZE, BLOCK, ROAD_W, CAR_TYPES, PLAYER, WANTED } from './config.js';
import { makeRng, pick, clamp, dist } from './random.js';
import { LANDMARKS } from './landmarks.js';
import { createWeather } from './weather.js';
import { createCollectibles } from './collectibles.js';
import { createMods } from './modshop.js';

export function roadCoord(i) { return i * BLOCK + BLOCK / 2; }
export function isOnRoad(x, y) {
  for (let i = 0; i < 9; i++) {
    const c = roadCoord(i);
    if (Math.abs(x - c) < ROAD_W / 2 || Math.abs(y - c) < ROAD_W / 2) return true;
  }
  return false;
}
export function nearestRoadPoint(x, y) {
  let bx = x, by = y, best = Infinity;
  for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) {
    const d = dist(x, y, roadCoord(i), roadCoord(j));
    if (d < best) { best = d; bx = roadCoord(i); by = roadCoord(j); }
  }
  return { x: bx, y: by };
}
// BFS over the intersection graph — cruisers hunt with this.
export function findGridPath(sx, sy, tx, ty) {
  const node = (x, y) => {
    let bi = 0, bj = 0, bd = Infinity;
    for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) {
      const d = dist(x, y, roadCoord(i), roadCoord(j));
      if (d < bd) { bd = d; bi = i; bj = j; }
    }
    return bi + ',' + bj;
  };
  const start = node(sx, sy), goal = node(tx, ty);
  const prev = new Map([[start, null]]); const q = [start];
  while (q.length) {
    const cur = q.shift(); if (cur === goal) break;
    const [i, j] = cur.split(',').map(Number);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni > 8 || nj > 8) continue;
      const k = ni + ',' + nj;
      if (!prev.has(k)) { prev.set(k, cur); q.push(k); }
    }
  }
  if (!prev.has(goal)) return [{ x: tx, y: ty }];
  const path = []; let cur = goal;
  while (cur) { const [i, j] = cur.split(',').map(Number); path.unshift({ x: roadCoord(i), y: roadCoord(j) }); cur = prev.get(cur); }
  path.push({ x: tx, y: ty });
  return path;
}

let carSeq = 1;
export function makeCar(typeId, x, y, angle, opts) {
  const t = CAR_TYPES.find((c) => c.id === typeId) || CAR_TYPES[0];
  return {
    id: carSeq++, type: t.id, name: t.name, x, y, angle: angle || 0,
    speed: 0, top: t.top, accel: t.accel, grip: t.grip,
    len: t.len, wid: t.wid, hp: t.hp, maxHp: t.hp, color: t.color,
    base: { top: t.top, accel: t.accel, grip: t.grip, hp: t.hp },
    parked: !!(opts && opts.parked), traffic: !!(opts && opts.traffic),
    police: typeId === 'police', isPlayerCar: !!(opts && opts.isPlayerCar),
    wrecked: false, driver: null, path: null, pathIdx: 0, lane: 20,
    bustTimer: 0, sirenPhase: Math.random() * 6,
  };
}

export function createWorld(seed) {
  const rng = makeRng(seed == null ? 20261121 : seed);
  const world = {
    rng, time: 0, events: [], stepFlags: {}, toasts: [],
    weather: createWeather(), collectibles: createCollectibles(),
    mods: createMods(), modBuys: 0,
    player: {
      x: PLAYER.safehouse.x, y: PLAYER.safehouse.y + 60, angle: 0,
      health: PLAYER.health, money: 120, score: 0, car: null,
      ammo: 12, reserve: 48, reloading: 0, punchCd: 0,
      carsStolen: 0, fares: 0, coins: 0, nearMisses: 0, rank: 'Nobody',
      dead: false, busted: false,
    },
    wanted: { heat: 0, stars: 0, cleanTime: 0, bust: 0 },
    cars: [], peds: [], cops: [], gang: [], bullets: [], particles: [],
    buildings: [], roadblocks: [], heli: null,
    mission: null, storyDone: false, missionsDone: 0,
    banner: null, gameState: 'title',
  };
  // Buildings fill each block, leaving parks / beach / plaza gaps.
  for (let bi = 0; bi < 8; bi++) for (let bj = 0; bj < 8; bj++) {
    if ((bi === 1 && bj === 6) || (bi === 6 && bj === 1)) continue; // park + beach blocks
    const bx = bi * BLOCK + ROAD_W / 2 + 24, by = bj * BLOCK + ROAD_W / 2 + 24;
    const bw = BLOCK - ROAD_W - 48;
    const n = 2 + Math.floor(rng() * 2);
    for (let k = 0; k < n; k++) {
      world.buildings.push({
        x: bx + (k % 2) * (bw / 2), y: by + Math.floor(k / 2) * (bw / 2),
        w: bw / 2 - 14, h: bw / 2 - 14, floors: 2 + Math.floor(rng() * 6),
        hue: pick(rng, ['#e8c9a0', '#dfae86', '#cf9d7a', '#e6d3b3', '#d9b8c4', '#a8c8d8']),
      });
    }
  }
  // Parked cars (22) + Rex's red Vento near the safehouse.
  const parkedTypes = ['sedan', 'coupe', 'taxi', 'van', 'pickup', 'compact', 'muscle', 'limo', 'truck', 'sports'];
  for (let i = 0; i < 22; i++) {
    const gx = roadCoord(Math.floor(rng() * 9)), gy = roadCoord(Math.floor(rng() * 9));
    world.cars.push(makeCar(pick(rng, parkedTypes), gx + 34, gy + (rng() * 160 - 80), 0, { parked: true }));
  }
  const vento = makeCar('vento', PLAYER.safehouse.x + 90, PLAYER.safehouse.y + 60, 0, { parked: true, isPlayerCar: true });
  world.cars.push(vento); world.vento = vento;
  // Traffic (26) driving the grid.
  for (let i = 0; i < 26; i++) {
    const horiz = rng() < 0.5;
    const gx = roadCoord(Math.floor(rng() * 9)), gy = roadCoord(Math.floor(rng() * 9));
    const c = makeCar(pick(rng, parkedTypes), horiz ? rng() * WORLD_SIZE : gx, horiz ? gy : rng() * WORLD_SIZE, horiz ? 0 : Math.PI / 2, { traffic: true });
    c.speed = 90 + rng() * 60; world.cars.push(c);
  }
  // Pedestrians (34) on sidewalks.
  for (let i = 0; i < 34; i++) {
    world.peds.push({
      x: rng() * WORLD_SIZE, y: rng() * WORLD_SIZE, angle: rng() * 6.28,
      speed: 34 + rng() * 30, flee: 0, color: pick(rng, ['#e86a5e', '#5e8fe8', '#6ac46a', '#e8c95e', '#b45ee8', '#eeeeee']),
      hp: 20,
    });
  }
  world.landmarks = LANDMARKS;
  return world;
}

export function starsForHeat(heat) { return clamp(Math.floor(heat / WANTED.band), 0, WANTED.maxStars); }
// A star gained lands mid-band so it cannot decay back next frame.
export function addHeat(world, amount) {
  const before = world.wanted.stars;
  world.wanted.heat = clamp(world.wanted.heat + amount, 0, WANTED.band * WANTED.maxStars - 1);
  world.wanted.stars = starsForHeat(world.wanted.heat);
  if (world.wanted.stars > before) {
    world.wanted.heat = world.wanted.stars * WANTED.band + WANTED.band / 2;
    world.wanted.stars = starsForHeat(world.wanted.heat);
  }
  world.wanted.cleanTime = 0;
}
export function setWanted(world, stars) {
  // Heat sits mid-band for the requested level (0 stars = no heat),
  // so a freshly set level never decays back on the next frame.
  world.wanted.stars = clamp(stars, 0, 5);
  world.wanted.heat = stars <= 0 ? 0 : stars * WANTED.band + WANTED.band / 2;
  world.wanted.cleanTime = 0;
}
export function stepWanted(world, dt, crimeActive) {
  const w = world.wanted;
  if (!crimeActive && w.stars > 0) {
    w.cleanTime += dt;
    if (w.cleanTime >= WANTED.decayDelay) {
      w.cleanTime = 0;
      w.stars -= 1;
      w.heat = w.stars === 0 ? 0 : w.stars * WANTED.band + WANTED.band / 2;
    }
  } else if (crimeActive) w.cleanTime = 0;
  trimCops(world);
}
export function wantedCopCounts(stars) {
  return { foot: stars >= 2 ? Math.min(4, stars) : 0, car: stars >= 1 ? Math.min(5, stars + 1) : 0 };
}
export function trimCops(world) {
  const want = wantedCopCounts(world.wanted.stars);
  const foot = world.cops.filter((c) => !c.inCar);
  const inCar = world.cops.filter((c) => c.inCar);
  for (let i = want.foot; i < foot.length; i++) foot[i].gone = true;
  for (let i = want.car; i < inCar.length; i++) inCar[i].gone = true;
  world.cops = world.cops.filter((c) => !c.gone);
  if (world.wanted.stars < 4) world.roadblocks = [];
  if (world.wanted.stars < 5) world.heli = null;
}
export function spawnPolice(world) {
  const want = wantedCopCounts(world.wanted.stars);
  const p = world.player;
  const foot = world.cops.filter((c) => !c.inCar).length;
  const inCar = world.cops.filter((c) => c.inCar).length;
  for (let i = inCar; i < want.car; i++) {
    const a = world.rng() * 6.28;
    const car = makeCar('police', clamp(p.x + Math.cos(a) * 620, 60, WORLD_SIZE - 60), clamp(p.y + Math.sin(a) * 620, 60, WORLD_SIZE - 60), a, {});
    world.cars.push(car);
    world.cops.push({ x: car.x, y: car.y, inCar: true, car, speed: 200, path: null, pathIdx: 0, bust: 0 });
  }
  for (let i = foot; i < want.foot; i++) {
    const a = world.rng() * 6.28;
    world.cops.push({ x: clamp(p.x + Math.cos(a) * 380, 30, WORLD_SIZE - 30), y: clamp(p.y + Math.sin(a) * 380, 30, WORLD_SIZE - 30), inCar: false, car: null, speed: 150, path: null, pathIdx: 0, bust: 0 });
  }
  if (world.wanted.stars >= 5 && !world.heli) world.heli = { x: p.x, y: p.y - 200, angle: 0 };
  if (world.wanted.stars >= 4 && world.roadblocks.length === 0) {
    const ahead = nearestRoadPoint(p.x + 300, p.y);
    world.roadblocks.push({ x: ahead.x, y: ahead.y, angle: 0 });
  }
}
export function damageCar(world, car, amount) {
  car.hp -= amount;
  if (car.hp <= 0) { car.hp = 0; car.wrecked = true; car.speed = 0; }
}
export function enterCar(world, car) {
  if (!car || car.wrecked) return false;
  const wasParked = car.parked;
  car.parked = false; car.traffic = false;
  world.player.car = car; car.driver = 'player';
  if (wasParked && !car.countedStolen) { car.countedStolen = true; world.player.carsStolen += 1; }
  return true;
}
export function exitCar(world) {
  const car = world.player.car; if (!car) return;
  car.driver = null; car.speed = 0;
  world.player.x = car.x + 30; world.player.y = car.y + 10;
  world.player.car = null;
}
export function respawn(world, atHospital) {
  const p = world.player;
  p.dead = false; p.busted = false; p.health = PLAYER.health; p.car = null;
  const spot = atHospital ? LANDMARKS.find((l) => l.id === 'hospital') : LANDMARKS[0];
  p.x = spot.x; p.y = spot.y + 50;
  world.wanted.stars = 0; world.wanted.heat = 0; world.cops = []; world.roadblocks = []; world.heli = null;
}
export function stepTraffic(world, dt) {
  for (const c of world.cars) {
    if (!c.traffic || c.wrecked) continue;
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    if (c.x < 0 || c.y < 0 || c.x > WORLD_SIZE || c.y > WORLD_SIZE) {
      c.angle += Math.PI; c.x = clamp(c.x, 10, WORLD_SIZE - 10); c.y = clamp(c.y, 10, WORLD_SIZE - 10);
    }
    // Turn at intersections sometimes.
    const near = nearestRoadPoint(c.x, c.y);
    if (dist(c.x, c.y, near.x, near.y) < 8 && world.rng() < 0.3) {
      c.angle = pick(world.rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]);
      c.x = near.x; c.y = near.y;
    }
  }
}
export function stepPeds(world, dt, danger) {
  for (const ped of world.peds) {
    if (danger && dist(ped.x, ped.y, danger.x, danger.y) < 130) ped.flee = 1.2;
    ped.flee = Math.max(0, ped.flee - dt);
    const sp = ped.flee > 0 ? ped.speed * 2.4 : ped.speed;
    ped.x += Math.cos(ped.angle) * sp * dt; ped.y += Math.sin(ped.angle) * sp * dt;
    if (ped.x < 20 || ped.y < 20 || ped.x > WORLD_SIZE - 20 || ped.y > WORLD_SIZE - 20) ped.angle += Math.PI;
    if (world.rng() < dt * 0.05) ped.angle = world.rng() * 6.28;
  }
}
export function stepPolice(world, dt) {
  spawnPolice(world);
  const p = world.player;
  for (const cop of world.cops) {
    const target = p.car || p;
    if (!cop.path || cop.pathIdx >= cop.path.length) { cop.path = findGridPath(cop.x, cop.y, target.x, target.y); cop.pathIdx = 0; }
    const wp = cop.path[Math.min(cop.pathIdx, cop.path.length - 1)];
    if (dist(cop.x, cop.y, wp.x, wp.y) < 42) cop.pathIdx += 1;
    const dx = target.x - cop.x, dy = target.y - cop.y; const d = Math.hypot(dx, dy) || 1;
    const sp = cop.inCar ? 235 : 152;
    cop.x += (dx / d) * Math.min(sp, d * 2) * dt; cop.y += (dy / d) * Math.min(sp, d * 2) * dt;
    if (cop.inCar && cop.car) { cop.car.x = cop.x; cop.car.y = cop.y; cop.car.angle = Math.atan2(dy, dx); }
    // Bust: a foot cop holding next to an on-foot player.
    if (!cop.inCar && !p.car && d < 30) {
      cop.bust += dt; world.wanted.bust = cop.bust;
      if (cop.bust >= WANTED.bustTime) {
        p.busted = true;
        const fine = Math.min(WANTED.fineCap, world.wanted.stars * WANTED.finePerStar);
        p.money = Math.max(0, p.money - fine); world.lastFine = fine;
      }
    } else cop.bust = Math.max(0, cop.bust - dt * 2);
  }
  if (world.heli) {
    const dx = p.x - world.heli.x, dy = p.y - world.heli.y; const d = Math.hypot(dx, dy) || 1;
    const sp = Math.min(520, d * 1.6);
    world.heli.x += (dx / d) * sp * 0.016; world.heli.y += (dy / d) * sp * 0.016;
    world.heli.angle = Math.atan2(dy, dx);
  }
}
export function saveData(world) {
  return {
    money: world.player.money, score: world.player.score, missionsDone: world.missionsDone,
    storyDone: world.storyDone, coins: world.collectibles.coins.map((c) => c.taken),
    mods: { ...world.mods }, carsStolen: world.player.carsStolen, fares: world.player.fares,
    turf: world.turfState || null,
  };
}
export function loadData(world, data) {
  if (!data) return false;
  world.player.money = data.money || 0; world.player.score = data.score || 0;
  world.missionsDone = data.missionsDone || 0; world.storyDone = !!data.storyDone;
  if (Array.isArray(data.coins)) data.coins.forEach((t, i) => { if (world.collectibles.coins[i]) world.collectibles.coins[i].taken = !!t; });
  world.player.coins = world.collectibles.coins.filter((c) => c.taken).length;
  if (data.mods) world.mods = { engine: 0, armor: 0, tires: 0, ...data.mods };
  world.player.carsStolen = data.carsStolen || 0; world.player.fares = data.fares || 0;
  if (data.turf) world.turfState = data.turf;
  return true;
}
