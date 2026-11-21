// world.js — Solmar itself: generation, traffic, pedestrians,
// police, the wanted system and the save slots. Everything is
// built from one seeded rng, so a seed always grows the same city.

import {
  WORLD, BLOCK, CELL, GRID, roadCenter, isRoad, clampWorld,
  CAR_TYPES, carType, rankFor, SAVE_PREFIX, BEACH_X,
} from './config.js';
import { makeRng, range, intRange, pick, hash2 } from './random.js';
import { buildProps } from './props.js';
import { buildCollectibles } from './collectibles.js';
import { buildTurf } from './turf.js';
import { landmark } from './landmarks.js';

export const WORLD_SEED = 20261121;
let carSeq = 0;

// ----------------------------------------------------------------
// Generation
// ----------------------------------------------------------------

function buildBuildings(world) {
  const rng = world.rng;
  const out = [];
  for (let bx = 0; bx < GRID; bx++) {
    for (let by = 0; by < GRID; by++) {
      if (bx === 8) continue; // east column is the beach
      const x0 = bx * BLOCK + 14, y0 = by * BLOCK + 14;
      const inner = CELL - 28;
      const split = intRange(rng, 1, 2);
      let idx = 0;
      for (let sx = 0; sx < split; sx++) {
        for (let sy = 0; sy < split; sy++) {
          if (split > 1 && rng() < 0.22) continue; // a yard / lot gap
          const w = inner / split - 12, h = inner / split - 12;
          out.push({
            x: x0 + sx * (inner / split) + 6, y: y0 + sy * (inner / split) + 6,
            w, h, bx, by, idx: idx++,
            floors: intRange(rng, 1, 8),
            hue: pick(rng, ['#e8dcc4', '#dfc9a8', '#e5e0d5', '#d9b8a3', '#cfe0e2', '#e8c9c9', '#f0e6cf']),
          });
        }
      }
    }
  }
  return out;
}

export function makeCar(world, typeId, x, y, angle) {
  const t = carType(typeId);
  carSeq++;
  return {
    id: carSeq, type: typeId, name: t.name, style: t.style,
    x, y, angle, speed: 0, hp: 100, wrecked: false,
    color: t.color, sirenPhase: (carSeq * 1.7) % 6.28,
    route: null, routeI: 0, parked: false, driver: 'traffic',
    air: 0, airRamp: null, stolen: false,
  };
}

function spawnTraffic(world) {
  const rng = world.rng;
  const cars = [];
  const usable = CAR_TYPES.filter(t => t.id !== 'cruiser' && t.id !== 'vento');
  for (let i = 0; i < 42; i++) {
    const vert = rng() < 0.5;
    const lane = intRange(rng, 0, 8);
    const along = range(rng, 60, WORLD - 60);
    const c = roadCenter(lane);
    const x = vert ? c + (rng() < 0.5 ? -23 : 23) : along;
    const y = vert ? along : c + (rng() < 0.5 ? -23 : 23);
    const car = makeCar(world, pick(rng, usable).id, x, y, vert ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI));
    car.speed = range(rng, 90, 150);
    cars.push(car);
  }
  // Parked cars hug the kerbs inside blocks.
  for (let i = 0; i < 34; i++) {
    const bx = intRange(rng, 0, 7), by = intRange(rng, 0, 8);
    const x = bx * BLOCK + CELL - 16, y = by * BLOCK + range(rng, 20, CELL - 20);
    const car = makeCar(world, pick(rng, usable).id, x, y, Math.PI / 2);
    car.parked = true;
    cars.push(car);
  }
  return cars;
}

