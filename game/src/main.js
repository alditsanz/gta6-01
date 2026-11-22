// Solmar Heat — main.js
// The game loop and the player's hands: driving, walking, stealing,
// shooting, missions, side work, shops, save/load and the screens
// (title / play / pause-map / mod shop / wasted / busted).
// Screenshot mode (?shot=chase|vault|map|title) stages a scene via
// shots.js, maps it to a screen state and holds it perfectly still.

import { VIEW_W, VIEW_H, SAVE_KEY, DAY_LENGTH_SEC, PLAYER_FOOT_SPEED, PLAYER_SPRINT_SPEED, KMH_PER_UNIT } from './config.js';
import { clamp, dist, angleTo } from './random.js';
import { createInput, held, tapped } from './input.js';
import { createAudio } from './audio.js';
import {
  createWorld, starsOf, addHeat, stepTraffic, stepPeds, stepPolice,
  stepWanted, stepCarPhysics, moveEntity, blockedAt, respawnPlayer, makeCar,
} from './world.js';
import { stepWeather, weatherOf, trafficDensity, skyPhase } from './weather.js';
import { stepCollectibles } from './collectibles.js';
import { stepTurf } from './turf.js';
import { stepMission, missionTarget, startMission, stepPos, MISSIONS } from './missions.js';
import { spawnGang, playerShoot, playerPunch, startReload, stepCombat, WEAPONS } from './combat.js';
import { startFare, stepFare, startDelivery, stepDelivery } from './sidejobs.js';
import { startRace, stepRace, RACES } from './races.js';
import { buyMod, usePaintShop } from './modshop.js';
import { landmarkById, LANDMARKS } from './landmarks.js';
import { drawWorld, drawHUD, drawMapScreen, drawTitle, drawModShop, drawEndScreen } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_W; canvas.height = VIEW_H;
const input = createInput(canvas);
const audio = createAudio();

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');

let world = createWorld();
let gameState = 'title';
let cam = { x: world.player.x, y: world.player.y, zoom: 1 };
let lastTs = 0;
let fireCool = 0;
let dialogueSeq = 0;

const DIALOGUES = [
  { who: 'Mama Lou', role: 'Fixer', line: 'Solmar pays the bold, Rex. Keep it that way.' },
  { who: 'Lena Voss', role: 'Crew', line: 'I mapped the cameras. You just drive.' },
  { who: 'Kane', role: 'Boss', line: 'Everyone in this city owes me. Soon you will not.' },
];

function say(idx) {
  const d = DIALOGUES[idx % DIALOGUES.length];
  world.dialogue = { who: d.who, role: d.role, line: d.line, until: world.time + 5 };
}

function flash(text, secs) {
  world.flash = { text, until: world.time + (secs || 2.2) };
}

// ------------------------------------------------------------ save / load ---

export function saveGame() {
  const s = world.stats;
  const data = {
    stats: s, mods: world.mods,
    coins: world.collectibles.coins.map((c) => c.taken),
    stashes: world.collectibles.stashes.map((c) => c.taken),
    jumps: world.collectibles.jumps.map((j) => j.done),
    turf: world.turf.zones.map((z) => z.owner),
    flags: world.flags,
    px: world.player.x, py: world.player.y,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* private mode */ }
  return data;
}

export function loadGame() {
  let raw = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { raw = null; }
  if (!raw) return false;
  let data;
  try { data = JSON.parse(raw); } catch (e) { return false; }
  Object.assign(world.stats, data.stats || {});
  Object.assign(world.mods, data.mods || {});
  (data.coins || []).forEach((t, i) => { if (world.collectibles.coins[i]) world.collectibles.coins[i].taken = !!t; });
  (data.stashes || []).forEach((t, i) => { if (world.collectibles.stashes[i]) world.collectibles.stashes[i].taken = !!t; });
  (data.jumps || []).forEach((t, i) => { if (world.collectibles.jumps[i]) world.collectibles.jumps[i].done = !!t; });
  (data.turf || []).forEach((o, i) => { if (world.turf.zones[i]) world.turf.zones[i].owner = o; });
  Object.assign(world.flags, data.flags || {});
  if (data.px) { world.player.x = data.px; world.player.y = data.py; }
  return true;
}

