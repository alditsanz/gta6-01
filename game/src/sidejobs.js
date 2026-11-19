// Solmar Heat — sidejobs.js
// The side work: taxi fares, the Canal Row package delivery, and the
// near-miss bonus. Pure state machines; main.js feeds them the player
// position and the clock.

import { mulberry32, range, pick } from './random.js';
import { roadPos, districtAt } from './config.js';
import { NEAR_MISS_PAY, NEAR_MISS_COOLDOWN, NEAR_MISS_SPEED } from './config.js';

export const FARE_PAY = 310; // a taxi fare pays around $310
export const FARE_TIME = 75; // seconds to reach the destination
export const DELIVERY_PAY = 450;
export const DELIVERY_TIME = 100;

/** Fresh side-job state. */
export function createSideJobs(seed = 777) {
  return {
    rng: mulberry32(seed),
    fare: null, // {px, py, dx, dy, timer, pickedUp}
    fareDone: 0,
    delivery: null, // {px, py, dx, dy, timer, pickedUp, spotted}
    deliveryDone: 0,
    nearMissTimer: 0,
    nearMisses: 0,
  };
}

/** A random point on a road, for fares and deliveries. */
export function roadPoint(rng) {
  const horizontal = rng() < 0.5;
  const road = Math.floor(rng() * 9);
  const along = range(rng, 200, 2240);
  return horizontal ? { x: along, y: roadPos(road) } : { x: roadPos(road), y: along };
}

/** Offer a new taxi fare somewhere in the city. */
export function offerFare(state) {
  if (state.fare) return null;
  const p = roadPoint(state.rng);
  const d = roadPoint(state.rng);
  state.fare = { px: p.x, py: p.y, dx: d.x, dy: d.y, timer: FARE_TIME, pickedUp: false };
  return state.fare;
}

/** Offer a new package delivery (starts in Canal Row). */
export function offerDelivery(state) {
  if (state.delivery) return null;
  const p = { x: range(state.rng, 900, 1500), y: range(state.rng, 1700, 2100) };
  const d = roadPoint(state.rng);
  state.delivery = { px: p.x, py: p.y, dx: d.x, dy: d.y, timer: DELIVERY_TIME, pickedUp: false, spotted: false };
  return state.delivery;
}

/**
 * Advance fares/delivery by dt. `near` is a function (x, y) => boolean
 * saying whether the player is close to a point. Returns events:
 * [{type: 'fare-paid'|'fare-failed'|'delivery-paid'|'delivery-failed'|'delivery-spotted', amount?}]
 */
export function tickSideJobs(state, dt, near, wantedStars, allowPickup = false) {
  const events = [];
  if (state.nearMissTimer > 0) state.nearMissTimer -= dt;

  const f = state.fare;
  if (f) {
    f.timer -= dt;
    if (!f.pickedUp && allowPickup && near(f.px, f.py, 46)) {
      f.pickedUp = true;
      f.timer = FARE_TIME;
    } else if (f.pickedUp && near(f.dx, f.dy, 52)) {
      state.fare = null;
      state.fareDone++;
      events.push({ type: 'fare-paid', amount: FARE_PAY, district: districtAt(f.dx, f.dy) });
    } else if (f.timer <= 0) {
      state.fare = null;
      events.push({ type: 'fare-failed' });
    }
  }

  const d = state.delivery;
  if (d) {
    d.timer -= dt;
    if (!d.pickedUp && allowPickup && near(d.px, d.py, 46)) {
      d.pickedUp = true;
      d.timer = DELIVERY_TIME;
    } else if (d.pickedUp && near(d.dx, d.dy, 52)) {
      state.delivery = null;
      state.deliveryDone++;
      events.push({ type: 'delivery-paid', amount: DELIVERY_PAY });
    } else if (d.timer <= 0) {
      state.delivery = null;
      events.push({ type: 'delivery-failed' });
    }
    // Getting spotted by police mid-delivery raises heat faster.
    if (d.pickedUp && !d.spotted && wantedStars >= 2) {
      d.spotted = true;
      events.push({ type: 'delivery-spotted' });
    }
  }
  return events;
}

/**
 * Near-miss check: the player is driving fast and a traffic car passes
 * close by without touching. Returns the payout ($15) or 0.
 */
export function checkNearMiss(state, speed, closestGap) {
  if (state.nearMissTimer > 0) return 0;
  if (speed < NEAR_MISS_SPEED) return 0;
  if (closestGap > 34 || closestGap < 6) return 0; // too far, or a crash
  state.nearMissTimer = NEAR_MISS_COOLDOWN;
  state.nearMisses++;
  return NEAR_MISS_PAY;
}

/** A short list of passenger names for the fare banner. */
export function passengerName(rng) {
  return pick(rng, ['Mara', 'Dino', 'Sofia', 'Rex', 'Iris', 'Kiko', 'Tomas', 'Lena']);
}
