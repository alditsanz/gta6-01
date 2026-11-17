// Solmar Heat — the game itself: state, the fixed-step loop, the story
// missions, the wanted system, police and roadblocks, WASTED and respawn,
// and the save. No DOM access at import time: boot() wires the browser in.

import {
  STEP, VIEW, WORLD, PLAYER, CAR, WANTED, COMBAT, MISSIONS, LANDMARKS,
  GUARD_DROP, roadAt, clampToWorld, districtAt,
} from './config.js';
import { createRandom } from './random.js';
import { createInput } from './input.js';
import {
  buildCity, spawnParkedCars, spawnTraffic, spawnPedestrians,
  updateTraffic, updatePedestrians, spawnPoliceCar, updatePoliceCar,
  hitsBuilding, nearestRoadIndex,
} from './world.js';
import { insideZone } from './landmarks.js';
import { createCoins, collectCoins, restoreCoins, takenCoinIds, coinsGot } from './collectibles.js';
import {
  startFare, updateFare, farePayout, nearMissCheck,
  damageCarFromWall, canEnterCar, paintShopService,
} from './sidejobs.js';
import {
  createWeapon, fireWeapon, startReload, tickWeapon, updateBullets,
  punch, spawnGuards, updateGuards, createAmmoPickup,
} from './combat.js';
import { createSound } from './audio.js';
import { createRenderer, SCREEN_TITLE, SCREEN_BOARD, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_WASTED, SCREEN_COMPLETE } from './render.js';
import { stageShot } from './shots.js';

export const SAVE_KEY = 'solmar-heat-save-v1';

/** Stars for a heat value: a star every 20 heat, capped at 5. */
export function starsForHeat(heat) {
  return Math.max(0, Math.min(5, Math.floor(heat / WANTED.perStar)));
}

/**
 * Add heat from a crime. A star gained lands mid-band (boundary + 10),
 * never exactly on a boundary that would decay back the next frame.
 */
export function addHeat(state, amount) {
  const before = state.stars;
  state.heat = Math.min(WANTED.maxHeat, state.heat + amount);
  const now = starsForHeat(state.heat);
  if (now > before) {
    state.heat = Math.min(WANTED.maxHeat, now * WANTED.perStar + WANTED.midBand);
    state.stars = now;
  }
  state.lastCrimeT = state.time;
}

/** Fresh game state for a seed. Nothing here reads the browser. */
export function createGame(seed) {
  const rng = createRandom(seed);
  const city = buildCity(rng);
  const cars = spawnParkedCars(rng);
  const traffic = spawnTraffic(rng, 14);
  const peds = spawnPedestrians(rng, 22);
  const pickups = [
    createAmmoPickup(roadAt(2), roadAt(5)),
    createAmmoPickup(roadAt(6), roadAt(2)),
    createAmmoPickup(roadAt(4), roadAt(7)),
  ];
  return {
    seed,
    rng,
    time: 0,
    screen: SCREEN_TITLE,
    city,
    cars,
    traffic,
    peds,
    police: [],
    roadblocks: [],
    bullets: [],
    guards: [],
    pickups,
    coins: createCoins(),
    player: { x: LANDMARKS.plaza.x, y: LANDMARKS.plaza.y + 90, angle: -Math.PI / 2, health: PLAYER.health, inCar: false, car: null },
    weapon: createWeapon(),
    money: 0,
    score: 0,
    carsStolen: 0,
    faresDone: 0,
    nearMisses: 0,
    heat: 0,
    stars: 0,
    lastCrimeT: -999,
    lastNearMiss: -999,
    mission: null,
    missionsDone: [false, false, false, false, false, false, false],
    storyComplete: false,
    fare: null,
    toast: null,
    rank: 0,
    muted: false,
    saveExists: false,
    saveT: 0,
    spawnT: 0,
    sfx: null,
  };
}

/** The save payload: money, progress, coins, rank. */
export function serializeSave(state) {
  return {
    money: state.money,
    score: state.score,
    carsStolen: state.carsStolen,
    faresDone: state.faresDone,
    nearMisses: state.nearMisses,
    missionsDone: state.missionsDone,
    coinsTaken: takenCoinIds(state.coins),
    rank: state.rank,
  };
}

