// Solmar Heat — main.js
// The heart of the game: the state object, the update loop, and every
// system that lives in the loop — driving and stealing, the wanted
// system, police pursuit, roadblocks, the 5-star helicopter, car damage,
// Lou's Paint Shop, WASTED and the hospital respawn, the day/night clock
// and weather, and the autosave. Rendering lives in render.js; this file
// only moves the world forward.

import { WORLD, ROADS, CARS, RANKS, DAY_LENGTH_SEC, CLOCK_START_HOUR, HEAT_PER_STAR, HEAT_DECAY_PER_SEC, HEAT_STEAL, HEAT_SHOT, HEAT_SPEEDING, HEAT_DELIVERY_SPOTTED, CAR_DAMAGE_PER_HIT, PAINT_COST, REPAINT_COST, TURF_ZONES } from './config.js';
import { createRng } from './random.js';
import { createInput, attachInput, endFrameInput, keyDown, keyPressed } from './input.js';
import { buildCity, hitsBuilding, isWater, trafficTarget, findPath, nearestIntersection, turfAt, districtAt } from './world.js';
import { inPaintShop, inModShop, landmarkByKind } from './landmarks.js';
import { createCoins, collectCoins, coinsCollected, coinsSave, coinsLoad } from './collectibles.js';
import { fireBullet, updateBullets, punch, AMMO_MAG, AMMO_RESERVE_START } from './combat.js';
import { spawnFare, startFare, updateFare, startDelivery, updateDelivery, raceAt, startRace, updateRace, checkNearMiss, turfZoneAt, startTurfChallenge, updateTurf, turfHourlyIncome, buyMod, moddedCarStats } from './sidejobs.js';
import { startMission, updateMission } from './missions.js';
import { sfx, toggleMute } from './audio.js';
import { render } from './render.js';
import { installShotsApi } from './shots.js';

export const SAVE_KEY = 'solmar-heat-save-v1';

// ------------------------------------------------------------------ state
export function createGame(seed = 20261119) {
  const rng = createRng(seed);
  const city = buildCity(seed);
  // Turf zones are shared module objects; a fresh game resets them to
  // their default crews (a loaded save restores them afterwards).
  for (const z of TURF_ZONES) z.owner = z.defaultOwner;
  // Twelve stealable cars parked on road intersections around town.
  const parked = CARS.map((def, i) => {
    const rx = ROADS[(i * 3 + 1) % 9];
    const ry = ROADS[(i * 5 + 2) % 9];
    return {
      id: i,
      model: def.model,
      color: def.color,
      top: def.top,
      accel: def.accel,
      taxi: !!def.taxi,
      x: rx + (i % 2 === 0 ? 26 : -26),
      y: ry + (i % 3 === 0 ? 26 : -26),
      angle: (i % 4) * (Math.PI / 2),
      health: 100,
      wrecked: false,
      stolen: false,
    };
  });
  // Traffic cars start spread across the roads.
  const traffic = [];
  for (let i = 0; i < 14; i++) {
    traffic.push(spawnTrafficCar(rng, i));
  }
  // Pedestrians stroll the sidewalks.
  const peds = [];
  for (let i = 0; i < 18; i++) {
    peds.push({
      x: rng.range(150, WORLD - 150),
      y: rng.range(150, WORLD - 150),
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(18, 34),
      color: ['#e8c39e', '#c98d5f', '#8a5a3b', '#f0d0b0'][i % 4],
    });
  }
  return {
    seed,
    rng,
    city,
    time: 0, // real seconds since the game started
    clockHours: CLOCK_START_HOUR, // in-game clock, 0..24
    screen: 'title', // title | board | play | pause | wasted
    paused: false,
    player: {
      x: 387,
      y: 891,
      angle: -Math.PI / 2,
      speed: 0,
      health: 100,
      inCar: false,
      car: null,
      ammo: AMMO_MAG,
      reserve: AMMO_RESERVE_START,
      onFootAngle: -Math.PI / 2,
    },
    parked,
    traffic,
    peds,
    police: [],
    heli: null,
    roadblocks: [],
    bullets: [],
    coins: createCoins(),
    money: 0,
    score: 0,
    heat: 0,
    lastCrime: -999,
    lastNearMiss: -999,
    lastRivalHit: -999,
    lastSiren: -999,
    missionsDone: [],
    mission: { active: false, id: 0, def: null, stage: '', timer: 0, guards: [], ledgerTaken: false, escapeTimer: 0 },
    storyComplete: false,
    fare: spawnFare(rng),
    delivery: { active: false, pickedUp: false, x: 0, y: 0, destX: 0, destY: 0, timer: 0, spotted: false },
    race: { active: false, def: null, index: 0, timer: 0, done: false },
    turf: { active: false, zone: null, timer: 0, rivals: [], spawnTimer: 0, fled: false },
    turfAllBonusPaid: false,
    mods: { engine: 0, armor: 0, tires: 0 },
    weather: 'clear', // clear | rain | fog
    weatherTimer: 90,
    rainDrops: [],
    stats: { carsStolen: 0, fares: 0, nearMisses: 0, races: 0, deliveries: 0, missions: 0, turfHeld: 0 },
    message: '',
    messageTimer: 0,
    paintCooldown: 0,
    repaintIndex: 0,
    wastedTimer: 0,
    camera: { x: 387, y: 891 },
    lastHour: CLOCK_START_HOUR,
    respawnCount: 0,
  };
}