const PED_COLORS = ['#d94f3d', '#3d7ad9', '#f2f2f2', '#39b56b', '#e4a11b', '#9c5ae4', '#e45a9c', '#4dd0e1'];
function spawnPeds(world) {
  const rng = world.rng;
  const peds = [];
  for (let i = 0; i < 72; i++) {
    const bx = intRange(rng, 0, 8), by = intRange(rng, 0, 8);
    peds.push({
      x: bx * BLOCK + range(rng, 4, CELL + 60), y: by * BLOCK + range(rng, 4, CELL + 60),
      angle: range(rng, 0, 6.28), speed: range(rng, 22, 44),
      color: pick(rng, PED_COLORS), flee: 0, tx: 0, ty: 0, retarget: range(rng, 1, 5),
    });
  }
  return peds;
}

export function createWorld(seed = WORLD_SEED) {
  carSeq = 0;
  const world = {
    seed, rng: makeRng(seed), time: 0, clock: 10.2,
    weather: 'clear', weatherTimer: 90, radioIdx: 0,
    buildings: [], props: [], cars: [], peds: [], cops: [], footCops: [],
    heli: null, roadblocks: [], gang: [], bullets: [], particles: [],
    coins: [], stashes: [], ramps: [], turf: [], turfHold: null,
    mission: null, missionTime: 0, missionDamage: 0, grades: {},
    race: null, fare: null, delivery: null,
    mods: { engine: 0, armor: 0, tires: 0 },
    heat: 0, exposure: 0, chaseTime: 0, dialogue: null, dialogueT: 0,
    crewCd: { lou: 0, dex: 0 }, lastHour: 10, cameraShake: 0,
    player: null, stats: null, gameState: 'title', message: null, messageT: 0,
  };
  world.buildings = buildBuildings(world);
  world.props = buildProps(world);
  const col = buildCollectibles(world);
  world.coins = col.coins; world.stashes = col.stashes; world.ramps = col.ramps;
  world.turf = buildTurf();
  world.cars = spawnTraffic(world);
  world.peds = spawnPeds(world);

  // The player's own red Vento, parked by the safehouse.
  const home = landmark('safehouse');
  const mine = makeCar(world, 'vento', home.x + 40, home.y + 6, 0);
  mine.stolen = true;
  world.cars.push(mine);
  world.player = {
    x: home.x, y: home.y, angle: 0, hp: 100, armour: 0, money: 120,
    car: null, weapon: 1, rp: 0, dead: false,
    ammo: { pistol: 48, smg: 120 }, mag: { pistol: 12, smg: 30 },
    reloadT: 0, fireT: 0, punchT: 0, nearMissCd: 0,
  };
  world.stats = {
    carsStolen: 0, fares: 0, deliveries: 0, racesWon: 0, nearMisses: 0,
    kmDriven: 0, copsEscaped: 0, longestChaseSec: 0, shotsFired: 0,
    jumpsLanded: 0, missionsDone: 0, playSeconds: 0,
  };
  world.radioIdx = intRange(world.rng, 0, 2);
  return world;
}

// ----------------------------------------------------------------
// Wanted / heat / exposure
// ----------------------------------------------------------------

export function starsOf(world) { return Math.min(5, Math.floor(world.heat / 100)); }

// Add heat for a crime. A star gained lands mid-band so decay can
// never drop it again on the very next frame.
export function addHeat(world, amount) {
  const before = starsOf(world);
  world.heat = Math.min(500, world.heat + amount);
  const after = starsOf(world);
  // A star gained lands mid-band, so decay cannot drop it next frame.
  if (after > before) world.heat = Math.min(500, Math.max(world.heat, after * 100 + 50));
}

export function clearHeat(world) { world.heat = 0; world.exposure = 0; world.chaseTime = 0; }

