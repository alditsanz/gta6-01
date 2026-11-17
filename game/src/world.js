// SOLMAR HEAT — world.js
// The whole simulation: the city, its traffic and pedestrians, the player
// on foot and in cars, the wanted level and the police, combat, the three
// story missions, pickups, particles and the save file. No DOM here except
// localStorage; rendering lives in render.js.

import { CAR_TYPES, GAME, MISSIONS, PALETTE, PLACES, STREETS, WORLD, ROAD_HALF, LANE, DIALOGUE, VIEW_W, VIEW_H } from './config.js';
import { mulberry32, pick, range, rangeInt, clamp, dist, angleTo, angleDiff } from './random.js';

// ---------------------------------------------------------------- city ---

export function streetCoord(i) {
  return STREETS[i];
}

export function isOnRoad(x, y) {
  for (const s of STREETS) {
    if (Math.abs(x - s) < ROAD_HALF + 6) return true;
    if (Math.abs(y - s) < ROAD_HALF + 6) return true;
  }
  return false;
}

function buildCity(rng) {
  const buildings = [];
  const trees = [];
  const parkBlock = { col: 2, row: 5 }; // Marina Park: trees, no buildings
  const plazaBlock = { col: 5, row: 3 }; // Marina Plaza: open square
  for (let col = 0; col < STREETS.length - 1; col++) {
    for (let row = 0; row < STREETS.length - 1; row++) {
      const x0 = STREETS[col] + ROAD_HALF + 14;
      const y0 = STREETS[row] + ROAD_HALF + 14;
      const x1 = STREETS[col + 1] - ROAD_HALF - 14;
      const y1 = STREETS[row + 1] - ROAD_HALF - 14;
      if (col === parkBlock.col && row === parkBlock.row) {
        for (let t = 0; t < 16; t++) {
          trees.push({ x: range(rng, x0 + 10, x1 - 10), y: range(rng, y0 + 10, y1 - 10), r: range(rng, 9, 15) });
        }
        continue;
      }
      if (col === plazaBlock.col && row === plazaBlock.row) {
        for (let t = 0; t < 6; t++) {
          trees.push({ x: range(rng, x0 + 20, x1 - 20), y: range(rng, y0 + 20, y1 - 20), r: range(rng, 8, 12) });
        }
        continue;
      }
      // Beach strip: the last row is sand, no buildings.
      if (row === STREETS.length - 2) continue;
      const n = rangeInt(rng, 1, 3);
      const ci = Math.floor(rng() * PALETTE.buildingTop.length);
      for (let b = 0; b < n; b++) {
        const w = range(rng, 70, 150);
        const h = range(rng, 60, 130);
        const x = range(rng, x0, Math.max(x0 + 1, x1 - w));
        const y = range(rng, y0, Math.max(y0 + 1, y1 - h));
        buildings.push({
          x, y, w, h,
          hgt: range(rng, 18, 85),
          top: PALETTE.buildingTop[ci],
          side: PALETTE.buildingSide[ci],
        });
      }
      if (rng() < 0.5) {
        trees.push({ x: range(rng, x0, x1), y: range(rng, y0, y1), r: range(rng, 8, 13) });
      }
    }
  }
  return { buildings, trees };
}

// Road graph: intersections are the STREETS x STREETS crossings.
// Node id = row * 9 + col. Edges join neighbouring intersections.
export function nearestNode(x, y) {
  let bi = 0;
  let bj = 0;
  let bd = Infinity;
  for (let i = 0; i < STREETS.length; i++) {
    for (let j = 0; j < STREETS.length; j++) {
      const d = dist(x, y, STREETS[i], STREETS[j]);
      if (d < bd) { bd = d; bi = i; bj = j; }
    }
  }
  return { i: bi, j: bj, id: bj * STREETS.length + bi };
}

export function nodePos(id) {
  const n = STREETS.length;
  return { x: STREETS[id % n], y: STREETS[Math.floor(id / n)] };
}

export function neighbours(id) {
  const n = STREETS.length;
  const i = id % n;
  const j = Math.floor(id / n);
  const out = [];
  if (i > 0) out.push(id - 1);
  if (i < n - 1) out.push(id + 1);
  if (j > 0) out.push(id - n);
  if (j < n - 1) out.push(id + n);
  return out;
}

// Breadth-first path over the street grid, returned as node ids.
export function findPath(fromId, toId) {
  if (fromId === toId) return [fromId];
  const prev = new Map([[fromId, -1]]);
  const queue = [fromId];
  while (queue.length) {
    const cur = queue.shift();
    for (const nb of neighbours(cur)) {
      if (prev.has(nb)) continue;
      prev.set(nb, cur);
      if (nb === toId) {
        const path = [nb];
        let p = cur;
        while (p !== -1) { path.unshift(p); p = prev.get(p); }
        return path;
      }
      queue.push(nb);
    }
  }
  return [fromId];
}

// ------------------------------------------------------------- entities ---

function makeCar(rng, type, x, y, angle) {
  const spec = CAR_TYPES[type];
  return {
    kind: 'car', type, spec,
    color: pick(rng, spec.colors),
    x, y, angle, speed: 0,
    hp: 100, smoke: 0,
    driver: 'parked', // parked | traffic | player | police | none
    edge: null, edgeT: 0, cruise: range(rng, 120, 200),
    path: null, pathI: 0,
    brakeLight: false,
  };
}

