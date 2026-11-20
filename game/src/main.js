// main.js — boot, the frame loop, and the state machine.
// One job: wire input/world/render/audio together. States: title,
// play, pause (the map & record screen), modshop, wasted, busted.
// With ?shot=<name> it instead holds one staged frame perfectly
// still for the entry screenshots.

import { dist } from './config.js';
import { createInput } from './input.js';
import {
  createWorld, stepWorld, driveCar, moveOnFoot, addHeat,
} from './world.js';
import { renderFrame, cameraFor } from './render.js';
import { AudioSys } from './audio.js';
import { SHOT_NAMES, stageShot } from './shots.js';
import { startStory, stepMissions, notice } from './missions.js';
import { playerShoot, playerReload, playerPunch, stepCombat, spawnGang } from './combat.js';
import { raceAt, startRace, stepRaces } from './races.js';
import { acceptFare, startDelivery, stepSidejobs } from './sidejobs.js';
import { stepTurf } from './turf.js';
import { stepCollectibles } from './collectibles.js';
import { buyMod, MOD_TRACKS } from './modshop.js';
import { cycleRadio } from './radio.js';
import { landmarkById, nearestLandmark } from './landmarks.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = createInput(canvas);
const audio = new AudioSys();
const SEED = 20261121;

// ------------------------------------------------------------ save/load

const SAVE_KEY = 'solmarheat-save-v1';

function saveGame(world) {
  try {
    const p = world.player;
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: p.money, score: p.score, rank: p.rank,
      carsStolen: p.carsStolen, fares: p.fares, deliveries: p.deliveries,
      nearMisses: p.nearMisses, shots: p.shots,
      missionIdx: world.mission ? world.mission.idx : 0,
      storyDone: world.storyDone, raceWins: world.raceWins,
      coins: world.coins.map((c) => c.taken),
      turf: world.turf.zones.map((z) => z.owner),
      mods: world.mods,
    }));
    world.saveExists = true;
  } catch { /* storage unavailable — play on unsaved */ }
}

function loadGame(world) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    const p = world.player;
    p.money = s.money ?? p.money;
    p.score = s.score ?? 0;
    p.rank = s.rank ?? p.rank;
    p.carsStolen = s.carsStolen ?? 0;
    p.fares = s.fares ?? 0;
    p.deliveries = s.deliveries ?? 0;
    p.nearMisses = s.nearMisses ?? 0;
    p.shots = s.shots ?? 0;
    world.storyDone = !!s.storyDone;
    world.raceWins = s.raceWins ?? 0;
    if (Array.isArray(s.coins)) s.coins.forEach((t, i) => { if (world.coins[i]) world.coins[i].taken = !!t; });
    if (Array.isArray(s.turf)) s.turf.forEach((o, i) => {
      if (world.turf.zones[i]) {
        world.turf.zones[i].owner = o;
        if (o === 'Player') world.turf.zones[i].color = '#59c2e8';
      }
    });
    if (s.mods) world.mods = { engine: s.mods.engine | 0, armor: s.mods.armor | 0, tires: s.mods.tires | 0 };
    world.mission = { idx: Math.min(3, s.missionIdx | 0), step: 0, vaultT: 0, started: true };
    world.saveExists = true;
  } catch { /* corrupt save — start fresh */ }
}

// ------------------------------------------------------------ boot

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
let world;
let state;

if (shotName && SHOT_NAMES.includes(shotName)) {
  world = stageShot(shotName);
  state = shotName === 'title' ? 'title' : shotName === 'map' ? 'pause' : 'play';
  renderFrame(ctx, world, state);
  // Hold the staged scene perfectly still.
  const hold = () => { renderFrame(ctx, world, state); requestAnimationFrame(hold); };
  requestAnimationFrame(hold);
} else {
  world = createWorld(SEED);
  loadGame(world);
  state = 'title';
  requestAnimationFrame(frame);
}

// Debug/testing hook: the headless play-test reads live state here.
window.__solmar = { get world() { return world; }, get state() { return state; } };

// ------------------------------------------------------------ play

let saveTimer = 0;
let paintCd = 0;

function mouseWorld() {
  const cam = cameraFor(world);
  return { x: input.mouse.x + cam.x, y: input.mouse.y + cam.y };
}