function spawnTrafficCar(rng, i) {
  const vertical = rng.chance(0.5);
  const road = rng.pick(ROADS);
  const along = rng.range(200, WORLD - 200);
  const dir = rng.chance(0.5) ? 1 : -1;
  return {
    x: vertical ? road + (dir > 0 ? 16 : -16) : along,
    y: vertical ? along : road + (dir > 0 ? 16 : -16),
    angle: vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI,
    speed: rng.range(90, 150),
    color: ['#c0392b', '#2980b9', '#7f8c8d', '#d4ac0d', '#16a085', '#6c3483'][i % 6],
    vertical,
    dir,
    honk: 0,
  };
}

// ------------------------------------------------------------------ wanted
export function wantedStars(state) {
  return Math.min(5, Math.floor(state.heat / HEAT_PER_STAR));
}

// Add heat for a crime, landing the new star mid-band so it cannot decay
// back on the very next frame.
export function addHeat(state, amount) {
  const before = wantedStars(state);
  state.heat = Math.min(100, state.heat + amount);
  state.lastCrime = state.time;
  const after = wantedStars(state);
  if (after > before) {
    // Mid-band: the middle of the new star's 20-heat band, so the star
    // cannot decay away on the very next frame (never past the 100 cap).
    state.heat = Math.min(100, after * HEAT_PER_STAR + HEAT_PER_STAR / 2);
  }
}

// ------------------------------------------------------------------ driving
function carTopSpeed(state, car) {
  const stats = moddedCarStats(state, car);
  let top = stats.top;
  if (state.weather === 'rain') top *= 0.9; // wet roads, a little slower
  return top;
}

