// Solmar Heat — sidejobs.js
// Everything the player can do besides the story: taxi fares, package
// deliveries, street races, near-miss bonuses, turf wars, and Lou's Mod
// Shop upgrades (new in round 9). Each system is a small state machine
// the main loop ticks; the functions here only touch the state object
// they are handed.

import {
  FARE_PAY,
  DELIVERY_PAY,
  DELIVERY_TIME,
  RACE_PAYOUTS,
  RACES,
  NEAR_MISS_PAY,
  NEAR_MISS_SPEED,
  NEAR_MISS_COOLDOWN,
  TURF_INCOME_PER_HOUR,
  TURF_ALL_BONUS,
  TURF_ZONES,
  MOD_SHOP,
  ROADS,
} from './config.js';
import { spawnRival } from './combat.js';

// ------------------------------------------------------------------ fares
// A fare is a pedestrian waiting at a roadside who wants a ride across
// town. Press T near one to pick them up; drive to the marker to be paid.
export function spawnFare(rng) {
  const from = { x: rng.pick(ROADS), y: rng.pick(ROADS) };
  let to = { x: rng.pick(ROADS), y: rng.pick(ROADS) };
  while (Math.hypot(to.x - from.x, to.y - from.y) < 800) {
    to = { x: rng.pick(ROADS), y: rng.pick(ROADS) };
  }
  return { x: from.x, y: from.y, destX: to.x, destY: to.y, active: true, pickedUp: false };
}

export function startFare(state) {
  const f = state.fare;
  if (!f || !f.active || f.pickedUp) return false;
  if (Math.hypot(state.player.x - f.x, state.player.y - f.y) > 70) return false;
  f.pickedUp = true;
  state.message = 'Fare picked up — drive to the marker!';
  return true;
}

// Drive the passenger to the destination. Returns the payout (0 if not done).
export function updateFare(state) {
  const f = state.fare;
  if (!f || !f.pickedUp) return 0;
  if (Math.hypot(state.player.x - f.destX, state.player.y - f.destY) < 60) {
    f.active = false;
    f.pickedUp = false;
    state.stats.fares += 1;
    state.message = `Fare complete! +$${FARE_PAY}`;
    return FARE_PAY;
  }
  return 0;
}

// -------------------------------------------------------------- deliveries
// Pick up a package, deliver it across the map before the timer ends.
// Being spotted by police (a cop within 220 units) during a delivery
// raises heat faster than usual.
export function startDelivery(state) {
  if (state.delivery.active) return false;
  const rng = state.rng;
  const from = { x: rng.pick(ROADS), y: rng.pick(ROADS) };
  let to = { x: rng.pick(ROADS), y: rng.pick(ROADS) };
  while (Math.hypot(to.x - from.x, to.y - from.y) < 900) {
    to = { x: rng.pick(ROADS), y: rng.pick(ROADS) };
  }
  state.delivery = {
    active: true,
    pickedUp: false,
    x: from.x,
    y: from.y,
    destX: to.x,
    destY: to.y,
    timer: DELIVERY_TIME,
    spotted: false,
  };
  state.message = 'Package waiting — pick it up, then deliver it fast.';
  return true;
}

export function updateDelivery(state, dt) {
  const d = state.delivery;
  if (!d.active) return 0;
  d.timer -= dt;
  if (d.timer <= 0) {
    d.active = false;
    state.message = 'Delivery failed — the package went cold.';
    return 0;
  }
  // Police spotting: a cop close by while carrying the package.
  const spotted = state.police.some((p) => Math.hypot(p.x - state.player.x, p.y - state.player.y) < 220);
  if (spotted && d.pickedUp) d.spotted = true;
  if (!d.pickedUp && Math.hypot(state.player.x - d.x, state.player.y - d.y) < 50) {
    d.pickedUp = true;
    state.message = 'Package picked up — deliver it before the timer ends!';
  } else if (d.pickedUp && Math.hypot(state.player.x - d.destX, state.player.y - d.destY) < 60) {
    d.active = false;
    state.stats.deliveries = (state.stats.deliveries || 0) + 1;
    state.message = `Delivery complete! +$${DELIVERY_PAY}`;
    return DELIVERY_PAY;
  }
  return 0;
}

