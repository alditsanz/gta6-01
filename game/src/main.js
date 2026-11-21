// main.js — the game loop and glue: player movement and driving,
// near misses, paint shop, save/load, screen states, and the
// screenshot mode (?shot=<name>) used to capture judge stills.

import { createWorld, stepPolice, stepTraffic, districtAt, nearestCar, enterCar, exitCar, damageCar, serializeWorld, restoreWorld, addHeat, starsOf } from './world.js';
import { createInput, moveAxis } from './input.js';
import { drawWorld, drawHUD, drawTitle, drawMapScreen, drawWasted, drawModShop } from './render.js';
import { startMission, stepMission } from './missions.js';
import { shoot, reload, punch, stepCombat } from './combat.js';
import { stepCollectibles } from './collectibles.js';
import { offerFare, stepFare, startDelivery, stepDelivery } from './sidejobs.js';
import { startRace, stepRace } from './races.js';
import { stepTurf, startChallenge, zoneAt, turfIncome } from './turf.js';
import { buyMod, speedBonus, armorFactor, tireGrip } from './modshop.js';
import { stepWeather, gripFactor } from './weather.js';
import { nextStation } from './radio.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import { landmark } from './landmarks.js';
import { WORLD_SIZE } from './config.js';

const SAVE_KEY = 'solmar-heat-save-v13';

