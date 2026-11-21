// main.js — Solmar Heat's engine room: the loop, driving and
// on-foot control, state machine (title / play / map / shop /
// wasted / busted), event plumbing into sound + messages, and the
// screenshot mode the dossier captures are taken through.

import {
  createWorld, stepTraffic, stepPeds, stepPolice, stepWanted,
  addHeat, clearHeat, collideBuildings, buildingAt, saveToSlot,
  readSlot, applySave, starsOf,
} from './world.js';
import { keys, mouse, attachInput, pressedOnce, endFrame, down } from './input.js';
import { stepMission, nextMission, startMission } from './missions.js';
import { playerShoot, startReload, stepCombat, spawnGang, WEAPONS } from './combat.js';
import { stepCollectibles, landJump } from './collectibles.js';
import { stepRace, RACES } from './races.js';
import { spawnFare, stepFare, spawnDelivery, stepDelivery } from './sidejobs.js';
import { stepTurf, turfRent } from './turf.js';
import { buyMod, buyArmour, MOD_TRACKS, ARMOUR_REFILL_COST, engineMult, armorMult, tireMult } from './modshop.js';
import { stepWeather, gripFor } from './weather.js';
import { cycleRadio } from './radio.js';
import { landmark, distTo } from './landmarks.js';
import { sfx, setMuted, isMuted } from './audio.js';
import { drawWorld, drawHUD, drawMapScreen, drawTitleScreen, drawShopScreen, drawEndScreen } from './render.js';
import { stageShot, slotViews, SHOT_NAMES } from './shots.js';
import { clampWorld } from './config.js';

export const VW = 1280, VH = 720;
let world = null;
let canvas = null, ctx = null;
let radioTimer = 0, saveTimer = 0, bustTimer = 0, gangTimer = 0;

export function say(world, text, t = 2.6) { world.message = text; world.messageT = t; }
export function talk(world, who, role, line, t = 4) {
  world.dialogue = { who, role, line }; world.dialogueT = t;
}

export function startNextMission(w) {
  const def = nextMission(w);
  if (!def || w.mission) return null;
  startMission(w, def);
  talk(w, def.giver, def.giver === 'Dex' ? 'Wheelman' : 'Fixer', '"' + def.blurb + '"');
  return def;
}

// Enter / exit the nearest usable car. Entering someone else's
// car is a theft: counted, heated, and remembered by the stats.
export function enterExitCar(w) {
  const p = w.player;
  if (p.car) {
    const c = p.car;
    p.x = clampWorld(c.x + Math.cos(c.angle + Math.PI / 2) * 30);
    p.y = clampWorld(c.y + Math.sin(c.angle + Math.PI / 2) * 30);
    p.car = null;
    return 'exit';
  }
  let best = null, bd = 52;
  for (const c of w.cars) {
    if (c.wrecked) continue;
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bd) { bd = d; best = c; }
  }
  if (!best) return null;
  if (!best.stolen && best.driver !== 'player') {
    best.stolen = true;
    w.stats.carsStolen++;
    addHeat(w, 30);
    sfx('crash');
  }
  best.parked = false;
  p.car = best;
  return 'enter';
}

export function useCrew(w, who) {
  const p = w.player;
  if (who === 'lou') {
    if (w.crewCd.lou > 0) return false;
    if (starsOf(w) === 0) return false;
    w.heat = Math.max(0, w.heat - 110);
    w.crewCd.lou = 120;
    say(w, 'Mama Lou swapped your plates — heat dropping');
    return true;
  }
  if (who === 'dex') {
    if (w.crewCd.dex > 0 || !p.car) return false;
    p.car.speed += 170;
    w.crewCd.dex = 45;
    say(w, 'Dex\'s nitro surge!');
    return true;
  }
  return false;
}

function burst(w, x, y, color, n = 8) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.28 + w.rng() * 0.5;
    w.particles.push({ x, y, vx: Math.cos(a) * (30 + w.rng() * 60), vy: Math.sin(a) * (30 + w.rng() * 60), life: 0.45, maxLife: 0.45, color });
  }
}