// Exposure: rises while any unit can see the player, falls while
// hidden. It drives both the IN SIGHT bar and heat decay.
export function stepWanted(world, dt) {
  const stars = starsOf(world);
  let seen = false;
  const p = world.player;
  const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
  const near = (u) => Math.hypot(u.x - px, u.y - py) < 430;
  if (world.cops.some(near) || world.footCops.some(near) || (world.heli && Math.hypot(world.heli.x - px, world.heli.y - py) < 620)) seen = true;
  world.exposure = Math.max(0, Math.min(1, world.exposure + (seen ? dt * 0.55 : -dt * 0.16)));
  if (stars > 0) {
    world.chaseTime += dt;
    world.stats.longestChaseSec = Math.max(world.stats.longestChaseSec, Math.floor(world.chaseTime));
  }
  // Heat itself always cools while unseen — even below one star,
  // or the meter would stick at 99 forever and no escape would
  // ever be credited.
  if (world.heat > 0 && !seen && world.exposure <= 0) {
    world.heat = Math.max(0, world.heat - dt * 4.2);
    if (world.heat <= 0) {
      if (world.chaseTime > 6) world.stats.copsEscaped++;
      world.chaseTime = 0;
    }
  }
}

// ----------------------------------------------------------------
// Police: BFS pursuit over the intersection graph
// ----------------------------------------------------------------

function nearestNode(x, y) {
  const i = Math.max(0, Math.min(8, Math.round((x - 354) / 400)));
  const j = Math.max(0, Math.min(8, Math.round((y - 354) / 400)));
  return { i, j };
}

// Breadth-first next hop from node a toward node b on the 9x9 grid.
export function bfsNext(a, b) {
  if (a.i === b.i && a.j === b.j) return b;
  const key = (i, j) => i * 9 + j;
  const prev = new Map([[key(a.i, a.j), null]]);
  const q = [a];
  while (q.length) {
    const n = q.shift();
    if (n.i === b.i && n.j === b.j) break;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = n.i + di, nj = n.j + dj;
      if (ni < 0 || ni > 8 || nj < 0 || nj > 8 || prev.has(key(ni, nj))) continue;
      prev.set(key(ni, nj), n);
      q.push({ i: ni, j: nj });
    }
  }
  let cur = { i: b.i, j: b.j };
  if (!prev.has(key(cur.i, cur.j))) return b;
  while (prev.get(key(cur.i, cur.j)) && !(prev.get(key(cur.i, cur.j)).i === a.i && prev.get(key(cur.i, cur.j)).j === a.j)) {
    cur = prev.get(key(cur.i, cur.j));
  }
  return cur;
}

function driveToward(world, car, tx, ty, dt, topSpeed) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  let d = want - car.angle;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  car.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, d * 4 * dt));
  const dist = Math.hypot(tx - car.x, ty - car.y);
  const target = dist < 60 ? topSpeed * 0.4 : topSpeed;
  car.speed += Math.max(-260 * dt, Math.min(200 * dt, target - car.speed));
  car.x = clampWorld(car.x + Math.cos(car.angle) * car.speed * dt);
  car.y = clampWorld(car.y + Math.sin(car.angle) * car.speed * dt);
}

export function spawnCopCar(world, x, y) {
  const c = makeCar(world, 'cruiser', x, y, 0);
  c.driver = 'cop';
  world.cops.push(c);
  return c;
}

