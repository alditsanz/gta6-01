// Solmar Heat — the browser loop. Wires the pure modules together:
// input, the fixed-step world simulation, combat, missions, side work,
// saves in localStorage, and the renderer's screens (title, play,
// pause map, mod shop, victory, end). A ?shot=<name> URL freezes a
// staged scene for screenshots.

import { VIEW_W, VIEW_H, SAVE_KEY, DAY_LENGTH_SEC, PLAYER_FOOT_SPEED, PLAYER_SPRINT_SPEED, KMH_PER_UNIT } from './config.js';
import { clamp, dist, angleTo } from './random.js';
import { createInput, held, tapped } from './input.js';
import { createAudio } from './audio.js';
import {
  createWorld, makeCar, stepTraffic, stepPeds, stepPolice, stepWanted,
  stepCarPhysics, moveEntity, addHeat, respawnPlayer, starsOf,
} from './world.js';
import { stepWeather, weatherOf, trafficDensity } from './weather.js';
import { stepCollectibles } from './collectibles.js';
import { stepTurf } from './turf.js';
import { stepMission, startMission, stepPos, MISSIONS } from './missions.js';
import { spawnGang, playerShoot, playerPunch, startReload, stepCombat, WEAPONS } from './combat.js';
import { startFare, stepFare, startDelivery, stepDelivery } from './sidejobs.js';
import { startRace, stepRace } from './races.js';
import { buyMod, usePaintShop, applyMods } from './modshop.js';
import { landmarkById, LANDMARKS } from './landmarks.js';
import { drawWorld, drawHUD, drawMapScreen, drawTitle, drawModShop, drawEndScreen, drawVictoryScreen } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = createInput(canvas);
const audio = createAudio();

let world = createWorld();
let gameState = 'title';
let cam = { x: world.player.x, y: world.player.y, zoom: 1 };
let flashTimer = 0;
let shotMode = false;

const DIALOGUES = [
  { who: 'Mama Lou', role: 'Fixer', line: 'Rex. Wheels first, questions later. Lou\u2019s, now.' },
  { who: 'Lena Voss', role: 'Crew', line: 'You drive, I count. Nobody bleeds on the upholstery.' },
  { who: 'Kane', role: 'Boss', line: 'The bank job is the last one. Make it sing.' },
];

function say(idx) {
  const d = DIALOGUES[idx % DIALOGUES.length];
  world.dialogue = { who: d.who, role: d.role, line: d.line, until: world.time + 5 };
}

function flash(text, secs) {
  world.flash = { text, until: world.time + (secs || 2.2) };
  flashTimer = secs || 2.2;
}

// ------------------------------------------------------------ save / load

export function saveGame() {
  try {
    const data = {
      stats: world.stats,
      flags: world.flags,
      mods: world.mods,
      coins: world.collectibles.coins.map((c) => c.taken),
      stashes: world.collectibles.stashes.map((c) => c.taken),
      jumps: world.collectibles.jumps.map((j) => j.done),
      turfOwners: world.turf.zones.map((z) => z.owner),
      player: { x: world.player.x, y: world.player.y, hp: world.player.hp, armour: world.player.armour },
      radioIdx: world.radioIdx,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    const fresh = createWorld();
    fresh.stats = Object.assign(fresh.stats, data.stats || {});
    fresh.flags = data.flags || {};
    fresh.mods = Object.assign(fresh.mods, data.mods || {});
    (data.coins || []).forEach((taken, i) => { if (fresh.collectibles.coins[i]) fresh.collectibles.coins[i].taken = !!taken; });
    (data.stashes || []).forEach((taken, i) => { if (fresh.collectibles.stashes[i]) fresh.collectibles.stashes[i].taken = !!taken; });
    (data.jumps || []).forEach((done, i) => { if (fresh.collectibles.jumps[i]) fresh.collectibles.jumps[i].done = !!done; });
    (data.turfOwners || []).forEach((owner, i) => { if (fresh.turf.zones[i]) fresh.turf.zones[i].owner = owner; });
    if (data.player) {
      fresh.player.x = data.player.x;
      fresh.player.y = data.player.y;
      fresh.player.hp = data.player.hp;
      fresh.player.armour = data.player.armour || 0;
    }
    fresh.radioIdx = data.radioIdx || 0;
    world = fresh;
    return true;
  } catch (err) {
    return false;
  }
}

function saveInfo() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { exists: false };
    const data = JSON.parse(raw);
    return { exists: true, missionsDone: data.stats ? data.stats.missionsDone : 0, money: data.stats ? data.stats.money : 0 };
  } catch (err) {
    return { exists: false };
  }
}

