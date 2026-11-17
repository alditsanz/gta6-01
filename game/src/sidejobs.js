// Side jobs: taxi fares, near-miss bonuses, the paint shop, and car
// damage. Each function takes the pieces of game state it needs and
// returns what changed, so the main loop stays the only orchestrator.

import { FARE_PAY, NEAR_MISS, CAR, WANTED, LANDMARKS } from './config.js';
import { roadAt } from './config.js';
import { insideZone } from './landmarks.js';

/**
 * Start a taxi fare: a waiting passenger stands at a road intersection
 * near the player; the destination is a few intersections away.
 * Returns the fare object, or null when no spot is free.
 */
export function startFare(rng, px, py) {
  const spots = [];
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      const x = roadAt(i);
      const y = roadAt(j);
      const d = Math.hypot(x - px, y - py);
      if (d > 180 && d < 900) spots.push({ x, y });
    }
  }
  if (spots.length === 0) return null;
  const pickup = spots[Math.floor(rng() * spots.length)];
  let dest = pickup;
  let tries = 0;
  while (tries++ < 40) {
    const cand = { x: roadAt(Math.floor(rng() * 9)), y: roadAt(Math.floor(rng() * 9)) };
    if (Math.hypot(cand.x - pickup.x, cand.y - pickup.y) > 700) {
      dest = cand;
      break;
    }
  }
  return { pickup, dest, state: 'waiting', pay: FARE_PAY, timer: 0 };
}

/** The fare payout: base pay, a little more for a long ride. */
export function farePayout(fare) {
  const dist = Math.hypot(fare.dest.x - fare.pickup.x, fare.dest.y - fare.pickup.y);
  return FARE_PAY + Math.round(dist / 400) * 10;
}

/**
 * Advance a fare one step. Returns 'picked' when the passenger boards,
 * 'done' when they are delivered (with the payout), 'lost' when the
 * player dawdles too long on foot, else null.
 */
export function updateFare(fare, px, py, inCar, dt) {
  if (!fare) return null;
  fare.timer += dt;
  if (fare.state === 'waiting') {
    if (Math.hypot(fare.pickup.x - px, fare.pickup.y - py) < 40) {
      if (inCar) {
        fare.state = 'riding';
        return 'picked';
      }
      return null;
    }
    if (fare.timer > 120) return 'lost';
    return null;
  }
  if (fare.state === 'riding') {
    if (Math.hypot(fare.dest.x - px, fare.dest.y - py) < 60) {
      return 'done';
    }
    return null;
  }
  return null;
}

/**
 * Near-miss check: the player's car threading past a traffic car at
 * speed, close enough to feel it but not touching. Returns the payout
 * (NEAR_MISS.payout) when one is earned, else 0. The cooldown lives on
 * the state object passed in.
 */
export function nearMissCheck(state, traffic) {
  if (!state.player.inCar || !state.player.car) return 0;
  const car = state.player.car;
  if (Math.abs(car.speed) < NEAR_MISS.speed) return 0;
  if (state.time - state.lastNearMiss < NEAR_MISS.cooldown) return 0;
  for (const t of traffic) {
    const dx = t.x - car.x;
    const dy = t.y - car.y;
    const dist = Math.hypot(dx, dy);
    if (dist < NEAR_MISS.gap && dist > 26) {
      // Must be passing alongside, not head-on into it.
      const along = Math.abs(dx * Math.cos(car.angle) + dy * Math.sin(car.angle));
      const across = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (along < 60 && across > 18 && across < NEAR_MISS.gap) {
        state.lastNearMiss = state.time;
        return NEAR_MISS.payout;
      }
    }
  }
  return 0;
}

/**
 * Wall damage: a car that hits a building loses CAR.wallDamage health.
 * Returns true when the hit totaled the car.
 */
export function damageCarFromWall(car) {
  car.health -= CAR.wallDamage;
  if (car.health <= 0) {
    car.health = 0;
    car.wrecked = true;
    car.speed = 0;
    return true;
  }
  return false;
}

/** A wrecked car can never be driven or stolen again. */
export function canEnterCar(car) {
  return !car.wrecked;
}

/**
 * Lou's Paint Shop: inside the shop zone the car is repaired and the
 * heat is cleared. Returns true when the shop did work this call.
 */
export function paintShopService(state) {
  const p = state.player;
  if (!p.inCar || !p.car) return false;
  if (!insideZone(p.car.x, p.car.y, LANDMARKS.paint, 110)) return false;
  if (state.heat <= 0 && p.car.health >= CAR.health) return false;
  p.car.health = CAR.health;
  state.heat = 0;
  state.lastCrimeT = -999;
  return true;
}

/** Heat for stealing a car, applied through the wanted helper in main. */
export function stealHeatAmount() {
  return WANTED.stealHeat;
}