function stepOnFoot(dt) {
  const p = world.player;
  let mx = 0, my = 0;
  if (input.down('KeyW') || input.down('ArrowUp')) my -= 1;
  if (input.down('KeyS') || input.down('ArrowDown')) my += 1;
  if (input.down('KeyA') || input.down('ArrowLeft')) mx -= 1;
  if (input.down('KeyD') || input.down('ArrowRight')) mx += 1;
  const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
  const sp = sprint ? 198 : 132;
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    p.angle = Math.atan2(my, mx);
    moveOnFoot(world, p, (mx / len) * sp, (my / len) * sp, dt, 10);
    p.walk += dt * (sprint ? 13 : 10);
  }
  if (input.mouse.down) {
    const m = mouseWorld();
    if (playerShoot(world, m.x, m.y)) audio.shot();
    p.angle = Math.atan2(m.y - p.y, m.x - p.x);
  }
  if (input.hit('KeyF')) { if (playerPunch(world)) audio.punch(); }
  if (input.hit('KeyR')) playerReload(world);
}

function stepDriving(dt) {
  const p = world.player;
  const car = p.car;
  const ctl = {
    throttle: (input.down('KeyW') || input.down('ArrowUp')) ? 1 : (input.down('KeyS') || input.down('ArrowDown')) ? -1 : 0,
    steer: (input.down('KeyA') || input.down('ArrowLeft')) ? -1 : (input.down('KeyD') || input.down('ArrowRight')) ? 1 : 0,
    brake: input.down('Space'),
  };
  const impact = driveCar(world, car, dt, ctl);
  if (impact > 0) {
    audio.crash();
    if (impact > 130) addHeat(world, 12);
  }
  p.x = car.x; p.y = car.y; p.angle = car.angle;

  // Near misses: threading past traffic at speed.
  if (Math.abs(car.speed) > 100) {
    for (const other of world.cars) {
      if (other === car || other.driver !== 'traffic' || other.nearMissCd > 0) continue;
      const d = dist(car.x, car.y, other.x, other.y);
      if (d > 20 && d < 42) {
        other.nearMissCd = 1.5;
        p.money += 15;
        p.score += 15;
        p.nearMisses += 1;
        audio.nearMiss();
        world.floaters.push({ x: car.x, y: car.y - 22, text: '+$15 NEAR MISS', t: 0.9, color: '#b8e6ff' });
      }
    }
  }

  // Lou's Paint Shop: roll in, roll out clean and repaired.
  const paint = landmarkById('paint');
  if (paintCd > 0) paintCd -= dt;
  if (paintCd <= 0 && dist(p.x, p.y, paint.x, paint.y) < 58 && (world.heat > 0 || car.hp < 100)) {
    const cost = Math.min(100, p.money);
    p.money -= cost;
    world.heat = 0;
    world.wanted = 0;
    car.hp = 100;
    car.wrecked = false;
    paintCd = 4;
    notice(world, 'REPAINTED', `Heat cleared, body repaired — $${cost}`, 2.2);
    audio.pickup();
  }
}