// ---------------------------------------------------------------- helpers

function nearestCar(maxD) {
  let best = null;
  let bestD = maxD;
  for (const car of world.cars) {
    if (car.wrecked) continue;
    const d = dist(world.player.x, world.player.y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function enterExitCar() {
  const p = world.player;
  if (p.car) {
    const car = p.car;
    p.car = null;
    car.driver = null;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
    return;
  }
  const car = nearestCar(62);
  if (car) {
    p.car = car;
    car.driver = 'player';
    p.x = car.x;
    p.y = car.y;
    if (!car.parked && !car.police) {
      // A running car with a driver-shaped hole in its day: it's theft.
    } else if (car.id !== world.playerCarId) {
      world.stats.carsStolen += 1;
      addHeat(world, 26);
      flash('CAR TAKEN', 1.4);
    }
    car.parked = false;
  }
}

function nearLandmark(id, range) {
  const lm = landmarkById(id);
  if (!lm) return false;
  return dist(world.player.x, world.player.y, lm.x, lm.y) < range;
}

// ------------------------------------------------------------------- step

function step(dt) {
  world.time += dt;
  world.stats.playTime += dt;
  stepWeather(world.weather, dt, world.rng, DAY_LENGTH_SEC);
  world.trafficDensity = trafficDensity(world.weather.clock);

  stepPlayer(dt);
  stepTraffic(world, dt);
  stepPeds(world, dt);

  for (const ev of stepTurf(world, dt)) handleEvent(ev);

  const missionEvents = stepMission(world, dt);
  for (const ev of missionEvents) handleEvent(ev);

  for (const ev of stepCollectibles(world, dt)) handleEvent(ev);
  for (const ev of stepFare(world, dt)) handleEvent(ev);
  for (const ev of stepDelivery(world, dt)) handleEvent(ev);
  for (const ev of stepRace(world, dt)) handleEvent(ev);

  stepCombat(world, dt);
  stepPolice(world, dt);
  stepWanted(world, dt);

  // Radio: Q cycles, and the dial drifts on its own while driving.
  world.radioTimer -= dt;
  if (world.radioTimer <= 0) {
    world.radioTimer = 24;
    if (world.player.car) world.radioIdx = (world.radioIdx + 1) % 3;
  }

  if (world.player.dead && gameState === 'play') {
    gameState = 'end';
    saveGame();
  }
  if (world.flags.storyComplete && !world.mission && gameState === 'play' && world.flags.justFinished) {
    world.flags.justFinished = false;
    gameState = 'victory';
    audio.levelup();
    saveGame();
  }

  // Camera follows the player (or the car).
  const focus = world.player;
  cam.x += (focus.x - cam.x) * Math.min(1, dt * 6);
  cam.y += (focus.y - cam.y) * Math.min(1, dt * 6);
  cam.zoom = world.flags.overShoulder ? 1.55 : 1;
  cam.persp = !!world.flags.perspCam && !!world.player.car;
}

function stepPlayer(dt) {
  const p = world.player;
  const up = held(input, 'KeyW', 'ArrowUp');
  const down = held(input, 'KeyS', 'ArrowDown');
  const left = held(input, 'KeyA', 'ArrowLeft');
  const right = held(input, 'KeyD', 'ArrowRight');

  if (p.car) {
    const car = p.car;
    const eff = applyMods(car, world.mods);
    const throttle = up ? 1 : down ? -0.7 : 0;
    const steer = (left ? -1 : 0) + (right ? 1 : 0);
    const before = car.speed;
    const move = stepCarPhysics(
      { ...car, topSpeed: eff.topSpeed, grip: eff.grip },
      throttle, steer, dt, weatherOf(world.weather).grip,
    );
    // Apply physics back onto the real car, capped by the modded top.
    car.speed = clamp(car.speed + throttle * car.accel * dt, -eff.topSpeed * 0.38, eff.topSpeed);
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 27 * dt);
    if (throttle === 0) car.speed -= car.speed * 0.35 * dt;
    car.angle += steer * eff.grip * clamp(Math.abs(car.speed) / 160, 0, 1) * dt * (car.speed < 0 ? -1 : 1) * weatherOf(world.weather).grip;
    void move;
    void before;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const ox = car.x;
    const oy = car.y;
    moveEntity(world, car, nx, ny, true);
    if (car.x === ox && car.y === oy && Math.abs(car.speed) > 120) {
      car.speed *= 0.4;
      audio.crash();
    }
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = car.speed;
    world.stats.kmDriven += Math.abs(car.speed) * dt * 0.004;
    // Near misses against traffic.
    if (Math.abs(car.speed) > 200) {
      for (const other of world.cars) {
        if (other === car || other.parked) continue;
        const d = dist(car.x, car.y, other.x, other.y);
        if (d > 34 && d < 62 && (other.nearMissCool || 0) <= 0) {
          other.nearMissCool = 3;
          world.stats.nearMisses += 1;
          world.stats.rp += 3;
          audio.whoosh();
        }
      }
    }
    for (const other of world.cars) if (other.nearMissCool > 0) other.nearMissCool -= dt;
  } else {
    const sprint = held(input, 'ShiftLeft', 'ShiftRight');
    const speed = sprint ? PLAYER_SPRINT_SPEED : PLAYER_FOOT_SPEED;
    let mx = (right ? 1 : 0) - (left ? 1 : 0);
    let my = (down ? 1 : 0) - (up ? 1 : 0);
    if (mx !== 0 && my !== 0) {
      mx *= 0.7071;
      my *= 0.7071;
    }
    p.speed = (mx !== 0 || my !== 0) ? speed : 0;
    if (p.speed > 0) {
      p.angle = Math.atan2(my, mx);
      moveEntity(world, p, p.x + mx * speed * dt, p.y + my * speed * dt, false);
    }
  }

  // Combat inputs.
  const aim = Math.atan2(
    (input.mouseY - VIEW_H / 2) / (cam.zoom || 1) + cam.y - p.y,
    (input.mouseX - VIEW_W / 2) / (cam.zoom || 1) + cam.x - p.x,
  );
  if (!p.car && (input.mouseDown || held(input, 'Space'))) {
    if (WEAPONS[p.weapon].speed > 0) {
      if (playerShoot(world, aim)) audio.shot();
    }
  }
  if (!p.car && tapped(input, 'KeyF')) {
    if (playerPunch(world)) audio.punch();
  }
  if (tapped(input, 'KeyR')) startReload(world);
  for (let i = 0; i < 3; i++) {
    if (tapped(input, 'Digit' + (i + 1))) p.weapon = i;
  }
  if (tapped(input, 'KeyQ')) world.radioIdx = (world.radioIdx + 1) % 3;
}

function handleEvent(ev) {
  if (typeof ev !== 'string') return;
  if (ev.startsWith('spawn-gang:')) {
    const count = parseInt(ev.split(':')[1], 10) || 5;
    const m = world.mission;
    if (m) {
      const pos = stepPos(m, m.step);
      spawnGang(world, count, pos.x, pos.y, 110);
    }
    flash('VIPERS INBOUND', 1.8);
  } else if (ev === 'turf-spawn') {
    const zone = world.turf.zones.find((z) => z.id === world.turf.activeZone);
    if (zone) spawnGang(world, 2, zone.x, zone.y, 150);
  } else if (ev === 'coin') {
    flash('COIN +$75', 1.1);
    audio.coin();
  } else if (ev === 'stash') {
    flash('STASH +$120', 1.4);
    audio.cash();
  } else if (ev === 'jump') {
    flash('STUNT JUMP!', 1.6);
    audio.levelup();
  } else if (ev === 'pickup') {
    flash('PACKAGE SECURED', 1.6);
  } else if (ev === 'step') {
    audio.cash();
  } else if (ev.startsWith('mission-done:')) {
    flash('JOB DONE — ' + ev.split(':')[1] + ' GRADE', 2.6);
    audio.levelup();
    say(world.stats.missionsDone % DIALOGUES.length);
    if (world.flags.storyComplete) world.flags.justFinished = true;
    saveGame();
  } else if (ev === 'mission-failed') {
    flash('JOB FAILED', 2.2);
  } else if (ev === 'story-complete') {
    flash('STORY COMPLETE', 3);
  } else if (ev.startsWith('fare-done:')) {
    flash('FARE +$' + ev.split(':')[1], 1.8);
    audio.cash();
  } else if (ev.startsWith('delivery-done:')) {
    flash('DELIVERED +$' + ev.split(':')[1], 1.8);
    audio.cash();
  } else if (ev === 'race-checkpoint') {
    audio.coin();
  } else if (ev.startsWith('race-won:')) {
    flash('RACE WON +$' + ev.split(':')[1], 2.4);
    audio.levelup();
    saveGame();
  } else if (ev === 'turf-flipped') {
    flash('TURF TAKEN', 2);
    audio.levelup();
    saveGame();
  } else if (ev.startsWith('gang-down:')) {
    audio.cash();
  }
}

// ------------------------------------------------------------------- draw

function draw() {
  if (gameState === 'title') {
    const titleCam = { x: 3140, y: 690, zoom: 1.02 };
    drawWorld(ctx, world, titleCam, VIEW_W, VIEW_H);
    drawTitle(ctx, world, VIEW_W, VIEW_H, saveInfo().exists ? loadPeek() : null);
  } else if (gameState === 'pause') {
    drawWorld(ctx, world, cam, VIEW_W, VIEW_H);
    drawMapScreen(ctx, world, VIEW_W, VIEW_H, saveInfo());
  } else if (gameState === 'modshop') {
    drawWorld(ctx, world, cam, VIEW_W, VIEW_H);
    drawModShop(ctx, world, VIEW_W, VIEW_H);
  } else if (gameState === 'victory') {
    drawWorld(ctx, world, cam, VIEW_W, VIEW_H);
    drawVictoryScreen(ctx, world, VIEW_W, VIEW_H);
  } else if (gameState === 'end') {
    drawWorld(ctx, world, cam, VIEW_W, VIEW_H);
    drawEndScreen(ctx, world, VIEW_W, VIEW_H, !!world.flags.busted);
  } else {
    drawWorld(ctx, world, cam, VIEW_W, VIEW_H);
    drawHUD(ctx, world, VIEW_W, VIEW_H);
  }
}

function loadPeek() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY));
    return data && data.stats ? data.stats : null;
  } catch (err) {
    return null;
  }
}

