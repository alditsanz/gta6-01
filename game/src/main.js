// Solmar Heat — main.js
// One job: the game itself. State, the loop, movement, driving, police,
// missions, side jobs, turf wars, the clock, weather and the save.
// Rendering lives in render.js; rules live in the small modules.

import { WORLD_SIZE, ROADS, CARS, SAVE_KEY, SAVE_VERSION, PLAYER, CAR, WANTED, CLOCK, WEATHER_CYCLE_SECONDS, BASE_PEDESTRIANS } from './config.js';
import { makeRng, randRange, randPick, randInt, clamp, distance, angleTo } from './random.js';
import { createInput } from './input.js';
import { clampToWorld, districtAt, trafficDensityForHour, trafficTargetForHour, skyPhase, gripForWeather, starsForHeat, addHeat, decayHeat, heatBandMid, bfsNextStep, nearestNode, nodePosition, damageCar, carIsTotaled, canStealCar } from './world.js';
import { LANDMARKS, landmarkByKind, landmarkCenter, insidePaintShop, pointInCanal, onCanalBridge, ledgerSpot, marinaEscapeSpot, pierSpot } from './landmarks.js';
import { COINS, collectCoinAt, serializeCoins, deserializeCoins, AMMO_PICKUPS, ammoPickupNear } from './collectibles.js';
import { createBullet, stepBullet, bulletHitsTarget, createGuard, damageGuard, punchHits, canReload, reloadAmmo } from './combat.js';
import { farePayout, makeFare, RACES, raceById, raceNearStart, raceCheckpointReached, makeDelivery, deliveryHeatGain, TURF_ZONES, PLAYER_CREW, TURF_CHALLENGE_SECONDS, TURF_RIVALS_PER_CHALLENGE, turfZoneAt, turfHeldCount, turfIncomePerHour, allTurfHeld, defaultTurfOwners, NEAR_MISS_MIN_SPEED, NEAR_MISS_RADIUS, NEAR_MISS_COOLDOWN, PAINT_COLOURS, nextPaintIndex, paintByIndex, canAffordRepaint, nearMissEligible } from './sidejobs.js';
import { MISSIONS, missionById, missionStage, jobSevenTotal, nextUnfinishedMission, storyComplete } from './missions.js';
import { createAudio } from './audio.js';
import { drawFrame, screenButtons, CANVAS_W, CANVAS_H } from './render.js';
import { shotFromUrl, applyShot } from './shots.js';

// ---------------------------------------------------------------- world build

function buildCityLayout() {
  const rng = makeRng(1337);
  const buildings = [];
  const trees = [];
  const parks = [];
  const parkBlocks = new Set(['1,1', '6,4']);
  const palette = ['#b08a5a', '#8a7a6a', '#a08a9a', '#7a8a9a', '#9a6a5a', '#6a7a6a'];
  for (let bx = 0; bx < 8; bx++) {
    for (let by = 0; by < 8; by++) {
      const x0 = ROADS[bx] + 26;
      const x1 = ROADS[bx + 1] - 26;
      const y0 = ROADS[by] + 26;
      const y1 = ROADS[by + 1] - 26;
      if (parkBlocks.has(bx + ',' + by)) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let i = 0; i < 7; i++) {
          trees.push({ x: randRange(rng, x0 + 10, x1 - 10), y: randRange(rng, y0 + 10, y1 - 10) });
        }
        continue;
      }
      const n = randInt(rng, 1, 2);
      for (let i = 0; i < n; i++) {
        const w = randRange(rng, 60, 110);
        const h = randRange(rng, 60, 110);
        const x = randRange(rng, x0, x1 - w);
        const y = randRange(rng, y0, y1 - h);
        buildings.push({ x, y, w, h, color: randPick(rng, palette) });
      }
      for (let i = 0; i < 2; i++) {
        trees.push({ x: randRange(rng, x0 + 8, x1 - 8), y: randRange(rng, y0 + 8, y1 - 8) });
      }
    }
  }
  return { buildings, trees, parks };
}

function createState() {
  const layout = buildCityLayout();
  const state = {
    mode: 'title',
    rng: makeRng(20261119),
    time: 0,
    clock: { hour: CLOCK.startHour, minute: 0 },
    weather: 'clear',
    weatherTimer: WEATHER_CYCLE_SECONDS,
    player: { x: 568, y: 568, angle: 0, speed: 0, health: PLAYER.health, inCar: false, car: null },
    playerCar: null,
    cars: CARS.map((c) => ({
      model: c.model, color: c.color, topSpeed: c.topSpeed,
      x: c.parked.x, y: c.parked.y, angle: 0, speed: 0, health: CAR.maxHealth, wreck: false,
    })),
    traffic: [],
    peds: [],
    police: [],
    heli: null,
    roadblocks: [],
    heat: 0,
    stars: 0,
    money: 0,
    score: 0,
    carsStolen: 0,
    faresDone: 0,
    nearMisses: 0,
    coinsCollected: new Set(),
    ammoTaken: new Set(),
    ammoPickups: AMMO_PICKUPS,
    ammo: { mag: PLAYER.magSize, reserve: PLAYER.reserveAmmo },
    bullets: [],
    guards: [],
    ledger: null,
    mission: null,
    missionTarget: null,
    completedMissions: [],
    race: null,
    raceDone: {},
    fare: null,
    delivery: null,
    turf: { owners: defaultTurfOwners(), challenge: null, leaveTimer: 0, bonusPaid: false },
    turfRivals: [],
    turfHeld: 0,
    turfTotal: TURF_ZONES.length,
    turfIncome: 0,
    turfZones: TURF_ZONES.map((z) => ({ name: z.name, x0: z.x0, y0: z.y0, x1: z.x1, y1: z.y1, owner: z.owner })),
    paintIndex: 0,
    paintName: null,
    camera: { x: 568, y: 568 },
    messages: [],
    objectiveText: '',
    timerText: '',
    nearMissCooldown: 0,
    wallHitCooldown: 0,
    policeHitCooldown: 0,
    fireCooldown: 0,
    saveTimer: 0,
    lastIncomeHour: CLOCK.startHour,
    saveSummary: '',
    buildings: layout.buildings,
    trees: layout.trees,
    parks: layout.parks,
  };
  return state;
}