function driveCar(state, input, dt) {
  const p = state.player;
  const car = p.car;
  const stats = moddedCarStats(state, car);
  const grip = stats.grip * (state.weather === 'rain' ? 0.85 : 1);
  const accel = car.accel * grip;
  const top = carTopSpeed(state, car);
  const fwd = keyDown(input, 'w', 'ArrowUp');
  const back = keyDown(input, 's', 'ArrowDown');
  const left = keyDown(input, 'a', 'ArrowLeft');
  const right = keyDown(input, 'd', 'ArrowRight');
  const brake = keyDown(input, ' ');
  if (fwd) p.speed += accel * dt;
  else if (back) p.speed -= accel * 0.7 * dt;
  else p.speed *= Math.max(0, 1 - 1.2 * dt); // rolling drag
  if (brake) p.speed *= Math.max(0, 1 - 4 * dt); // handbrake: hard stop
  p.speed = Math.max(-top * 0.45, Math.min(top, p.speed));
  const turnRate = 2.4 * grip * (p.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(p.speed) / 90 + 0.15);
  if (left) p.angle -= turnRate * dt;
  if (right) p.angle += turnRate * dt;
  const nx = p.x + Math.cos(p.angle) * p.speed * dt;
  const ny = p.y + Math.sin(p.angle) * p.speed * dt;
  // Walls, buildings and water stop the car — and cost 8 car health.
  if (nx < 40 || nx > WORLD - 40 || ny < 40 || ny > WORLD - 40 || hitsBuilding(state.city.buildings, nx, ny, 20) || isWater(nx, ny)) {
    if (Math.abs(p.speed) > 60) {
      car.health -= CAR_DAMAGE_PER_HIT;
      sfx.crash();
      state.message = `Crash! Car condition ${Math.max(0, car.health)}%`;
      if (car.health <= 0) {
        car.health = 0;
        car.wrecked = true;
        state.message = 'Car totaled! It can never be driven again.';
        p.inCar = false;
        p.car = null;
        p.speed = 0;
        p.x = Math.max(60, Math.min(WORLD - 60, p.x));
        p.y = Math.max(60, Math.min(WORLD - 60, p.y));
        return;
      }
    }
    p.speed *= 0.4;
  } else {
    p.x = nx;
    p.y = ny;
    car.x = p.x;
    car.y = p.y;
    car.angle = p.angle;
  }
  // Speeding past a police car adds heat.
  for (const cop of state.police) {
    if (Math.abs(p.speed) > 200 && Math.hypot(cop.x - p.x, cop.y - p.y) < 160) {
      if (state.time - (state.lastSpeeding || 0) > 3) {
        state.lastSpeeding = state.time;
        addHeat(state, HEAT_SPEEDING);
      }
    }
  }
}

function walkPlayer(state, input, dt) {
  const p = state.player;
  const sprint = keyDown(input, 'Shift') ? 1.7 : 1;
  const spd = 165 * sprint;
  let mx = 0;
  let my = 0;
  if (keyDown(input, 'w', 'ArrowUp')) my -= 1;
  if (keyDown(input, 's', 'ArrowDown')) my += 1;
  if (keyDown(input, 'a', 'ArrowLeft')) mx -= 1;
  if (keyDown(input, 'd', 'ArrowRight')) mx += 1;
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    const nx = p.x + (mx / len) * spd * dt;
    const ny = p.y + (my / len) * spd * dt;
    p.onFootAngle = Math.atan2(my, mx);
    if (!hitsBuilding(state.city.buildings, nx, p.y, 14) && !isWater(nx, p.y) && nx > 30 && nx < WORLD - 30) p.x = nx;
    if (!hitsBuilding(state.city.buildings, p.x, ny, 14) && !isWater(p.x, ny) && ny > 30 && ny < WORLD - 30) p.y = ny;
  }
  p.speed = 0;
}