// ------------------------------------------------------------------ races
// Three race routes (easy / medium / hard). A checkered flag marker
// starts one; checkpoints light up in order; finishing all of them
// before the par time pays cash scaled by difficulty.
export function raceAt(x, y) {
  // Race starters sit at the first checkpoint of each route.
  for (const r of RACES) {
    const c = r.checkpoints[0];
    if (Math.hypot(x - c.x, y - c.y) < 70) return r;
  }
  return null;
}

export function startRace(state, race) {
  if (state.race.active) return false;
  state.race = {
    active: true,
    def: race,
    index: 0,
    timer: race.par,
    done: false,
  };
  state.message = `${race.name} — hit every checkpoint before the clock runs out!`;
  return true;
}

// Returns the payout (0 while racing, or the prize on finish).
export function updateRace(state, dt) {
  const r = state.race;
  if (!r.active) return 0;
  r.timer -= dt;
  if (r.timer <= 0) {
    r.active = false;
    state.message = 'Race failed — out of time. Try again at the flag.';
    return 0;
  }
  const cp = r.def.checkpoints[r.index];
  if (cp && Math.hypot(state.player.x - cp.x, state.player.y - cp.y) < 70) {
    r.index += 1;
    if (r.index >= r.def.checkpoints.length) {
      r.active = false;
      r.done = true;
      const pay = RACE_PAYOUTS[r.def.id] || 150;
      state.stats.races = (state.stats.races || 0) + 1;
      state.message = `${r.def.name} won! +$${pay}`;
      return pay;
    }
    state.message = `Checkpoint ${r.index + 1}/${r.def.checkpoints.length}`;
  }
  return 0;
}

// -------------------------------------------------------------- near miss
// Threading past a traffic car at speed over 150 pays $15, with a
// 1.5-second cooldown so one pass cannot pay twice.
export function checkNearMiss(state, traffic) {
  if (!state.player.inCar || state.player.speed < NEAR_MISS_SPEED) return 0;
  if (state.time - state.lastNearMiss < NEAR_MISS_COOLDOWN) return 0;
  for (const t of traffic) {
    const d = Math.hypot(t.x - state.player.x, t.y - state.player.y);
    if (d > 26 && d < 60) {
      state.lastNearMiss = state.time;
      state.stats.nearMisses += 1;
      state.message = `Near miss! +$${NEAR_MISS_PAY}`;
      return NEAR_MISS_PAY;
    }
  }
  return 0;
}

// -------------------------------------------------------------- turf wars
// Challenge a rival zone: stand inside it and hold the ground while
// rival crew members spawn and attack. Survive the timer and the zone
// flips to the player's crew. Each held zone pays $5 per game hour.
export function turfZoneAt(x, y) {
  for (const z of TURF_ZONES) {
    if (x >= z.rect.x && x <= z.rect.x + z.rect.w && y >= z.rect.y && y <= z.rect.y + z.rect.h) {
      return z;
    }
  }
  return null;
}

export function startTurfChallenge(state, zone) {
  if (state.turf.active) return false;
  if (zone.owner === 'player') return false;
  state.turf = {
    active: true,
    zone,
    timer: 20,
    rivals: [],
    spawnTimer: 0,
    fled: false,
  };
  state.message = `Turf war in ${zone.name}! Hold the ground for 20 seconds.`;
  return true;
}

