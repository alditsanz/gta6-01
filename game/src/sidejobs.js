// Solmar Heat — sidejobs.js
// Taxi fares and package deliveries: the honest work of Solmar.
// A fare pays about $310 for a clean run; a delivery pays more but the
// clock is tight and being spotted by police raises heat faster.

import { dist } from './random.js';
import { addHeat, starsOf } from './world.js';
import { LANDMARKS } from './landmarks.js';

export function startFare(world) {
  if (world.fare) return null;
  const rng = world.rng;
  const from = LANDMARKS[rng.int(0, LANDMARKS.length - 1)];
  let to = LANDMARKS[rng.int(0, LANDMARKS.length - 1)];
  if (to.id === from.id) to = LANDMARKS[(LANDMARKS.indexOf(to) + 3) % LANDMARKS.length];
  world.fare = {
    phase: 'pickup', x: from.x + 90, y: from.y + 80,
    dx: to.x + 40, dy: to.y + 90, timer: 150, name: to.name,
  };
  return world.fare;
}

export function stepFare(world, dt) {
  const events = [];
  const f = world.fare;
  if (!f) return events;
  const p = world.player;
  if (!p.car) return events; // fares are driven, not walked
  if (f.phase === 'pickup' && dist(p.x, p.y, f.x, f.y) < 70) {
    f.phase = 'dropoff'; f.timer = 170; events.push('fare-pickup');
  } else if (f.phase === 'dropoff') {
    f.timer -= dt;
    if (dist(p.x, p.y, f.dx, f.dy) < 80) {
      const pay = 310 + Math.max(0, Math.floor(f.timer / 6));
      world.stats.money += pay; world.stats.fares += 1; world.stats.rp += 22; world.stats.score += 60;
      world.fare = null; events.push('fare-done:' + pay);
    } else if (f.timer <= 0) {
      world.fare = null; events.push('fare-failed');
    }
  }
  return events;
}

export function startDelivery(world) {
  if (world.delivery) return null;
  const rng = world.rng;
  const from = LANDMARKS[8]; // the Marina dock office
  const to = LANDMARKS[rng.int(0, 6)];
  world.delivery = {
    phase: 'pickup', x: from.x - 120, y: from.y + 110,
    dx: to.x - 60, dy: to.y - 100, timer: 130, name: to.name,
  };
  return world.delivery;
}

export function stepDelivery(world, dt) {
  const events = [];
  const d = world.delivery;
  if (!d) return events;
  const p = world.player;
  if (d.phase === 'pickup' && dist(p.x, p.y, d.x, d.y) < 70) {
    d.phase = 'dropoff'; events.push('delivery-pickup');
  } else if (d.phase === 'dropoff') {
    d.timer -= dt;
    // Spotted: carrying the package, police attention compounds.
    if (starsOf(world) > 0) addHeat(world, 5.5 * dt);
    if (dist(p.x, p.y, d.dx, d.dy) < 85) {
      const pay = 260 + Math.max(0, Math.floor(d.timer * 1.2));
      world.stats.money += pay; world.stats.deliveries += 1; world.stats.rp += 30; world.stats.score += 80;
      world.delivery = null; events.push('delivery-done:' + pay);
    } else if (d.timer <= 0) {
      world.delivery = null; events.push('delivery-failed');
    }
  }
  return events;
}