// ---------------------------------------------------------------- save

function saveGame(state) {
  try {
    const data = {
      version: SAVE_VERSION,
      money: Math.floor(state.money),
      score: Math.floor(state.score),
      completedMissions: state.completedMissions,
      coins: serializeCoins(state.coinsCollected),
      turfOwners: state.turf.owners,
      raceDone: state.raceDone,
      faresDone: state.faresDone,
      carsStolen: state.carsStolen,
      nearMisses: state.nearMisses,
      paintIndex: state.paintIndex,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { /* save is best-effort */ }
}

function loadGame(state) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data.version !== SAVE_VERSION) return false;
    state.money = data.money || 0;
    state.score = data.score || 0;
    state.completedMissions = Array.isArray(data.completedMissions) ? data.completedMissions : [];
    state.coinsCollected = deserializeCoins(data.coins);
    if (data.turfOwners) state.turf.owners = { ...defaultTurfOwners(), ...data.turfOwners };
    state.raceDone = data.raceDone || {};
    state.faresDone = data.faresDone || 0;
    state.carsStolen = data.carsStolen || 0;
    state.nearMisses = data.nearMisses || 0;
    state.paintIndex = data.paintIndex || 0;
    state.saveSummary = 'Welcome back — $' + Math.floor(state.money).toLocaleString('en-US') +
      ' • ' + state.completedMissions.length + '/7 jobs done • ' + state.coinsCollected.size + '/10 coins';
    return true;
  } catch (e) {
    return false;
  }
}

function addMoney(state, amount, label) {
  state.money += amount;
  state.score += amount;
  if (label) toast(state, label + ' +$' + amount);
}

function toast(state, text) {
  state.messages.push({ text, ttl: 3 });
  if (state.messages.length > 4) state.messages.shift();
}

// ---------------------------------------------------------------- missions

function startMission(state, id) {
  const mission = missionById(id);
  if (!mission) return;
  if (id > 1 && !state.completedMissions.includes(id - 1)) {
    toast(state, 'Finish Job ' + (id - 1) + ' first.');
    return;
  }
  if (state.completedMissions.includes(id)) {
    toast(state, 'Job ' + id + ' already done — replay it for fun, no second payout.');
  }
  state.mission = { id, stage: 0, timer: mission.timer, escapeTimer: 0 };
  state.guards = [];
  state.ledger = null;
  if (mission.startStars) state.heat = heatBandMid(mission.startStars);
  if (id === 7) {
    state.guards = [
      createGuard(1880, 280, 3),
      createGuard(1990, 300, 3),
      createGuard(1940, 380, 3),
    ];
  }
  state.mode = 'play';
  toast(state, 'JOB ' + id + ': ' + mission.title);
}

function completeMission(state) {
  const mission = missionById(state.mission.id);
  const replay = state.completedMissions.includes(mission.id);
  state.mission = null;
  state.missionTarget = null;
  state.objectiveText = '';
  state.timerText = '';
  if (!replay) {
    state.completedMissions.push(mission.id);
    addMoney(state, mission.payout, 'JOB ' + mission.id + ' COMPLETE');
    if (mission.id === 7) {
      toast(state, 'STORY COMPLETE — you are a Solmar Legend!');
    }
  } else {
    toast(state, 'Job ' + mission.id + ' replayed.');
  }
  saveGame(state);
}

function failMission(state, reason) {
  const mission = missionById(state.mission.id);
  state.mission = null;
  state.missionTarget = null;
  state.guards = [];
  state.ledger = null;
  toast(state, 'JOB ' + mission.id + ' FAILED — ' + reason + '. Retry from the board.');
  saveGame(state);
}

function stageReached(state, stage) {
  const p = state.player;
  const dx = stage.x - p.x;
  const dy = stage.y - p.y;
  return dx * dx + dy * dy <= 70 * 70;
}

// ---------------------------------------------------------------- spawning