/** Apply a loaded save payload onto fresh state. */
export function applySave(state, data) {
  if (!data || typeof data !== 'object') return false;
  if (typeof data.money === 'number') state.money = data.money;
  if (typeof data.score === 'number') state.score = data.score;
  if (typeof data.carsStolen === 'number') state.carsStolen = data.carsStolen;
  if (typeof data.faresDone === 'number') state.faresDone = data.faresDone;
  if (typeof data.nearMisses === 'number') state.nearMisses = data.nearMisses;
  if (Array.isArray(data.missionsDone)) {
    for (let i = 0; i < 7; i++) state.missionsDone[i] = !!data.missionsDone[i];
  }
  if (Array.isArray(data.coinsTaken)) restoreCoins(state.coins, data.coinsTaken);
  state.rank = state.missionsDone.filter(Boolean).length;
  state.storyComplete = state.missionsDone[6] === true;
  state.saveExists = true;
  return true;
}

export function setToast(state, text, good) {
  state.toast = { text, t: state.time, good: !!good };
}

function nearestCar(state, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const car of state.cars) {
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return { car: best, distance: bestD };
}

/** Start a story job by id (1..7). Returns false when locked or busy. */
export function startMission(state, id) {
  if (state.mission) return false;
  if (id < 1 || id > 7) return false;
  if (id > 1 && !state.missionsDone[id - 2]) return false;
  const def = MISSIONS[id - 1];
  const mission = { def, id, phase: 'start', t: def.timer, countdown: def.timer > 0, target: null, courier: null, rams: 0, ramT: 0 };
  if (id === 1) {
    const { car } = nearestCar(state, state.player.x, state.player.y);
    mission.target = car ? { x: car.x, y: car.y, label: car.model } : { x: LANDMARKS.plaza.x, y: LANDMARKS.plaza.y };
    mission.phase = 'steal';
  } else if (id === 2) {
    mission.phase = 'pickup';
    mission.target = { x: LANDMARKS.plaza.x, y: LANDMARKS.plaza.y, label: 'Lena' };
  } else if (id === 3) {
    const vento = state.cars.find((c) => c.model === 'Vento');
    mission.target = vento ? { x: vento.x, y: vento.y, label: 'Vento' } : { x: LANDMARKS.marina.x, y: LANDMARKS.marina.y };
    mission.phase = 'steal';
  } else if (id === 4) {
    const px = state.player.x;
    const py = state.player.y;
    const ahead = { x: clampToWorld(px + 500), y: roadAt(nearestRoadIndex(py)) };
    mission.courier = {
      x: ahead.x, y: ahead.y, angle: 0, speed: 210, color: '#4d7cfe',
      model: 'Comet', health: 100, wrecked: false, stopped: false,
    };
    mission.phase = 'chase';
    mission.target = { x: ahead.x, y: ahead.y, label: 'Courier' };
  } else if (id === 5) {
    mission.phase = 'deliver';
    mission.target = { x: LANDMARKS.pier.x, y: LANDMARKS.pier.y, label: 'Pier 9' };
  } else if (id === 6) {
    mission.phase = 'reach';
    mission.target = { x: LANDMARKS.pier.x, y: LANDMARKS.pier.y, label: 'Pier 9' };
  } else if (id === 7) {
    state.guards = spawnGuards(LANDMARKS.hq.x, LANDMARKS.hq.y);
    mission.phase = 'clear';
    mission.target = { x: LANDMARKS.hq.x, y: LANDMARKS.hq.y, label: 'SCPD HQ' };
    mission.countdown = false;
    mission.t = 0;
  }
  if (def.startStars > 0) {
    state.heat = def.startStars * WANTED.perStar + WANTED.midBand;
    state.stars = def.startStars;
    state.lastCrimeT = state.time;
  }
  state.mission = mission;
  setToast(state, `Job ${def.id}: ${def.title}`, true);
  return true;
}

/** A job is done: pay out, advance the story, save. */
export function completeMission(state) {
  const m = state.mission;
  if (!m) return;
  const payout = m.def.payout;
  state.money += payout;
  state.score += payout * 2;
  state.missionsDone[m.id - 1] = true;
  state.rank = state.missionsDone.filter(Boolean).length;
  state.mission = null;
  state.guards = [];
  setToast(state, `Job complete! +$${payout.toLocaleString('en-US')}`, true);
  if (state.sfx) state.sfx.missionDone();
  if (m.id === 7) {
    state.storyComplete = true;
    state.screen = SCREEN_COMPLETE;
  }
  saveNow(state);
}