// Steal the nearest parked car (E), or step out of the current car.
function tryStealOrExit(state) {
  const p = state.player;
  if (p.inCar) {
    p.inCar = false;
    p.car = null;
    p.speed = 0;
    p.x += 30;
    p.y += 30;
    return;
  }
  let best = null;
  let bestD = 60;
  for (const c of state.parked) {
    if (c.wrecked) continue; // a totaled car can never be stolen again
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  if (!best) return;
  best.stolen = true;
  p.inCar = true;
  p.car = best;
  p.angle = best.angle;
  p.x = best.x;
  p.y = best.y;
  state.stats.carsStolen += 1;
  addHeat(state, HEAT_STEAL);
  state.message = `Stole the ${best.model}! The law noticed.`;
  sfx.pickup();
}

// ------------------------------------------------------------------ police
function updatePolice(state, dt) {
  const stars = wantedStars(state);
  const want = stars === 0 ? 0 : stars + 1; // 1 star -> 2 cruisers, up to 6
  // Spawn cruisers up to the wanted count, on intersections a couple of
  // blocks from the player so they start on real roads.
  while (state.police.length < want) {
    const near = nearestIntersection(state.player.x, state.player.y);
    let di = state.rng.int(-2, 2);
    let dj = state.rng.int(-2, 2);
    if (di === 0 && dj === 0) di = 2;
    const ix = Math.max(0, Math.min(8, ROADS.indexOf(near.x) + di));
    const iy = Math.max(0, Math.min(8, ROADS.indexOf(near.y) + dj));
    state.police.push({
      x: ROADS[ix],
      y: ROADS[iy],
      angle: 0,
      speed: 0,
      path: [],
      pathI: 0,
      repath: 0,
    });
  }
  while (state.police.length > want) state.police.pop();
  for (const cop of state.police) {
    cop.repath -= dt;
    if (cop.repath <= 0 || cop.pathI >= cop.path.length) {
      cop.path = findPath(cop.x, cop.y, state.player.x, state.player.y);
      cop.pathI = 0;
      cop.repath = 1.2;
    }
    const node = cop.path[Math.min(cop.pathI, cop.path.length - 1)];
    const d = Math.hypot(node.x - cop.x, node.y - cop.y);
    if (d < 60) {
      // Reached this intersection: move on to the next one.
      cop.pathI += 1;
    } else {
      const wantAngle = Math.atan2(node.y - cop.y, node.x - cop.x);
      let diff = wantAngle - cop.angle;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      cop.angle += Math.max(-4 * dt, Math.min(4 * dt, diff));
      // Slow for the turn into an intersection, fast on the straight.
      const targetSpeed = d < 160 ? 160 : 300;
      if (cop.speed < targetSpeed) cop.speed = Math.min(targetSpeed, cop.speed + 260 * dt);
      else cop.speed = Math.max(targetSpeed, cop.speed - 200 * dt);
    }
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    // A cruiser ramming the player hurts.
    if (Math.hypot(cop.x - state.player.x, cop.y - state.player.y) < 34) {
      if (state.time - (state.lastRam || 0) > 1) {
        state.lastRam = state.time;
        state.player.health -= 10;
        sfx.crash();
      }
    }
  }
  // Roadblocks from 4 stars: two parked cruisers with striped barriers
  // across the road ahead of the player. They clear when heat drops.
  if (stars >= 4 && state.roadblocks.length === 0) {
    const a = state.player.angle;
    const bx = state.player.x + Math.cos(a) * 260;
    const by = state.player.y + Math.sin(a) * 260;
    state.roadblocks = [
      { x: bx - Math.sin(a) * 40, y: by + Math.cos(a) * 40, angle: a },
      { x: bx + Math.sin(a) * 40, y: by - Math.cos(a) * 40, angle: a },
    ];
    state.message = 'Roadblock ahead!';
  } else if (stars < 4) {
    state.roadblocks = [];
  }
  // The 5-star helicopter: faster than any cruiser, it only leaves when
  // heat drops below 5 stars.
  if (stars >= 5 && !state.heli) {
    state.heli = { x: state.player.x - 200, y: state.player.y - 200, angle: 0 };
    state.message = 'SCPD helicopter overhead — you cannot outrun it on the road!';
  } else if (stars < 5) {
    state.heli = null;
  }
  if (state.heli) {
    const h = state.heli;
    const d = Math.hypot(state.player.x - h.x, state.player.y - h.y);
    if (d > 10) {
      h.x += ((state.player.x - h.x) / d) * 380 * dt;
      h.y += ((state.player.y - h.y) / d) * 380 * dt;
    }
    h.angle = Math.atan2(state.player.y - h.y, state.player.x - h.x);
  }
  // Siren wail while the police are close.
  if (state.police.length && state.time - state.lastSiren > 4) {
    state.lastSiren = state.time;
    sfx.siren();
  }
}

// ------------------------------------------------------------------ clock
// The in-game clock: a full day is DAY_LENGTH_SEC real seconds. Crossing
// an hour pays turf income; weather rolls on its own timer.
function updateClock(state, dt) {
  state.clockHours = (CLOCK_START_HOUR + (state.time / DAY_LENGTH_SEC) * 24) % 24;
  const hour = Math.floor(state.clockHours);
  if (hour !== state.lastHour) {
    state.lastHour = hour;
    const income = turfHourlyIncome();
    if (income > 0) {
      state.money += income;
      state.message = `Turf income +$${income}`;
    }
  }
  state.weatherTimer -= dt;
  if (state.weatherTimer <= 0) {
    state.weatherTimer = 75 + state.rng.range(0, 60);
    state.weather = state.rng.pick(['clear', 'clear', 'rain', 'fog']);
  }
  if (state.weather === 'rain' && state.rainDrops.length < 90) {
    for (let i = 0; i < 4; i++) {
      state.rainDrops.push({ x: state.rng.range(0, 1280), y: -10, speed: state.rng.range(500, 800) });
    }
  }
  for (const d of state.rainDrops) d.y += d.speed * dt;
  state.rainDrops = state.rainDrops.filter((d) => d.y < 760);
}

// ------------------------------------------------------------------ traffic
function updateTraffic(state, dt) {
  const hour = Math.floor(state.clockHours);
  const target = trafficTarget(hour);
  while (state.traffic.length < target) {
    state.traffic.push(spawnTrafficCar(state.rng, state.traffic.length));
  }
  while (state.traffic.length > target) state.traffic.pop();
  for (const t of state.traffic) {
    // Traffic follows its road: vertical cars move in y, horizontal in x.
    if (t.vertical) {
      t.y += t.dir * t.speed * dt;
      if (t.y < 100 || t.y > WORLD - 100) t.dir *= -1;
    } else {
      t.x += t.dir * t.speed * dt;
      if (t.x < 100 || t.x > WORLD - 100) t.dir *= -1;
    }
    // Never spawn or sit on top of the player.
    const d = Math.hypot(t.x - state.player.x, t.y - state.player.y);
    if (d < 50) {
      t.x += (t.x - state.player.x) / d * 60;
      t.y += (t.y - state.player.y) / d * 60;
    }
  }
  // Pedestrians wander the sidewalks.
  for (const p of state.peds) {
    p.x += Math.cos(p.angle) * p.speed * dt;
    p.y += Math.sin(p.angle) * p.speed * dt;
    if (p.x < 60 || p.x > WORLD - 60 || p.y < 60 || p.y > WORLD - 60 || state.rng.chance(0.002)) {
      p.angle = state.rng.range(0, Math.PI * 2);
      p.x = Math.max(60, Math.min(WORLD - 60, p.x));
      p.y = Math.max(60, Math.min(WORLD - 60, p.y));
    }
  }
}

// ------------------------------------------------------------------ paint
// Lou's Paint Shop: driving in clears heat and repairs the car for $50.
// Press G inside the shop to repaint the car a new colour for $25.
function updatePaintShop(state, input, dt) {
  if (state.paintCooldown > 0) state.paintCooldown -= dt;
  if (!inPaintShop(state.player.x, state.player.y)) return;
  if (state.paintCooldown <= 0 && (state.heat > 0 || (state.player.car && state.player.car.health < 100))) {
    state.paintCooldown = 5;
    const cost = Math.min(PAINT_COST, state.money);
    state.money -= cost;
    state.heat = 0;
    if (state.player.car) {
      const stats = moddedCarStats(state, state.player.car);
      state.player.car.health = stats.maxHealth;
    }
    state.message = `Lou's Paint Shop — heat cleared, car repaired. -$${cost}`;
    sfx.success();
  }
  if (keyPressed(input, 'g') && state.player.car) {
    if (state.money < REPAINT_COST) {
      state.message = `Repaint costs $${REPAINT_COST} — not enough cash.`;
      return;
    }
    state.money -= REPAINT_COST;
    const palette = ['#e33f2f', '#3f7de3', '#7a4fd0', '#2f8f5b', '#f2c230', '#e3e3e3', '#8a2f5b', '#3fd0c0'];
    state.repaintIndex = (state.repaintIndex + 1) % palette.length;
    state.player.car.color = palette[state.repaintIndex];
    state.message = `Fresh paint! -$${REPAINT_COST}`;
    sfx.pickup();
  }
}

// ------------------------------------------------------------------ wasted
function checkWasted(state) {
  if (state.player.health > 0) return;
  state.screen = 'wasted';
  state.wastedTimer = 3;
  state.money = Math.max(0, state.money - 100); // hospital bill
  state.heat = 0;
  state.mission = { active: false, id: 0, def: null, stage: '', timer: 0, guards: [], ledgerTaken: false, escapeTimer: 0 };
  state.turf.active = false;
  state.race.active = false;
  state.delivery.active = false;
  state.respawnCount += 1;
}

function respawn(state) {
  state.player.health = 100;
  state.player.x = 387;
  state.player.y = 2151; // hospital, by the Marina
  state.player.inCar = false;
  state.player.car = null;
  state.player.speed = 0;
  state.player.ammo = AMMO_MAG;
  state.player.reserve = AMMO_RESERVE_START;
  state.screen = 'play';
  state.message = 'You woke up at the Marina hospital. -$100.';
}

// ------------------------------------------------------------------ update
export function updateGame(state, input, dt) {
  dt = Math.min(dt, 0.05);
  state.time += dt;
  if (state.messageTimer > 0) {
    state.messageTimer -= dt;
    if (state.messageTimer <= 0) state.message = '';
  }
  if (state.screen === 'wasted') {
    state.wastedTimer -= dt;
    if (state.wastedTimer <= 0) respawn(state);
    return;
  }
  if (state.screen !== 'play') return;

  updateClock(state, dt);
  updateTraffic(state, dt);

  // Heat decays while the player lays low.
  if (state.time - state.lastCrime > 4) {
    state.heat = Math.max(0, state.heat - HEAT_DECAY_PER_SEC * dt);
  }
  updatePolice(state, dt);

  // Movement.
  if (state.player.inCar) driveCar(state, input, dt);
  else walkPlayer(state, input, dt);

  // Keys.
  if (keyPressed(input, 'e')) tryStealOrExit(state);
  if (keyPressed(input, 't')) {
    if (state.fare.active && !state.fare.pickedUp) startFare(state);
  }
  if (keyPressed(input, 'p', 'Escape')) {
    state.screen = 'pause';
    return;
  }
  if (keyPressed(input, 'm')) toggleMute();
  if (keyPressed(input, 'f')) {
    const targets = [...state.mission.guards, ...state.turf.rivals];
    const hit = punch(targets, state.player.x, state.player.y, state.player.inCar ? state.player.angle : state.player.onFootAngle);
    if (hit) {
      sfx.punch();
      if (hit.hp <= 0) hit.dead = true;
    }
  }
  if (keyPressed(input, 'r')) {
    // Reload from the reserve.
    const p = state.player;
    const need = AMMO_MAG - p.ammo;
    const take = Math.min(need, p.reserve);
    if (take > 0) {
      p.ammo += take;
      p.reserve -= take;
      sfx.click();
    }
  }
  // Shooting: click aims at the mouse (screen space -> world space).
  if (input.mouseClicked && !state.player.inCar) {
    const p = state.player;
    if (p.ammo > 0) {
      const wx = state.camera.x - 640 + input.mouseX;
      const wy = state.camera.y - 360 + input.mouseY;
      const ang = Math.atan2(wy - p.y, wx - p.x);
      fireBullet(state.bullets, p.x, p.y, ang);
      p.ammo -= 1;
      sfx.shot();
      addHeat(state, HEAT_SHOT);
    } else {
      sfx.click();
    }
  }
  // Bullets vs guards and rivals.
  const targets = [...state.mission.guards, ...state.turf.rivals];
  const hits = updateBullets(state.bullets, dt, targets);
  for (const h of hits) {
    h.target.hp -= h.damage;
    if (h.target.hp <= 0) h.target.dead = true;
  }

  // Mod shop purchases: 1 = Engine, 2 = Armor, 3 = Tires (inside the shop).
  if (inModShop(state.player.x, state.player.y)) {
    if (keyPressed(input, '1')) buyMod(state, 'engine');
    if (keyPressed(input, '2')) buyMod(state, 'armor');
    if (keyPressed(input, '3')) buyMod(state, 'tires');
  }

  // Coins, fares, deliveries, races, turf, near misses, paint shop.
  const coinMoney = collectCoins(state.coins, state.player.x, state.player.y);
  if (coinMoney > 0) {
    state.money += coinMoney;
    state.score += coinMoney;
    sfx.coin();
    state.message = `Solmar coin! +$${coinMoney} (${coinsCollected(state.coins)}/10)`;
    state.messageTimer = 3;
  }
  state.money += updateFare(state);
  state.money += updateDelivery(state, dt);
  state.money += updateRace(state, dt);
  state.money += updateTurf(state, dt);
  const nm = checkNearMiss(state, state.traffic);
  if (nm > 0) {
    state.money += nm;
    state.score += nm;
    sfx.whoosh();
    state.messageTimer = 2;
  }
  // Delivery spotting raises heat faster.
  if (state.delivery.active && state.delivery.spotted) {
    state.delivery.spotted = false;
    addHeat(state, HEAT_DELIVERY_SPOTTED);
    state.message = 'The police spotted your package!';
  }
  updatePaintShop(state, input, dt);

  // The story.
  state.money += updateMission(state, dt);

  // Turf challenge start: press C while standing in a rival zone.
  if (keyPressed(input, 'c')) {
    const zone = turfZoneAt(state.player.x, state.player.y);
    if (zone && zone.owner !== 'player' && !state.turf.active) {
      startTurfChallenge(state, zone);
    }
  }
  // Delivery start: press V near a package marker.
  if (keyPressed(input, 'v') && !state.delivery.active) startDelivery(state);

  // WASTED check.
  checkWasted(state);

  // Camera follows the player.
  state.camera.x += (state.player.x - state.camera.x) * Math.min(1, 6 * dt);
  state.camera.y += (state.player.y - state.camera.y) * Math.min(1, 6 * dt);
  state.camera.x = Math.max(640, Math.min(WORLD - 640, state.camera.x));
  state.camera.y = Math.max(360, Math.min(WORLD - 360, state.camera.y));

  // Autosave every few seconds of play.
  if (Math.floor(state.time) % 5 === 0 && state.time - (state.lastSave || 0) > 4) {
    state.lastSave = state.time;
    saveGame(state);
  }
}

// ------------------------------------------------------------------ rank
export function rankIndex(state) {
  if (state.storyComplete) return 6;
  const done = state.missionsDone.length;
  if (done >= 6) return 5;
  if (done >= 5) return 4;
  if (done >= 4) return 3;
  if (done >= 3) return 2;
  if (done >= 1) return 1;
  return 0;
}

export function rankTitle(state) {
  return RANKS[rankIndex(state)];
}

// ------------------------------------------------------------------ save
export function saveGame(state) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        money: state.money,
        score: state.score,
        missionsDone: state.missionsDone,
        coins: coinsSave(state.coins),
        mods: state.mods,
        turf: state.turfAllBonusPaid,
        turfOwners: TURF_ZONES.map((z) => ({ name: z.name, owner: z.owner })),
        storyComplete: state.storyComplete,
        stats: state.stats,
      }),
    );
  } catch {
    // A save that cannot be written must never break the game.
  }
}