function spawnTraffic(state) {
  const target = trafficTargetForHour(state.clock.hour);
  while (state.traffic.length < target) {
    const axis = state.rng() < 0.5 ? 'x' : 'y';
    const road = ROADS[Math.floor(state.rng() * ROADS.length)];
    const along = randRange(state.rng, 60, WORLD_SIZE - 60);
    const x = axis === 'x' ? along : road;
    const y = axis === 'x' ? road : along;
    if (distance(x, y, state.player.x, state.player.y) < 320) continue;
    const colors = ['#c94f42', '#4f7ec9', '#c9c9c9', '#5a8a4f', '#8a5a9a', '#d4a03d'];
    state.traffic.push({
      x, y, axis, road,
      dir: state.rng() < 0.5 ? 1 : -1,
      angle: axis === 'x' ? (state.rng() < 0.5 ? 0 : Math.PI) : (state.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
      speed: randRange(state.rng, 90, 170),
      color: randPick(state.rng, colors),
    });
  }
  while (state.traffic.length > target) state.traffic.pop();
}

function spawnPedestrians(state) {
  while (state.peds.length < BASE_PEDESTRIANS) {
    const road = ROADS[Math.floor(state.rng() * ROADS.length)];
    const along = randRange(state.rng, 60, WORLD_SIZE - 60);
    const horizontal = state.rng() < 0.5;
    const colors = ['#e26fd5', '#3d7bd4', '#2fae6e', '#c96a3b', '#8a6fd6'];
    state.peds.push({
      x: horizontal ? along : road + 26,
      y: horizontal ? road + 26 : along,
      angle: state.rng() * Math.PI * 2,
      speed: randRange(state.rng, 30, 60),
      color: randPick(state.rng, colors),
      wander: randRange(state.rng, 2, 6),
    });
  }
}

function spawnPolice(state) {
  const want = Math.min(5, state.stars);
  while (state.police.length < want) {
    const edge = Math.floor(state.rng() * 4);
    let x = state.player.x;
    let y = state.player.y;
    if (edge === 0) { x = state.player.x - 500; y = state.player.y; }
    if (edge === 1) { x = state.player.x + 500; y = state.player.y; }
    if (edge === 2) { x = state.player.x; y = state.player.y - 500; }
    if (edge === 3) { x = state.player.x; y = state.player.y + 500; }
    const c = clampToWorld(x, y);
    state.police.push({ x: c.x, y: c.y, angle: 0, speed: 0, path: null, pathI: 0, repath: 0 });
  }
  while (state.police.length > want) state.police.pop();
  // Roadblocks from 4 stars: two cruisers plus barriers ahead of the player.
  if (state.stars >= 4 && state.roadblocks.length === 0) {
    const ahead = state.player.inCar ? state.player.angle : 0;
    const bx = clamp(state.player.x + Math.cos(ahead) * 320, 80, WORLD_SIZE - 80);
    const by = clamp(state.player.y + Math.sin(ahead) * 320, 80, WORLD_SIZE - 80);
    state.roadblocks.push({ x: bx, y: by, angle: ahead + Math.PI / 2 });
  }
  if (state.stars < 4) state.roadblocks = [];
  // Helicopter at 5 stars; it leaves when heat drops below 5 stars.
  if (state.stars >= 5 && !state.heli) {
    state.heli = { x: state.player.x, y: state.player.y - 120 };
    toast(state, 'SCPD helicopter overhead — 5 stars!');
  }
  if (state.stars < 5) state.heli = null;
}

// ---------------------------------------------------------------- movement

function hitsBuilding(state, x, y) {
  for (const b of state.buildings) {
    if (x > b.x - 8 && x < b.x + b.w + 8 && y > b.y - 8 && y < b.y + b.h + 8) return true;
  }
  return false;
}

function hitsWater(state, x, y) {
  if (!pointInCanal(x, y)) return false;
  return !onCanalBridge(x, y, ROADS);
}

function blockedAt(state, x, y) {
  return hitsBuilding(state, x, y) || hitsWater(state, x, y);
}

function movePlayer(state, dt, input) {
  const p = state.player;
  const up = input.held('up');
  const down = input.held('down');
  const left = input.held('left');
  const right = input.held('right');

  if (p.inCar && p.car) {
    const car = p.car;
    const grip = gripForWeather(state.weather);
    const accel = 520 * grip;
    const maxSpeed = car.topSpeed * grip;
    if (up) car.speed += accel * dt;
    if (down) car.speed -= accel * 0.7 * dt;
    // Coast-down: no throttle means a gradual roll to a stop, never a snap.
    if (!up && !down) {
      const drag = 160 * dt;
      if (Math.abs(car.speed) <= drag) car.speed = 0;
      else car.speed -= Math.sign(car.speed) * drag;
    }
    if (input.held('handbrake')) {
      car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 700 * dt);
    }
    car.speed = clamp(car.speed, -180, maxSpeed);
    if (left) car.angle -= 2.4 * dt * (car.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(car.speed) / 120 + 0.25);
    if (right) car.angle += 2.4 * dt * (car.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(car.speed) / 120 + 0.25);
    const nx = p.x + Math.cos(car.angle) * car.speed * dt;
    const ny = p.y + Math.sin(car.angle) * car.speed * dt;
    state.wallHitCooldown = Math.max(0, state.wallHitCooldown - dt);
    if (blockedAt(state, nx, ny)) {
      if (Math.abs(car.speed) > 100 && state.wallHitCooldown <= 0) {
        car.health = damageCar(car.health, CAR.wallHitDamage);
        state.wallHitCooldown = CAR.wallHitCooldown;
        state.audio.crash();
        toast(state, 'Crash! Car condition -' + CAR.wallHitDamage);
        if (carIsTotaled(car.health)) {
          car.wreck = true;
          toast(state, 'Car totaled! It will never drive again.');
          exitCar(state, true);
        }
      }
      car.speed *= 0.3;
    } else {
      p.x = nx;
      p.y = ny;
      car.x = nx;
      car.y = ny;
    }
    p.angle = car.angle;
    p.speed = car.speed;
    const clamped = clampToWorld(p.x, p.y);
    p.x = clamped.x;
    p.y = clamped.y;
    car.x = p.x;
    car.y = p.y;
  } else {
    let dx = 0;
    let dy = 0;
    if (up) dy -= 1;
    if (down) dy += 1;
    if (left) dx -= 1;
    if (right) dx += 1;
    const moving = dx !== 0 || dy !== 0;
    const speed = input.held('sprint') ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    if (moving) {
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = p.x + (dx / len) * speed * dt;
      const ny = p.y + (dy / len) * speed * dt;
      if (!blockedAt(state, nx, p.y)) p.x = nx;
      if (!blockedAt(state, p.x, ny)) p.y = ny;
      p.angle = Math.atan2(dy, dx);
      p.speed = speed;
    } else {
      p.speed = 0;
    }
    // Aim with the mouse on foot.
    const cam = state.camera;
    const wx = p.x + (input.mouse.x - CANVAS_W / 2);
    const wy = p.y + (input.mouse.y - CANVAS_H / 2);
    if (distance(input.mouse.x, input.mouse.y, CANVAS_W / 2, CANVAS_H / 2) > 8) {
      p.angle = angleTo(p.x, p.y, wx, wy);
    }
    const clamped = clampToWorld(p.x, p.y);
    p.x = clamped.x;
    p.y = clamped.y;
  }
}