export function updateTurf(state, dt) {
  const t = state.turf;
  if (!t.active) return 0;
  // Fleeing the zone forfeits the challenge.
  const z = t.zone;
  const inside =
    state.player.x >= z.rect.x &&
    state.player.x <= z.rect.x + z.rect.w &&
    state.player.y >= z.rect.y &&
    state.player.y <= z.rect.y + z.rect.h;
  if (!inside) {
    t.active = false;
    state.message = 'You left the turf — the challenge is off.';
    return 0;
  }
  t.timer -= dt;
  t.spawnTimer -= dt;
  if (t.spawnTimer <= 0 && t.rivals.filter((r) => !r.dead).length < 3) {
    t.spawnTimer = 2.5;
    const ang = state.rng.range(0, Math.PI * 2);
    t.rivals.push(
      spawnRival(
        state.player.x + Math.cos(ang) * 220,
        state.player.y + Math.sin(ang) * 220,
      ),
    );
  }
  // Rivals shamble toward the player.
  for (const r of t.rivals) {
    if (r.dead) continue;
    const d = Math.hypot(state.player.x - r.x, state.player.y - r.y);
    if (d > 24) {
      r.x += ((state.player.x - r.x) / d) * 55 * dt;
      r.y += ((state.player.y - r.y) / d) * 55 * dt;
    } else if (state.time - (state.lastRivalHit || 0) > 1) {
      // A rival in reach hurts the player once a second.
      state.lastRivalHit = state.time;
      state.player.health -= 8;
    }
  }
  if (t.timer <= 0) {
    t.active = false;
    z.owner = 'player';
    state.stats.turfHeld = TURF_ZONES.filter((zz) => zz.owner === 'player').length;
    let bonus = 0;
    if (state.stats.turfHeld === TURF_ZONES.length && !state.turfAllBonusPaid) {
      state.turfAllBonusPaid = true;
      bonus = TURF_ALL_BONUS;
    }
    state.message =
      bonus > 0
        ? `${z.name} is yours — ALL TURF HELD! +$${TURF_ALL_BONUS} bonus`
        : `${z.name} is yours now. Turf income: $${state.stats.turfHeld * TURF_INCOME_PER_HOUR}/hour.`;
    return bonus;
  }
  return 0;
}

// Hourly turf income, called when the game clock crosses an hour.
export function turfHourlyIncome() {
  return TURF_ZONES.filter((z) => z.owner === 'player').length * TURF_INCOME_PER_HOUR;
}

// ------------------------------------------------------- Lou's Mod Shop
// NEW in round 9: spend cash on real car upgrades at Lou's Mod Shop.
// Engine raises top speed, Armor raises car health, Tires raise grip
// (less slide, better handling in the rain). Three levels each, costs
// rising, saved with the rest of the progress.
export function modLevel(state, kind) {
  return state.mods[kind] || 0;
}

export function modCost(kind, level) {
  const track = MOD_SHOP[kind];
  if (!track || level >= track.costs.length) return null;
  return track.costs[level];
}

export function buyMod(state, kind) {
  const level = modLevel(state, kind);
  const cost = modCost(kind, level);
  if (cost === null) {
    state.message = `${MOD_SHOP[kind].name} is already maxed out.`;
    return false;
  }
  if (state.money < cost) {
    state.message = `Not enough cash — ${MOD_SHOP[kind].name} Lv${level + 1} costs $${cost}.`;
    return false;
  }
  state.money -= cost;
  state.mods[kind] = level + 1;
  state.message = `${MOD_SHOP[kind].name} upgraded to Lv${level + 1}! -$${cost}`;
  return true;
}

// Effective car stats after mods: top speed, max health, grip.
export function moddedCarStats(state, base) {
  const engine = MOD_SHOP.engine.speedBonus[modLevel(state, 'engine')] || 0;
  const armor = MOD_SHOP.armor.healthBonus[modLevel(state, 'armor')] || 0;
  const grip = MOD_SHOP.tires.gripBonus[modLevel(state, 'tires')] || 0;
  return { top: base.top + engine, maxHealth: 100 + armor, grip: 1 + grip };
}