export function loadGame(state) {
  if (typeof localStorage === 'undefined') return false;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    state.money = data.money || 0;
    state.score = data.score || 0;
    state.missionsDone = Array.isArray(data.missionsDone) ? data.missionsDone : [];
    state.storyComplete = !!data.storyComplete;
    state.mods = data.mods || { engine: 0, armor: 0, tires: 0 };
    state.turfAllBonusPaid = !!data.turf;
    if (data.stats) state.stats = { ...state.stats, ...data.stats };
    coinsLoad(state.coins, data.coins);
    if (Array.isArray(data.turfOwners)) {
      // Turf owners live on the shared zone objects; restore them by name.
      for (const saved of data.turfOwners) {
        const zone = TURF_ZONES.find((z) => z.name === saved.name);
        if (zone) zone.owner = saved.owner;
      }
      state.stats.turfHeld = TURF_ZONES.filter((z) => z.owner === 'player').length;
    }
    return true;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------ boot
// Browser entry: wire the canvas, input and the animation loop together.
export function boot(canvas) {
  const state = createGame();
  const input = createInput();
  // Keyboard listens on the window, not the canvas: the game must answer
  // keys even when the canvas never took focus (a real browser quirk).
  attachInput(input, typeof window !== 'undefined' ? window : canvas);
  loadGame(state);
  installShotsApi(state, input);
  const ctx2d = canvas.getContext('2d');

  // The click that leaves the title screen must not also count as a
  // click on a mission-board card in the very next frame.
  let ignoreBoardClick = false;

  // Title screen: click or Enter to play.
  function titleKey(e) {
    if (state.screen === 'title' && (e.key === 'Enter' || e.key === ' ')) {
      state.screen = 'board';
      sfx.click();
    }
  }
  if (typeof window !== 'undefined') window.addEventListener('keydown', titleKey);

  canvas.addEventListener('mousedown', () => {
    if (state.screen === 'title') {
      state.screen = 'board';
      ignoreBoardClick = true;
      sfx.click();
    }
  });

  let last = 0;
  function frame(ts) {
    const dt = last === 0 ? 0.016 : Math.min(0.05, (ts - last) / 1000);
    last = ts;
    // Board screen: number keys pick a job, B goes back.
    if (state.screen === 'board') {
      for (let i = 1; i <= 7; i++) {
        if (keyPressed(input, String(i))) {
          if (startMission(state, i)) state.screen = 'play';
          sfx.click();
        }
      }
      if (keyPressed(input, 'b', 'Escape')) state.screen = 'title';
      if (input.mouseClicked) {
        if (ignoreBoardClick) {
          // The click that opened the board, not a card pick.
          ignoreBoardClick = false;
        } else {
          // Clicking a board card starts that job (cards are laid out in code).
          const idx = boardClickIndex(input.mouseX, input.mouseY);
          if (idx >= 1 && idx <= 7 && startMission(state, idx)) state.screen = 'play';
        }
      }
    }
    if (state.screen === 'pause') {
      if (keyPressed(input, 'p', 'Escape')) {
        state.screen = 'play';
        // Consume the press: updateGame would otherwise pause again
        // in the same frame and P could never resume.
        input.pressed.delete('p');
        input.pressed.delete('Escape');
      }
      if (keyPressed(input, 'q')) state.screen = 'title';
    }
    updateGame(state, input, dt);
    render(ctx2d, state, input);
    endFrameInput(input);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return state;
}

// Which mission-board card (if any) sits under a click. Cards are drawn
// in render.js at these exact coordinates, so the two must agree.
export function boardClickIndex(mx, my) {
  for (let i = 0; i < 7; i++) {
    const x = 90 + (i % 4) * 300;
    const y = 170 + Math.floor(i / 4) * 190;
    if (mx >= x && mx <= x + 270 && my >= y && my <= y + 160) return i + 1;
  }
  return 0;
}

// Keep the landmark import used (the mod shop lookup lives here for the HUD).
export function modShopLandmark() {
  return landmarkByKind('modshop');
}