// ------------------------------------------------------------------ frame

let lastTs = 0;
function frame(ts) {
  const dt = Math.min(0.05, lastTs ? (ts - lastTs) / 1000 : 0.016);
  lastTs = ts;

  if (!shotMode) {
    if (gameState === 'play') {
      step(dt);
      if (tapped(input, 'KeyP', 'Escape')) gameState = 'pause';
      else if (tapped(input, 'KeyE')) {
        if (nearLandmark('modshop', 130) && !world.player.car) gameState = 'modshop';
        else if (nearLandmark('paint', 130) && world.player.car) {
          const res = usePaintShop(world);
          flash(res.ok ? 'RESPRAYED — HEAT WIPED' : 'PAINT NEEDS $120', 2);
          if (res.ok) audio.cash();
        } else enterExitCar();
      } else if (tapped(input, 'KeyN')) {
        const nextIdx = MISSIONS.findIndex((def) => !world.flags['done_' + def.id]);
        if (nextIdx >= 0 && !world.mission) {
          startMission(world, nextIdx);
          say(nextIdx);
          flash('NEW JOB: ' + MISSIONS[nextIdx].title.toUpperCase(), 2.2);
        }
      } else if (tapped(input, 'KeyT')) {
        if (!world.fare) { startFare(world); flash('FARE CALLED', 1.6); }
      } else if (tapped(input, 'KeyG')) {
        if (!world.delivery) { startDelivery(world); flash('DELIVERY JOB', 1.6); }
      }
    } else if (gameState === 'title') {
      world.time += dt;
      if (tapped(input, 'Enter')) {
        audio.unlock();
        gameState = 'play';
        cam = { x: world.player.x, y: world.player.y, zoom: 1 };
        say(0);
      }
    } else if (gameState === 'pause') {
      if (tapped(input, 'KeyP', 'Escape')) gameState = 'play';
    } else if (gameState === 'modshop') {
      const tracks = ['engine', 'armor', 'tires'];
      for (let i = 0; i < 3; i++) {
        if (tapped(input, 'Digit' + (i + 1))) {
          const res = buyMod(world, tracks[i]);
          flash(res.ok ? 'MOD FITTED' : 'CANNOT BUY THAT', 1.6);
          if (res.ok) audio.cash();
        }
      }
      if (tapped(input, 'KeyE', 'Escape')) gameState = 'play';
    } else if (gameState === 'victory') {
      if (tapped(input, 'Enter')) gameState = 'play';
    } else if (gameState === 'end') {
      if (tapped(input, 'Enter')) {
        respawnPlayer(world);
        world.flags.busted = false;
        gameState = 'play';
      }
    }
  }

  draw();
  input.pressed.clear();
  input.clicked = false;
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------- shot mode

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
if (shotName) {
  shotMode = true;
  const staged = stageShot(shotName);
  world = staged.world;
  cam = staged.cam;
  gameState = staged.state;
  world.time = 3.2;
  draw();
}

window.__solmar = {
  get world() { return world; },
  get state() { return gameState; },
  startMission,
  LANDMARKS,
  makeCar,
};

requestAnimationFrame(frame);