export function failMission(state, reason) {
  state.mission = null;
  state.guards = [];
  setToast(state, reason || 'Job failed.', false);
}

/** Persist the save to localStorage when the browser has one. */
export function saveNow(state) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(serializeSave(state)));
    }
  } catch {
    // Storage may be unavailable; the game plays on regardless.
  }
}

/** Load a save from localStorage, or null. */
export function loadSave() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    }
  } catch {
    return null;
  }
  return null;
}

/** Steal the nearest car, or step out of the one being driven. */
export function toggleCar(state) {
  const p = state.player;
  if (p.inCar && p.car) {
    const car = p.car;
    p.inCar = false;
    p.car = null;
    p.x = clampToWorld(car.x + Math.cos(car.angle + Math.PI / 2) * 34);
    p.y = clampToWorld(car.y + Math.sin(car.angle + Math.PI / 2) * 34);
    p.angle = car.angle;
    car.speed = 0;
    return 'exit';
  }
  const { car, distance } = nearestCar(state, p.x, p.y);
  if (!car || distance > 52) return 'none';
  if (!canEnterCar(car)) {
    setToast(state, 'That car is totaled — it will never drive again.', false);
    return 'wrecked';
  }
  p.inCar = true;
  p.car = car;
  p.x = car.x;
  p.y = car.y;
  if (!car.stolen) {
    car.stolen = true;
    state.carsStolen += 1;
    state.score += 25;
    addHeat(state, WANTED.stealHeat);
  }
  if (state.sfx) state.sfx.pickup();
  return 'steal';
}

/** Move the player on foot, sliding along buildings. */
function moveOnFoot(state, vx, vy, dt) {
  const p = state.player;
  const nx = clampToWorld(p.x + vx * dt);
  if (!hitsBuilding(state.city, nx, p.y, PLAYER.radius)) p.x = nx;
  const ny = clampToWorld(p.y + vy * dt);
  if (!hitsBuilding(state.city, p.x, ny, PLAYER.radius)) p.y = ny;
}