export function stepPolice(world, dt) {
  const stars = starsOf(world);
  const p = world.player;
  const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;

  // Maintain the response the star level calls for.
  const wantCars = stars === 0 ? 0 : Math.min(6, stars + 1);
  while (world.cops.length < wantCars) {
    const a = world.rng() * Math.PI * 2, d = 620 + world.rng() * 200;
    spawnCopCar(world, clampWorld(px + Math.cos(a) * d), clampWorld(py + Math.sin(a) * d));
  }
  if (stars === 0) world.cops.length = 0;
  const wantFoot = stars >= 3 ? stars - 1 : 0;
  while (world.footCops.length < wantFoot) {
    const a = world.rng() * Math.PI * 2;
    world.footCops.push({ x: clampWorld(px + Math.cos(a) * 380), y: clampWorld(py + Math.sin(a) * 380), angle: 0, hp: 30, color: '#2c4a7c' });
  }
  if (stars < 3) world.footCops.length = 0;

  // Helicopter at five stars.
  if (stars >= 5 && !world.heli) world.heli = { x: px + 300, y: py - 300, angle: 0 };
  if (stars < 5) world.heli = null;
  if (world.heli) {
    const h = world.heli;
    const want = Math.atan2(py - h.y, px - h.x);
    h.angle = want;
    const d = Math.hypot(px - h.x, py - h.y);
    const sp = d > 130 ? 330 : 120;
    h.x += Math.cos(want) * Math.min(sp * dt, d);
    h.y += Math.sin(want) * Math.min(sp * dt, d);
  }

  // Roadblocks at four stars: two cruisers + barrier across the
  // road ahead of the player; they clear when the heat drops.
  if (stars >= 4 && world.roadblocks.length === 0) {
    const ahead = 330;
    const ang = p.car ? p.car.angle : p.angle;
    const bx = clampWorld(px + Math.cos(ang) * ahead), by = clampWorld(py + Math.sin(ang) * ahead);
    world.roadblocks.push({ x: bx, y: by, angle: ang + Math.PI / 2 });
  }
  if (stars < 4) world.roadblocks.length = 0;

  // Car cops: BFS to the player's intersection, then home in.
  const targetNode = nearestNode(px, py);
  for (const cop of world.cops) {
    const myNode = nearestNode(cop.x, cop.y);
    const hop = bfsNext(myNode, targetNode);
    const hx = roadCenter(hop.i), hy = roadCenter(hop.j);
    const dPlayer = Math.hypot(px - cop.x, py - cop.y);
    if (dPlayer < 240) driveToward(world, cop, px, py, dt, 345);
    else driveToward(world, cop, hx, hy, dt, 345);
    // Ramming contact slows and hurts the player's car.
    if (p.car && Math.hypot(p.car.x - cop.x, p.car.y - cop.y) < 34 && Math.abs(cop.speed) > 60) {
      p.car.hp -= 9 * dt * 3;
      world.missionDamage += 9 * dt * 3;
      world.cameraShake = Math.min(6, world.cameraShake + dt * 8);
    }
  }
  for (const f of world.footCops) {
    const want = Math.atan2(py - f.y, px - f.x);
    f.angle = want;
    const d = Math.hypot(px - f.x, py - f.y);
    if (d > 26) { f.x += Math.cos(want) * 105 * dt; f.y += Math.sin(want) * 105 * dt; }
  }
}

// ----------------------------------------------------------------
// Traffic + pedestrians
// ----------------------------------------------------------------

export function stepTraffic(world, dt) {
  for (const car of world.cars) {
    if (car.parked || car.wrecked || car === world.player.car) continue;
    // Drive along the current road; at intersections, sometimes turn.
    const aheadX = car.x + Math.cos(car.angle) * 60, aheadY = car.y + Math.sin(car.angle) * 60;
    if (!isRoad(aheadX, aheadY)) {
      // Pick the turn that stays on a road.
      const options = [car.angle + Math.PI / 2, car.angle - Math.PI / 2, car.angle + Math.PI];
      for (const o of options) {
        if (isRoad(car.x + Math.cos(o) * 60, car.y + Math.sin(o) * 60)) { car.angle = o; break; }
      }
    }
    car.x = clampWorld(car.x + Math.cos(car.angle) * car.speed * dt);
    car.y = clampWorld(car.y + Math.sin(car.angle) * car.speed * dt);
    if (car.air > 0) car.air -= dt;
  }
}

export function stepPeds(world, dt) {
  const p = world.player;
  for (const ped of world.peds) {
    ped.retarget -= dt;
    if (ped.retarget <= 0) {
      ped.retarget = 2 + world.rng() * 4;
      ped.angle = world.rng() * Math.PI * 2;
    }
    let sp = ped.speed;
    if (ped.flee > 0) { ped.flee -= dt; sp = 120; }
    let nx = ped.x + Math.cos(ped.angle) * sp * dt;
    let ny = ped.y + Math.sin(ped.angle) * sp * dt;
    if (nx < 10 || nx > WORLD - 10 || ny < 10 || ny > WORLD - 10) { ped.angle += Math.PI; continue; }
    ped.x = nx; ped.y = ny;
    // Civilians scatter from gunfire and fast cars.
    if (p.car && Math.abs(p.car.speed) > 200 && Math.hypot(p.car.x - ped.x, p.car.y - ped.y) < 90) ped.flee = 1.2;
  }
}