function spawnTrafficCar(world, rng) {
  const types = ['sedan', 'sedan', 'coupe', 'taxi', 'van', 'truck', 'pickup'];
  const type = pick(rng, types);
  // Pick a street and a segment, drive along it.
  const horizontal = rng() < 0.5;
  const street = pick(rng, STREETS);
  const a = pick(rng, STREETS.slice(0, -1));
  const b = a + 400;
  const x = horizontal ? range(rng, a + 30, b - 30) : street;
  const y = horizontal ? street : range(rng, a + 30, b - 30);
  const angle = horizontal ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
  const car = makeCar(rng, type, x, y, angle);
  car.driver = 'traffic';
  // Lane offset: right-hand traffic.
  const nx = Math.cos(angle + Math.PI / 2) * LANE;
  const ny = Math.sin(angle + Math.PI / 2) * LANE;
  car.x += nx;
  car.y += ny;
  car.speed = car.cruise;
  return car;
}

function spawnPedestrian(world, rng) {
  const horizontal = rng() < 0.5;
  const street = pick(rng, STREETS);
  const along = range(rng, 100, WORLD - 100);
  const side = rng() < 0.5 ? -1 : 1;
  const off = ROAD_HALF + 12;
  return {
    kind: 'ped',
    x: horizontal ? along : street + side * off,
    y: horizontal ? street + side * off : along,
    angle: horizontal ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
    speed: range(rng, 28, 52),
    horizontal,
    shirt: pick(rng, ['#e84a3a', '#2e6fb0', '#e8b73a', '#1f8a5b', '#7d5ba6', '#d8d8d8', '#222831']),
    skin: pick(rng, ['#e8b88a', '#c98d5f', '#8a5a3b', '#f2c9a0']),
    flee: 0,
    dead: false,
    deadT: 0,
  };
}

function spawnCop(world, rng, inCar) {
  // Appear on a street a little way from the player, never on top of them.
  const p = world.player;
  for (let tries = 0; tries < 12; tries++) {
    const street = pick(rng, STREETS);
    const along = clamp(p.x + range(rng, -700, 700), 120, WORLD - 120);
    const along2 = clamp(p.y + range(rng, -700, 700), 120, WORLD - 120);
    const x = rng() < 0.5 ? along : street;
    const y = rng() < 0.5 ? street : along2;
    if (dist(x, y, p.x, p.y) < 320) continue;
    if (inCar) {
      const car = makeCar(rng, 'police', x, y, angleTo(x, y, p.x, p.y));
      car.driver = 'police';
      car.path = findPath(nearestNode(x, y).id, nearestNode(p.x, p.y).id);
      car.pathI = 1;
      return { kind: 'copcar', car, bustTimer: 0 };
    }
    return { kind: 'cop', x, y, angle: angleTo(x, y, p.x, p.y), speed: 0, bustTimer: 0 };
  }
  return null;
}

// --------------------------------------------------------------- world ----

export function createWorld(seed) {
  const rng = mulberry32(seed);
  const city = buildCity(rng);
  const world = {
    seed,
    time: 17.35, // 5:21 pm — golden hour
    clock: 0,
    city,
    cars: [],
    peds: [],
    cops: [],
    gang: [],
    bullets: [],
    particles: [],
    pickups: [],
    player: {
      x: PLACES.safehouse.x, y: PLACES.safehouse.y + 60,
      angle: -Math.PI / 2, hp: GAME.playerMaxHp, money: 0,
      ammo: GAME.pistolAmmo, reloading: 0,
      inCar: null, wanted: 0, wantedTimer: 0,
      punchCd: 0, shootCd: 0, hurtFlash: 0,
    },
    missionIndex: 0,
    missionStep: 0,
    missionState: 'idle', // idle | active | done-banner | complete
    waitTimer: 0,
    banner: null, // {title, sub, t}
    messages: [],
    stats: { kills: 0, carsStolen: 0, shotsFired: 0, missionsDone: 0, busted: 0, wasted: 0 },
    screen: 'title',
    camera: { x: PLACES.safehouse.x, y: PLACES.safehouse.y + 60 },
    saveExists: false,
    storyDone: false,
    toast: null,
  };
  // The mission car: a Vento Coupe waiting at Marina Plaza.
  const missionCar = makeCar(rng, 'coupe', PLACES.plaza.x - 40, PLACES.plaza.y + 30, Math.PI / 2);
  missionCar.driver = 'parked';
  missionCar.missionCar = true;
  missionCar.color = '#e84a3a'; // Rex's Vento is always red: easy to spot.
  world.cars.push(missionCar);
  for (let i = 0; i < GAME.parkedCars; i++) {
    const c = spawnParkedCar(world, rng);
    if (c) world.cars.push(c);
  }
  for (let i = 0; i < GAME.trafficCars; i++) world.cars.push(spawnTrafficCar(world, rng));
  for (let i = 0; i < GAME.pedestrians; i++) world.peds.push(spawnPedestrian(world, rng));
  // Cash pickups scattered around town.
  for (let i = 0; i < 10; i++) {
    world.pickups.push({
      kind: 'cash',
      x: range(rng, 150, WORLD - 150),
      y: range(rng, 150, WORLD - 150),
      bob: rng() * Math.PI * 2,
    });
  }
  world.pickups.push({ kind: 'health', x: PLACES.hospital.x + 40, y: PLACES.hospital.y + 40, bob: 0 });
  world.pickups.push({ kind: 'ammo', x: PLACES.safehouse.x - 60, y: PLACES.safehouse.y + 40, bob: 1 });
  return world;
}

