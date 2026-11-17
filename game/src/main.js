// main.js — Solmar Heat: the game itself.
// Owns the state, the frame loop, and every system that makes the city alive:
// walking and driving, stealing cars, shooting, the wanted level and the
// police who answer it, the three story missions, and the save.

import { CITY, VEHICLES, PLAYER, PISTOL, WANTED, MISSIONS, PLACES, FEEL, SAVE_KEY } from './config.js';
import { makeRng } from './random.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import {
  createWorld, blockRect, placeCenter, nearestNode, nodePoint,
  onRoad, makeCar, parkingSpotNear, spawnTraffic, spawnPedestrians,
  stepTraffic, stepPedestrian, stepCruiser, stepFootCop, makeCruiser,
  makeFootCop, resolveBuildingCollision, rectsOverlap,
} from './world.js';
import { drawFrame } from './render.js';
import { readShotParams, applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const G = {
  state: 'menu', // menu | play | paused | wasted | busted
  now: 0,
  time: FEEL.startHour * 3600,
  cash: 0,
  wanted: 0,
  heat: 0,
  lastCrime: -9999,
  missionIndex: 0,
  missionStage: 0,
  storyDone: false,
  player: null,
  playerCar: null,
  world: null,
  camera: { x: 0, y: 0, zoom: FEEL.zoom },
  view: { w: 1280, h: 800 },
  effects: { bullets: [], skid: [], muzzle: { x: 0, y: 0, life: 0 } },
  hintText: '',
  objectiveText: '',
  objectivePos: null,
  banner: null,
  toast: null,
  holdProgress: 0,
  holdLabel: '',
  howto: false,
  storyPanel: false,
  hasSave: false,
  endCardText: '',
  uiButtons: [],
  input: new Input(canvas),
  sound: new SoundBank(),
  rng: makeRng(2026),
  shot: null,
};

// --- Setup ------------------------------------------------------------------

function freshPlayer(x, y) {
  return {
    x, y, angle: 0, hp: PLAYER.maxHp,
    ammo: PISTOL.magSize, reserveAmmo: 48,
    reloading: false, reloadT: 0, fireCd: 0, punchCd: 0, aiming: false,
  };
}

function spawnParkedCars(rng) {
  const cars = [];
  const spots = [
    ['vento', 'docks', 1, '#c23b2e', true],
    ['sirocco', 'park', -1, '#e8b13c', false],
    ['falco', 'bank', 1, '#2e6fc2', false],
    ['cab', 'motel', -1, '#f2c230', false],
    ['mule', 'hospital', 1, '#8a8f96', false],
    ['bison', 'safehouse', -1, '#7a4a8c', false],
    ['hauler', 'docks', -1, '#5b7d3c', false],
  ];
  for (const [type, place, side, color, missionCar] of spots) {
    const s = parkingSpotNear(rng, place, side);
    const car = makeCar(type, s.x, s.y, s.angle, { parked: true, color });
    car.missionCar = missionCar;
    cars.push(car);
  }
  return cars;
}

function spawnPickups() {
  const spots = [
    { x: placeCenter('hospital').x - 60, y: placeCenter('hospital').y, kind: 'health' },
    { x: placeCenter('park').x + 80, y: placeCenter('park').y - 40, kind: 'health' },
    { x: placeCenter('safehouse').x + 40, y: placeCenter('safehouse').y + 60, kind: 'ammo' },
    { x: placeCenter('pier').x - 40, y: placeCenter('pier').y - 60, kind: 'ammo' },
    { x: placeCenter('motel').x + 70, y: placeCenter('motel').y + 40, kind: 'health' },
  ];
  return spots.map((s) => ({ ...s, taken: false }));
}

function newGame() {
  G.world = createWorld(1337);
  G.world.parkedCars = spawnParkedCars(G.rng);
  G.world.pickups = spawnPickups();
  const home = placeCenter('safehouse');
  // Spawn on the street just south of the safehouse block, so Rex can walk
  // freely in any direction instead of starting against a wall.
  G.player = freshPlayer(home.x, (PLACES.safehouse.block[1] + 1) * CITY.pitch);
  G.playerCar = null;
  G.cash = 0;
  G.wanted = 0;
  G.heat = 0;
  G.lastCrime = -9999;
  G.missionIndex = 0;
  G.missionStage = 0;
  G.storyDone = false;
  G.time = FEEL.startHour * 3600;
  G.camera.x = G.player.x;
  G.camera.y = G.player.y;
  G.effects = { bullets: [], skid: [], muzzle: { x: 0, y: 0, life: 0 } };
  G.banner = null;
  G.toast = null;
  G.holdProgress = 0;
  startMission(0);
}

// --- Save -------------------------------------------------------------------

function saveGame() {
  try {
    const s = {
      cash: G.cash, missionIndex: G.missionIndex, missionStage: G.missionStage,
      storyDone: G.storyDone, x: G.player.x, y: G.player.y,
      hp: G.player.hp, time: G.time,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    G.hasSave = true;
  } catch (e) { /* saving is best-effort */ }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function continueGame() {
  const s = loadSave();
  if (!s) { newGame(); return; }
  newGame();
  G.cash = s.cash || 0;
  G.missionIndex = Math.min(s.missionIndex || 0, 2);
  G.missionStage = s.missionStage || 0;
  G.storyDone = !!s.storyDone;
  G.player.x = s.x;
  G.player.y = s.y;
  G.player.hp = s.hp || PLAYER.maxHp;
  G.time = s.time || FEEL.startHour * 3600;
  G.camera.x = G.player.x;
  G.camera.y = G.player.y;
  startMission(G.missionIndex);
  G.missionStage = s.missionStage || 0;
  updateObjective();
  toast('Welcome back to Solmar');
}

// --- Missions -----------------------------------------------------------------

function currentMission() {
  return MISSIONS[G.missionIndex];
}

function currentStage() {
  const m = currentMission();
  return m ? m.stages[G.missionStage] : null;
}

function startMission(i) {
  if (i >= MISSIONS.length) {
    G.storyDone = true;
    G.objectiveText = '';
    G.objectivePos = null;
    return;
  }
  G.missionIndex = i;
  G.missionStage = 0;
  const m = MISSIONS[i];
  G.banner = { title: m.name + '  ·  $' + m.reward.toLocaleString('en-US'), text: m.intro, life: 9 };
  updateObjective();
}

function updateObjective() {
  if (G.storyDone || G.missionIndex >= MISSIONS.length) {
    G.objectiveText = 'Free roam — Solmar is yours';
    G.objectivePos = null;
    return;
  }
  const stage = currentStage();
  if (!stage) return;
  G.objectiveText = stage.label;
  const place = placeCenter(stage.place);
  G.objectivePos = { x: place.x, y: place.y };
}

function toast(text) {
  G.toast = { text, life: 3 };
}

function completeMission() {
  const m = currentMission();
  G.cash += m.reward;
  G.sound.cash();
  G.sound.missionDone();
  toast('Mission complete: +' + '$' + m.reward.toLocaleString('en-US'));
  saveGame();
  if (G.missionIndex + 1 >= MISSIONS.length) {
    G.storyDone = true;
    G.missionIndex = 3;
    G.banner = {
      title: 'SOLMAR IS YOURS',
      text: 'The Harbor Job is done. The vault money is yours, the SCPD lost your trail, and Mama Lou is already planning the next score. Free roam — drive anywhere, steal anything.',
      life: 10,
    };
    updateObjective();
  } else {
    startMission(G.missionIndex + 1);
  }
}

function advanceStage() {
  const m = currentMission();
  G.missionStage++;
  if (G.missionStage >= m.stages.length) {
    completeMission();
  } else {
    updateObjective();
  }
}

function spawnGangsters(placeKey, count) {
  const c = placeCenter(placeKey);
  for (let i = 0; i < count; i++) {
    G.world.gangsters.push({
      x: c.x + G.rng.range(-120, 120),
      y: c.y + G.rng.range(-120, 120),
      angle: 0, hp: 60, shootCd: G.rng.range(0.5, 2),
      color: G.rng.pick(['#3d2b4a', '#4a2b2b', '#2b3a4a']),
      alive: true,
    });
  }
}

// Exposed for the deterministic screenshot states in shots.js.
G.startMission = startMission;
G.spawnPolice = spawnPolice;
G.updateObjective = updateObjective;

// --- Wanted level and police --------------------------------------------------

function commitCrime(stars) {
  G.heat = Math.min(WANTED.maxStars, G.heat + stars);
  G.wanted = G.heat;
  G.lastCrime = G.now;
}

function spawnPolice(force) {
  const wantCruisers = WANTED.cruisersPerStar[Math.floor(G.wanted)] || 0;
  const wantCops = WANTED.copsPerStar[Math.floor(G.wanted)] || 0;
  const P = G.player;
  while (G.world.cruisers.length < wantCruisers) {
    const n = nearestNode(P.x, P.y);
    const ni = Math.max(0, Math.min(CITY.blocks, n.i + (G.rng.chance(0.5) ? 2 : -2)));
    const nj = Math.max(0, Math.min(CITY.blocks, n.j + (G.rng.chance(0.5) ? 2 : -2)));
    const p = nodePoint(ni, nj);
    const cr = makeCruiser(p.x, p.y);
    cr.repath = 0;
    G.world.cruisers.push(cr);
  }
  while (G.world.footCops.length < wantCops) {
    const a = G.rng.range(0, Math.PI * 2);
    const d = G.rng.range(260, 420);
    G.world.footCops.push(makeFootCop(P.x + Math.cos(a) * d, P.y + Math.sin(a) * d));
  }
  if (force) {
    // In shot mode the wanted level is set before this call; nothing extra.
  }
}

function despawnPolice() {
  if (G.wanted < 0.5) {
    G.world.cruisers = [];
    G.world.footCops = [];
  }
}

// --- Combat -------------------------------------------------------------------

function firePistol() {
  const P = G.player;
  if (P.ammo <= 0) {
    P.reloading = true;
    P.reloadT = PISTOL.reloadTime;
    return;
  }
  P.ammo--;
  P.fireCd = PISTOL.fireCooldown;
  const aim = P.angle + (Math.random() - 0.5) * PISTOL.spread * 2;
  const mx = P.x + Math.cos(aim) * PISTOL.range;
  const my = P.y + Math.sin(aim) * PISTOL.range;
  // Nearest hit: gangster, foot cop, pedestrian, or building.
  let bestD = PISTOL.range;
  let best = null;
  const consider = (x, y, radius, ref) => {
    const dx = x - P.x, dy = y - P.y;
    const along = dx * Math.cos(aim) + dy * Math.sin(aim);
    if (along < 0 || along > bestD) return;
    const perp = Math.abs(-dx * Math.sin(aim) + dy * Math.cos(aim));
    if (perp < radius + 6) { bestD = along; best = ref; }
  };
  for (const g of G.world.gangsters) if (g.alive) consider(g.x, g.y, 12, { kind: 'gangster', ref: g });
  for (const c of G.world.footCops) consider(c.x, c.y, 12, { kind: 'cop', ref: c });
  for (const p of G.world.pedestrians) consider(p.x, p.y, 10, { kind: 'ped', ref: p });
  for (const b of G.world.buildings) {
    const cx = Math.max(b.x, Math.min(P.x + Math.cos(aim) * bestD, b.x + b.w));
    const cy = Math.max(b.y, Math.min(P.y + Math.sin(aim) * bestD, b.y + b.h));
    consider(cx, cy, 2, { kind: 'wall', ref: null });
  }
  const endX = P.x + Math.cos(aim) * bestD;
  const endY = P.y + Math.sin(aim) * bestD;
  G.effects.bullets.push({ x1: P.x + Math.cos(aim) * 20, y1: P.y + Math.sin(aim) * 20, x2: endX, y2: endY, life: 0.12 });
  G.effects.muzzle = { x: P.x + Math.cos(aim) * 24, y: P.y + Math.sin(aim) * 24, life: 0.08 };
  G.sound.gunshot();
  G.gunshotEvent = { x: P.x, y: P.y };
  if (best) {
    if (best.kind === 'gangster') {
      best.ref.hp -= PISTOL.damage;
      if (best.ref.hp <= 0) best.ref.alive = false;
    } else if (best.kind === 'cop') {
      commitCrime(2);
    } else if (best.kind === 'ped') {
      commitCrime(2);
    }
  }
  // Firing where the law can see it draws heat.
  const nearCop = G.world.footCops.some((c) => Math.hypot(c.x - P.x, c.y - P.y) < 300) ||
    G.world.cruisers.some((c) => Math.hypot(c.x - P.x, c.y - P.y) < 340);
  const nearPed = G.world.pedestrians.some((p) => Math.hypot(p.x - P.x, p.y - P.y) < 220);
  if (nearCop || nearPed) commitCrime(1);
}

function punch() {
  const P = G.player;
  P.punchCd = PLAYER.punchCooldown;
  G.sound.punch();
  for (const g of G.world.gangsters) {
    if (!g.alive) continue;
    const d = Math.hypot(g.x - P.x, g.y - P.y);
    if (d < PLAYER.punchRange + 12) {
      g.hp -= PLAYER.punchDamage;
      if (g.hp <= 0) g.alive = false;
    }
  }
  for (const p of G.world.pedestrians) {
    const d = Math.hypot(p.x - P.x, p.y - P.y);
    if (d < PLAYER.punchRange + 10) {
      p.flee = 2;
      p.fleeX = p.x - P.x;
      p.fleeY = p.y - P.y;
      commitCrime(1);
    }
  }
}

// --- Cars ---------------------------------------------------------------------

function nearestCar(maxD) {
  const P = G.player;
  let best = null, bestD = maxD;
  const check = (car) => {
    const d = Math.hypot(car.x - P.x, car.y - P.y);
    if (d < bestD) { bestD = d; best = car; }
  };
  for (const car of G.world.parkedCars) check(car);
  for (const car of G.world.traffic) check(car);
  return best;
}

function enterCar(car) {
  const P = G.player;
  // Stealing in front of a witness calls the cops.
  const witnessed = G.world.pedestrians.some((p) => Math.hypot(p.x - P.x, p.y - P.y) < 200) ||
    G.world.footCops.some((c) => Math.hypot(c.x - P.x, c.y - P.y) < 320) ||
    G.world.cruisers.some((c) => Math.hypot(c.x - P.x, c.y - P.y) < 340);
  if (car.parked || car.driver === 'traffic') {
    if (witnessed) commitCrime(1);
    if (!car.parked && car.driver === 'traffic') {
      G.world.traffic = G.world.traffic.filter((t) => t !== car);
    } else {
      G.world.parkedCars = G.world.parkedCars.filter((t) => t !== car);
    }
    car.parked = false;
    car.driver = 'player';
    G.playerCar = car;
    G.sound.engineStart();
    G.sound.startEngine();
    if (car.missionCar && !G.storyDone && G.missionIndex === 0 && G.missionStage === 0) {
      advanceStage();
    }
  }
}

function exitCar() {
  const car = G.playerCar;
  if (!car) return;
  const P = G.player;
  P.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  P.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  P.angle = car.angle;
  car.driver = null;
  car.parked = true;
  car.speed = 0;
  G.world.parkedCars.push(car);
  G.playerCar = null;
  G.sound.stopEngine();
}

// --- Per-frame update -----------------------------------------------------------

function stepPlay(dt) {
  const P = G.player;
  const inp = G.input;
  G.time = (G.time + dt * (86400 / FEEL.dayLength)) % 86400;
  if (G.banner) { G.banner.life -= dt; if (G.banner.life <= 0) G.banner = null; }
  if (G.toast) { G.toast.life -= dt; if (G.toast.life <= 0) G.toast = null; }

  // Wanted decay: lay low and the heat falls.
  if (G.now - G.lastCrime > WANTED.decayDelay && G.heat > 0) {
    G.heat = Math.max(0, G.heat - WANTED.decayPerSecond * dt);
    G.wanted = G.heat;
  }
  spawnPolice(false);
  despawnPolice();
  G.sound.setSiren(G.world.cruisers.length > 0 && G.state === 'play');

  // Mouse aim in world coordinates.
  const cam = G.camera;
  const mwx = (inp.mouse.x - G.view.w / 2) / cam.zoom + cam.x;
  const mwy = (inp.mouse.y - G.view.h / 2) / cam.zoom + cam.y;

  if (G.playerCar) {
    const car = G.playerCar;
    const d = car.def;
    // Drive: W/S throttle, A/D steer, Space handbrake.
    const fwd = inp.any('KeyW', 'ArrowUp') ? 1 : 0;
    const back = inp.any('KeyS', 'ArrowDown') ? 1 : 0;
    const steer = (inp.any('KeyA', 'ArrowLeft') ? -1 : 0) + (inp.any('KeyD', 'ArrowRight') ? 1 : 0);
    const handbrake = inp.down('Space');
    if (fwd) car.speed += d.accel * dt;
    if (back) car.speed -= (car.speed > 10 ? d.accel * 1.2 : d.accel * 0.55) * dt;
    if (!fwd && !back) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 140 * dt);
    if (handbrake) {
      car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 620 * dt);
      if (Math.abs(car.speed) > 120 && Math.random() < 0.5) {
        G.effects.skid.push({ x: car.x - Math.cos(car.angle) * 14, y: car.y - Math.sin(car.angle) * 14, angle: car.angle, life: 4 });
      }
    }
    car.speed = Math.max(-d.speed * 0.35, Math.min(d.speed, car.speed));
    const turnRate = d.turn * steer * Math.min(1, Math.abs(car.speed) / 140) * Math.sign(car.speed || 1);
    car.angle += turnRate * dt * (car.speed >= 0 ? 1 : -1);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Keep the car out of buildings and inside the world.
    const fx = car.x + Math.cos(car.angle) * 16;
    const fy = car.y + Math.sin(car.angle) * 16;
    const bx = car.x - Math.cos(car.angle) * 16;
    const by = car.y - Math.sin(car.angle) * 16;
    const front = resolveBuildingCollision(fx, fy, 15, G.world.buildings);
    const backPt = resolveBuildingCollision(bx, by, 15, G.world.buildings);
    const scraped = Math.hypot(front.x - fx, front.y - fy) > 2 ||
      Math.hypot(backPt.x - bx, backPt.y - by) > 2;
    car.x = (front.x + backPt.x) / 2;
    car.y = (front.y + backPt.y) / 2;
    if (scraped) car.speed *= 0.4; // scraped a wall: lose speed
    car.x = Math.max(20, Math.min(CITY.size - 20, car.x));
    car.y = Math.max(20, Math.min(CITY.size - 20, car.y));
    P.x = car.x; P.y = car.y; P.angle = car.angle;
    G.sound.setEngine(Math.abs(car.speed) / d.speed, true);
    if (inp.hit('KeyE')) exitCar();
    // Running over a pedestrian is a crime.
    for (const ped of G.world.pedestrians) {
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < 24 && Math.abs(car.speed) > 60) {
        ped.flee = 3;
        ped.fleeX = ped.x - car.x;
        ped.fleeY = ped.y - car.y;
        commitCrime(2);
      }
    }
  } else {
    // On foot: WASD, Shift to run, mouse aims.
    const mx = (inp.any('KeyD', 'ArrowRight') ? 1 : 0) - (inp.any('KeyA', 'ArrowLeft') ? 1 : 0);
    const my = (inp.any('KeyS', 'ArrowDown') ? 1 : 0) - (inp.any('KeyW', 'ArrowUp') ? 1 : 0);
    const run = inp.down('ShiftLeft') || inp.down('ShiftRight');
    const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const len = Math.hypot(mx, my) || 1;
    P.x += (mx / len) * speed * dt * (mx || my ? 1 : 0);
    P.y += (my / len) * speed * dt * (mx || my ? 1 : 0);
    const fixed = resolveBuildingCollision(P.x, P.y, PLAYER.radius, G.world.buildings);
    P.x = fixed.x; P.y = fixed.y;
    P.x = Math.max(20, Math.min(CITY.size - 20, P.x));
    P.y = Math.max(20, Math.min(CITY.size - 20, P.y));
    P.angle = Math.atan2(mwy - P.y, mwx - P.x);
    P.aiming = inp.mouse.down || Math.hypot(mwx - P.x, mwy - P.y) < 500;
    G.sound.setEngine(0, false);
    // Timers.
    if (P.fireCd > 0) P.fireCd -= dt;
    if (P.punchCd > 0) P.punchCd -= dt;
    if (P.reloading) {
      P.reloadT -= dt;
      if (P.reloadT <= 0) {
        P.reloading = false;
        const need = PISTOL.magSize - P.ammo;
        const take = Math.min(need, P.reserveAmmo);
        P.ammo += take;
        P.reserveAmmo -= take;
      }
    }
    // Shoot / punch / reload. A click edge fires too, so a quick tap counts
    // even if the button is released between frames.
    const shotClick = inp.click();
    if ((inp.mouse.down || shotClick) && P.fireCd <= 0 && !P.reloading) firePistol();
    if (inp.hit('KeyR') && !P.reloading && P.ammo < PISTOL.magSize && P.reserveAmmo > 0) {
      P.reloading = true;
      P.reloadT = PISTOL.reloadTime;
    }
    if (inp.hit('KeyF') && P.punchCd <= 0) punch();
    // Enter a car.
    if (inp.hit('KeyE')) {
      const car = nearestCar(70);
      if (car) enterCar(car);
    }
  }

  // Mission hold actions (pick up the package / crack the vault).
  const stage = currentStage();
  if (stage && (stage.kind === 'pickup' || stage.kind === 'crack') && !G.playerCar) {
    const target = placeCenter(stage.place);
    const d = Math.hypot(target.x - P.x, target.y - P.y);
    if (d < 110) {
      G.holdLabel = stage.kind === 'pickup' ? 'Pick up the package' : 'Crack the vault';
      if (inp.down('KeyE')) {
        G.holdProgress += dt / 2.5;
        if (G.holdProgress >= 1) {
          G.holdProgress = 0;
          if (stage.kind === 'pickup') {
            spawnGangsters('motel', 3);
            commitCrime(2);
            G.banner = { title: 'AMBUSH!', text: 'Harbor Boys: "That package is ours, Marlowe." Get out — lose them and reach the paint shop.', life: 7 };
          } else {
            spawnGangsters('bank', 4);
            commitCrime(3);
            G.banner = { title: 'VAULT CRACKED', text: 'The vault is open and the alarm is screaming. The whole SCPD is coming — run for Pier 9.', life: 7 };
          }
          advanceStage();
        }
      } else {
        G.holdProgress = Math.max(0, G.holdProgress - dt);
      }
    } else {
      G.holdProgress = 0;
    }
  } else {
    G.holdProgress = 0;
  }

  // Mission arrival checks.
  if (stage && !G.storyDone) {
    const target = placeCenter(stage.place);
    const d = Math.hypot(target.x - P.x, target.y - P.y);
    if (stage.kind === 'go' && d < 80) advanceStage();
    if (stage.kind === 'deliver' && d < 90 && G.playerCar) advanceStage();
    if (stage.kind === 'escape' && d < 90) advanceStage();
  }

  // Traffic, pedestrians, police, gangsters.
  for (const car of G.world.traffic) stepTraffic(car, dt, G.rng);
  const gunshot = G.gunshotEvent;
  for (const ped of G.world.pedestrians) stepPedestrian(ped, dt, G.rng, gunshot);
  G.gunshotEvent = null;
  for (const cr of G.world.cruisers) stepCruiser(cr, dt, P, G.rng);
  for (const cop of G.world.footCops) stepFootCop(cop, dt, P, G.world.buildings);
  // Foot cops bust you on foot.
  if (!G.playerCar) {
    for (const cop of G.world.footCops) {
      const d = Math.hypot(cop.x - P.x, cop.y - P.y);
      if (d < WANTED.bustRadius) {
        cop.bustTimer += dt;
        if (cop.bustTimer >= WANTED.bustTime) {
          busted();
          return;
        }
      } else {
        cop.bustTimer = 0;
      }
    }
  }
  // Gangsters strafe and shoot back.
  for (const g of G.world.gangsters) {
    if (!g.alive) continue;
    const d = Math.hypot(P.x - g.x, P.y - g.y);
    g.angle = Math.atan2(P.y - g.y, P.x - g.x);
    if (d > 260) {
      g.x += Math.cos(g.angle) * 120 * dt;
      g.y += Math.sin(g.angle) * 120 * dt;
    } else if (d < 150) {
      g.x -= Math.cos(g.angle) * 60 * dt;
      g.y -= Math.sin(g.angle) * 60 * dt;
    }
    g.shootCd -= dt;
    if (g.shootCd <= 0 && d < 420) {
      g.shootCd = G.rng.range(1.1, 2.2);
      const spread = (Math.random() - 0.5) * 0.25;
      const a = g.angle + spread;
      const hitX = P.x + (Math.random() - 0.5) * 30;
      const hitY = P.y + (Math.random() - 0.5) * 30;
      G.effects.bullets.push({ x1: g.x, y1: g.y, x2: hitX, y2: hitY, life: 0.12 });
      G.sound.gunshot();
      if (Math.random() < 0.45) {
        P.hp -= 7;
        if (P.hp <= 0) { wasted(); return; }
      }
    }
  }
  // Pickups.
  for (const p of G.world.pickups) {
    if (p.taken) continue;
    if (Math.hypot(p.x - P.x, p.y - P.y) < 26) {
      p.taken = true;
      G.sound.pickup();
      if (p.kind === 'health') P.hp = Math.min(PLAYER.maxHp, P.hp + 40);
      else P.reserveAmmo += 24;
      toast(p.kind === 'health' ? '+40 health' : '+24 ammo');
    }
  }
  // Cruiser rams: a cruiser touching the player hurts.
  for (const cr of G.world.cruisers) {
    if (Math.hypot(cr.x - P.x, cr.y - P.y) < 30) {
      if (G.playerCar) {
        G.playerCar.speed *= 0.6;
      } else {
        P.hp -= 30 * dt;
        if (P.hp <= 0) { wasted(); return; }
      }
    }
  }
  // Effects decay.
  for (const b of G.effects.bullets) b.life -= dt;
  G.effects.bullets = G.effects.bullets.filter((b) => b.life > 0);
  for (const s of G.effects.skid) s.life -= dt;
  G.effects.skid = G.effects.skid.filter((s) => s.life > 0);
  if (G.effects.muzzle.life > 0) G.effects.muzzle.life -= dt;
  // Slow health regen out of combat.
  if (P.hp < PLAYER.maxHp && G.wanted < 1) P.hp = Math.min(PLAYER.maxHp, P.hp + 1.2 * dt);

  // Hint line.
  updateHint();
  // Camera follows the player.
  const tx = P.x, ty = P.y;
  G.camera.x += (tx - G.camera.x) * Math.min(1, FEEL.cameraLerp * dt);
  G.camera.y += (ty - G.camera.y) * Math.min(1, FEEL.cameraLerp * dt);

  if (inp.hit('Escape')) {
    G.state = 'paused';
    saveGame();
    G.sound.setSiren(false);
    G.sound.setEngine(0, false);
  }
  if (inp.hit('KeyM')) {
    const muted = G.sound.toggleMute();
    toast(muted ? 'Sound muted' : 'Sound on');
  }
}

