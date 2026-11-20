// sidejobs.js — taxi fares and package deliveries, the honest work.
// One job: spawn a waiting fare (press T nearby to accept) or a
// delivery pickup, track the trip, and pay on arrival. Deliveries run
// against a timer and draw extra heat while the player is wanted.

import { dist } from './config.js';
import { LANDMARKS } from './landmarks.js';
import { notice, say } from './missions.js';
import { addHeat } from './world.js';

const FARE_PRICE = 310; // a Solmar fare pays around $310, tip included

// A fare waits at a sidewalk point; refresh it when none is active.
export function ensureFare(world) {
  if (world.fare || world.farePed) return;
  const p = world.player;
  const a = world.rng.range(0, Math.PI * 2);
  const d = world.rng.range(260, 420);
  world.farePed = {
    x: Math.max(40, Math.min(3560, p.x + Math.cos(a) * d)),
    y: Math.max(40, Math.min(3560, p.y + Math.sin(a) * d)),
    color: '#ffd76a', skin: '#d9a066',
  };
}

// Press T near the waiting fare (in a car) to pick them up.
export function acceptFare(world) {
  const p = world.player;
  if (!world.farePed || !p.car || world.fare) return false;
  if (dist(p.x, p.y, world.farePed.x, world.farePed.y) > 64) return false;
  const dest = world.rng.pick(LANDMARKS);
  world.fare = { phase: 'dropoff', x: dest.x, y: dest.y, name: dest.name };
  world.farePed = null;
  say(world, 'Passenger', `Take me to ${dest.name}, driver — and I tip for smooth.`, 3.5);
  return true;
}

// A delivery can be started at the plaza crate marker.
export function startDelivery(world) {
  const p = world.player;
  if (world.delivery) return false;
  const dest = world.rng.pick(LANDMARKS.filter((l) => l.id !== 'plaza'));
  const d = dist(1020, 1020, dest.x, dest.y);
  world.delivery = { x: dest.x, y: dest.y, name: dest.name, t: Math.round(d / 14) + 25, pay: 140 + Math.round(d / 12) };
  say(world, 'Dispatcher', `One crate to ${dest.name}. Clock is running — and the SCPD loves a courier.`, 4);
  return true;
}

export function stepSidejobs(world, dt) {
  const p = world.player;
  ensureFare(world);

  if (world.fare) {
    const f = world.fare;
    if (p.car && dist(p.x, p.y, f.x, f.y) < 70 && Math.abs(p.car.speed) < 26) {
      const price = FARE_PRICE;
      p.money += price;
      p.score += 60;
      p.fares += 1;
      notice(world, 'FARE COMPLETE', `${f.name}  +$${price}`, 2.4);
      world.fare = null;
    }
  }

  if (world.delivery) {
    const dl = world.delivery;
    dl.t -= dt;
    if (world.wanted > 0) addHeat(world, dt * 2.2); // spotted couriers heat up faster
    if (dist(p.x, p.y, dl.x, dl.y) < 72) {
      p.money += dl.pay;
      p.score += 90;
      p.deliveries += 1;
      notice(world, 'DELIVERED', `${dl.name}  +$${dl.pay}`, 2.4);
      world.delivery = null;
    } else if (dl.t <= 0) {
      notice(world, 'DELIVERY FAILED', 'The crate went cold. The dispatcher shrugs.', 2.4);
      world.delivery = null;
    }
  }
}

// The marker the HUD should point at for side work, or null.
export function sidejobTarget(world) {
  if (world.delivery) return { x: world.delivery.x, y: world.delivery.y, label: `Deliver to ${world.delivery.name} — ${Math.ceil(world.delivery.t)}s` };
  if (world.fare) return { x: world.fare.x, y: world.fare.y, label: `Fare: drop at ${world.fare.name}` };
  if (world.farePed) return { x: world.farePed.x, y: world.farePed.y, label: 'Taxi fare waiting — press T' };
  return null;
}