function nearestStealableCar(state) {
  let best = null;
  let bestD = 70;
  for (const c of state.cars) {
    if (c === state.player.car) continue;
    if (c.wreck) continue;
    const d = distance(c.x, c.y, state.player.x, state.player.y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

function stealCar(state, car) {
  if (!canStealCar(car)) {
    toast(state, 'That wreck will never drive again.');
    return;
  }
  state.player.inCar = true;
  state.player.car = car;
  state.playerCar = car;
  car.angle = state.player.angle;
  state.carsStolen++;
  state.heat = addHeat(state.heat, WANTED.stealHeat);
  state.audio.pickup();
  toast(state, 'Stole the ' + car.model + '! Heat rising.');
}

function exitCar(state, wrecked) {
  const p = state.player;
  const car = p.car;
  if (!car) return;
  p.inCar = false;
  p.car = null;
  if (!wrecked) {
    p.x += Math.cos(p.angle + Math.PI / 2) * 30;
    p.y += Math.sin(p.angle + Math.PI / 2) * 30;
    const c = clampToWorld(p.x, p.y);
    p.x = c.x;
    p.y = c.y;
    car.speed = 0;
  }
}

// ---------------------------------------------------------------- combat update

function updateCombat(state, dt, input) {
  const p = state.player;
  state.fireCooldown = Math.max(0, state.fireCooldown - dt);
  if (input.mouse.down && !p.inCar && state.fireCooldown <= 0) {
    if (state.ammo.mag > 0) {
      state.ammo.mag--;
      state.fireCooldown = 0.18;
      const b = createBullet(p.x + Math.cos(p.angle) * 18, p.y + Math.sin(p.angle) * 18, p.angle, 900);
      state.bullets.push(b);
      state.audio.shoot();
      state.heat = addHeat(state.heat, WANTED.shootHeat);
    } else if (canReload(state.ammo)) {
      state.ammo = reloadAmmo(state.ammo);
      state.audio.pickup();
    }
  }
  if (input.hit('reload') && canReload(state.ammo)) {
    state.ammo = reloadAmmo(state.ammo);
    state.audio.pickup();
    toast(state, 'Reloaded.');
  }
  if (input.hit('punch') && !p.inCar) {
    state.audio.punch();
    for (const g of state.guards) {
      if (g.alive && punchHits(p.x, p.y, p.angle, g)) {
        damageGuard(g, PLAYER.punchDamage);
        if (!g.alive) addMoney(state, 50, 'Guard down');
      }
    }
    for (const r of state.turfRivals) {
      if (punchHits(p.x, p.y, p.angle, r)) {
        r.hp -= 1;
        if (r.hp <= 0) r.dead = true;
      }
    }
  }
  // Bullets travel with swept collision against guards and turf rivals.
  for (const b of state.bullets) {
    const px = b.x;
    const py = b.y;
    stepBullet(b, dt);
    if (b.dead) continue;
    for (const g of state.guards) {
      if (g.alive && bulletHitsTarget(px, py, b, g, 16)) {
        damageGuard(g, 1);
        b.dead = true;
        if (!g.alive) addMoney(state, 50, 'Guard down');
        break;
      }
    }
    if (b.dead) continue;
    for (const r of state.turfRivals) {
      if (!r.dead && bulletHitsTarget(px, py, b, r, 14)) {
        r.hp -= 1;
        if (r.hp <= 0) r.dead = true;
        b.dead = true;
        break;
      }
    }
  }
  state.bullets = state.bullets.filter((b) => !b.dead);
  // Guards shoot back when the player is close.
  for (const g of state.guards) {
    if (!g.alive) continue;
    g.shootCooldown -= dt;
    const d = distance(g.x, g.y, p.x, p.y);
    if (d < 420 && g.shootCooldown <= 0) {
      g.shootCooldown = 1.6;
      p.health -= 6;
      state.audio.shoot();
      if (p.health <= 0) wasted(state);
    }
  }
}

function wasted(state) {
  state.mode = 'wasted';
  state.mission = null;
  state.missionTarget = null;
  state.race = null;
  state.fare = null;
  state.delivery = null;
  state.turf.challenge = null;
  state.turfRivals = [];
  state.bullets = [];
  state.audio.fail();
}

// ---------------------------------------------------------------- traffic / peds / police update

function updateTraffic(state, dt) {
  spawnTraffic(state);
  for (const t of state.traffic) {
    if (t.axis === 'x') {
      t.x += t.dir * t.speed * dt;
      t.angle = t.dir > 0 ? 0 : Math.PI;
      if (t.x < 30 || t.x > WORLD_SIZE - 30) {
        t.dir *= -1;
        t.road = ROADS[Math.floor(state.rng() * ROADS.length)];
        t.y = t.road;
        t.x = clamp(t.x, 30, WORLD_SIZE - 30);
      }
    } else {
      t.y += t.dir * t.speed * dt;
      t.angle = t.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (t.y < 30 || t.y > WORLD_SIZE - 30) {
        t.dir *= -1;
        t.road = ROADS[Math.floor(state.rng() * ROADS.length)];
        t.x = t.road;
        t.y = clamp(t.y, 30, WORLD_SIZE - 30);
      }
    }
    // Near-miss: threading past traffic at speed pays $15.
    const p = state.player;
    if (p.inCar && p.car) {
      const d = distance(t.x, t.y, p.x, p.y);
      if (nearMissEligible(Math.abs(p.car.speed), d, state.nearMissCooldown)) {
        state.nearMissCooldown = NEAR_MISS_COOLDOWN;
        state.nearMisses++;
        addMoney(state, 15, 'NEAR MISS');
        state.audio.whoosh();
      }
      // A real hit costs car condition.
      if (d < 26 && state.wallHitCooldown <= 0) {
        p.car.health = damageCar(p.car.health, CAR.trafficHitDamage);
        state.wallHitCooldown = CAR.wallHitCooldown;
        state.audio.crash();
        if (carIsTotaled(p.car.health)) {
          p.car.wreck = true;
          toast(state, 'Car totaled in the crash!');
          exitCar(state, true);
        }
      }
    }
  }
  state.nearMissCooldown = Math.max(0, state.nearMissCooldown - dt);
}

function updatePeds(state, dt) {
  spawnPedestrians(state);
  for (const p of state.peds) {
    p.wander -= dt;
    if (p.wander <= 0) {
      p.wander = randRange(state.rng, 2, 6);
      p.angle = state.rng() * Math.PI * 2;
    }
    p.x += Math.cos(p.angle) * p.speed * dt;
    p.y += Math.sin(p.angle) * p.speed * dt;
    const c = clampToWorld(p.x, p.y);
    if (p.x !== c.x || p.y !== c.y) {
      p.x = c.x;
      p.y = c.y;
      p.angle += Math.PI;
    }
  }
}

function updatePolice(state, dt) {
  spawnPolice(state);
  state.policeHitCooldown = Math.max(0, state.policeHitCooldown - dt);
  const playerNode = nearestNode(state.player.x, state.player.y);
  for (const cop of state.police) {
    cop.repath -= dt;
    if (cop.repath <= 0 || !cop.path) {
      cop.repath = 1;
      const from = nearestNode(cop.x, cop.y);
      const step = bfsNextStep(from.rx, from.ry, playerNode.rx, playerNode.ry);
      cop.path = step ? [nodePosition(step.rx, step.ry)] : [nodePosition(playerNode.rx, playerNode.ry)];
      cop.pathI = 0;
    }
    const target = cop.path[cop.pathI] || { x: state.player.x, y: state.player.y };
    const d = distance(cop.x, cop.y, target.x, target.y);
    if (d < 24) {
      cop.pathI++;
    } else {
      const want = angleTo(cop.x, cop.y, target.x, target.y);
      let diff = want - cop.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      cop.angle += clamp(diff, -3 * dt, 3 * dt);
      cop.speed = 380;
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
    }
    // Ramming the player hurts.
    const pd = distance(cop.x, cop.y, state.player.x, state.player.y);
    if (pd < 34 && state.policeHitCooldown <= 0) {
      state.policeHitCooldown = 1;
      state.audio.crash();
      if (state.player.inCar && state.player.car) {
        state.player.car.health = damageCar(state.player.car.health, 10);
        if (carIsTotaled(state.player.car.health)) {
          state.player.car.wreck = true;
          exitCar(state, true);
        }
      } else {
        state.player.health -= 8;
        if (state.player.health <= 0) wasted(state);
      }
    }
  }
  // Helicopter follows from above, faster than any cruiser.
  if (state.heli) {
    const h = state.heli;
    const d = distance(h.x, h.y, state.player.x, state.player.y);
    if (d > 4) {
      const a = angleTo(h.x, h.y, state.player.x, state.player.y);
      const sp = 520;
      h.x += Math.cos(a) * sp * dt;
      h.y += Math.sin(a) * sp * dt;
    }
  }
}

// ---------------------------------------------------------------- clock, weather, turf income

function updateClockWeather(state, dt) {
  const hoursPerSecond = 24 / CLOCK.dayLengthSeconds;
  const prevHour = Math.floor(state.clock.hour);
  state.clock.hour += hoursPerSecond * dt;
  if (state.clock.hour >= 24) state.clock.hour -= 24;
  state.clock.minute = (state.clock.hour % 1) * 60;
  // Turf income lands once per in-game hour.
  const nowHour = Math.floor(state.clock.hour);
  if (nowHour !== prevHour) {
    const income = turfIncomePerHour(state.turf.owners);
    if (income > 0) addMoney(state, income, 'Turf income');
  }
  state.weatherTimer -= dt;
  if (state.weatherTimer <= 0) {
    state.weatherTimer = WEATHER_CYCLE_SECONDS;
    state.weather = state.weather === 'clear' ? 'rain' : state.weather === 'rain' ? 'fog' : 'clear';
    toast(state, 'Weather: ' + state.weather.toUpperCase());
  }
}

// ---------------------------------------------------------------- side jobs update

function updateSideJobs(state, dt, input) {
  const p = state.player;
  // Coins.
  const got = collectCoinAt(p.x, p.y, state.coinsCollected);
  if (got.payout > 0) {
    addMoney(state, got.payout, 'SOLMAR COIN');
    state.audio.coin();
    saveGame(state);
  }
  // Ammo pickups.
  const ai = ammoPickupNear(p.x, p.y, state.ammoTaken);
  if (ai >= 0) {
    state.ammoTaken.add(ai);
    state.ammo.reserve += AMMO_PICKUPS[ai].amount;
    state.audio.pickup();
    toast(state, 'Ammo +' + AMMO_PICKUPS[ai].amount);
  }
  // Taxi fares: press T to take a fare, drive to the passenger, then on.
  if (input.hit('taxi') && !state.fare && p.inCar) {
    state.fare = makeFare(state.rng, p.x, p.y);
    toast(state, 'Fare: pick up the passenger (yellow T).');
  }
  if (state.fare) {
    const f = state.fare;
    f.timer -= dt;
    const target = f.pickedUp ? { x: f.toX, y: f.toY } : { x: f.fromX, y: f.fromY };
    if (distance(p.x, p.y, target.x, target.y) < 60) {
      if (!f.pickedUp) {
        f.pickedUp = true;
        toast(state, 'Passenger aboard — drive to the destination.');
      } else {
        const pay = farePayout(distance(f.fromX, f.fromY, f.toX, f.toY));
        state.faresDone++;
        addMoney(state, pay, 'FARE COMPLETE');
        state.audio.success();
        state.fare = null;
        saveGame(state);
      }
    }
    if (f.timer <= 0) {
      toast(state, 'Fare expired — the passenger walked away.');
      state.fare = null;
    }
  }
  // Deliveries: press L at the Harbor Market to take a package.
  const market = landmarkByKind('market');
  if (input.hit('delivery') && !state.delivery) {
    const c = landmarkCenter(market);
    if (distance(p.x, p.y, c.x, c.y) < 120) {
      state.delivery = makeDelivery(state.rng);
      toast(state, 'Package picked up — deliver to Coral Bay!');
      state.delivery.pickedUp = true;
    }
  }
  if (state.delivery) {
    const d = state.delivery;
    d.timer -= dt;
    if (distance(p.x, p.y, d.dropoff.x, d.dropoff.y) < 60) {
      addMoney(state, d.payout, 'DELIVERY COMPLETE');
      state.audio.success();
      state.delivery = null;
      saveGame(state);
    } else if (d.timer <= 0) {
      toast(state, 'Delivery failed — too slow.');
      state.delivery = null;
    } else if (state.stars >= 1) {
      // Spotted by police mid-delivery: heat climbs twice as fast.
      state.heat = addHeat(state.heat, (WANTED.speedHeat * dt) / 10);
    }
  }
  // Street races: drive into a start marker while in a car.
  if (!state.race && p.inCar) {
    const race = raceNearStart(p.x, p.y);
    if (race) {
      state.race = { id: race.id, cp: 0, timer: race.par, nextCheckpoint: race.checkpoints[0] };
      toast(state, 'RACE: ' + race.name + ' — hit every checkpoint before the clock runs out!');
    }
  }
  if (state.race) {
    const race = raceById(state.race.id);
    state.race.timer -= dt;
    const cp = race.checkpoints[state.race.cp];
    if (cp && raceCheckpointReached(race, state.race.cp, p.x, p.y)) {
      state.race.cp++;
      state.audio.pickup();
      if (state.race.cp >= race.checkpoints.length) {
        addMoney(state, race.payout, 'RACE WON: ' + race.name);
        state.audio.success();
        state.raceDone[race.id] = true;
        state.race = null;
        saveGame(state);
      } else {
        state.race.nextCheckpoint = race.checkpoints[state.race.cp];
        toast(state, 'Checkpoint ' + state.race.cp + '/' + race.checkpoints.length);
      }
    }
    if (state.race && state.race.timer <= 0) {
      toast(state, 'Race failed — the clock beat you. Retry any time.');
      state.audio.fail();
      state.race = null;
    }
  }
  // Turf wars: press G inside a rival zone to challenge it.
  if (input.hit('turf') && !state.turf.challenge) {
    const zone = turfZoneAt(p.x, p.y);
    if (zone && state.turf.owners[zone.name] !== PLAYER_CREW) {
      state.turf.challenge = { zone: zone.name, timer: TURF_CHALLENGE_SECONDS };
      state.turf.leaveTimer = 0;
      state.turfRivals = [];
      for (let i = 0; i < TURF_RIVALS_PER_CHALLENGE; i++) {
        state.turfRivals.push({
          x: p.x + randRange(state.rng, -160, 160),
          y: p.y + randRange(state.rng, -160, 160),
          angle: 0, hp: 2, dead: false, speed: 120,
        });
      }
      toast(state, 'TURF WAR for ' + zone.name + ' — hold the zone for 30 seconds!');
    } else if (zone) {
      toast(state, 'You already hold ' + zone.name + '.');
    }
  }
  if (state.turf.challenge) {
    const ch = state.turf.challenge;
    const zone = TURF_ZONES.find((z) => z.name === ch.zone);
    const inside = p.x >= zone.x0 && p.x < zone.x1 && p.y >= zone.y0 && p.y < zone.y1;
    if (!inside) {
      state.turf.leaveTimer += dt;
      if (state.turf.leaveTimer > 5) {
        state.turf.challenge = null;
        state.turfRivals = [];
        toast(state, 'Turf war lost — you left the zone.');
      }
    } else {
      state.turf.leaveTimer = 0;
    }
    ch.timer -= dt;
    for (const r of state.turfRivals) {
      if (r.dead) continue;
      const a = angleTo(r.x, r.y, p.x, p.y);
      r.angle = a;
      r.x += Math.cos(a) * r.speed * dt;
      r.y += Math.sin(a) * r.speed * dt;
      if (distance(r.x, r.y, p.x, p.y) < 26) {
        p.health -= 4 * dt;
        if (p.health <= 0) {
          wasted(state);
          return;
        }
      }
    }
    state.turfRivals = state.turfRivals.filter((r) => !r.dead);
    if (state.turf.challenge && ch.timer <= 0) {
      state.turf.owners[ch.zone] = PLAYER_CREW;
      state.turf.challenge = null;
      state.turfRivals = [];
      addMoney(state, 100, 'TURF TAKEN: ' + ch.zone);
      state.audio.success();
      if (allTurfHeld(state.turf.owners) && !state.turf.bonusPaid) {
        state.turf.bonusPaid = true;
        addMoney(state, 500, 'ALL TURF HELD BONUS');
      }
      saveGame(state);
    }
  }
  // Paint shop: inside the lot, heat clears and the car is repaired.
  if (insidePaintShop(p.x, p.y)) {
    state.heat = Math.max(0, state.heat - 25 * dt);
    if (p.inCar && p.car && p.car.health < CAR.maxHealth) {
      p.car.health = Math.min(CAR.maxHealth, p.car.health + 30 * dt);
    }
    if (input.hit('paint') && p.inCar && p.car) {
      if (canAffordRepaint(state.money)) {
        state.money -= PRICES_PAINT;
        state.paintIndex = nextPaintIndex(state.paintIndex);
        const paint = paintByIndex(state.paintIndex);
        p.car.color = paint.color;
        state.paintName = paint.name;
        state.audio.success();
        toast(state, 'Repainted: ' + paint.name + ' (-$50). Heat cleared!');
        state.heat = 0;
        saveGame(state);
      } else {
        toast(state, 'A repaint costs $50.');
      }
    }
  }
}

const PRICES_PAINT = 50;

// ---------------------------------------------------------------- mission update

function updateMission(state, dt) {
  const m = state.mission;
  if (!m) {
    state.missionTarget = null;
    state.objectiveText = '';
    state.timerText = '';
    return;
  }
  const mission = missionById(m.id);
  const stage = missionStage(mission, m.stage);
  state.objectiveText = 'JOB ' + mission.id + ' — ' + mission.title + ': ' + stage.label;
  // Escape leg of job 7 runs its own 90-second clock.
  if (m.id === 7 && m.stage === 2) {
    m.escapeTimer -= dt;
    state.timerText = 'ESCAPE ' + Math.max(0, Math.ceil(m.escapeTimer)) + 's';
    if (m.escapeTimer <= 0) {
      failMission(state, 'the SCPD locked down the Marina');
      return;
    }
    state.missionTarget = { x: marinaEscapeSpot().x, y: marinaEscapeSpot().y };
    if (stageReached(state, stage)) {
      completeMission(state);
    }
    return;
  }
  m.timer -= dt;
  state.timerText = Math.max(0, Math.ceil(m.timer)) + 's';
  if (m.timer <= 0) {
    failMission(state, 'time ran out');
    return;
  }
  state.missionTarget = { x: stage.x, y: stage.y };
  if (stage.kind === 'steal') {
    if (state.player.inCar) {
      m.stage++;
      toast(state, 'Got wheels — now ' + missionStage(mission, m.stage).label);
    }
    return;
  }
  if (stage.kind === 'clear') {
    if (state.guards.length > 0 && state.guards.every((g) => !g.alive)) {
      state.ledger = { x: ledgerSpot().x, y: ledgerSpot().y, taken: false };
      m.stage++;
      toast(state, 'Guards down — grab the ledger!');
    }
    return;
  }
  if (stage.kind === 'grab') {
    if (state.ledger && !state.ledger.taken && distance(state.player.x, state.player.y, state.ledger.x, state.ledger.y) < 50) {
      state.ledger.taken = true;
      m.stage++;
      m.escapeTimer = mission.escapeTimer;
      state.heat = heatBandMid(mission.escapeStars);
      toast(state, 'LEDGER SECURED — 4 stars! Escape to the Marina in 90 seconds!');
    }
    return;
  }
  if (stageReached(state, stage)) {
    if (m.stage + 1 >= mission.stages.length) {
      completeMission(state);
    } else {
      m.stage++;
    }
  }
}

// ---------------------------------------------------------------- main update

function update(state, dt, input) {
  if (state.mode !== 'play') return;
  // Mute toggle works everywhere.
  if (input.hit('mute')) {
    state.audio.muted = state.audio.toggleMute();
    toast(state, state.audio.muted ? 'Sound off.' : 'Sound on.');
  }
  if (input.hit('pause')) {
    state.mode = 'pause';
    return;
  }
  if (input.hit('board')) {
    state.mode = 'board';
    return;
  }
  // Steal / exit car.
  if (input.hit('steal')) {
    if (state.player.inCar) {
      exitCar(state, false);
    } else {
      const car = nearestStealableCar(state);
      if (car) stealCar(state, car);
    }
  }
  movePlayer(state, dt, input);
  updateCombat(state, dt, input);
  if (state.mode !== 'play') return;
  updateTraffic(state, dt);
  updatePeds(state, dt);
  updatePolice(state, dt);
  updateClockWeather(state, dt);
  updateSideJobs(state, dt, input);
  if (state.mode !== 'play') return;
  updateMission(state, dt);
  if (state.mode !== 'play') return;

  // Wanted decay when laying low: no police within 260 and no recent crime.
  const nearCop = state.police.some((c) => distance(c.x, c.y, state.player.x, state.player.y) < 260);
  state.heat = decayHeat(state.heat, dt, !nearCop);
  state.stars = starsForHeat(state.heat);
  state.turfHeld = turfHeldCount(state.turf.owners);
  state.turfIncome = turfIncomePerHour(state.turf.owners);
  state.turfZones = TURF_ZONES.map((z) => ({
    name: z.name, x0: z.x0, y0: z.y0, x1: z.x1, y1: z.y1, owner: state.turf.owners[z.name],
  }));

  // Camera follows the player, clamped so it never leaves the city.
  state.camera.x = clamp(state.player.x, CANVAS_W / 2, WORLD_SIZE - CANVAS_W / 2);
  state.camera.y = clamp(state.player.y, CANVAS_H / 2, WORLD_SIZE - CANVAS_H / 2);

  // Toast lifetimes.
  for (const m of state.messages) m.ttl -= dt;
  state.messages = state.messages.filter((m) => m.ttl > 0);

  // Autosave every few seconds while playing.
  state.saveTimer -= dt;
  if (state.saveTimer <= 0) {
    state.saveTimer = 5;
    saveGame(state);
  }
}

// ---------------------------------------------------------------- clicks

function handleClick(state, input) {
  if (!input.mouse.clicked) return;
  const mx = input.mouse.x;
  const my = input.mouse.y;
  const buttons = screenButtons(state.mode, CANVAS_W, CANVAS_H);
  for (const b of buttons) {
    if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
      clickButton(state, b.id);
      return;
    }
  }
  // Clicking anywhere on the title starts the game too.
  if (state.mode === 'title') {
    state.mode = 'play';
    state.audio.ensure();
    state.audio.resume();
  }
}

function clickButton(state, id) {
  state.audio.ensure();
  state.audio.resume();
  if (id === 'play') {
    state.mode = 'play';
  } else if (id === 'missions' || id === 'board') {
    state.mode = 'board';
  } else if (id === 'back') {
    state.mode = 'play';
  } else if (id === 'resume') {
    state.mode = 'play';
  } else if (id === 'title') {
    state.mode = 'title';
  } else if (id === 'respawn') {
    respawn(state);
  } else if (id.startsWith('mission-')) {
    startMission(state, parseInt(id.slice(8), 10));
  } else if (id.startsWith('race-')) {
    const race = raceById(id.slice(5));
    state.mode = 'play';
    // Teleport the player to the race start so the race can begin at once.
    state.player.x = race.start.x;
    state.player.y = race.start.y;
    toast(state, 'Drive into the checkered marker to start ' + race.name + '.');
  }
}

function respawn(state) {
  state.player.x = 568;
  state.player.y = 568;
  state.player.health = PLAYER.health;
  state.player.inCar = false;
  state.player.car = null;
  state.heat = Math.max(0, state.heat / 2);
  state.money = Math.max(0, state.money - 100);
  state.mode = 'play';
  toast(state, 'Discharged from hospital (-$100). Stay sharp.');
  saveGame(state);
}

// ---------------------------------------------------------------- boot

export function boot() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const state = createState();
  state.audio = createAudio();
  // Debug handle for automated play-tests (read-only state inspection).
  window.__solmar = { state };
  const input = createInput();
  input.attach(canvas);
  loadGame(state);
  state.paintName = paintByIndex(state.paintIndex).name;

  // Screenshot scenes, when the URL asks for one.
  const shot = shotFromUrl();
  if (shot) {
    // Give the player a car to pose with before the shot is arranged.
    const falco = state.cars.find((c) => c.model === 'Falco');
    state.playerCar = falco;
    applyShot(state, shot);
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    state.time += dt;
    if (input.hit('confirm') && state.mode === 'title') {
      state.mode = 'play';
      state.audio.ensure();
      state.audio.resume();
    }
    handleClick(state, input);
    update(state, dt, input);
    drawFrame(ctx, state);
    input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (typeof document !== 'undefined') {
  boot();
}