function handleEvents(w, events) {
  for (const e of events) {
    switch (e.type) {
      case 'coin': burst(w, e.x, e.y, '#ffd23e'); sfx('coin'); say(w, 'Solmar coin! +$75'); break;
      case 'stash': burst(w, e.x, e.y, '#ffb03a'); sfx('pickup'); say(w, 'Lantern stash! +$50'); break;
      case 'jump-start': sfx('whoosh'); break;
      case 'jump': sfx('win'); say(w, 'Stunt jump landed! +$100'); break;
      case 'shot': sfx('shot'); break;
      case 'gang-down': burst(w, e.x, e.y, '#ff8a75'); say(w, 'Viper down +$25'); break;
      case 'mission-step': {
        const s = e.step;
        if (s.kind === 'vault') { spawnGang(w, 1800, 1748, 7); talk(w, 'Mama Lou', 'Fixer', '"They\'re coming through the doors — hold the circle."'); }
        if (s.kind === 'hold') { spawnGang(w, 2500, 880, 6); talk(w, 'Mama Lou', 'Fixer', '"Hold the block, Rex. The Strip is ours."'); }
        sfx('pickup');
        break;
      }
      case 'mission-done':
        sfx('win');
        say(w, `MISSION PASSED — ${e.def.title} · GRADE ${e.grade} · +$${e.def.pay}`, 4);
        talk(w, e.def.giver, 'Fixer', e.grade === 'S' ? '"Flawless. You\'re making us rich."' : '"Done. That\'s how Solmar works."');
        break;
      case 'checkpoint': say(w, `Checkpoint ${e.n}/${e.total}`); sfx('pickup'); break;
      case 'race-won': sfx('win'); say(w, `RACE WON — ${e.def.name} in ${e.t.toFixed(1)}s · +$${e.def.pay}`, 3.4); break;
      case 'race-late': sfx('fail'); say(w, `Too slow — ${e.t.toFixed(1)}s vs par ${e.def.par}s. Run it again.`, 3); break;
      case 'fare-pickup': say(w, 'Fare aboard — follow the marker'); break;
      case 'fare-done': sfx('coin'); say(w, `Fare paid +$${e.pay}`); break;
      case 'delivery-pickup': say(w, 'Package aboard — the clock is running'); break;
      case 'delivery-done': sfx('coin'); say(w, `Delivered +$${e.pay}`); break;
      case 'delivery-failed': sfx('fail'); say(w, 'Delivery window missed'); break;
      case 'hold-start': spawnGang(w, e.zone.x, e.zone.y, 3); say(w, `Taking ${e.zone.name} — hold the ground!`, 3); break;
      case 'hold-done': sfx('win'); say(w, `${e.zone.name} is yours · +$150`, 3); break;
      case 'hold-lost': say(w, 'Turf hold broken'); break;
      default: break;
    }
  }
}

