// sidejobs.js — taxi fares and package deliveries: the honest
// work between crimes. A fare waits at a kerb (press T nearby);
// a delivery is a timed run where police attention costs heat.

import { range } from './random.js';
import { addHeat } from './world.js';

export const FARE_PAY = 310;
export const DELIVERY_PAY = 260;

const KERBS = [
  { x: 754, y: 500 }, { x: 1554, y: 900 }, { x: 2354, y: 1400 }, { x: 954, y: 2200 },
  { x: 2754, y: 2600 }, { x: 500, y: 754 }, { x: 3154, y: 1900 }, { x: 1954, y: 3154 },
];

export function spawnFare(world) {
  const rng = world.rng;
  const from = KERBS[Math.floor(rng() * KERBS.length)];
  let to = KERBS[Math.floor(rng() * KERBS.length)];
  if (to === from) to = KERBS[(KERBS.indexOf(from) + 3) % KERBS.length];
  world.fare = { x: from.x, y: from.y, destX: to.x, destY: to.y, aboard: false };
  return world.fare;
}

export function stepFare(world, events) {
  const fare = world.fare;
  if (!fare) return;
  const p = world.player;
  if (!fare.aboard) {
    if (p.car && Math.hypot(fare.x - p.car.x, fare.y - p.car.y) < 55) {
      fare.aboard = true;
      events.push({ type: 'fare-pickup' });
    }
  } else if (p.car && Math.hypot(fare.destX - p.car.x, fare.destY - p.car.y) < 70) {
    p.money += FARE_PAY; p.rp += 8;
    world.stats.fares++;
    events.push({ type: 'fare-done', pay: FARE_PAY });
    world.fare = null;
  }
}

export function spawnDelivery(world) {
  const spots = [
    { x: 2154, y: 2900 }, { x: 3350, y: 3300 }, { x: 1700, y: 600 }, { x: 600, y: 1554 },
  ];
  const a = spots[Math.floor(world.rng() * spots.length)];
  let b = spots[Math.floor(world.rng() * spots.length)];
  if (b === a) b = spots[(spots.indexOf(a) + 2) % spots.length];
  world.delivery = { x: a.x, y: a.y, destX: b.x, destY: b.y, carried: false, t: 120 };
  return world.delivery;
}

export function stepDelivery(world, dt, events) {
  const d = world.delivery;
  if (!d) return;
  const p = world.player;
  const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
  if (!d.carried) {
    if (Math.hypot(d.x - px, d.y - py) < 55) { d.carried = true; events.push({ type: 'delivery-pickup' }); }
    return;
  }
  d.t -= dt;
  // Being watched while carrying costs heat, slowly.
  if (world.exposure > 0.4) addHeat(world, dt * 6);
  if (Math.hypot(d.destX - px, d.destY - py) < 75) {
    p.money += DELIVERY_PAY; p.rp += 12;
    world.stats.deliveries++;
    events.push({ type: 'delivery-done', pay: DELIVERY_PAY });
    world.delivery = null;
  } else if (d.t <= 0) {
    events.push({ type: 'delivery-failed' });
    world.delivery = null;
  }
}

export { range };
