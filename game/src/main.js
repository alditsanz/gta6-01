// main.js — Solmar Heat game state, simulation and browser boot.
// Every other module is a single-job system; this file wires them into
// one playable game: driving, heat and police, missions, side work,
// races, turf, weather, the mod shop, saving, and the screen flow
// (title -> mission board -> play -> pause / wasted / shop).

import {
  WORLD_SIZE, PLAYER_SPEED, PLAYER_SPRINT, PLAYER_MAX_HEALTH, HEAT_MAX,
  HEAT_MID_BAND, HEAT_PER_STAR, WALL_HIT_DAMAGE, SAVE_KEY, clamp, dist,
  starsForHeat, rankFor, districtAt, POLICE_SPEED, HELI_SPEED, TRAFFIC_BASE_COUNT, PEDESTRIAN_COUNT,
} from './config.js';
import { createRng } from './random.js';
import { Input } from './input.js';
import { generateWorld, spawnParkedCars, spawnTraffic, spawnPedestrians, collidesBuilding, findPath, nearestIntersection } from './world.js';
import { landmarkAt, landmarkById } from './landmarks.js';
import { createCollectibles, checkCoinPickup, coinsTaken, serializeCoins, restoreCoins } from './collectibles.js';
import { MISSIONS, MissionManager } from './missions.js';
import { createCombatState, tryShoot, tryPunch, stepBullets, startReload, createAmmoPickup, checkAmmoPickup } from './combat.js';
import { SideJobs } from './sidejobs.js';
import { RACES, RaceManager } from './races.js';
import { TurfManager, PLAYER_CREW } from './turf.js';
import { WeatherSystem } from './weather.js';
import { SoundEngine } from './audio.js';
import { createMods, buyMod, effectiveStats, damageAfterArmor, serializeMods, restoreMods } from './modshop.js';
import { makeCamera, followCamera, drawWorld, drawEntities, drawSkyAndWeather, drawHUD } from './render.js';
import { getShotName, applyShotScenario } from './shots.js';

export { districtAt, starsForHeat, rankFor };

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