// ---------------------------------------------------------------
function updatePlay(w, dt) {
  const p = w.player;
  const events = [];
  w.stats.playSeconds += dt;
  w.clock = (w.clock + dt * 0.1) % 24; // a day in four minutes
  const hour = Math.floor(w.clock);
  if (hour !== w.lastHour) {
    w.lastHour = hour;
    const rent = turfRent(w);
    if (rent > 0) say(w, `Turf rent +$${rent}`);
  }
  stepWeather(w, dt);
  if (w.crewCd.lou > 0) w.crewCd.lou -= dt;
  if (w.crewCd.dex > 0) w.crewCd.dex -= dt;
  if (w.messageT > 0) w.messageT -= dt;
  if (w.dialogueT > 0) w.dialogueT -= dt;
  radioTimer += dt;
  if (radioTimer > 24) { radioTimer = 0; cycleRadio(w); }
  saveTimer += dt;
  if (saveTimer > 5) { saveTimer = 0; saveToSlot(w, 1); }

  // --- movement ---
  if (p.car) {
    const car = p.car;
    const grip = gripFor(w.weather) * tireMult(w);
    const top = (carTypeTop(car) * engineMult(w));
    if (down('KeyW', 'ArrowUp')) car.speed += carAccel(car) * dt;
    if (down('KeyS', 'ArrowDown')) car.speed -= (car.speed > 0 ? 320 : 140) * dt;
    car.speed -= car.speed * 0.35 * dt; // drag
    if (down('Space')) car.speed -= car.speed * 2.4 * dt; // handbrake
    car.speed = Math.max(-top * 0.35, Math.min(top * 1.15, car.speed));
    const steer = (down('KeyA', 'ArrowLeft') ? -1 : 0) + (down('KeyD', 'ArrowRight') ? 1 : 0);
    if (steer && Math.abs(car.speed) > 4) car.angle += steer * 2.1 * grip * dt * Math.sign(car.speed);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    // Building crash: damage, bounce, shake.
    if (buildingAt(w, nx, ny) && Math.abs(car.speed) > 30) {
      car.hp -= 8 * armorMult(w);
      w.missionDamage += 8;
      w.cameraShake = 5;
      sfx('crash');
      car.speed = -car.speed * 0.25;
      if (car.hp <= 0) { car.hp = 0; car.wrecked = true; say(w, 'Totaled. Walk away.'); enterExitCar(w); }
    } else { car.x = clampWorld(nx); car.y = clampWorld(ny); }
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    w.stats.kmDriven += Math.abs(car.speed) * dt / 1000;
    if (car.air > 0) { car.air -= dt; if (car.air <= 0) landJump(w, car, events); }
    // Near misses against traffic.
    if (p.nearMissCd > 0) p.nearMissCd -= dt;
    if (Math.abs(car.speed) > 240 && p.nearMissCd <= 0) {
      for (const o of w.cars) {
        if (o === car || o.parked) continue;
        const d = Math.hypot(o.x - car.x, o.y - car.y);
        if (d > 34 && d < 56) {
          w.stats.nearMisses++; p.money += 15; p.nearMissCd = 1.5;
          sfx('whoosh'); say(w, 'Near miss +$15');
          break;
        }
      }
    }
    // Paint shop: drive in, lose the heat, fix the car.
    const paint = landmark('paintshop');
    if (distTo(paint, car) < 78 && starsOf(w) > 0) {
      clearHeat(w); car.hp = 100; say(w, "Lou's Paint Shop — new colour, no heat"); sfx('win');
    }
  } else {
    const sp = down('ShiftLeft', 'ShiftRight') ? 195 : 128;
    let mx = 0, my = 0;
    if (down('KeyW', 'ArrowUp')) my -= 1;
    if (down('KeyS', 'ArrowDown')) my += 1;
    if (down('KeyA', 'ArrowLeft')) mx -= 1;
    if (down('KeyD', 'ArrowRight')) mx += 1;
    if (mx || my) {
      const len = Math.hypot(mx, my);
      p.angle = Math.atan2(my, mx);
      const pos = collideBuildings(w, p.x + (mx / len) * sp * dt, p.y + (my / len) * sp * dt, 10);
      p.x = pos.x; p.y = pos.y;
    }
    // Aim follows the mouse.
    if (canvas) {
      const wx = w.camera.x + (mouse.x - VW / 2) / (w.camera.zoom || 1);
      const wy = w.camera.y + (mouse.y - VH / 2) / (w.camera.zoom || 1);
      p.angle = Math.atan2(wy - p.y, wx - p.x);
    }
  }

  // --- actions ---
  if (pressedOnce('KeyE')) enterExitCar(w);
  if (pressedOnce('Digit1')) p.weapon = 0;
  if (pressedOnce('Digit2')) p.weapon = 1;
  if (pressedOnce('Digit3')) p.weapon = 2;
  if (pressedOnce('KeyR')) startReload(w);
  if (pressedOnce('KeyQ') && p.car) cycleRadio(w);
  if (pressedOnce('KeyC')) useCrew(w, 'lou');
  if (pressedOnce('KeyV')) useCrew(w, 'dex');
  if (pressedOnce('KeyT') && !w.fare) { spawnFare(w); say(w, 'Fare waiting — check the marker'); }
  if (pressedOnce('KeyG') && !w.delivery) { spawnDelivery(w); say(w, 'Delivery job posted'); }
  if (pressedOnce('KeyJ') && !w.mission) startNextMission(w);
  if (pressedOnce('KeyB') && p.car && !w.race) {
    for (const r of RACES) {
      if (Math.hypot(r.start.x - p.car.x, r.start.y - p.car.y) < 80) {
        w.race = { def: r, cp: 0, t: 0, done: false };
        say(w, `${r.name} — beat ${r.par}s for $${r.pay}`);
      }
    }
  }
  if (!p.car && distTo(landmark('modshop'), p) < 62 && pressedOnce('KeyF')) w.gameState = 'shop';
  if (mouse.down && !p.car) {
    const wx = w.camera.x + (mouse.x - VW / 2) / (w.camera.zoom || 1);
    const wy = w.camera.y + (mouse.y - VH / 2) / (w.camera.zoom || 1);
    playerShoot(w, wx, wy, events);
  }
  if (pressedOnce('KeyF') && !p.car && w.gameState === 'play') {
    const keep = p.weapon; p.weapon = 0;
    playerShoot(w, p.x + Math.cos(p.angle) * 30, p.y + Math.sin(p.angle) * 30, events);
    p.weapon = keep;
  }

  // --- world systems ---
  stepTraffic(w, dt);
  stepPeds(w, dt);
  stepPolice(w, dt);
  stepWanted(w, dt);
  stepMission(w, dt, events);
  stepCombat(w, dt, events);
  stepCollectibles(w, events);
  stepRace(w, dt, events);
  stepFare(w, events);
  stepDelivery(w, dt, events);
  stepTurf(w, dt, events);
  // Turf holds keep pressure on.
  if (w.turfHold) {
    gangTimer -= dt;
    if (gangTimer <= 0 && w.gang.length < 3) {
      gangTimer = 6;
      const z = w.turf.find(t => t.id === w.turfHold.zoneId);
      if (z) spawnGang(w, z.x + 120, z.y, 2);
    }
  }
  // Particles.
  for (const pt of [...w.particles]) {
    pt.x += (pt.vx || 0) * dt; pt.y += (pt.vy || 0) * dt; pt.life -= dt;
    if (pt.life <= 0) w.particles.splice(w.particles.indexOf(pt), 1);
  }
  handleEvents(w, events);

  // Camera follows; shake decays.
  const fx = p.car ? p.car.x : p.x, fy = p.car ? p.car.y : p.y;
  w.camera.x += (fx - w.camera.x) * Math.min(1, dt * 6);
  w.camera.y += (fy - w.camera.y) * Math.min(1, dt * 6);
  w.camera.zoom = 1;
  w.cameraShake = Math.max(0, w.cameraShake - dt * 14);
  w.shakeX = Math.sin(w.time * 91) * w.cameraShake;
  w.shakeY = Math.cos(w.time * 83) * w.cameraShake;

  // Busted: pinned on foot by foot cops while fully exposed.
  if (!p.car && starsOf(w) >= 2 && w.exposure > 0.9 && w.footCops.some(f => Math.hypot(f.x - p.x, f.y - p.y) < 30)) {
    bustTimer += dt;
    if (bustTimer > 2) { w.gameState = 'busted'; bustTimer = 0; }
  } else bustTimer = 0;
  if (p.hp <= 0) w.gameState = 'wasted';
}