// ------------------------------------------------------------- interaction ---

function nearestCar(maxD) {
  let best = null, bestD = maxD;
  for (const car of world.cars) {
    if (car.police) continue;
    const d = dist(world.player.x, world.player.y, car.x, car.y);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

function enterExitCar() {
  const p = world.player;
  if (p.car) {
    const side = p.car.angle + Math.PI / 2;
    p.x = p.car.x + Math.cos(side) * 30;
    p.y = p.car.y + Math.sin(side) * 30;
    p.car = null;
    return;
  }
  const car = nearestCar(46);
  if (!car) return;
  if (car.wrecked) { flash('TOTALED — THIS CAR IS DONE'); return; }
  p.car = car;
  car.parked = false;
  if (!car.ai) car.ai = {};
  car.ai.traffic = false;
  world.stats.carsStolen += 1;
  world.stats.rp += 4;
  if (!car.wasCounted) { car.wasCounted = true; }
  addHeat(world, 26);
  audio.crash();
}

function nearLandmark(id, range) {
  const lm = landmarkById(id);
  return lm && dist(world.player.x, world.player.y, lm.x, lm.y) < range;
}

// ------------------------------------------------------------------- loop ---

function step(dt) {
  world.time += dt;
  world.stats.playTime += dt;
  const p = world.player;
  stepWeather(world.weather, dt, world.rng, DAY_LENGTH_SEC);
  world.weather.phase = skyPhase(world.weather.clock);
  world.trafficDensity = trafficDensity(world.weather.clock);

  // Radio auto-cycle while driving.
  if (p.car) {
    world.radioTimer -= dt;
    if (world.radioTimer <= 0) { world.radioTimer = 24; world.radioIdx = (world.radioIdx + 1) % 3; }
  }

  stepPlayer(dt);
  stepTraffic(world, dt);
  stepPeds(world, dt);
  if (starsOf(world) > 0 || world.cops.length) stepPolice(world, dt);
  stepWanted(world, dt);
  if (!world.sighted && starsOf(world) > 0) world.flags.hideTime = (world.flags.hideTime || 0) + dt;
  else world.flags.hideTime = 0;

  for (const ev of stepMission(world, dt)) handleEvent(ev);
  // Keep the vault ring's bright arc glued to the live hold progress.
  if (world.mission && world.flags.vaultRing) {
    world.flags.vaultRing.pct = world.mission.vaultPct;
    if (world.mission.step !== 1) world.flags.vaultRing = null;
  }
  for (const ev of stepCollectibles(world, dt)) handleEvent(ev);
  for (const ev of stepTurf(world, dt)) handleEvent(ev);
  for (const ev of stepFare(world, dt)) handleEvent(ev);
  for (const ev of stepDelivery(world, dt)) handleEvent(ev);
  for (const ev of stepRace(world, dt)) handleEvent(ev);
  stepCombat(world, dt);
  for (const ev of world.events || []) handleEvent(ev);
  world.events = [];

  // Pickups of opportunity: paint shop & mod shop proximity prompts.
  world.flags.target = missionTarget(world)
    || (world.race ? { x: world.race.def.points[world.race.idx][0], y: world.race.def.points[world.race.idx][1] } : null)
    || (world.fare ? (world.fare.phase === 'pickup' ? { x: world.fare.x, y: world.fare.y } : { x: world.fare.dx, y: world.fare.dy }) : null)
    || (world.delivery ? (world.delivery.phase === 'pickup' ? { x: world.delivery.x, y: world.delivery.y } : { x: world.delivery.dx, y: world.delivery.dy }) : null);

  // Camera follows, easing toward the player.
  const tx = p.car ? p.car.x : p.x, ty = p.car ? p.car.y : p.y;
  cam.x += (tx - cam.x) * Math.min(1, dt * 5);
  cam.y += (ty - cam.y) * Math.min(1, dt * 5);
  cam.zoom += ((p.car ? 1.0 : 1.12) - cam.zoom) * Math.min(1, dt * 2);

  if (world.stats.playTime > 0 && Math.floor(world.stats.playTime) % 20 === 0) saveGame();
}

function stepPlayer(dt) {
  const p = world.player;
  if (p.dead) return;
  if (tapped(input, 'KeyM')) audio.toggleMute();
  if (tapped(input, 'KeyE')) enterExitCar();
  if (tapped(input, 'KeyR')) startReload(world);
  if (tapped(input, 'KeyF')) { if (playerPunch(world)) audio.punch(); }
  if (tapped(input, 'Digit1')) p.weapon = 0;
  if (tapped(input, 'Digit2')) p.weapon = 1;
  if (tapped(input, 'Digit3')) p.weapon = 2;
  if (tapped(input, 'KeyQ')) world.radioIdx = (world.radioIdx + 1) % 3;
  if (tapped(input, 'KeyT')) { if (startFare(world)) flash('TAXI FARE — PICK UP THE PASSENGER'); }
  if (tapped(input, 'KeyB')) { if (startDelivery(world)) flash('DELIVERY — COLLECT AT THE MARINA'); }
  if (tapped(input, 'KeyJ')) {
    for (const race of RACES) {
      if (dist(p.x, p.y, race.start.x, race.start.y) < 120 && startRace(world, race.id)) flash('RACE — ' + race.name.toUpperCase());
    }
  }
  if (tapped(input, 'KeyN')) {
    const idx = world.stats.missionsDone;
    if (idx < MISSIONS.length && !world.mission) {
      startMission(world, idx);
      say(idx);
      flash('MISSION — ' + MISSIONS[idx].title.toUpperCase());
    }
  }
  if (tapped(input, 'KeyG')) {
    if (nearLandmark('paint', 130)) {
      const res = usePaintShop(world);
      flash(res.ok ? 'PAINT SHOP — HEAT CLEARED, CAR REPAIRED' : 'PAINT SHOP NEEDS $120');
    }
  }
  // Crew ability: Lena's getaway route (clears a chunk of heat, cooldown).
  if (tapped(input, 'KeyC')) {
    if (world.time - (world.flags.crewUsedAt || -99) > 45 && starsOf(world) > 0) {
      world.flags.crewUsedAt = world.time;
      world.heat = Math.max(0, world.heat - 130);
      flash('LENA FOUND A WAY OUT — HEAT DROPPED');
    }
  }

  const gripMul = weatherOf(world.weather).grip;
  if (p.car) {
    const car = p.car;
    const mods = { topSpeed: car.topSpeed * (1 + world.mods.engine * 0.09), grip: car.grip * (1 + world.mods.tires * 0.08) };
    const savedTop = car.topSpeed, savedGrip = car.grip;
    car.topSpeed = mods.topSpeed; car.grip = mods.grip;
    const throttle = held(input, 'KeyW', 'ArrowUp') ? 1 : held(input, 'KeyS', 'ArrowDown') ? -0.7 : 0;
    const steer = (held(input, 'KeyA', 'ArrowLeft') ? -1 : 0) + (held(input, 'KeyD', 'ArrowRight') ? 1 : 0);
    const handbrake = held(input, 'Space');
    if (handbrake) car.speed -= car.speed * 2.4 * dt;
    const before = { x: car.x, y: car.y, speed: car.speed };
    const move = stepCarPhysics(car, throttle, steer * (handbrake ? 1.7 : 1), dt, gripMul);
    world.flags.sliding = handbrake && Math.abs(car.speed) > 120;
    const nx = car.x + move.dx, ny = car.y + move.dy;
    if (!blockedAt(world, nx, ny, true)) {
      car.x = nx; car.y = ny;
    } else {
      // Wall hit: damage, worse at speed; armor mods soften it.
      const impact = Math.abs(car.speed);
      if (impact > 90) {
        car.hp -= 8 * (1 - world.mods.armor * 0.18);
        audio.crash();
        if (car.hp <= 0) { car.wrecked = true; car.hp = 0; p.car = null; flash('CAR TOTALED'); }
      }
      car.speed *= -0.25;
    }
    car.topSpeed = savedTop; car.grip = savedGrip;
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    const moved = dist(before.x, before.y, car.x, car.y);
    world.stats.kmDriven += moved / 1000;
    // Near-miss: threading past traffic at speed.
    car.nearMissCool -= dt;
    if (Math.abs(car.speed) > 150 && car.nearMissCool <= 0) {
      for (const other of world.cars) {
        if (other === car || other.police || other.parked) continue;
        const d = dist(car.x, car.y, other.x, other.y);
        if (d > 34 && d < 62) {
          world.stats.nearMisses += 1;
          world.stats.money += 15; world.stats.score += 10;
          car.nearMissCool = 1.5;
          audio.whoosh();
          flash('NEAR MISS +$15', 1.1);
          break;
        }
      }
    }
    // Ramming a cop at speed is a crime with witnesses.
    for (const cop of world.cops) {
      if (!cop.wrecked && dist(car.x, car.y, cop.x, cop.y) < 30 && Math.abs(car.speed) > 120) {
        cop.hp -= 30; addHeat(world, 16); car.speed *= 0.6;
        if (cop.hp <= 25) { cop.wrecked = true; cop.hp = 0; }
      }
    }
  } else {
    const sprint = held(input, 'ShiftLeft', 'ShiftRight');
    const sp = sprint ? PLAYER_SPRINT_SPEED : PLAYER_FOOT_SPEED;
    let mx = 0, my = 0;
    if (held(input, 'KeyW', 'ArrowUp')) my -= 1;
    if (held(input, 'KeyS', 'ArrowDown')) my += 1;
    if (held(input, 'KeyA', 'ArrowLeft')) mx -= 1;
    if (held(input, 'KeyD', 'ArrowRight')) mx += 1;
    const len = Math.sqrt(mx * mx + my * my) || 1;
    p.speed = (mx || my) ? sp : 0;
    if (mx || my) p.angle = Math.atan2(my, mx);
    moveEntity(world, p, p.x + (mx / len) * sp * dt, p.y + (my / len) * sp * dt, false);
    // Aim with the mouse; click to shoot.
    const aim = Math.atan2(input.mouseY - VIEW_H / 2, input.mouseX - VIEW_W / 2);
    p.angle = (mx || my) ? p.angle : aim;
    fireCool -= dt;
    if (input.mouseDown && fireCool <= 0 && p.weapon > 0) {
      if (playerShoot(world, aim)) { fireCool = WEAPONS[p.weapon].rate; audio.shot(); }
    }
  }
}

function handleEvent(ev) {
  if (ev === 'coin') { audio.coin(); flash('SOLMAR COIN +$75', 1.2); }
  else if (ev === 'stash') { audio.cash(); flash('LANTERN STASH +$120', 1.2); }
  else if (ev === 'jump') { audio.levelup(); flash('STUNT JUMP +$90', 1.4); }
  else if (ev.startsWith('spawn-gang:')) {
    const m = world.mission;
    const stepDef = m && m.def.steps[m.step];
    const at = m ? stepPos(m, m.step) : { x: world.player.x, y: world.player.y };
    spawnGang(world, parseInt(ev.split(':')[1], 10) || 5, at.x, at.y, stepDef && stepDef.vault ? 80 : 110);
    if (stepDef && stepDef.vault) world.flags.vaultRing = { x: at.x, y: at.y + 8, pct: 0 };
  }
  else if (ev.startsWith('mission-done:')) {
    audio.levelup();
    flash('MISSION PASSED — GRADE ' + ev.split(':')[1]);
    dialogueSeq += 1; say(dialogueSeq);
    if (world.mission === null) world.flags.vaultRing = null;
    saveGame();
  }
  else if (ev === 'mission-failed') flash('MISSION FAILED — TRY AGAIN (N)');
  else if (ev === 'turf-spawn') {
    const zone = world.turf.zones.find((z) => z.id === world.turf.activeZone);
    if (zone) spawnGang(world, 2, zone.x + world.rng.range(-160, 160), zone.y + world.rng.range(-160, 160), 60);
  }
  else if (ev === 'turf-flipped') { audio.levelup(); flash('TURF TAKEN +$200'); }
  else if (ev === 'turf-all') flash('ALL TURF HELD — SOLMAR IS YOURS');
  else if (ev.startsWith('fare-done:')) { audio.cash(); flash('FARE PAID +$' + ev.split(':')[1]); }
  else if (ev === 'fare-pickup') flash('PASSENGER IN — DRIVE!');
  else if (ev === 'fare-failed') flash('FARE LOST');
  else if (ev.startsWith('delivery-done:')) { audio.cash(); flash('DELIVERED +$' + ev.split(':')[1]); }
  else if (ev === 'delivery-pickup') flash('PACKAGE ABOARD — THE CLOCK IS RUNNING');
  else if (ev === 'delivery-failed') flash('DELIVERY SPOILED');
  else if (ev === 'race-checkpoint') audio.coin();
  else if (ev.startsWith('race-won:')) { audio.levelup(); flash('RACE WON +$' + ev.split(':')[1]); }
  else if (ev === 'race-failed') flash('OUT OF TIME — RACE RESET');
  else if (ev.startsWith('gang-down:')) audio.cash();
  else if (ev === 'wasted' || ev === 'busted') {
    gameState = ev;
    setTimeout(() => { respawnPlayer(world); gameState = 'play'; }, 2600);
  }
}

function draw() {
  if (gameState === 'title') {
    drawWorld(ctx, world, cam, VIEW_W, VIEW_H);
    drawTitle(ctx, world, VIEW_W, VIEW_H);
  } else if (gameState === 'pause') {
    drawWorld(ctx, world, cam, VIEW_W, VIEW_H);
    drawMapScreen(ctx, world, VIEW_W, VIEW_H);
  } else if (gameState === 'modshop') {
    drawWorld(ctx, world, cam, VIEW_W, VIEW_H);
    drawModShop(ctx, world, VIEW_W, VIEW_H);
  } else if (gameState === 'wasted' || gameState === 'busted') {
    drawWorld(ctx, world, cam, VIEW_W, VIEW_H);
    drawHUD(ctx, world, VIEW_W, VIEW_H);
    drawEndScreen(ctx, world, VIEW_W, VIEW_H, gameState === 'busted');
  } else {
    drawWorld(ctx, world, cam, VIEW_W, VIEW_H);
    drawHUD(ctx, world, VIEW_W, VIEW_H);
  }
}

function frame(ts) {
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
  lastTs = ts;
  if (shotName) { draw(); return; } // staged scenes hold perfectly still
  if (gameState === 'title') {
    world.time += dt;
    stepWeather(world.weather, dt, world.rng, DAY_LENGTH_SEC);
    if (input.clicked || tapped(input, 'Enter')) {
      audio.unlock();
      loadGame();
      gameState = 'play';
      flash('SOLMAR HEAT — PRESS N FOR WORK', 2.6);
    }
    cam.x += (world.player.x + 230 - cam.x) * Math.min(1, dt);
    cam.y += (world.player.y - cam.y) * Math.min(1, dt);
  } else if (gameState === 'pause') {
    if (tapped(input, 'KeyP', 'Escape')) gameState = 'play';
  } else if (gameState === 'modshop') {
    if (tapped(input, 'Escape')) gameState = 'play';
    if (tapped(input, 'Digit1')) buyMod(world, 'engine');
    if (tapped(input, 'Digit2')) buyMod(world, 'armor');
    if (tapped(input, 'Digit3')) buyMod(world, 'tires');
  } else if (gameState === 'play') {
    if (tapped(input, 'KeyP', 'Escape')) gameState = 'pause';
    else if (tapped(input, 'KeyO') && nearLandmark('modshop', 140)) gameState = 'modshop';
    else step(dt);
  }
  input.clicked = false;
  input.pressed.clear();
  draw();
  requestAnimationFrame(frame);
}

// Screenshot mode: stage the scene, map it to its screen state, and let
// the coordinator's camera take the picture.
if (shotName) {
  const staged = stageShot(shotName);
  world = staged.world;
  cam = staged.cam;
  gameState = staged.state;
  if (shotName === 'vault' && world.mission) world.flags.vaultRing = { x: 1800, y: 1808, pct: world.mission.vaultPct };
  draw();
} else {
  loadGame();
  requestAnimationFrame(frame);
}

// Small handles for the headless play-test (harmless in normal play).
window.__solmar = { get world() { return world; }, get state() { return gameState; }, startMission, LANDMARKS, makeCar };
void angleTo; void clamp; void landmarkById;