function updateHint() {
  const P = G.player;
  if (G.holdProgress > 0 || G.holdLabel) {
    if (G.holdProgress > 0) {
      G.hintText = G.holdLabel + '… ' + Math.round(G.holdProgress * 100) + '% (hold E)';
      return;
    }
  }
  if (G.playerCar) {
    G.hintText = 'W/S drive · A/D steer · Space handbrake · E get out';
    return;
  }
  const car = nearestCar(70);
  if (car) {
    G.hintText = 'E — Steal the ' + car.def.name + (car.missionCar ? '  ★ mission car' : '');
    return;
  }
  const stage = currentStage();
  if (stage && (stage.kind === 'pickup' || stage.kind === 'crack')) {
    const target = placeCenter(stage.place);
    if (Math.hypot(target.x - P.x, target.y - P.y) < 110) {
      G.hintText = 'Hold E — ' + (stage.kind === 'pickup' ? 'Pick up the package' : 'Crack the vault');
      return;
    }
  }
  G.hintText = 'WASD move · Shift run · Click shoot · F punch · E enter car';
}

// --- Wasted / Busted ----------------------------------------------------------

function wasted() {
  G.state = 'wasted';
  G.sound.wasted();
  G.sound.setSiren(false);
  G.sound.setEngine(0, false);
  G.sound.stopEngine();
  G.endCardText = 'The SCPD scraped you off the asphalt. Solmar General patched you up — minus $' + Math.min(G.cash, 200) + '.';
  G.cash = Math.max(0, G.cash - 200);
}

