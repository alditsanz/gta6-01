// Solmar Heat — main.js
// Browser entry: owns the canvas loop and wires input, driving,
// combat, missions and every side system together. Also exposes
// window.__SOLMAR so the screenshot tooling can stage scenes.

import { SAVE_KEY, WORLD_SIZE, PLAYER } from './config.js';
import { clamp, dist } from './random.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { createWorld, stepTraffic, stepPeds, stepPolice, stepWanted, exitCar, respawn, saveData, loadData, damageCar, isOnRoad } from './world.js';
import { startMission, stepMission, tryStealNearby } from './missions.js';
import { shoot, startReload, punch, stepCombat } from './combat.js';
import { stepCollectibles } from './collectibles.js';
import { stepWeather, gripFactor, rushDensity, hourOf } from './weather.js';
import { createRaceState, stepRace } from './races.js';
import { createSidejobs, stepSidejobs, tryTaxiKey, startDelivery } from './sidejobs.js';
import { createTurf, stepTurf } from './turf.js';
import { buyUpgrade } from './modshop.js';
import { drawWorld, drawHUD, drawTitle, drawPause, drawModShop, drawEndScreen } from './render.js';
import { stageShot } from './shots.js';
import { landmarkById } from './landmarks.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const VW = 1280, VH = 720;
const input = new Input(window);
const audio = new AudioSys();

let world = createWorld(20261121);
world.turf = createTurf(); world.sidejobs = createSidejobs(world.rng);
world.race = createRaceState(); world.raceDone = {};
let paused = false, inModShop = false, endKind = null;
try { world.hasSave = !!localStorage.getItem(SAVE_KEY); } catch { world.hasSave = false; }

const params = new URLSearchParams(location.search);
if (params.get('shot')) {
  world = stageShot(params.get('shot'));
  world.turf = createTurf(); world.sidejobs = createSidejobs(world.rng); world.race = createRaceState(); world.raceDone = {};
  // Populate the chase frame with its police response before drawing.
  if (params.get('shot') === 'chase') for (let i = 0; i < 40; i++) stepPolice(world, 0.05);
}

function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(saveData(world))); world.hasSave = true; } catch { /* storage unavailable */ } }
function load() { try { const raw = localStorage.getItem(SAVE_KEY); if (raw) loadData(world, JSON.parse(raw)); } catch { /* ignore */ } }

function startGame(fresh) {
  if (!fresh && world.hasSave) load();
  world.gameState = 'play';
  if (!world.mission && !world.storyDone) startMission(world, world.missionsDone || 0);
  audio.ensure();
}
function playerPos() { const p = world.player; return p.car ? { x: p.car.x, y: p.car.y } : p; }