/** Drive the player's car: accel, steering, handbrake, wall hits. */
function driveCar(state, input, dt) {
  const p = state.player;
  const car = p.car;
  const mv = input.moveVector();
  const handbrake = input.down('Space');
  if (mv.y < 0) car.speed += CAR.accel * dt;
  else if (mv.y > 0) {
    if (car.speed > 0) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.accel * 0.6 * dt;
  } else {
    car.speed -= car.speed * CAR.drag * dt;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  if (handbrake) {
    car.speed -= car.speed * 2.2 * dt;
  }
  car.speed = Math.max(-CAR.reverseMax, Math.min(CAR.maxSpeed, car.speed));
  const speedRatio = Math.min(1, Math.abs(car.speed) / 220);
  const steer = mv.x * CAR.turnRate * speedRatio * (handbrake ? CAR.handbrakeTurn : 1);
  car.angle += steer * dt * (car.speed < 0 ? -1 : 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const frontX = nx + Math.cos(car.angle) * 22;
  const frontY = ny + Math.sin(car.angle) * 22;
  if (hitsBuilding(state.city, frontX, frontY, 10) || nx < 24 || nx > WORLD.size - 24 || ny < 24 || ny > WORLD.size - 24) {
    if (Math.abs(car.speed) > 120 && (!car.hitT || state.time - car.hitT > 0.5)) {
      car.hitT = state.time;
      const totaled = damageCarFromWall(car);
      if (state.sfx) state.sfx.crash();
      setToast(state, totaled ? 'Car totaled!' : `Car damaged — ${car.health}% left`, false);
      if (totaled && p.inCar) {
        p.inCar = false;
        p.car = null;
        p.x = clampToWorld(car.x + 34);
        p.y = clampToWorld(car.y + 34);
      }
    }
    car.speed *= -0.3;
  } else {
    car.x = clampToWorld(nx);
    car.y = clampToWorld(ny);
  }
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  // Bump into traffic: a nudge, not a pile-up.
  for (const t of state.traffic) {
    if (Math.hypot(t.x - car.x, t.y - car.y) < 34) {
      t.x += (t.x - car.x) * 0.4;
      t.y += (t.y - car.y) * 0.4;
      if (Math.abs(car.speed) > 60) car.speed *= 0.7;
    }
  }
  // Roadblock crash.
  for (const rb of state.roadblocks) {
    if (Math.hypot(rb.x - car.x, rb.y - car.y) < 46) {
      car.speed = 0;
      car.x = clampToWorld(car.x - Math.cos(car.angle) * 40);
      car.y = clampToWorld(car.y - Math.sin(car.angle) * 40);
      damageCarFromWall(car);
      if (state.sfx) state.sfx.crash();
      setToast(state, 'Roadblock! You smashed into the barrier.', false);
    }
  }
}

/** One mission step. */
function updateMission(state, dt) {
  const m = state.mission;
  if (!m) return;
  const p = state.player;
  if (m.countdown) {
    m.t -= dt;
    if (m.t <= 0) {
      m.t = 0;
      failMission(state, 'Job failed — the clock ran out.');
      return;
    }
  }
  const near = (x, y, r) => Math.hypot(p.x - x, p.y - y) < r;
  if (m.id === 1) {
    if (m.phase === 'steal' && p.inCar) {
      m.phase = 'deliver';
      m.target = { x: LANDMARKS.plaza.x, y: LANDMARKS.plaza.y, label: 'Lena' };
      setToast(state, 'Now drive to Lena at Cactus Court Plaza.', true);
    } else if (m.phase === 'deliver' && p.inCar && near(LANDMARKS.plaza.x, LANDMARKS.plaza.y, 90)) {
      completeMission(state);
    }
  } else if (m.id === 2) {
    if (m.phase === 'pickup' && near(LANDMARKS.plaza.x, LANDMARKS.plaza.y, 44)) {
      m.phase = 'drive';
      m.target = { x: 1895, y: 103, label: 'Neon Strip Hotel' };
      setToast(state, 'Lena is in. Drive to the Neon Strip hotel!', true);
    } else if (m.phase === 'drive' && near(1895, 103, 70)) {
      completeMission(state);
    }
  } else if (m.id === 3) {
    const vento = state.cars.find((c) => c.model === 'Vento');
    if (m.phase === 'steal' && p.inCar && p.car === vento) {
      m.phase = 'deliver';
      m.target = { x: LANDMARKS.paint.x, y: LANDMARKS.paint.y, label: "Lou's Paint Shop" };
      setToast(state, 'Got the Vento. Take it to Lou’s Paint Shop.', true);
    } else if (m.phase === 'deliver' && p.inCar && p.car === vento && near(LANDMARKS.paint.x, LANDMARKS.paint.y, 110)) {
      completeMission(state);
    }
  } else if (m.id === 4) {
    const c = m.courier;
    if (m.phase === 'chase' && c) {
      m.target = { x: c.x, y: c.y, label: 'Courier' };
      // The courier flees along its road, away from the player.
      if (!c.stopped) {
        c.x = clampToWorld(c.x + Math.cos(c.angle) * c.speed * dt);
        c.y = clampToWorld(c.y + Math.sin(c.angle) * c.speed * dt);
        if (c.x < 40 || c.x > WORLD.size - 40) c.angle = Math.PI - c.angle;
        if (c.y < 40 || c.y > WORLD.size - 40) c.angle = -c.angle;
      }
      if (p.inCar && p.car) {
        m.ramT -= dt;
        if (Math.hypot(c.x - p.car.x, c.y - p.car.y) < 44 && Math.abs(p.car.speed) > 100 && m.ramT <= 0) {
          m.ramT = 1;
          m.rams += 1;
          p.car.speed *= 0.5;
          if (state.sfx) state.sfx.crash();
          setToast(state, `Ram ${m.rams}/3 — keep hitting the courier!`, true);
          if (m.rams >= 3) {
            c.stopped = true;
            c.speed = 0;
            m.phase = 'grab';
            setToast(state, 'Courier stopped! Grab the package on foot.', true);
          }
        }
      }
    } else if (m.phase === 'grab' && c && !p.inCar && near(c.x, c.y, 34)) {
      m.phase = 'return';
      m.target = { x: LANDMARKS.plaza.x, y: LANDMARKS.plaza.y, label: 'Lena' };
      setToast(state, 'Package grabbed. Bring it back to Lena.', true);
    } else if (m.phase === 'return' && near(LANDMARKS.plaza.x, LANDMARKS.plaza.y, 90)) {
      completeMission(state);
    }
  } else if (m.id === 5) {
    if (near(LANDMARKS.pier.x, LANDMARKS.pier.y, 90)) completeMission(state);
  } else if (m.id === 6) {
    if (near(LANDMARKS.pier.x, LANDMARKS.pier.y, 90)) completeMission(state);
  } else if (m.id === 7) {
    if (m.phase === 'clear') {
      if (state.guards.length > 0 && state.guards.every((g) => !g.alive)) {
        m.phase = 'grab';
        m.target = { x: LANDMARKS.hq.x, y: LANDMARKS.hq.y + 40, label: 'The Ledger' };
        setToast(state, 'Guards down. Grab Kane’s ledger!', true);
      }
    } else if (m.phase === 'grab') {
      if (near(LANDMARKS.hq.x, LANDMARKS.hq.y + 40, 34)) {
        m.phase = 'escape';
        m.countdown = true;
        m.t = 90;
        m.target = { x: LANDMARKS.marina.x, y: LANDMARKS.marina.y, label: 'Marina' };
        state.heat = 4 * WANTED.perStar + WANTED.midBand;
        state.stars = 4;
        state.lastCrimeT = state.time;
        setToast(state, 'Ledger grabbed! Escape to the Marina in 90 seconds!', true);
      }
    } else if (m.phase === 'escape') {
      if (near(LANDMARKS.marina.x, LANDMARKS.marina.y, 90)) completeMission(state);
    }
  }
}

/** Police: spawn to match the wanted level, chase, and clear at zero stars. */
function updatePolice(state, dt) {
  if (state.stars === 0) {
    if (state.police.length > 0) state.police = [];
    if (state.roadblocks.length > 0) state.roadblocks = [];
    return;
  }
  const want = Math.min(state.stars, 4);
  state.spawnT -= dt;
  if (state.police.length < want && state.spawnT <= 0) {
    state.police.push(spawnPoliceCar(state.rng, state.player.x, state.player.y));
    state.spawnT = 2;
  }
  const p = state.player;
  for (const pc of state.police) {
    updatePoliceCar(pc, p.x, p.y, dt);
    // Ramming the player hurts.
    if (Math.hypot(pc.x - p.x, pc.y - p.y) < 34) {
      if (!pc.hitT || state.time - pc.hitT > 1) {
        pc.hitT = state.time;
        if (p.inCar && p.car) {
          p.car.health = Math.max(0, p.car.health - 4);
          p.car.speed *= 0.6;
        } else {
          p.health -= 10;
        }
        if (state.sfx) state.sfx.crash();
      }
    }
  }
  // Roadblocks from 4 stars: one barrier across the road ahead.
  if (state.stars >= 4) {
    if (state.roadblocks.length === 0) {
      const aheadX = p.x + Math.cos(p.angle) * 280;
      const aheadY = p.y + Math.sin(p.angle) * 280;
      const rx = roadAt(nearestRoadIndex(aheadX));
      const ry = roadAt(nearestRoadIndex(aheadY));
      const onHorizontal = Math.abs(p.y - ry) < Math.abs(p.x - rx);
      state.roadblocks.push({
        x: onHorizontal ? clampToWorld(aheadX) : rx,
        y: onHorizontal ? ry : clampToWorld(aheadY),
        angle: onHorizontal ? Math.PI / 2 : 0,
      });
    }
  } else if (state.roadblocks.length > 0) {
    state.roadblocks = [];
  }
}

/** One fixed update step. `input` is the input handle (or a test stub). */
export function update(state, input, dt) {
  state.time += dt;
  if (state.screen !== SCREEN_PLAY) return;
  const p = state.player;
  tickWeapon(state.weapon, dt);

  // Aim: the player faces the mouse.
  if (input.mouse) {
    const dx = input.mouse.worldX - p.x;
    const dy = input.mouse.worldY - p.y;
    if (dx * dx + dy * dy > 4) p.angle = Math.atan2(dy, dx);
  }

  // Move or drive.
  if (p.inCar && p.car) {
    driveCar(state, input, dt);
  } else {
    const mv = input.moveVector();
    const speed = input.down('ShiftLeft') || input.down('ShiftRight') ? PLAYER.sprint : PLAYER.walk;
    moveOnFoot(state, mv.x * speed, mv.y * speed, dt);
  }

  // Steal / exit.
  if (input.wasPressed && input.wasPressed('KeyE')) toggleCar(state);

  // Taxi fare.
  if (input.wasPressed && input.wasPressed('KeyT') && !state.fare) {
    const fare = startFare(state.rng, p.x, p.y);
    if (fare) {
      state.fare = fare;
      let best = null;
      let bestD = Infinity;
      for (const ped of state.peds) {
        const d = Math.hypot(ped.x - fare.pickup.x, ped.y - fare.pickup.y);
        if (d < bestD) {
          bestD = d;
          best = ped;
        }
      }
      if (best) best.fare = true;
      setToast(state, 'Fare waiting — drive to the green $ marker.', true);
    }
  }

  // Shooting.
  if (input.mouse && input.mouse.down) {
    const b = fireWeapon(state.weapon, p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20, p.angle);
    if (b) {
      state.bullets.push(b);
      addHeat(state, WANTED.shotHeat);
      if (state.sfx) state.sfx.shoot();
    }
  }
  if (input.wasPressed && input.wasPressed('KeyR')) startReload(state.weapon);
  if (input.wasPressed && input.wasPressed('KeyF')) {
    const hit = punch(p.x, p.y, p.angle, state.guards.filter((g) => g.alive));
    if (hit && state.sfx) state.sfx.punch();
  }

  // Bullets vs guards.
  const killed = updateBullets(state.bullets, state.guards, dt);
  for (const g of killed) {
    state.money += GUARD_DROP;
    state.score += GUARD_DROP;
    addHeat(state, WANTED.guardHeat);
    setToast(state, `Guard down! +$${GUARD_DROP}`, true);
  }

  // Guards shoot back.
  updateGuards(state.guards, p.x, p.y, dt, () => {
    p.health -= 6;
    if (state.sfx) state.sfx.shoot();
  });

  // World life.
  updateTraffic(state.traffic, dt);
  updatePedestrians(state.peds, dt);

  // Coins.
  const earned = collectCoins(state.coins, p.x, p.y);
  if (earned > 0) {
    state.money += earned;
    state.score += earned;
    if (state.sfx) state.sfx.coin();
    setToast(state, `Solmar coin! +$${earned} (${coinsGot(state.coins)}/10)`, true);
    saveNow(state);
  }

  // Near-miss bonuses.
  const nm = nearMissCheck(state, state.traffic);
  if (nm > 0) {
    state.money += nm;
    state.score += nm;
    state.nearMisses += 1;
    if (state.sfx) state.sfx.whoosh();
    setToast(state, `Near miss! +$${nm}`, true);
  }

  // Taxi fare progress.
  if (state.fare) {
    const res = updateFare(state.fare, p.x, p.y, p.inCar, dt);
    if (res === 'picked') setToast(state, 'Passenger aboard — drive to the destination.', true);
    else if (res === 'done') {
      const pay = farePayout(state.fare);
      state.money += pay;
      state.score += pay;
      state.faresDone += 1;
      setToast(state, `Fare complete! +$${pay}`, true);
      if (state.sfx) state.sfx.pickup();
      state.fare = null;
      for (const ped of state.peds) ped.fare = false;
      saveNow(state);
    } else if (res === 'lost') {
      setToast(state, 'The fare gave up waiting.', false);
      state.fare = null;
      for (const ped of state.peds) ped.fare = false;
    }
  }

  // Paint shop: repair + clear heat.
  if (paintShopService(state)) {
    setToast(state, "Lou's Paint Shop — car repaired, heat cleared!", true);
    if (state.sfx) state.sfx.pickup();
  }

  // Ammo pickups.
  for (const pk of state.pickups) {
    if (!pk.taken && Math.hypot(pk.x - p.x, pk.y - p.y) < 32) {
      pk.taken = true;
      state.weapon.reserve += pk.amount;
      setToast(state, `Ammo +${pk.amount}`, true);
      if (state.sfx) state.sfx.pickup();
    }
  }

  // Wanted decay: lay low and the heat fades.
  if (state.time - state.lastCrimeT > WANTED.calmSeconds && state.heat > 0) {
    state.heat = Math.max(0, state.heat - WANTED.decayPerSec * dt);
    state.stars = starsForHeat(state.heat);
  }

  updatePolice(state, dt);
  updateMission(state, dt);

  // WASTED.
  if (p.health <= 0) {
    p.health = 0;
    const lost = Math.min(state.money, 100);
    state.money -= lost;
    state.screen = SCREEN_WASTED;
    if (state.sfx) state.sfx.wasted();
  }

  // Autosave.
  state.saveT += dt;
  if (state.saveT > 10) {
    state.saveT = 0;
    saveNow(state);
  }
}

/** Respawn after WASTED: hospital, full health, no heat. */
export function respawn(state) {
  const p = state.player;
  p.x = LANDMARKS.hospital.x;
  p.y = LANDMARKS.hospital.y + 90;
  p.health = PLAYER.health;
  p.inCar = false;
  p.car = null;
  state.heat = 0;
  state.stars = 0;
  state.police = [];
  state.roadblocks = [];
  state.screen = SCREEN_PLAY;
}

/** Boot the game in the browser: canvas, input, loop, screens. */
export function boot() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
  const seed = Number.isInteger(seedParam) ? seedParam : (Math.floor(Math.random() * 4294967296) >>> 0);

  const canvas = document.getElementById('game');
  const status = document.getElementById('status');
  const state = createGame(seed);
  state.sfx = createSound();
  const saved = loadSave();
  if (saved) applySave(state, saved);

  const input = createInput(canvas);
  const renderer = createRenderer(canvas);

  // Mouse position in world coords, for aiming.
  function refreshMouseWorld() {
    const rect = canvas.getBoundingClientRect();
    const cam = renderer.cameraFor(state);
    const sx = VIEW.width / Math.max(1, rect.width);
    const sy = VIEW.height / Math.max(1, rect.height);
    input.mouse.worldX = cam.x + input.mouse.x * sx;
    input.mouse.worldY = cam.y + input.mouse.y * sy;
  }

  function announce(text) {
    if (status) status.textContent = text;
  }

  input.setActionHandler((action) => {
    if (action === 'mute') {
      state.muted = !state.muted;
      if (state.sfx) state.sfx.muted = state.muted;
      return;
    }
    if (action === 'pause') {
      if (state.screen === SCREEN_PLAY) state.screen = SCREEN_PAUSED;
      else if (state.screen === SCREEN_PAUSED) state.screen = SCREEN_PLAY;
      else if (state.screen === SCREEN_BOARD) state.screen = SCREEN_TITLE;
      return;
    }
    if (action === 'confirm') {
      if (state.screen === SCREEN_TITLE) {
        state.screen = SCREEN_BOARD;
        announce('Mission board. Choose a job.');
      } else if (state.screen === SCREEN_WASTED) {
        respawn(state);
      } else if (state.screen === SCREEN_COMPLETE) {
        state.screen = SCREEN_PLAY;
      }
    }
  });

  // Screenshot staging: a fixed scene, painted twice, then flagged ready.
  if (shot) {
    stageShot(state, shot);
    renderer.draw(state);
    renderer.draw(state);
    window.__shotReady = true;
    return;
  }

  let last = performance.now();
  let acc = 0;
  function frame(now) {
    const elapsed = Math.min(0.25, (now - last) / 1000);
    last = now;
    refreshMouseWorld();
    // Board shortcuts: number keys start jobs, Esc goes back.
    if (state.screen === SCREEN_BOARD) {
      for (let i = 1; i <= 7; i++) {
        if (input.wasPressed(`Digit${i}`)) {
          if (startMission(state, i)) {
            state.screen = SCREEN_PLAY;
            announce(`Job ${i} started.`);
          }
        }
      }
      if (input.wasPressed('Escape')) state.screen = SCREEN_TITLE;
      if (input.wasClicked()) {
        const rect = canvas.getBoundingClientRect();
        const sx = VIEW.width / Math.max(1, rect.width);
        const sy = VIEW.height / Math.max(1, rect.height);
        const mx = input.mouse.x * sx;
        const my = input.mouse.y * sy;
        // Card rects live in render.js; recompute the same layout here.
        for (let i = 0; i < 7; i++) {
          const col = i % 4;
          const row = Math.floor(i / 4);
          const rx = 60 + col * 300;
          const ry = 170 + row * 210;
          if (mx >= rx && mx <= rx + 280 && my >= ry && my <= ry + 190) {
            if (startMission(state, i + 1)) {
              state.screen = SCREEN_PLAY;
              announce(`Job ${i + 1} started.`);
            }
          }
        }
      }
    }
    acc += elapsed;
    while (acc >= STEP) {
      update(state, input, STEP);
      acc -= STEP;
    }
    renderer.draw(state);
    input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// In a browser, start the game as soon as this module loads. In Node
// (the logic test imports this module) there is no window, so boot stays
// off and the pure functions remain testable.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  boot();
}