function busted() {
  G.state = 'busted';
  G.sound.busted();
  G.sound.setSiren(false);
  G.sound.setEngine(0, false);
  G.sound.stopEngine();
  const fine = WANTED.finePerStar * Math.max(1, Math.round(G.wanted));
  G.endCardText = 'The SCPD caught you. Fine: $' + fine + '. Mama Lou is not impressed.';
  G.cash = Math.max(0, G.cash - fine);
  G.wanted = 0;
  G.heat = 0;
}

function wakeUp() {
  const hosp = placeCenter('hospital');
  if (G.playerCar) { G.playerCar = null; }
  G.player.x = hosp.x;
  G.player.y = hosp.y + 60;
  G.player.hp = PLAYER.maxHp;
  G.player.ammo = PISTOL.magSize;
  G.player.reserveAmmo = 48;
  G.world.cruisers = [];
  G.world.footCops = [];
  G.wanted = 0;
  G.heat = 0;
  G.camera.x = G.player.x;
  G.camera.y = G.player.y;
  G.state = 'play';
  saveGame();
}

// --- Menus --------------------------------------------------------------------

function handleMenuClick() {
  const click = G.input.click();
  if (!click) return false;
  for (const b of G.uiButtons) {
    if (click.x >= b.x && click.x <= b.x + b.w && click.y >= b.y && click.y <= b.y + b.h) {
      G.sound.click();
      if (b.id === 'continue') { G.state = 'play'; continueGame(); }
      else if (b.id === 'new') { newGame(); G.state = 'play'; G.sound.unlock(); G.sound.startEngine(); }
      else if (b.id === 'howto') { G.howto = true; G.storyPanel = false; }
      else if (b.id === 'missions') { G.storyPanel = true; G.howto = false; }
      else if (b.id === 'close') { G.howto = false; G.storyPanel = false; }
      else if (b.id === 'resume') { G.state = 'play'; }
      else if (b.id === 'quit') { saveGame(); G.state = 'menu'; }
      else if (b.id === 'wake') { wakeUp(); }
      return true;
    }
  }
  return false;
}