function step(dt) {
  world.time += dt;
  stepWeather(world.weather, dt, world.rng);
  if (world.banner) { world.banner.t -= dt; if (world.banner.t <= 0) world.banner = null; }
  if (world.dialogue && world.dialogue.length && world.time % 5 < dt) world.dialogue.shift();
  const p = world.player;
  const pos = playerPos(); p.x = pos.x; p.y = pos.y;
  // Traffic density follows rush hour: trim or top up visible traffic.
  const density = rushDensity(hourOf(world.weather));
  world.trafficDensity = density;
  stepTraffic(world, dt); stepPeds(world, dt, world.bullets.length ? p : null);
  // Driving / walking.
  if (p.car) {
    const car = p.car;
    const grip = car.grip * gripFactor(world.weather);
    if (input.down('w', 'arrowup')) car.speed += car.accel * dt;
    else if (input.down('s', 'arrowdown')) car.speed -= car.accel * 0.7 * dt;
    else car.speed -= car.speed * 0.35 * dt;
    if (input.down('space')) car.speed -= car.speed * 2.2 * dt;
    car.speed = clamp(car.speed, -120, car.top);
    const steer = (input.down('a', 'arrowleft') ? -1 : 0) + (input.down('d', 'arrowright') ? 1 : 0);
    if (Math.abs(car.speed) > 4) car.angle += steer * grip * dt * (car.speed > 0 ? 1 : -1) * Math.min(1, Math.abs(car.speed) / 160);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    // Building collision = crash: damage + stop.
    let crashed = false;
    for (const b of world.buildings) {
      if (nx > b.x - 14 && nx < b.x + b.w + 14 && ny > b.y - 14 && ny < b.y + b.h + 14) { crashed = true; break; }
    }
    if (crashed) { if (Math.abs(car.speed) > 90) { damageCar(world, car, 8); audio.crash(); } car.speed = 0; }
    else { car.x = clamp(nx, 20, WORLD_SIZE - 20); car.y = clamp(ny, 20, WORLD_SIZE - 20); }
    if (!isOnRoad(car.x, car.y)) car.speed -= car.speed * 0.25 * dt;
    p.angle = car.angle;
    audio.setEngine(true, car.speed / car.top);
  } else {
    const sprint = input.down('shift') ? 1.5 : 1;
    const mx = input.axisX(), my = input.axisY();
    if (mx || my) { const a = Math.atan2(my, mx); p.angle = a; p.x = clamp(p.x + Math.cos(a) * PLAYER.walkSpeed * sprint * dt, 16, WORLD_SIZE - 16); p.y = clamp(p.y + Math.sin(a) * PLAYER.walkSpeed * sprint * dt, 16, WORLD_SIZE - 16); }
    audio.setEngine(false, 0);
  }
  // Actions.
  if (input.wasPressed('e')) {
    if (p.car) exitCar(world);
    else if (nearLandmark('modshop', 95)) inModShop = true;
    else if (nearLandmark('paint', 110)) { world.wanted.stars = 0; world.wanted.heat = 0; if (p.car) p.car.hp = p.car.maxHp; audio.cash(); toast("Lou's Paint Shop: heat cleared, car repaired"); }
    else tryStealNearby(world);
  }
  if (input.wasPressed('r')) startReload(world);
  if (input.wasPressed('f')) { if (punch(world)) audio.punch(); }
  if (input.wasPressed('t')) tryTaxiKey(world);
  if (input.wasPressed('g')) startDelivery(world);
  if (input.wasPressed('m')) audio.toggleMute();
  if (input.wasPressed('s')) { save(); toast('Saved'); }
  if ((input.mouse.down || input.mouse.clicked) && !p.car) {
    const cam = { x: clamp(p.x - VW / 2, 0, WORLD_SIZE - VW), y: clamp(p.y - VH / 2, 0, WORLD_SIZE - VH) };
    const a = Math.atan2(input.mouse.y + cam.y - p.y, input.mouse.x + cam.x - p.x);
    if (shoot(world, p, a, true)) audio.shot();
  }
  stepCombat(world, dt); stepCollectibles(world, dt);
  stepMission(world, dt); stepRace(world, dt); stepSidejobs(world, dt); stepTurf(world, dt);
  stepPolice(world, dt);
  stepWanted(world, dt, world.gang.length > 0);
  audio.setSiren(world.cops.length > 0); audio.stepMusic(dt);
  for (const ev of world.events.splice(0)) {
    if (ev.type === 'coin' || ev.type === 'pickup') audio.pickup();
    if (ev.type === 'missionPassed') { audio.jingle(true); save(); if (!world.storyDone && world.missionsDone < 3) startMission(world, world.missionsDone); }
    if (ev.type === 'nearmiss') audio.whoosh();
    if (ev.type === 'fare' || ev.type === 'delivery') audio.cash();
  }
  if (p.dead) { endKind = 'wasted'; world.gameState = 'end'; audio.jingle(false); respawn(world, true); }
  else if (p.busted) { endKind = 'busted'; world.gameState = 'end'; respawn(world, false); }
}
function nearLandmark(id, r) { const lm = landmarkById(id); return lm && dist(world.player.x, world.player.y, lm.x, lm.y) < r; }
function toast(text) { world.banner = { text: '', sub: text, t: 2.2 }; }

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (params.get('shot') && params.get('shot') !== 'start') {
    // Screenshot mode: hold the staged scene perfectly still so the
    // capture shows exactly what shots.js staged.
    drawWorld(ctx, world, VW, VH); drawHUD(ctx, world, VW, VH);
    input.endFrame(); requestAnimationFrame(frame); return;
  }
  if (world.gameState === 'title') {
    world.time += dt; stepTraffic(world, dt);
    if (input.wasPressed('enter')) startGame(false);
    else if (input.wasPressed('n')) { localStorage.removeItem(SAVE_KEY); world = freshWorld(); startGame(true); }
    drawTitle(ctx, world, VW, VH);
  } else if (world.gameState === 'end') {
    drawWorld(ctx, world, VW, VH); drawHUD(ctx, world, VW, VH); drawEndScreen(ctx, world, VW, VH, endKind || 'wasted');
    if (input.wasPressed('enter')) { world.gameState = 'play'; if (!world.mission && !world.storyDone) startMission(world, world.missionsDone || 0); }
  } else if (inModShop) {
    drawWorld(ctx, world, VW, VH); drawModShop(ctx, world, VW, VH);
    if (input.wasPressed('1')) buyUpgrade(world, 'engine');
    if (input.wasPressed('2')) buyUpgrade(world, 'armor');
    if (input.wasPressed('3')) buyUpgrade(world, 'tires');
    if (input.wasPressed('escape', 'e')) { inModShop = false; save(); }
  } else if (paused) {
    drawWorld(ctx, world, VW, VH); drawHUD(ctx, world, VW, VH); drawPause(ctx, world, VW, VH);
    if (input.wasPressed('p', 'escape')) paused = false;
    if (input.wasPressed('s')) { save(); toast('Saved'); }
  } else {
    if (input.wasPressed('p', 'escape')) paused = true;
    else { step(dt); drawWorld(ctx, world, VW, VH); drawHUD(ctx, world, VW, VH); }
  }
  input.endFrame();
  requestAnimationFrame(frame);
}
function freshWorld() {
  const w = createWorld(20261121);
  w.turf = createTurf(); w.sidejobs = createSidejobs(w.rng); w.race = createRaceState(); w.raceDone = {}; w.hasSave = false;
  return w;
}
window.__SOLMAR = { get world() { return world; }, get paused() { return paused; }, get inModShop() { return inModShop; }, stageShot, startGame, save, load, freshWorld };
requestAnimationFrame(frame);