function spawnParkedCar(world, rng) {
  const types = ['sedan', 'coupe', 'sports', 'van', 'pickup', 'sedan'];
  for (let tries = 0; tries < 20; tries++) {
    const horizontal = rng() < 0.5;
    const street = pick(rng, STREETS);
    const along = range(rng, 150, WORLD - 150);
    const side = rng() < 0.5 ? -1 : 1;
    const off = ROAD_HALF - 12;
    const x = horizontal ? along : street + side * off;
    const y = horizontal ? street + side * off : along;
    if (collidesBuilding(world, x, y, 26)) continue;
    if (world.cars.some((c) => dist(c.x, c.y, x, y) < 70)) continue;
    const car = makeCar(rng, pick(rng, types), x, y, horizontal ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2));
    car.driver = 'parked';
    return car;
  }
  return null;
}

export function collidesBuilding(world, x, y, r) {
  for (const b of world.city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

export function mission() {
  return MISSIONS;
}

export function currentMission(world) {
  return world.missionIndex < MISSIONS.length ? MISSIONS[world.missionIndex] : null;
}

export function currentStep(world) {
  const m = currentMission(world);
  return m ? m.steps[world.missionStep] : null;
}

export function addMessage(world, text) {
  world.messages.push({ text, t: 5 });
  if (world.messages.length > 3) world.messages.shift();
}

export function addWanted(world, n, reason) {
  const p = world.player;
  p.wanted = clamp(p.wanted + n, 0, GAME.maxWanted);
  p.wantedTimer = 0;
  if (reason) addMessage(world, reason);
}

// -------------------------------------------------------------- saving ----

export function saveGame(world) {
  try {
    const p = world.player;
    localStorage.setItem(GAME.saveKey, JSON.stringify({
      money: p.money, hp: p.hp,
      x: p.x, y: p.y,
      missionIndex: world.missionIndex, missionStep: world.missionStep,
      storyDone: world.storyDone,
      time: world.time,
      stats: world.stats,
    }));
    world.saveExists = true;
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(GAME.saveKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function applySave(world, save) {
  const p = world.player;
  p.money = save.money || 0;
  p.hp = save.hp || GAME.playerMaxHp;
  p.x = save.x ?? p.x;
  p.y = save.y ?? p.y;
  world.missionIndex = save.missionIndex || 0;
  world.missionStep = save.missionStep || 0;
  world.storyDone = !!save.storyDone;
  world.time = save.time || 17.35;
  if (save.stats) world.stats = { ...world.stats, ...save.stats };
  world.camera.x = p.x;
  world.camera.y = p.y;
  world.missionState = 'active';
}

// --------------------------------------------------------------- step -----

export function startMission(world, audio) {
  const m = currentMission(world);
  if (!m) return;
  world.missionState = 'active';
  world.missionStep = 0;
  world.waitTimer = 0;
  world.stepFlags = {};
  addMessage(world, m.intro);
  if (audio) audio.jingle();
}

export function completeMission(world, audio) {
  const m = currentMission(world);
  world.stats.missionsDone++;
  world.player.money += m.reward;
  world.missionState = 'done-banner';
  world.banner = { title: 'MISSION PASSED', sub: `${m.title}  •  +$${m.reward}`, t: 4 };
  addMessage(world, m.outro);
  if (audio) audio.jingle();
  saveGame(world);
  world.missionIndex++;
  world.missionStep = 0;
  world.waitTimer = 0;
  if (world.missionIndex >= MISSIONS.length) {
    world.storyDone = true;
  }
}

function advanceStep(world, audio) {
  const m = currentMission(world);
  if (!m) return;
  world.missionStep++;
  world.waitTimer = 0;
  if (world.missionStep >= m.steps.length) {
    completeMission(world, audio);
  }
}

function stepMission(world, audio, dt) {
  if (world.missionState !== 'active') return;
  const step = currentStep(world);
  if (!step) return;
  const p = world.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  if (step.kind === 'goto' || step.kind === 'drive') {
    if (dist(px, py, step.x, step.y) < step.radius) advanceStep(world, audio);
  } else if (step.kind === 'steal') {
    if (p.inCar) advanceStep(world, audio);
  } else if (step.kind === 'wait') {
    if (dist(px, py, step.x, step.y) < step.radius) {
      world.waitTimer += dt;
      if (world.waitTimer >= (step.wait || 2)) advanceStep(world, audio);
    } else {
      world.waitTimer = Math.max(0, world.waitTimer - dt * 2);
    }
  } else if (step.kind === 'escape') {
    if (dist(px, py, step.x, step.y) < step.radius) {
      p.wanted = 0;
      world.cops.length = 0;
      advanceStep(world, audio);
    }
  }
  // A step that starts with a wanted level sets it once, when the step begins.
  // Flags live on the world, never on the shared MISSIONS constants.
  world.stepFlags = world.stepFlags || {};
  const flagKey = `${world.missionIndex}:${world.missionStep}`;
  if (step.wantedOnStart && !world.stepFlags[flagKey + ':wanted']) {
    world.stepFlags[flagKey + ':wanted'] = true;
    p.wanted = Math.max(p.wanted, step.wantedOnStart);
    p.wantedTimer = 0;
    addMessage(world, 'The cops are onto you!');
  }
  if (step.spawnGang && !world.stepFlags[flagKey + ':gang']) {
    world.stepFlags[flagKey + ':gang'] = true;
    spawnGang(world, step.spawnGang);
  }
}

function spawnGang(world, count) {
  const rng = mulberry32(world.seed + world.missionIndex * 97 + 13);
  const p = world.player;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    world.gang.push({
      x: p.x + Math.cos(a) * range(rng, 180, 320),
      y: p.y + Math.sin(a) * range(rng, 180, 320),
      angle: 0, hp: 3, shootCd: range(rng, 0.5, 1.5), moveCd: 0,
    });
  }
  addMessage(world, 'Harbor Boys! They are shooting at you!');
}

// Move a point, sliding along building walls instead of passing through.
function moveWithCollision(world, x, y, dx, dy, r) {
  let nx = x + dx;
  let ny = y + dy;
  nx = clamp(nx, 20, WORLD - 20);
  ny = clamp(ny, 20, WORLD - 20);
  if (!collidesBuilding(world, nx, y, r)) x = nx;
  if (!collidesBuilding(world, x, ny, r)) y = ny;
  return { x, y };
}

function carCollides(world, car, nx, ny) {
  if (collidesBuilding(world, nx, ny, car.spec.len * 0.42)) return true;
  const fx = nx + Math.cos(car.angle) * car.spec.len * 0.5;
  const fy = ny + Math.sin(car.angle) * car.spec.len * 0.5;
  if (collidesBuilding(world, fx, fy, 10)) return true;
  return false;
}

function stepPlayer(world, input, audio, dt, mouseWorld) {
  const p = world.player;
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.shootCd = Math.max(0, p.shootCd - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);
  if (p.reloading > 0) {
    p.reloading -= dt;
    if (p.reloading <= 0) p.ammo = GAME.pistolAmmo;
  }

  if (p.inCar) {
    stepPlayerCar(world, input, audio, dt);
    return;
  }

  // On foot: WASD moves, Shift sprints, mouse aims the pistol.
  const ax = input.axisX();
  const ay = input.axisY();
  const sprint = input.down('shift');
  const speed = sprint ? GAME.playerSprint : GAME.playerWalk;
  if (ax !== 0 || ay !== 0) {
    const len = Math.hypot(ax, ay);
    const moved = moveWithCollision(world, p.x, p.y, (ax / len) * speed * dt, (ay / len) * speed * dt, GAME.playerRadius);
    p.x = moved.x;
    p.y = moved.y;
    p.angle = Math.atan2(ay, ax);
  }
  // Aim at the mouse.
  p.aimAngle = angleTo(p.x, p.y, mouseWorld.x, mouseWorld.y);
  // Enter / steal a car.
  if (input.wasPressed('e')) enterNearestCar(world, audio);
  // Shoot with the mouse, punch with F.
  if (input.mouse.clicked && p.shootCd <= 0 && p.reloading <= 0) {
    fireBullet(world, audio, p.x, p.y, p.aimAngle, 'player');
    p.shootCd = 0.22;
    p.ammo--;
    world.stats.shotsFired++;
    if (p.ammo <= 0) p.reloading = GAME.pistolReloadSecs;
  }
  if (input.wasPressed('f') && p.punchCd <= 0) {
    p.punchCd = 0.45;
    punch(world, audio);
  }
  if (input.wasPressed('r') && p.ammo < GAME.pistolAmmo && p.reloading <= 0) {
    p.reloading = GAME.pistolReloadSecs;
  }
}

function enterNearestCar(world, audio) {
  const p = world.player;
  let best = null;
  let bestD = 70;
  for (const car of world.cars) {
    if (car.driver === 'traffic') continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) return;
  const wasParked = best.driver === 'parked';
  best.driver = 'player';
  best.path = null;
  p.inCar = best;
  p.x = best.x;
  p.y = best.y;
  if (audio) audio.door();
  if (wasParked) {
    world.stats.carsStolen++;
    // Stealing in front of a cop or a crowd gets the law involved.
    const witnessed = world.cops.length > 0 ||
      world.peds.some((ped) => !ped.dead && dist(ped.x, ped.y, p.x, p.y) < 220);
    if (witnessed) addWanted(world, 1, DIALOGUE.stealSeen);
  }
}

function exitCar(world, audio) {
  const p = world.player;
  const car = p.inCar;
  if (!car) return;
  car.driver = 'parked';
  car.speed = 0;
  const side = Math.cos(car.angle + Math.PI / 2);
  const sideY = Math.sin(car.angle + Math.PI / 2);
  p.x = car.x + side * 30;
  p.y = car.y + sideY * 30;
  const moved = moveWithCollision(world, p.x, p.y, 0, 0, GAME.playerRadius);
  p.x = moved.x;
  p.y = moved.y;
  p.inCar = null;
  if (audio) audio.door();
}

function stepPlayerCar(world, input, audio, dt) {
  const p = world.player;
  const car = p.inCar;
  const spec = car.spec;
  const fwd = input.down('w', 'arrowup');
  const back = input.down('s', 'arrowdown');
  const steer = input.axisX();
  const brake = input.down(' ');
  if (fwd) car.speed += spec.accel * dt;
  if (back) car.speed -= (car.speed > 5 ? spec.accel * 0.8 : spec.accel * 0.4) * dt;
  if (!fwd && !back) car.speed -= Math.sign(car.speed) * 140 * dt;
  if (brake) car.speed -= Math.sign(car.speed) * 620 * dt;
  car.speed = clamp(car.speed, -140, spec.maxSpeed);
  if (Math.abs(car.speed) < 4 && !fwd && !back) car.speed = 0;
  const turn = steer * spec.grip * dt * clamp(Math.abs(car.speed) / 120, 0, 1) * (car.speed >= 0 ? 1 : -1);
  car.angle += turn * (brake ? 1.35 : 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (carCollides(world, car, nx, ny)) {
    car.speed *= -0.25;
    car.hp -= Math.abs(car.speed) * 0.02 + 1;
    if (car.hp < 50) car.smoke = 1;
    spawnSparks(world, nx, ny, 6);
  } else {
    car.x = clamp(nx, 20, WORLD - 20);
    car.y = clamp(ny, 20, WORLD - 20);
  }
  // Shove traffic and peds out of the way; running someone over is a crime.
  for (const other of world.cars) {
    if (other === car || other.driver === 'player') continue;
    if (dist(other.x, other.y, car.x, car.y) < 44 && Math.abs(car.speed) > 60) {
      const a = angleTo(car.x, car.y, other.x, other.y);
      other.x += Math.cos(a) * 60 * dt * 4;
      other.y += Math.sin(a) * 60 * dt * 4;
      other.speed = 0;
      if (other.driver === 'traffic') {
        other.driver = 'parked';
        const ped = spawnPedestrian(world, mulberry32((Math.random() * 1e9) | 0));
        ped.x = other.x + 20;
        ped.y = other.y + 20;
        ped.flee = 3;
        world.peds.push(ped);
        addWanted(world, 1, 'You hit a driver! They called the cops.');
      }
    }
  }
  for (const ped of world.peds) {
    if (ped.dead) continue;
    if (dist(ped.x, ped.y, car.x, car.y) < 30 && Math.abs(car.speed) > 40) {
      killPed(world, ped, true);
    } else if (dist(ped.x, ped.y, car.x, car.y) < 90) {
      ped.flee = 2;
    }
  }
  if (input.wasPressed('e')) exitCar(world, audio);
  if (car.hp <= 0) {
    spawnSparks(world, car.x, car.y, 20);
    exitCar(world, audio);
    car.driver = 'none';
    car.hp = 0;
    addMessage(world, 'That car is wrecked. Find another one.');
  }
  p.x = car.x;
  p.y = car.y;
}

function punch(world, audio) {
  const p = world.player;
  if (audio) audio.punch();
  const hx = p.x + Math.cos(p.aimAngle) * GAME.punchRange;
  const hy = p.y + Math.sin(p.aimAngle) * GAME.punchRange;
  for (const ped of world.peds) {
    if (ped.dead) continue;
    if (dist(ped.x, ped.y, hx, hy) < 30) {
      ped.flee = 4;
      addWanted(world, 1, 'Assault! A witness called the cops.');
      spawnSparks(world, ped.x, ped.y, 4);
      return;
    }
  }
  for (const cop of world.cops) {
    if (cop.kind !== 'cop') continue;
    if (dist(cop.x, cop.y, hx, hy) < 32) {
      world.cops.splice(world.cops.indexOf(cop), 1);
      addWanted(world, 2, DIALOGUE.copDown);
      world.stats.kills++;
      return;
    }
  }
}

function fireBullet(world, audio, x, y, angle, from) {
  world.bullets.push({ x, y, angle, from, life: GAME.pistolRange / GAME.bulletSpeed });
  if (audio && from === 'player') audio.shoot();
}

function killPed(world, ped, byCar) {
  ped.dead = true;
  ped.deadT = 0;
  world.stats.kills++;
  addWanted(world, byCar ? 1 : 2, DIALOGUE.pedDown);
  spawnSparks(world, ped.x, ped.y, 8);
}

export function spawnSparks(world, x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    world.particles.push({
      x, y,
      vx: Math.cos(a) * (40 + Math.random() * 120),
      vy: Math.sin(a) * (40 + Math.random() * 120),
      life: 0.4 + Math.random() * 0.3, maxLife: 0.7,
      color: '#ffd76a', size: 2 + Math.random() * 2,
    });
  }
}

function stepBullets(world, audio, dt) {
  const p = world.player;
  for (let i = world.bullets.length - 1; i >= 0; i--) {
    const b = world.bullets[i];
    b.x += Math.cos(b.angle) * GAME.bulletSpeed * dt;
    b.y += Math.sin(b.angle) * GAME.bulletSpeed * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && collidesBuilding(world, b.x, b.y, 2)) {
      spawnSparks(world, b.x, b.y, 3);
      dead = true;
    }
    if (!dead && b.from === 'player') {
      for (const ped of world.peds) {
        if (!ped.dead && dist(ped.x, ped.y, b.x, b.y) < 16) { killPed(world, ped, false); dead = true; break; }
      }
      if (!dead) for (const cop of world.cops) {
        if (cop.kind === 'cop' && dist(cop.x, cop.y, b.x, b.y) < 16) {
          world.cops.splice(world.cops.indexOf(cop), 1);
          addWanted(world, 2, DIALOGUE.copDown);
          world.stats.kills++;
          dead = true;
          break;
        }
        if (cop.kind === 'copcar' && dist(cop.car.x, cop.car.y, b.x, b.y) < 26) {
          cop.car.hp -= GAME.pistolDamage;
          if (cop.car.hp <= 0) {
            world.cops.splice(world.cops.indexOf(cop), 1);
            addWanted(world, 2, DIALOGUE.copDown);
            spawnSparks(world, cop.car.x, cop.car.y, 18);
          }
          dead = true;
          break;
        }
      }
      if (!dead) for (const g of world.gang) {
        if (dist(g.x, g.y, b.x, b.y) < 16) {
          g.hp--;
          spawnSparks(world, g.x, g.y, 4);
          if (g.hp <= 0) {
            world.gang.splice(world.gang.indexOf(g), 1);
            world.stats.kills++;
            addMessage(world, 'Harbor Boy down.');
          }
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.from === 'enemy') {
      const tx = p.inCar ? p.inCar.x : p.x;
      const ty = p.inCar ? p.inCar.y : p.y;
      if (dist(tx, ty, b.x, b.y) < (p.inCar ? 26 : 16)) {
        hurtPlayer(world, audio, 9);
        dead = true;
      }
    }
    if (dead) world.bullets.splice(i, 1);
  }
}

export function hurtPlayer(world, audio, dmg) {
  const p = world.player;
  p.hp -= dmg;
  p.hurtFlash = 0.35;
  if (audio) audio.hurt();
  if (p.hp <= 30 && p.hp > 0) addMessage(world, DIALOGUE.lowHp);
  if (p.hp <= 0) {
    p.hp = GAME.playerMaxHp;
    world.stats.wasted++;
    if (p.inCar) exitCar(world, null);
    p.x = PLACES.hospital.x;
    p.y = PLACES.hospital.y + 60;
    p.wanted = 0;
    world.cops.length = 0;
    world.gang.length = 0;
    world.screen = 'wasted';
    world.banner = { title: 'WASTED', sub: DIALOGUE.wasted, t: 4 };
    if (audio) audio.fail();
  }
}

// -------------------------------------------------------------- traffic ---

function stepTraffic(world, dt) {
  const p = world.player;
  for (let i = world.cars.length - 1; i >= 0; i--) {
    const car = world.cars[i];
    if (car.driver !== 'traffic') continue;
    // Drive along the street; at each intersection pick a new direction.
    car.speed = car.cruise;
    let nx = car.x + Math.cos(car.angle) * car.speed * dt;
    let ny = car.y + Math.sin(car.angle) * car.speed * dt;
    // Approaching an intersection? Decide the turn there.
    const node = nearestNode(nx, ny);
    const np = nodePos(node.id);
    if (dist(nx, ny, np.x, np.y) < 26 && dist(car.x, car.y, np.x, np.y) >= 26) {
      const options = neighbours(node.id).map((id) => nodePos(id));
      const next = options[Math.floor(Math.random() * options.length)];
      const targetAngle = angleTo(np.x, np.y, next.x, next.y);
      car.angle = targetAngle;
      const off = LANE;
      nx = np.x + Math.cos(targetAngle + Math.PI / 2) * off;
      ny = np.y + Math.sin(targetAngle + Math.PI / 2) * off;
    }
    car.x = nx;
    car.y = ny;
    // Wrap around the city edge so traffic never runs out.
    if (car.x < 60 || car.x > WORLD - 60 || car.y < 60 || car.y > WORLD - 60) {
      world.cars[i] = spawnTrafficCar(world, mulberry32((Math.random() * 1e9) | 0));
    }
    // Slow down for the player's car ahead.
    if (p.inCar && dist(car.x, car.y, p.inCar.x, p.inCar.y) < 90) car.speed = Math.min(car.speed, 60);
  }
  // Keep the traffic count topped up.
  const trafficCount = world.cars.filter((c) => c.driver === 'traffic').length;
  for (let i = trafficCount; i < GAME.trafficCars; i++) {
    world.cars.push(spawnTrafficCar(world, mulberry32((Math.random() * 1e9) | 0)));
  }
}

function stepPeds(world, dt) {
  const p = world.player;
  for (let i = world.peds.length - 1; i >= 0; i--) {
    const ped = world.peds[i];
    if (ped.dead) {
      ped.deadT += dt;
      if (ped.deadT > 12) world.peds.splice(i, 1);
      continue;
    }
    if (ped.flee > 0) {
      ped.flee -= dt;
      const a = angleTo(p.x, p.y, p.x, p.y) + Math.PI;
      const moved = moveWithCollision(world, ped.x, ped.y, Math.cos(a) * 150 * dt, Math.sin(a) * 150 * dt, 10);
      ped.x = moved.x;
      ped.y = moved.y;
      ped.angle = a;
      continue;
    }
    // Stroll along the sidewalk; turn at intersections.
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    const node = nearestNode(ped.x, ped.y);
    const np = nodePos(node.id);
    if (dist(ped.x, ped.y, np.x, np.y) < 30 && Math.random() < 0.3) {
      const options = neighbours(node.id).map((id) => nodePos(id));
      const next = options[Math.floor(Math.random() * options.length)];
      ped.angle = angleTo(np.x, np.y, next.x, next.y);
      ped.horizontal = Math.abs(Math.cos(ped.angle)) > 0.5;
    }
    if (ped.x < 60 || ped.x > WORLD - 60 || ped.y < 60 || ped.y > WORLD - 60) {
      world.peds[i] = spawnPedestrian(world, mulberry32((Math.random() * 1e9) | 0));
    }
    // Flee gunfire.
    if (world.bullets.length && dist(ped.x, ped.y, p.x, p.y) < 260) ped.flee = 1.5;
  }
  const alive = world.peds.filter((x) => !x.dead).length;
  for (let i = alive; i < GAME.pedestrians; i++) {
    world.peds.push(spawnPedestrian(world, mulberry32((Math.random() * 1e9) | 0)));
  }
}

// --------------------------------------------------------------- police ---

function stepPolice(world, audio, dt) {
  const p = world.player;
  // Wanted level decays when the player stays clean.
  if (p.wanted > 0) {
    p.wantedTimer += dt;
    if (p.wantedTimer > GAME.wantedDecaySecs) {
      p.wanted--;
      p.wantedTimer = 0;
      if (p.wanted === 0) {
        world.cops.length = 0;
        addMessage(world, 'You lost the cops. Lay low.');
      }
    }
  }
  const wantFoot = Math.min(p.wanted, 3);
  const wantCars = p.wanted >= 2 ? Math.min(p.wanted - 1, 3) : 0;
  // Trim the excess when the wanted level has dropped.
  const footCops = world.cops.filter((c) => c.kind === 'cop');
  const carCops = world.cops.filter((c) => c.kind === 'copcar');
  for (let i = footCops.length - 1; i >= wantFoot; i--) {
    world.cops.splice(world.cops.indexOf(footCops[i]), 1);
  }
  for (let i = carCops.length - 1; i >= wantCars; i--) {
    world.cops.splice(world.cops.indexOf(carCops[i]), 1);
  }
  const foot = world.cops.filter((c) => c.kind === 'cop').length;
  const cars = world.cops.filter((c) => c.kind === 'copcar').length;
  const rng = mulberry32((world.clock * 1000) | 0);
  for (let i = foot; i < wantFoot; i++) {
    const cop = spawnCop(world, rng, false);
    if (cop) world.cops.push(cop);
  }
  for (let i = cars; i < wantCars; i++) {
    const cop = spawnCop(world, rng, true);
    if (cop) world.cops.push(cop);
  }
  for (let i = world.cops.length - 1; i >= 0; i--) {
    const cop = world.cops[i];
    if (cop.kind === 'cop') {
      const target = p.inCar ? p.inCar : p;
      const d = dist(cop.x, cop.y, target.x, target.y);
      cop.angle = angleTo(cop.x, cop.y, target.x, target.y);
      const speed = p.wanted >= 3 ? 205 : 175;
      const moved = moveWithCollision(world, cop.x, cop.y, Math.cos(cop.angle) * speed * dt, Math.sin(cop.angle) * speed * dt, 11);
      cop.x = moved.x;
      cop.y = moved.y;
      // Bust: a cop standing next to the player on foot arrests them.
      if (!p.inCar && d < 30) {
        cop.bustTimer += dt;
        if (cop.bustTimer > GAME.bustSeconds) {
          bustPlayer(world, audio);
          return;
        }
      } else {
        cop.bustTimer = 0;
      }
      if (d > 1400) world.cops.splice(i, 1);
    } else {
      const car = cop.car;
      const targetNode = nearestNode(p.x, p.y).id;
      const carNode = nearestNode(car.x, car.y).id;
      if (!car.path || car.pathI >= car.path.length || car.path[car.path.length - 1] !== targetNode) {
        car.path = findPath(carNode, targetNode);
        car.pathI = 1;
      }
      const nextNode = nodePos(car.path[Math.min(car.pathI, car.path.length - 1)]);
      const dNode = dist(car.x, car.y, nextNode.x, nextNode.y);
      if (dNode < 30) car.pathI++;
      const wantAngle = angleTo(car.x, car.y, nextNode.x, nextNode.y);
      car.angle += clamp(angleDiff(car.angle, wantAngle), -2.4 * dt, 2.4 * dt);
      car.speed = clamp(car.speed + car.spec.accel * dt, 0, car.spec.maxSpeed);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      if (!carCollides(world, car, nx, ny)) {
        car.x = nx;
        car.y = ny;
      } else {
        car.speed *= 0.4;
      }
      const d = dist(car.x, car.y, p.x, p.y);
      if (p.inCar && d < 64 && Math.abs(p.inCar.speed) < 30) {
        cop.bustTimer += dt;
        if (cop.bustTimer > GAME.bustSeconds) {
          bustPlayer(world, audio);
          return;
        }
      } else {
        cop.bustTimer = 0;
      }
      if (d > 1600) world.cops.splice(i, 1);
    }
  }
  if (audio) audio.setSiren(p.wanted > 0);
}

function bustPlayer(world, audio) {
  const p = world.player;
  world.stats.busted++;
  const fine = Math.min(GAME.bustFine, p.money);
  p.money -= fine;
  p.wanted = 0;
  world.cops.length = 0;
  world.gang.length = 0;
  if (p.inCar) exitCar(world, null);
  p.x = PLACES.safehouse.x;
  p.y = PLACES.safehouse.y + 60;
  world.screen = 'busted';
  world.banner = { title: 'BUSTED', sub: `${DIALOGUE.busted} (fine $${fine})`, t: 4 };
  if (audio) audio.bust();
}

// ----------------------------------------------------------------- gang ---

function stepGang(world, audio, dt) {
  const p = world.player;
  for (const g of world.gang) {
    const d = dist(g.x, g.y, p.x, p.y);
    g.angle = angleTo(g.x, g.y, p.x, p.y);
    g.shootCd -= dt;
    g.moveCd -= dt;
    if (d > 320) {
      const moved = moveWithCollision(world, g.x, g.y, Math.cos(g.angle) * 120 * dt, Math.sin(g.angle) * 120 * dt, 11);
      g.x = moved.x;
      g.y = moved.y;
    } else if (g.moveCd <= 0) {
      // Strafe sideways so they are not standing targets.
      const strafe = g.angle + Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1);
      const moved = moveWithCollision(world, g.x, g.y, Math.cos(strafe) * 70 * dt, Math.sin(strafe) * 70 * dt, 11);
      g.x = moved.x;
      g.y = moved.y;
      g.moveCd = 0.8 + Math.random() * 0.8;
    }
    if (g.shootCd <= 0 && d < 460) {
      g.shootCd = 1.4 + Math.random() * 0.8;
      const spread = (Math.random() - 0.5) * 0.22;
      fireBullet(world, null, g.x, g.y, g.angle + spread, 'enemy');
    }
  }
}

// -------------------------------------------------------------- pickups ----

function stepPickups(world, audio, dt) {
  const p = world.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  for (let i = world.pickups.length - 1; i >= 0; i--) {
    const pk = world.pickups[i];
    pk.bob += dt * 3;
    if (dist(pk.x, pk.y, px, py) < 34) {
      if (pk.kind === 'cash') {
        p.money += GAME.cashPickupValue;
        addMessage(world, `+$${GAME.cashPickupValue} street cash`);
        if (audio) audio.cash();
      } else if (pk.kind === 'health') {
        p.hp = Math.min(GAME.playerMaxHp, p.hp + 50);
        addMessage(world, 'Patched up (+50 HP)');
        if (audio) audio.pickup();
      } else if (pk.kind === 'ammo') {
        p.ammo = GAME.pistolAmmo;
        p.reloading = 0;
        addMessage(world, 'Ammo restocked');
        if (audio) audio.pickup();
      }
      if (pk.kind === 'cash') {
        world.pickups.splice(i, 1);
        const rng = mulberry32((world.clock * 7919) | 0);
        world.pickups.push({ kind: 'cash', x: range(rng, 150, WORLD - 150), y: range(rng, 150, WORLD - 150), bob: 0 });
      }
    }
  }
}

// ----------------------------------------------------------------- main ---

export function stepWorld(world, input, audio, dt, mouseWorld) {
  world.clock += dt;
  world.time += dt / 210; // one game hour per ~3.5 real minutes
  if (world.time >= 24) world.time -= 24;
  if (world.banner) {
    world.banner.t -= dt;
    if (world.banner.t <= 0) {
      world.banner = null;
      if (world.missionState === 'done-banner') {
        world.missionState = currentMission(world) ? 'active' : 'idle';
        if (currentMission(world)) startMission(world, audio);
        else if (world.storyDone) {
          world.screen = 'complete';
        }
      }
    }
  }
  for (const m of world.messages) m.t -= dt;
  world.messages = world.messages.filter((m) => m.t > 0);
  if (world.screen !== 'play') return;

  stepPlayer(world, input, audio, dt, mouseWorld);
  stepTraffic(world, dt);
  stepPeds(world, dt);
  stepPolice(world, audio, dt);
  stepGang(world, audio, dt);
  stepBullets(world, audio, dt);
  stepPickups(world, audio, dt);
  stepMission(world, audio, dt);

  for (let i = world.particles.length - 1; i >= 0; i--) {
    const pt = world.particles[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
    if (pt.life <= 0) world.particles.splice(i, 1);
  }
  // Smoking wrecks keep smoking.
  for (const car of world.cars) {
    if (car.smoke && Math.random() < dt * 8) {
      world.particles.push({
        x: car.x + (Math.random() - 0.5) * 20, y: car.y + (Math.random() - 0.5) * 14,
        vx: 0, vy: -30 - Math.random() * 20, life: 0.8, maxLife: 0.8,
        color: '#555555', size: 5 + Math.random() * 4,
      });
    }
  }
  // Camera follows the player (or their car).
  const p = world.player;
  const tx = clamp(p.x, VIEW_W / 2 - 400, WORLD - VIEW_W / 2 + 400);
  const ty = clamp(p.y, VIEW_H / 2 - 400, WORLD - VIEW_H / 2 + 400);
  world.camera.x += (tx - world.camera.x) * Math.min(1, dt * 5);
  world.camera.y += (ty - world.camera.y) * Math.min(1, dt * 5);
  if (audio) {
    const driving = !!p.inCar;
    audio.setEngine(driving ? Math.abs(p.inCar.speed) / p.inCar.spec.maxSpeed : 0, driving);
  }
}