function carTypeTop(car) {
  const table = { sedan: 300, coupe: 340, falco: 430, taxi: 300, vento: 290, van: 260, truck: 240, pickup: 310, muscle: 380, compact: 265, limo: 295, cruiser: 360 };
  return table[car.type] || 300;
}
function carAccel(car) {
  const table = { sedan: 190, coupe: 230, falco: 320, taxi: 200, vento: 195, van: 160, truck: 140, pickup: 210, muscle: 280, compact: 185, limo: 175, cruiser: 260 };
  return table[car.type] || 190;
}

function respawn(w, kind) {
  const p = w.player;
  const at = kind === 'wasted' ? landmark('hospital') : landmark('hq');
  p.hp = 100; p.armour = 0; p.car = null;
  p.x = at.x; p.y = at.y + 30;
  p.money = Math.max(0, p.money - (kind === 'wasted' ? Math.floor(p.money * 0.1) : 150));
  clearHeat(w);
  w.gang.length = 0;
  w.camera.x = p.x; w.camera.y = p.y;
  w.gameState = 'play';
}

// ---------------------------------------------------------------
function frame(now) {
  if (!world) return;
  const dt = Math.min(0.05, (now - (frame.last || now)) / 1000);
  frame.last = now;
  world.time += dt;
  const st = world.gameState;
  // Screenshot mode renders the staged scene exactly as staged —
  // no simulation steps, so nothing drifts between staging and
  // capture.
  if (!frame.still && st === 'play') updatePlay(world, dt);
  else if (frame.still) { /* staged: draw only */ }
  else if (st === 'title') {
    if (pressedOnce('Enter') || mouse.clicked) world.gameState = 'play';
  } else if (st === 'pause') {
    if (pressedOnce('KeyP') || pressedOnce('Escape')) world.gameState = 'play';
  } else if (st === 'shop') {
    if (pressedOnce('Digit1')) buyMod(world, 'engine');
    if (pressedOnce('Digit2')) buyMod(world, 'armor');
    if (pressedOnce('Digit3')) buyMod(world, 'tires');
    if (pressedOnce('Digit4')) buyArmour(world);
    if (pressedOnce('KeyE') || pressedOnce('Escape')) world.gameState = 'play';
  } else if (st === 'wasted' || st === 'busted') {
    if (pressedOnce('Enter')) respawn(world, st);
  }
  if (st === 'play' && (pressedOnce('KeyP') || pressedOnce('Escape'))) world.gameState = 'pause';
  if (pressedOnce('KeyM')) setMuted(!isMuted());

  // Render.
  if (st === 'title') drawTitleScreen(ctx, world, VW, VH, slotViews(world));
  else if (st === 'pause') drawMapScreen(ctx, world, VW, VH, slotViews(world));
  else if (st === 'shop') drawShopScreen(ctx, world, VW, VH, MOD_TRACKS, ARMOUR_REFILL_COST);
  else if (st === 'wasted' || st === 'busted') drawEndScreen(ctx, world, VW, VH, st);
  else { drawWorld(ctx, world, VW, VH); drawHUD(ctx, world, VW, VH); }
  endFrame();
  if (!frame.still) requestAnimationFrame(frame);
}

export function boot() {
  if (typeof document === 'undefined') return null;
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  attachInput(canvas);
  world = createWorld();
  const saved = readSlot(1);
  if (saved) applySave(world, saved);
  const home = landmark('safehouse');
  world.camera = { x: home.x, y: home.y, zoom: 1 };
  world.gameState = 'title';

  // Screenshot mode: ?shot=chase|vault|map|title — a fresh world,
  // staged once, rendered still, signalled when ready.
  const q = new URLSearchParams(location.search);
  const shot = q.get('shot');
  if (shot && SHOT_NAMES.includes(shot)) {
    world = createWorld(1337);
    stageShot(world, shot);
    frame.still = true;
    requestAnimationFrame((t) => { frame(t); requestAnimationFrame((t2) => { frame(t2); window.__shotReady = true; }); });
  } else {
    requestAnimationFrame(frame);
  }
  window.SOLMAR = { get world() { return world; }, stageShot, startNextMission, enterExitCar, useCrew };
  window.__solmarReady = true;
  return world;
}

if (typeof document !== 'undefined') boot();