// Building collision for a point with radius: returns pushed-out pos.
export function collideBuildings(world, x, y, r) {
  for (const b of world.buildings) {
    if (x > b.x - r && x < b.x + b.w + r && y > b.y - r && y < b.y + b.h + r) {
      const dxl = x - (b.x - r), dxr = (b.x + b.w + r) - x;
      const dyt = y - (b.y - r), dyb = (b.y + b.h + r) - y;
      const m = Math.min(dxl, dxr, dyt, dyb);
      if (m === dxl) x = b.x - r; else if (m === dxr) x = b.x + b.w + r;
      else if (m === dyt) y = b.y - r; else y = b.y + b.h + r;
    }
  }
  return { x: clampWorld(x), y: clampWorld(y) };
}

export function buildingAt(world, x, y) {
  return world.buildings.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) || null;
}

// % of the game completed, from real counters (map screen ring).
export function completionPct(world) {
  const coins = world.coins.filter(c => c.taken).length;
  const stashes = world.stashes.filter(s => s.taken).length;
  const turf = world.turf.filter(z => z.owner === 'player').length;
  const jumps = world.ramps.filter(r => r.done).length;
  const pct = (world.stats.missionsDone / 5) * 40 + (coins / 20) * 15 +
    (stashes / 12) * 10 + (turf / 5) * 15 + (world.stats.racesWon / 3) * 10 + (jumps / 5) * 10;
  return Math.round(pct * 10) / 10;
}

// ----------------------------------------------------------------
// Save slots (localStorage in the browser; in-memory under Node)
// ----------------------------------------------------------------

const memSlots = {};
function slotStore() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch (e) { /* headless or Node */ }
  return null;
}
export function saveToSlot(world, slot) {
  const data = serializeWorld(world);
  const ls = slotStore();
  if (ls) ls.setItem(SAVE_PREFIX + slot, JSON.stringify(data));
  else memSlots[slot] = data;
  return data;
}
export function readSlot(slot) {
  const ls = slotStore();
  if (ls) {
    const raw = ls.getItem(SAVE_PREFIX + slot);
    return raw ? JSON.parse(raw) : null;
  }
  return memSlots[slot] || null;
}
export function serializeWorld(world) {
  const p = world.player;
  return {
    money: p.money, rp: p.rp, hp: p.hp, armour: p.armour,
    ammo: p.ammo, clock: world.clock, missionsDone: world.stats.missionsDone,
    grades: world.grades, mods: world.mods, stats: world.stats,
    coins: world.coins.map(c => c.taken), stashes: world.stashes.map(s => s.taken),
    ramps: world.ramps.map(r => r.done), turf: world.turf.map(z => z.owner),
    pct: completionPct(world),
  };
}
export function applySave(world, data) {
  const p = world.player;
  p.money = data.money; p.rp = data.rp; p.hp = data.hp; p.armour = data.armour || 0;
  p.ammo = data.ammo; world.clock = data.clock;
  world.grades = data.grades || {}; world.mods = data.mods;
  Object.assign(world.stats, data.stats);
  data.coins.forEach((t, i) => { if (world.coins[i]) world.coins[i].taken = t; });
  data.stashes.forEach((t, i) => { if (world.stashes[i]) world.stashes[i].taken = t; });
  data.ramps.forEach((t, i) => { if (world.ramps[i]) world.ramps[i].done = t; });
  data.turf.forEach((o, i) => { if (world.turf[i]) world.turf[i].owner = o; });
}

export { rankFor };