export function createGame(storage) {
  const rng = createRng(20261117);
  const game = {
    mode: 'title',
    time: 0,
    world: generateWorld(20261117),
    weather: new WeatherSystem(createRng(777)),
    player: { x: 660, y: 720, angle: 0, health: PLAYER_MAX_HEALTH, car: null, speed: 0 },
    cars: spawnParkedCars(),
    traffic: spawnTraffic(rng, TRAFFIC_BASE_COUNT),
    pedestrians: spawnPedestrians(rng, PEDESTRIAN_COUNT),
    police: [],
    heli: { active: false, x: 660, y: 660, angle: 0 },
    roadblocks: [],
    coins: createCollectibles(),
    missions: new MissionManager(),
    side: new SideJobs(createRng(4242)),
    races: new RaceManager(),
    raceList: RACES,
    turf: new TurfManager(),
    combat: createCombatState(),
    ammoPickups: [createAmmoPickup(700, 700), createAmmoPickup(1500, 1500), createAmmoPickup(300, 2000)],
    mods: createMods(),
    money: 120,
    score: 0,
    heat: 0,
    stars: 0,
    rank: rankFor(0, false),
    stats: { stolen: 0, fares: 0, nearMiss: 0 },
    camera: makeCamera(20, 360, 1280, 720),
    message: '',
    messageT: 0,
    objectiveText: '',
    crimeTimer: 0,
    nearMissTimer: 0,
    hitCooldown: 0,
    wastedTimer: 0,
    shopOpen: false,
    sound: new SoundEngine(),
    storage: storage || new MemoryStorage(),
    rng,
    saveTimer: 0,
  };
  game.side.spawnFare();
  game.side.startDelivery();

  game.setHeat = (v) => {
    game.heat = clamp(v, 0, HEAT_MAX);
    game.stars = starsForHeat(game.heat);
  };
  // Crimes raise heat so a NEW star lands mid-band, never on a boundary.
  game.addHeat = (amount) => {
    const before = starsForHeat(game.heat);
    game.setHeat(game.heat + amount);
    const after = starsForHeat(game.heat);
    // A new star lands mid-band (band start + 50), never on the edge
    // that decay would undo on the very next frame.
    if (after > before) game.setHeat(after * HEAT_PER_STAR + HEAT_MID_BAND);
    game.crimeTimer = 6;
  };
  game.enterCar = (car) => {
    if (!car || car.wrecked) return false;
    game.player.car = car;
    car.isPlayerCar = true;
    game.player.x = car.x; game.player.y = car.y;
    if (!car.stolen) {
      car.stolen = true;
      game.stats.stolen += 1;
      game.addHeat(60);
      game.say('Stole a ' + car.model + '!');
    }
    return true;
  };
  game.exitCar = () => {
    const car = game.player.car;
    if (!car) return false;
    car.isPlayerCar = false;
    car.speed = 0;
    game.player.car = null;
    game.player.x = car.x + 34; game.player.y = car.y + 10;
    return true;
  };
  game.say = (text, secs) => { game.message = text; game.messageT = secs || 3.2; };
  game.startMissionByIndex = (i) => {
    const m = MISSIONS[i];
    if (!m) return null;
    game.missions.start(m);
    game.mode = 'play';
    if (m.stars) game.addHeat(m.stars * HEAT_PER_STAR);
    game.say(m.title + ' — ' + m.objective, 5);
    return m;
  };
  game.spawnRoadblock = () => {
    if (game.roadblocks.length) return game.roadblocks[0];
    const p = game.player;
    const aheadX = clamp(p.x + 185, 120, WORLD_SIZE - 120);
    const y = nearestIntersection(p.x, p.y).y;
    const mk = (yy) => ({ id: 'rb', model: 'SCPD Cruiser', color: '#222222', x: aheadX, y: yy, angle: Math.PI / 2, speed: 0, health: 100, wrecked: false });
    const rb = { x: aheadX, y, angle: 0, a: mk(y - 26), b: mk(y + 26) };
    game.roadblocks.push(rb);
    return rb;
  };
  game.usePaintShop = () => {
    const lm = landmarkById('paint');
    if (dist(game.player.x, game.player.y, lm.x, lm.y) > 110) { game.say("Go to Lou's Paint Shop first."); return false; }
    if (game.money < 150) { game.say('Paint Shop costs $150 — not enough cash.'); return false; }
    game.money -= 150;
    game.setHeat(0);
    if (game.player.car) game.player.car.health = 100;
    game.say("Lou's crew resprayed you — heat cleared, car repaired.");
    game.sound.play('cash');
    return true;
  };
  game.buyMod = (catId) => {
    const res = buyMod(game.mods, game, catId);
    if (res.ok) game.say(res.category.name + ' upgraded to level ' + res.level + ' for $' + res.cost);
    else if (res.reason === 'max-level') game.say(res.category.name + ' is already max level.');
    else game.say('Not enough cash for that upgrade.');
    if (res.ok) game.save();
    return res;
  };
  game.damagePlayer = (amount) => {
    game.player.health -= amount;
    if (game.player.health <= 0 && game.mode === 'play') {
      game.mode = 'wasted';
      game.wastedTimer = 2.6;
      if (game.turf.challenge) game.turf.update(0, game.player.x, game.player.y, false);
    }
  };
  game.respawn = () => {
    const hosp = landmarkById('hospital');
    if (game.player.car) game.exitCar();
    game.player.x = hosp.x; game.player.y = hosp.y + 30;
    game.player.health = PLAYER_MAX_HEALTH;
    game.money = Math.max(0, game.money - 100);
    game.setHeat(0);
    game.mode = 'play';
    game.say('Solmar General patched you up. Hospital bill: $100.');
  };
  game.save = () => {
    const data = {
      money: game.money, score: game.score,
      missions: game.missions.serialize(),
      coins: serializeCoins(game.coins),
      turf: game.turf.serialize(),
      mods: serializeMods(game.mods),
      stats: game.stats,
    };
    try { game.storage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (err) { /* storage may be unavailable */ }
    return data;
  };
  game.load = () => {
    try {
      const raw = game.storage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      game.money = data.money || 0;
      game.score = data.score || 0;
      game.missions.restore(data.missions);
      restoreCoins(game.coins, data.coins);
      game.turf.restore(data.turf);
      restoreMods(game.mods, data.mods);
      if (data.stats) game.stats = data.stats;
      game.rank = rankFor(game.score, game.missions.storyComplete);
      return true;
    } catch (err) { return false; }
  };
  game.load();
  return game;
}

// ---- simulation -------------------------------------------------------

function movePlayerOnFoot(game, input, dt) {
  const p = game.player;
  const axis = input.moveAxis ? input.moveAxis() : { x: input.axisX || 0, y: input.axisY || 0 };
  const sprint = input.down ? input.down('ShiftLeft', 'ShiftRight') : input.sprint;
  const speed = sprint ? PLAYER_SPRINT : PLAYER_SPEED;
  if (axis.x || axis.y) {
    const len = Math.hypot(axis.x, axis.y) || 1;
    const nx = clamp(p.x + (axis.x / len) * speed * dt, 16, WORLD_SIZE - 16);
    const ny = clamp(p.y + (axis.y / len) * speed * dt, 16, WORLD_SIZE - 16);
    if (!collidesBuilding(game.world, nx, ny, 10)) { p.x = nx; p.y = ny; }
    p.angle = Math.atan2(axis.y, axis.x);
  }
  if (input.mouseX !== undefined && game.camera) {
    const wx = game.camera.x + input.mouseX, wy = game.camera.y + input.mouseY;
    p.angle = Math.atan2(wy - p.y, wx - p.x);
  }
}

function drivePlayerCar(game, input, dt) {
  const p = game.player;
  const car = p.car;
  const stats = effectiveStats(car, game.mods);
  const grip = stats.grip * game.weather.grip();
  const fwd = input.down ? (input.down('KeyW', 'ArrowUp') ? 1 : 0) - (input.down('KeyS', 'ArrowDown') ? 1 : 0) : (input.drive || 0);
  const steer = input.down ? (input.down('KeyD', 'ArrowRight') ? 1 : 0) - (input.down('KeyA', 'ArrowLeft') ? 1 : 0) : (input.steer || 0);
  const brake = input.down ? input.down('Space') : input.handbrake;
  if (fwd > 0) car.speed += stats.accel * dt;
  else if (fwd < 0) car.speed -= stats.accel * 0.7 * dt;
  else car.speed -= car.speed * 0.6 * dt;
  if (brake) car.speed -= car.speed * 3.2 * dt;
  car.speed = clamp(car.speed, -stats.topSpeed * 0.4, stats.topSpeed);
  if (steer && Math.abs(car.speed) > 4) car.angle += steer * (car.speed > 0 ? 1 : -1) * (1.9 * grip) * dt * Math.min(1, Math.abs(car.speed) / 120);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const clampedX = clamp(nx, 20, WORLD_SIZE - 20), clampedY = clamp(ny, 20, WORLD_SIZE - 20);
  game.hitCooldown -= dt;
  if (collidesBuilding(game.world, clampedX, clampedY, 16) || clampedX !== nx || clampedY !== ny) {
    if (Math.abs(car.speed) > 60 && game.hitCooldown <= 0) {
      car.health -= damageAfterArmor(WALL_HIT_DAMAGE, game.mods);
      game.hitCooldown = 0.5;
      game.sound.play('crash');
      game.say(car.health <= 0 ? 'Car totaled!' : 'Wall hit — car at ' + Math.max(0, Math.round(car.health)) + '%');
      if (car.health <= 0) { car.health = 0; car.wrecked = true; game.exitCar(); }
    }
    car.speed = 0;
  } else { car.x = clampedX; car.y = clampedY; }
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  // Speeding past police feeds the heat.
  if (Math.abs(car.speed) > 200) {
    for (const cop of game.police) if (dist(p.x, p.y, cop.x, cop.y) < 130) game.addHeat(6 * dt * 10);
  }
}

function updateTraffic(game, dt) {
  const target = Math.round(TRAFFIC_BASE_COUNT * game.weather.density());
  while (game.traffic.length < target) game.traffic.push(spawnTraffic(game.rng, 1)[0]);
  if (game.traffic.length > target) game.traffic.length = target;
  for (const c of game.traffic) {
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    if (c.x < 40 || c.x > WORLD_SIZE - 40 || c.y < 40 || c.y > WORLD_SIZE - 40) {
      c.angle += Math.PI;
      c.x = clamp(c.x, 50, WORLD_SIZE - 50); c.y = clamp(c.y, 50, WORLD_SIZE - 50);
    }
  }
  for (const ped of game.pedestrians) {
    ped.wander -= dt;
    if (ped.wander <= 0) { ped.angle = game.rng() * Math.PI * 2; ped.wander = 3 + game.rng() * 6; }
    const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
    if (!collidesBuilding(game.world, nx, ny, 6) && nx > 20 && ny > 20 && nx < WORLD_SIZE - 20 && ny < WORLD_SIZE - 20) { ped.x = nx; ped.y = ny; }
    else ped.angle += Math.PI / 2;
  }
}

function updatePolice(game, dt) {
  const want = game.stars;
  while (game.police.length < want) {
    const spot = nearestIntersection(game.player.x - 220, game.player.y - 160);
    game.police.push({ id: 'cop' + game.police.length + '-' + Math.floor(game.time), model: 'SCPD Cruiser', color: '#1b1b22', x: spot.x, y: spot.y, angle: 0, speed: 0, health: 100, wrecked: false, path: [], pathT: 0 });
  }
  if (game.police.length > want) game.police.length = want;
  for (const cop of game.police) {
    cop.pathT -= dt;
    if (cop.pathT <= 0 || !cop.path.length) { cop.path = findPath(cop.x, cop.y, game.player.x, game.player.y); cop.pathT = 0.6; }
    const target = cop.path.length > 1 ? cop.path[1] : { x: game.player.x, y: game.player.y };
    const d = dist(cop.x, cop.y, target.x, target.y);
    if (d < 30 && cop.path.length > 1) cop.path.shift();
    const ang = Math.atan2(target.y - cop.y, target.x - cop.x);
    cop.angle = ang;
    const sp = Math.min(POLICE_SPEED, Math.max(60, d * 1.4));
    cop.x += Math.cos(ang) * sp * dt;
    cop.y += Math.sin(ang) * sp * dt;
    cop.speed = sp;
    if (dist(cop.x, cop.y, game.player.x, game.player.y) < 30 && !game.player.car) game.damagePlayer(6 * dt);
  }
  // Roadblocks from 4 stars; they clear when heat drops.
  if (game.stars >= 4) game.spawnRoadblock();
  if (game.stars < 4) game.roadblocks = [];
  // Helicopter only at 5 stars.
  game.heli.active = game.stars >= 5;
  if (game.heli.active) {
    const h = game.heli;
    const ang = Math.atan2(game.player.y - h.y, game.player.x - h.x);
    h.angle = ang;
    const d = dist(h.x, h.y, game.player.x, game.player.y);
    if (d > 60) { h.x += Math.cos(ang) * HELI_SPEED * dt; h.y += Math.sin(ang) * HELI_SPEED * dt; }
  }
}

function updateNearMiss(game, dt) {
  game.nearMissTimer -= dt;
  const car = game.player.car;
  if (!car || Math.abs(car.speed) <= 150 || game.nearMissTimer > 0) return;
  for (const t of game.traffic) {
    const d = dist(car.x, car.y, t.x, t.y);
    if (d > 26 && d < 46) {
      game.nearMissTimer = 1.5;
      game.stats.nearMiss += 1;
      game.money += 15; game.score += 15;
      game.sound.play('whoosh');
      game.say('Near miss! +$15');
      return;
    }
  }
}

export function updateGame(game, input, dt) {
  if (game.mode === 'wasted') {
    game.wastedTimer -= dt;
    if (game.wastedTimer <= 0) game.respawn();
    return;
  }
  if (game.mode !== 'play') return;
  game.time += dt;
  if (game.messageT > 0) game.messageT -= dt;
  game.crimeTimer = Math.max(0, game.crimeTimer - dt);
  const hourChanged = game.weather.update(dt);
  if (hourChanged) {
    const income = game.turf.incomeForHour();
    if (income > 0) { game.money += income; game.say('Turf income: +$' + income); }
  }
  if (game.crimeTimer <= 0 && game.heat > 0) game.setHeat(Math.max(0, game.heat - 3.5 * dt));

  if (game.player.car) drivePlayerCar(game, input, dt); else movePlayerOnFoot(game, input, dt);

  // Interactions (edge-triggered when a real Input is supplied).
  const pressed = (code) => input.justPressed ? input.justPressed(code) : !!input['press' + code];
  if (pressed('KeyE')) {
    if (game.player.car) game.exitCar();
    else {
      let best = null, bd = 64;
      for (const c of game.cars) { const d = dist(game.player.x, game.player.y, c.x, c.y); if (d < bd) { bd = d; best = c; } }
      if (best) { if (!game.enterCar(best)) game.say('That car is totaled — it will never run again.'); }
    }
  }
  if (pressed('KeyT') && game.player.car && game.side.tryPickupFare(game.player.x, game.player.y, true)) game.say('Fare picked up — follow the marker!');
  if (pressed('KeyR') && !game.player.car && startReload(game.combat)) game.sound.play('reload');
  if (pressed('KeyF') && !game.player.car) {
    const targets = [...(game.missions.guards || []), ...game.pedestrians.map((p) => ({ ...p, _ped: p }))];
    const hit = tryPunch(game.player.x, game.player.y, game.player.angle, game.missions.guards || []);
    if (hit) { game.sound.play('punch'); if (!hit.alive) { const ev = game.missions.onGuardDown(hit); if (ev) game.say('Guard down!'); } game.addHeat(25); }
    void targets;
  }
  if (pressed('KeyY')) game.usePaintShop();
  if (pressed('KeyU')) {
    const lm = landmarkById('modshop');
    if (dist(game.player.x, game.player.y, lm.x, lm.y) <= 110) game.shopOpen = !game.shopOpen;
    else game.say("Lou's Mod Shop is next to the Paint Shop.");
  }
  if (game.shopOpen) {
    if (pressed('Digit1')) game.buyMod('engine');
    if (pressed('Digit2')) game.buyMod('armor');
    if (pressed('Digit3')) game.buyMod('tires');
    if (pressed('Escape')) game.shopOpen = false;
  }
  if (pressed('KeyG')) {
    const ch = game.turf.startChallenge(game.player.x, game.player.y);
    if (ch) game.say('Turf war! Hold ' + ch.zone.name + ' for 20 seconds!');
  }
  // Shooting on foot with the mouse held.
  if (!game.player.car && input.mouseDown) {
    const b = tryShoot(game.combat, game.player.x, game.player.y, game.player.angle);
    if (b) { game.sound.play('shot'); game.addHeat(18); }
  }

  // Mission pickup for the delivery-style package.
  if (game.side.delivery && game.side.delivery.phase === 'pickup' && game.side.tryPickupPackage(game.player.x, game.player.y)) game.say('Package picked up — run it to the Harbor Depot!');

  const guards = game.missions.guards || [];
  const hits = stepBullets(game.combat, dt, guards, (x, y) => collidesBuilding(game.world, x, y, 2));
  for (const h of hits) {
    if (h.killed) { const ev = game.missions.onGuardDown(h.target); game.score += 25; if (ev) game.say('Guard down (' + game.missions.guardsCleared + '/3)'); }
  }
  // Guards fight back at close range.
  for (const g of guards) if (g.alive && dist(g.x, g.y, game.player.x, game.player.y) < 120) game.damagePlayer(5 * dt);
  if (checkAmmoPickup(game.ammoPickups, game.combat, game.player.x, game.player.y)) game.say('Ammo +24');

  const coinHit = checkCoinPickup(game.coins, game.player.x, game.player.y);
  if (coinHit) { game.money += coinHit.value; game.score += coinHit.value; game.sound.play('coin'); game.say('Solmar coin! +$75 (' + coinsTaken(game.coins) + '/10)'); game.save(); }

  const mEv = game.missions.update(dt, game.player.x, game.player.y);
  if (mEv) {
    if (mEv.type === 'complete') {
      game.money += mEv.pay; game.score += mEv.pay;
      game.sound.play('win');
      game.say('Job complete: ' + mEv.mission.title + ' +$' + mEv.pay + (mEv.storyComplete ? ' — STORY COMPLETE! You are a Solmar Legend.' : ''));
      game.rank = rankFor(game.score, game.missions.storyComplete);
      game.save();
    } else if (mEv.type === 'grabbed') { game.setHeat(4 * HEAT_PER_STAR + 50); game.say('Ledger grabbed! Escape to the Marina!'); }
    else if (mEv.type === 'failed') { game.sound.play('fail'); game.say('Job failed: ' + mEv.mission.title + ' — try again from the board.'); }
    else if (mEv.type === 'phase') game.say(game.missions.objectiveText());
  }
  // Job 4 resolves when heat is lost after reaching the courier.
  if (game.missions.active && game.missions.active.kind === 'reach-and-lose' && game.missions.phase === 'go' && game.stars === 0 && game._job4Reached) {
    const ev = game.missions.finish(); game.money += ev.pay; game.score += ev.pay; game.say('Job complete: Strip Chase +$' + ev.pay); game.save();
  }
  if (game.missions.active && game.missions.active.kind === 'reach-and-lose' && landmarkAt(game.player.x, game.player.y, 90)) game._job4Reached = true;

  const fEv = game.side.updateFare(dt, game.player.x, game.player.y);
  if (fEv && fEv.type === 'fare-complete') { game.money += fEv.pay; game.score += 60; game.stats.fares += 1; game.sound.play('cash'); game.say('Fare delivered! +$' + fEv.pay); game.side.spawnFare(); }
  if (fEv && fEv.type === 'fare-failed') { game.say('Fare gave up waiting.'); game.side.spawnFare(); }
  const spotted = game.police.some((c) => dist(c.x, c.y, game.player.x, game.player.y) < 220);
  const dEv = game.side.updateDelivery(dt, game.player.x, game.player.y, spotted);
  if (dEv && dEv.heat) game.addHeat(dEv.heat);
  if (dEv && dEv.type === 'delivery-complete') { game.money += dEv.pay; game.score += 80; game.sound.play('cash'); game.say('Delivery done! +$' + dEv.pay); game.side.startDelivery(); }
  if (dEv && dEv.type === 'delivery-failed') { game.say('Delivery failed — package lost.'); game.side.startDelivery(); }

  const rEv = game.races.update(dt, game.player.x, game.player.y);
  if (rEv && rEv.type === 'race-complete') { game.money += rEv.pay; game.score += rEv.pay / 2; game.sound.play('win'); game.say('Race won: ' + rEv.race.name + ' +$' + rEv.pay); game.save(); }
  if (rEv && rEv.type === 'race-failed') { game.sound.play('fail'); game.say('Race failed — out of time. Retry at the flag.'); }
  if (rEv && rEv.type === 'checkpoint') game.say('Checkpoint ' + rEv.index + '/' + rEv.total);

  const tEv = game.turf.update(dt, game.player.x, game.player.y, game.player.health > 0);
  if (tEv && tEv.type === 'turf-won') { game.score += 120; game.say('Turf won: ' + tEv.zone.name + (tEv.allHeld ? ' — ALL TURF HELD! Bonus title earned.' : '')); game.save(); }
  if (tEv && tEv.type === 'turf-lost') game.say('Turf lost: ' + tEv.zone.name + ' stays with its crew.');

  updateTraffic(game, dt);
  updatePolice(game, dt);
  updateNearMiss(game, dt);

  // Race starters: drive onto a flag with no active race to begin.
  if (!game.races.active && game.player.car) {
    for (const r of RACES) if (dist(game.player.x, game.player.y, r.start.x, r.start.y) < 56 && game._raceArm !== r.id) {
      game.races.start(r); game._raceArm = r.id; game.say('Race started: ' + r.name + ' — beat ' + r.par + 's for $' + r.pay + '!');
    }
  }
  if (game.races.active) game._raceArm = game.races.active.id; else game._raceArm = null;

  const target = game.missions.active ? game.missions.objectiveText()
    : game.races.active ? 'Race: checkpoint ' + (game.races.index + 1) + '/' + game.races.active.checkpoints.length + ' — ' + Math.ceil(game.races.timeLeft) + 's left'
    : game.side.fare && game.side.fare.phase === 'ride' ? 'Taxi fare: drive your passenger to ' + game.side.fare.dest.name + ' (' + Math.ceil(game.side.fare.timeLeft) + 's)'
    : game.side.delivery && game.side.delivery.phase === 'run' ? 'Delivery: run the package to the Harbor Depot (' + Math.ceil(game.side.delivery.timeLeft) + 's)'
    : game.turf.challenge ? 'Turf war: hold the zone! ' + Math.ceil(game.turf.challenge.timeLeft) + 's'
    : '';
  game.objectiveText = target;
  if (game.missions.active) game.objectiveText = game.missions.active.title + ': ' + game.missions.objectiveText() + ' — ' + Math.ceil(game.missions.timeLeft) + 's';

  game.rank = rankFor(game.score, game.missions.storyComplete);
  followCamera(game.camera, game.player.x, game.player.y);
  game.saveTimer -= dt;
  if (game.saveTimer <= 0) { game.saveTimer = 5; game.save(); }
  if (input.endFrame) input.endFrame();
}

// ---- browser boot -----------------------------------------------------

function drawOverlay(ctx, game, w, h) {
  ctx.textAlign = 'center';
  if (game.mode === 'title') {
    ctx.fillStyle = 'rgba(10,10,30,0.72)'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffd700'; ctx.font = 'bold 74px sans-serif';
    ctx.fillText('SOLMAR HEAT', w / 2, 170);
    ctx.fillStyle = '#ffffff'; ctx.font = '22px sans-serif';
    ctx.fillText('An open-world crime story — steal, drive, run, survive.', w / 2, 214);
    ctx.font = '17px sans-serif';
    ctx.fillText('WASD / arrows — move & drive · E — steal / exit car · Mouse — aim & shoot · R — reload · F — punch', w / 2, 286);
    ctx.fillText('Space — handbrake · T — taxi fare · Y — paint shop · U — mod shop · G — turf war · Shift — sprint · P — pause · M — mute', w / 2, 316);
    ctx.fillStyle = '#ffd700';
    ctx.fillText('7 story jobs, 10 hidden Solmar coins, taxi fares, races, turf wars, the paint & mod shops — progress saves automatically', w / 2, 360);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 24px sans-serif';
    ctx.fillText('Click or press Enter to play', w / 2, 430);
    ctx.font = '13px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('A wholly original game. No part of it comes from any commercial game.', w / 2, h - 30);
  } else if (game.mode === 'board') {
    ctx.fillStyle = 'rgba(8,8,24,0.88)'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffd700'; ctx.font = 'bold 38px sans-serif';
    ctx.fillText('MISSION BOARD — Lena Voss', w / 2, 64);
    ctx.font = '15px sans-serif'; ctx.fillStyle = '#ffffff';
    MISSIONS.forEach((m, i) => {
      const y = 104 + i * 52;
      const done = game.missions.completed.has(m.id);
      ctx.fillStyle = done ? 'rgba(46,204,113,0.25)' : 'rgba(255,255,255,0.09)';
      ctx.fillRect(w / 2 - 430, y - 24, 860, 42);
      ctx.fillStyle = done ? '#2ecc71' : '#ffffff'; ctx.textAlign = 'left';
      ctx.fillText((i + 1) + '. ' + m.title + ' — $' + m.pay + (done ? ' ✓ DONE' : '') + ' — ' + m.text, w / 2 - 416, y + 3);
      ctx.textAlign = 'center';
    });
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Press 1–7 to take a job · Races: Sunset Sprint $150 · Canal Circuit $300 · Solmar Grand Run $600 (drive onto a 🏁 flag)', w / 2, 104 + 7 * 52 + 14);
    ctx.fillText('Turf: ' + game.turf.zones.map((z) => z.name.replace(' Turf', '') + '=' + z.owner).join(' · '), w / 2, 104 + 7 * 52 + 40);
    ctx.fillText('Esc — free roam', w / 2, 104 + 7 * 52 + 66);
  } else if (game.mode === 'pause') {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 42px sans-serif';
    ctx.fillText('PAUSED', w / 2, 240);
    ctx.font = '18px sans-serif';
    ctx.fillText('Mission: ' + (game.missions.active ? game.missions.active.title : 'none') + ' · Race: ' + (game.races.active ? game.races.active.name : 'none'), w / 2, 292);
    ctx.fillText('Jobs done ' + game.missions.completed.size + '/7 · Coins ' + coinsTaken(game.coins) + '/10 · Turf ' + game.turf.heldCount() + '/6 · Mods E' + game.mods.engine + '/A' + game.mods.armor + '/T' + game.mods.tires, w / 2, 324);
    ctx.fillText('Press P to resume', w / 2, 366);
  } else if (game.mode === 'wasted') {
    ctx.fillStyle = 'rgba(60,0,0,0.66)'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 72px sans-serif';
    ctx.fillText('WASTED', w / 2, 330);
    ctx.fillStyle = '#ffffff'; ctx.font = '19px sans-serif';
    ctx.fillText('An ambulance is taking you to Solmar General…', w / 2, 376);
  }
  if (game.shopOpen && game.mode === 'play') {
    ctx.fillStyle = 'rgba(8,8,24,0.9)'; ctx.fillRect(w / 2 - 300, 120, 600, 300);
    ctx.fillStyle = '#ffd700'; ctx.font = 'bold 28px sans-serif';
    ctx.fillText("LOU'S MOD SHOP", w / 2, 168);
    ctx.font = '17px sans-serif'; ctx.fillStyle = '#ffffff';
    ctx.fillText('1 · Engine — level ' + game.mods.engine + '/3' + (game.mods.engine < 3 ? ' — next $' + [250, 500, 950][game.mods.engine] : ' — MAX'), w / 2, 224);
    ctx.fillText('2 · Armor — level ' + game.mods.armor + '/3' + (game.mods.armor < 3 ? ' — next $' + [220, 480, 900][game.mods.armor] : ' — MAX'), w / 2, 264);
    ctx.fillText('3 · Tires — level ' + game.mods.tires + '/3' + (game.mods.tires < 3 ? ' — next $' + [180, 400, 800][game.mods.tires] : ' — MAX'), w / 2, 304);
    ctx.fillText('Money: $' + game.money + ' · Esc — close', w / 2, 356);
  }
  ctx.textAlign = 'left';
}

export function bootBrowser() {
  const canvas = document.getElementById('game');
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  const storage = typeof localStorage !== 'undefined' ? localStorage : new MemoryStorage();
  const game = createGame(storage);
  const input = new Input();
  input.attach(canvas, window);
  const shot = getShotName(window.location.search);
  if (shot) applyShotScenario(game, shot);
  window.__solmar = game;
  let last = performance.now();
  let boardArmed = true;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (input.justPressed('KeyM')) game.sound.toggleMute();
    if (game.mode === 'title' && (input.clicked || input.justPressed('Enter'))) game.mode = 'board';
    else if (game.mode === 'board') {
      for (let i = 0; i < 7; i++) if (input.justPressed('Digit' + (i + 1))) { game.startMissionByIndex(i); break; }
      if (input.justPressed('Escape')) game.mode = 'play';
      if (input.clicked && boardArmed) { game.startMissionByIndex(0); }
    } else if (game.mode === 'play' && input.justPressed('KeyP')) game.mode = 'pause';
    else if (game.mode === 'pause' && input.justPressed('KeyP')) game.mode = 'play';
    if (game.mode === 'board') boardArmed = false;
    updateGame(game, input, game.mode === 'play' || game.mode === 'wasted' ? dt : 0);
    if (input.endFrame) input.endFrame();
    const cam = game.camera;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    drawWorld(ctx, game, cam);
    drawEntities(ctx, game, cam);
    ctx.restore();
    drawSkyAndWeather(ctx, game, canvas.width, canvas.height);
    if (game.mode !== 'title') drawHUD(ctx, game, canvas.width, canvas.height);
    drawOverlay(ctx, game, canvas.width, canvas.height);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return game;
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootBrowser);
  else bootBrowser();
}
