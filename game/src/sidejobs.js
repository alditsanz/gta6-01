// Solmar Heat — honest work, sort of. Taxi fares pay for speed and
// clean driving; marina deliveries pay better but the cargo makes
// every passing cruiser lean in for a second look.

import { dist } from './random.js';
import { addHeat, starsOf } from './world.js';
import { LANDMARKS } from './landmarks.js';

export function startFare(world) {
  if (world.fare) return null;
  const rng = world.rng;
  const from = LANDMARKS[rng.int(0, LANDMARKS.length - 1)];
  let to = LANDMARKS[rng.int(0, LANDMARKS.length - 1)];
  if (to.id === from.id) {
    to = LANDMARKS[(LANDMARKS.indexOf(to) + 3) % LANDMARKS.length];
  }
  world.fare = {
    phase: 'pickup',
    x: from.x + 90, y: from.y + 80,
    dx: to.x + 40, dy: to.y + 90,
    timer: 150,
    name: to.name,
  };
  return world.fare;
}

export function stepFare(world, dt) {
  const events = [];
  const fare = world.fare;
  if (!fare) return events;
  const p = world.player;
  if (!p.car) return events;

  if (fare.phase === 'pickup') {
    if (dist(p.x, p.y, fare.x, fare.y) < 70) {
      fare.phase = 'dropoff';
      fare.timer = 170;
      events.push('fare-pickup');
    }
    return events;
  }

  fare.timer -= dt;
  if (dist(p.x, p.y, fare.dx, fare.dy) < 80) {
    const pay = 310 + Math.max(0, Math.floor(fare.timer / 6));
    world.stats.money += pay;
    world.stats.fares += 1;
    world.stats.rp += 22;
    world.stats.score += 60;
    world.fare = null;
    events.push('fare-done:' + pay);
  } else if (fare.timer <= 0) {
    world.fare = null;
    events.push('fare-failed');
  }
  return events;
}

export function startDelivery(world) {
  if (world.delivery) return null;
  const rng = world.rng;
  const from = LANDMARKS[8];
  const to = LANDMARKS[rng.int(0, 6)];
  world.delivery = {
    phase: 'pickup',
    x: from.x - 120, y: from.y + 110,
    dx: to.x - 60, dy: to.y - 100,
    timer: 130,
    name: to.name,
  };
  return world.delivery;
}

export function stepDelivery(world, dt) {
  const events = [];
  const job = world.delivery;
  if (!job) return events;
  const p = world.player;

  if (job.phase === 'pickup') {
    if (dist(p.x, p.y, job.x, job.y) < 70) {
      job.phase = 'dropoff';
      events.push('delivery-pickup');
    }
    return events;
  }

  job.timer -= dt;
  if (starsOf(world) > 0) addHeat(world, 5.5 * dt);
  if (dist(p.x, p.y, job.dx, job.dy) < 85) {
    const pay = 260 + Math.max(0, Math.floor(job.timer * 1.2));
    world.stats.money += pay;
    world.stats.deliveries += 1;
    world.stats.rp += 30;
    world.stats.score += 80;
    world.delivery = null;
    events.push('delivery-done:' + pay);
  } else if (job.timer <= 0) {
    world.delivery = null;
    events.push('delivery-failed');
  }
  return events;
}