export function createGame(canvas, opts) {
  const shot = opts && opts.shot;
  const world = shot ? stageShot(shot) : createWorld(20261121);
  if (!shot) {
    try { const raw = localStorage.getItem(SAVE_KEY); if (raw) restoreWorld(world, raw); } catch { /* fresh start */ }
    startMission(world, firstOpen(world));
    offerFare(world);
  }
  let state = world.gameState || (shot ? 'shot' : 'title');
  const input = createInput();
  const audio = createAudio();
  let last = 0; let incomeT = 0;

  function firstOpen(w) { return w.missions.done.findIndex((d) => !d); }

  function save() {
    try { localStorage.setItem(SAVE_KEY, serializeWorld(world)); } catch { /* storage off */ }
  }

  function respawn(busted) {
    const at = landmark(busted ? 'hq' : 'hospital');
    world.player.x = at.x + 60; world.player.y = at.y + 60;
    world.player.hp = 100; world.player.car = null;
    world.heat = 0; world.cops = []; world.footCops = []; world.heli = null; world.roadblock = null;
    if (busted) world.player.money = Math.max(0, world.player.money - 100);
    state = 'play';
  }

  function step(dt) {
    world.time += dt; world.stats.playTime += dt;
    stepWeather(world, dt);
    world.radioT += dt;
    if (world.radioT > 24) { world.radioT = 0; nextStation(world); }
    const p = world.player;
    const ax = moveAxis(input.keys);
    if (p.car) {
      const grip = gripFactor(world) * tireGrip(p.mods);
      const top = p.car.topSpeed * speedBonus(p.mods);
      if (ax.y < 0) p.car.speed = Math.min(top, (p.car.speed || 0) + 190 * grip * dt);
      else if (ax.y > 0) p.car.speed = Math.max(-70, (p.car.speed || 0) - 150 * dt);
      else p.car.speed = (p.car.speed || 0) * (1 - 0.6 * dt);
      if (input.keys.Space) p.car.speed *= 1 - 3.2 * dt;
      const steer = ax.x * (0.9 + Math.abs(p.car.speed) / 300);
      if (p.car.speed) p.car.angle += steer * dt * Math.sign(p.car.speed);
      p.x += Math.cos(p.car.angle) * p.car.speed * dt;
      p.y += Math.sin(p.car.angle) * p.car.speed * dt;
      // Near miss: fast pass close to a moving traffic car.
      p.nearMissCd -= dt;
      if (Math.abs(p.car.speed) > 150 && p.nearMissCd <= 0) {
        for (const c of world.cars) {
          if (c !== p.car && !c.parked && Math.hypot(c.x - p.x, c.y - p.y) < 52) {
            p.money += 15; world.stats.nearMisses++; p.nearMissCd = 1.5; audio.whoosh(); break;
          }
        }
      }
      // Paint shop: clears heat, repairs the car.
      const paint = landmark('paint');
      if (Math.hypot(paint.x - p.x, paint.y - p.y) < 95 && world.heat > 0) { world.heat = 0; p.car.hp = 100; }
    } else {
      const sp = (input.keys.ShiftLeft ? 175 : 118);
      p.x += ax.x * sp * dt; p.y += ax.y * sp * dt;
      if (ax.x || ax.y) p.angle = Math.atan2(ax.y, ax.x);
    }
    p.x = Math.max(24, Math.min(WORLD_SIZE - 24, p.x));
    p.y = Math.max(24, Math.min(WORLD_SIZE - 24, p.y));
    if (p.car) { p.car.x = p.x; p.car.y = p.y; }

    stepTraffic(world, dt);
    stepPolice(world, dt);
    stepCombat(world, dt);
    stepCollectibles(world);
    stepMission(world, dt);
    stepFare(world);
    stepDelivery(world, dt);
    stepRace(world, dt);
    stepTurf(world, dt);
    incomeT += dt;
    if (incomeT >= 10) { incomeT = 0; p.money += turfIncome(world); p.score += 5; }
    if (input.wasPressed('KeyQ')) nextStation(world);
    if (input.wasPressed('KeyE')) {
      if (p.car) exitCar(world);
      else { const c = nearestCar(world, 62); if (c && enterCar(world, c)) audio.crash; }
    }
    if (input.wasPressed('KeyT')) { offerFare(world); if (!world.side.delivery) startDelivery(world); }
    if (input.wasPressed('KeyG')) { const z = zoneAt(world, p.x, p.y); if (z) startChallenge(world, z); }
    if (input.wasPressed('KeyR')) reload(world);
    if (input.wasPressed('KeyF')) punch(world);
    if (input.mouse.down && !p.car) shoot(world, p.x + (input.mouse.x - 640), p.y + (input.mouse.y - 360));
    if (p.hp <= 0) { state = 'wasted'; setTimeout(() => respawn(false), 900); }
    if (starsOf(world) >= 3 && world.footCops.some((f) => Math.hypot(f.x - p.x, f.y - p.y) < 18) && !p.car) { state = 'busted'; setTimeout(() => respawn(true), 900); }
    save();
  }

  function frame(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts;
    const ctx = canvas.getContext('2d');
    const vw = canvas.width; const vh = canvas.height;
    if (state === 'play') step(dt);
    const p = world.player;
    const camX = Math.max(0, Math.min(WORLD_SIZE - vw, p.x - vw / 2));
    const camY = Math.max(0, Math.min(WORLD_SIZE - vh, p.y - vh / 2));
    drawWorld(ctx, world, camX, camY, vw, vh);
    if (state === 'title') drawTitle(ctx, world, vw, vh);
    else if (state === 'pause') drawMapScreen(ctx, world, vw, vh);
    else if (state === 'shop') drawModShop(ctx, world, vw, vh);
    else if (state === 'wasted') drawWasted(ctx, world, vw, vh, false);
    else if (state === 'busted') drawWasted(ctx, world, vw, vh, true);
    else { drawHUD(ctx, world, vw, vh); if (state === 'shot' && world.gameState === 'pause') drawMapScreen(ctx, world, vw, vh); if (state === 'shot' && world.gameState === 'title') drawTitle(ctx, world, vw, vh); }
    input.clearPressed();
    requestAnimationFrame(frame);
  }

  if (typeof window !== 'undefined') {
    input.attach(window, canvas);
    window.addEventListener('keydown', (e) => {
      if (state === 'title' && (e.code === 'Enter' || e.code === 'Space')) state = 'play';
      if ((state === 'play' || state === 'pause') && (e.code === 'KeyP' || e.code === 'Escape')) state = state === 'play' ? 'pause' : 'play';
      if (e.code === 'KeyM') audio.toggleMute();
      if (e.code === 'KeyB') { const d = Math.hypot(landmark('modshop').x - world.player.x, landmark('modshop').y - world.player.y); if (d < 130) state = 'shop'; }
      if (state === 'shop') {
        if (e.code === 'Digit1') buyMod(world, 'engine');
        if (e.code === 'Digit2') buyMod(world, 'armor');
        if (e.code === 'Digit3') buyMod(world, 'tires');
        if (e.code === 'Escape') state = 'play';
      }
      if (e.code === 'Digit1' && state === 'play' && !world.missions.active) startMission(world, 0);
      if (e.code === 'Digit2' && state === 'play' && !world.missions.active) startMission(world, 1);
      if (e.code === 'Digit3' && state === 'play' && !world.missions.active) startMission(world, 2);
    });
    requestAnimationFrame(frame);
  }
  return { world, getState: () => state, districtAt };
}

if (typeof document !== 'undefined') {
  const canvas = document.getElementById('game');
  const params = new URLSearchParams(location.search);
  createGame(canvas, { shot: params.get('shot') || null });
}