function enterExitCar() {
  const p = world.player;
  if (p.car) {
    const car = p.car;
    car.driver = 'parked';
    p.car = null;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
    return;
  }
  let best = null, bestD = 48;
  for (const car of world.cars) {
    if (car.wrecked || car.driver === 'cop') continue;
    if (car.driver === 'traffic' && Math.abs(car.speed) > 42) continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (best) {
    best.driver = 'player';
    p.car = best;
    p.x = best.x; p.y = best.y; p.angle = best.angle;
    if (!best.stolen) {
      best.stolen = true;
      p.carsStolen += 1;
      addHeat(world, 55);
    }
    audio.ui();
  }
}

function updatePrompt() {
  const p = world.player;
  world.prompt = null;
  if (p.car) {
    const ri = raceAt(world);
    if (ri >= 0) world.prompt = `R — Start the race at this flag`;
    else if (world.farePed && dist(p.x, p.y, world.farePed.x, world.farePed.y) < 90) {
      world.prompt = 'T — Pick up the taxi fare';
    }
  } else {
    const near = nearestLandmark(p.x, p.y, 74);
    if (near && near.id === 'modshop') world.prompt = "E — Lou's Mod Shop";
    else if (dist(p.x, p.y, 1020, 1020) < 60 && !world.delivery) world.prompt = 'R — Take a delivery job';
    else {
      // nearest enterable car?
      for (const car of world.cars) {
        if (!car.wrecked && car.driver !== 'cop' && dist(p.x, p.y, car.x, car.y) < 48) {
          world.prompt = `E — Drive the ${car.name}`;
          break;
        }
      }
    }
  }
}

function stepPlay(dt) {
  const p = world.player;
  if (input.hit('KeyP') || input.hit('Escape')) { state = 'pause'; return; }
  if (input.hit('KeyM')) audio.muted = !audio.muted;
  if (input.hit('KeyQ')) cycleRadio(world);

  if (p.car) stepDriving(dt);
  else stepOnFoot(dt);

  if (input.hit('KeyE')) {
    const near = !p.car ? nearestLandmark(p.x, p.y, 74) : null;
    if (near && near.id === 'modshop') { state = 'modshop'; audio.ui(); }
    else enterExitCar();
  }
  if (input.hit('KeyT')) { if (acceptFare(world)) audio.ui(); }
  if (input.hit('KeyR')) {
    if (p.car) {
      const ri = raceAt(world);
      if (ri >= 0) startRace(world, ri);
    } else if (dist(p.x, p.y, 1020, 1020) < 60 && !world.delivery) {
      if (startDelivery(world)) audio.ui();
    }
  }
  updatePrompt();

  if (p.car) {
    world.radioT += dt;
    if (world.radioT > 24) { world.radioT = 0; cycleRadio(world); }
  }

  stepWorld(world, dt);
  stepMissions(world, dt);
  stepRaces(world, dt);
  stepSidejobs(world, dt);
  const tev = stepTurf(world, dt);
  if (tev === 'wave' && world.turf.active >= 0) {
    const z = world.turf.zones[world.turf.active];
    spawnGang(world, z.x, z.y, 3, 26);
    addHeat(world, 20);
  }
  if (tev === 'captured') {
    audio.passed();
    notice(world, 'TURF TAKEN', 'The zone flies your colours now', 2.6);
  }
  const cev = stepCollectibles(world, dt);
  if (cev === 'coin') audio.coin();
  else if (cev) audio.pickup();
  stepCombat(world, dt);
  audio.step(world, dt);

  if (p.hp <= 0) state = 'wasted';
  else if (world.bust >= 1) state = 'busted';

  saveTimer += dt;
  if (saveTimer > 4) { saveTimer = 0; saveGame(world); }
}

function respawn(kind) {
  const p = world.player;
  const spot = kind === 'wasted' ? landmarkById('hospital') : landmarkById('hq');
  if (p.car) { p.car.driver = 'parked'; p.car = null; }
  p.x = spot.x + 30; p.y = spot.y + 46;
  p.hp = 100;
  p.armor = 0;
  p.money = Math.max(0, p.money - (kind === 'wasted' ? 150 : 200));
  world.heat = 0;
  world.wanted = 0;
  world.bust = 0;
  world.gang.length = 0;
  state = 'play';
}

// ------------------------------------------------------------ loop

let last = 0;
function frame(now) {
  const dt = Math.min(0.033, last ? (now - last) / 1000 : 0.016);
  last = now;

  if (state === 'title') {
    world.time += dt;
    stepWorld(world, dt); // the city lives behind the title
    if (input.hit('Enter') || input.mouse.clicked) {
      audio.ensure();
      startStory(world);
      state = 'play';
    }
  } else if (state === 'play') {
    stepPlay(dt);
  } else if (state === 'pause') {
    if (input.hit('KeyP') || input.hit('Escape') || input.hit('Enter')) state = 'play';
  } else if (state === 'modshop') {
    if (input.hit('Escape') || input.hit('KeyP')) state = 'play';
    else {
      MOD_TRACKS.forEach((t, i) => {
        if (input.hit(`Digit${i + 1}`)) { if (buyMod(world, t.key)) audio.passed(); else audio.ui(); }
      });
    }
  } else if (state === 'wasted' || state === 'busted') {
    if (input.hit('Enter')) respawn(state);
  }

  renderFrame(ctx, world, state);
  input.endFrame();
  requestAnimationFrame(frame);
}