// --- Frame loop ---------------------------------------------------------------

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  G.view.w = canvas.width;
  G.view.h = canvas.height;
}

let lastT = 0;
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
  lastT = t;
  G.now += dt;
  if (G.state === 'menu') {
    handleMenuClick();
    if (G.input.hit('Enter')) {
      if (G.hasSave) { G.state = 'play'; continueGame(); }
      else { newGame(); G.state = 'play'; G.sound.unlock(); }
    }
  } else if (G.state === 'play') {
    stepPlay(dt);
  } else if (G.state === 'paused') {
    handleMenuClick();
    if (G.input.hit('Escape') || G.input.hit('Enter')) G.state = 'play';
  } else if (G.state === 'wasted' || G.state === 'busted') {
    handleMenuClick();
    if (G.input.hit('Enter')) wakeUp();
  }
  drawFrame(ctx, G);
  G.input.endFrame();
}

// --- Boot ---------------------------------------------------------------------

// Debug handle for play-testing (read-only state inspection from the console).
window.__solmar = G;

G.hasSave = !!loadSave();
G.shot = readShotParams();
G.input.attach();
window.addEventListener('resize', resize);
resize();
newGame();
if (G.shot) {
  applyShot(G, G.shot.shot, makeRng(G.shot.seed));
  if (G.shot.shot !== 'start') {
    // In shot mode the game is already playing; freeze the camera on the pose.
    G.camera.x = G.player.x;
    G.camera.y = G.player.y;
  }
}
requestAnimationFrame(frame);
