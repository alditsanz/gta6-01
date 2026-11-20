// Solmar Heat — sidejobs.js
// Taxi fares and cross-map delivery runs between story missions.

import { dist } from './random.js';
import { addHeat } from './world.js';

export function createSidejobs(rng) {
  return {
    fare: null, delivery: null, rng,
    fareSpots: [[900, 900], [2700, 900], [900, 2700], [2700, 2700], [1800, 600]],
  };
}
export function offerFare(world) {
  const s = world.sidejobs; if (s.fare) return s.fare;
  const from = s.fareSpots[Math.floor(s.rng() * s.fareSpots.length)];
  let to = s.fareSpots[Math.floor(s.rng() * s.fareSpots.length)];
  if (to === from) to = s.fareSpots[0];
  s.fare = { x: from[0], y: from[1], dx: to[0], dy: to[1], picked: false };
  return s.fare;
}
export function stepSidejobs(world, dt) {
  const s = world.sidejobs; const p = world.player;
  if (s.fare) {
    if (!s.fare.picked && p.car && dist(p.x, p.y, s.fare.x, s.fare.y) < 70) s.fare.picked = true;
    else if (s.fare.picked && dist(p.x, p.y, s.fare.dx, s.fare.dy) < 85) {
      p.money += 310; p.fares += 1; world.events.push({ type: 'fare', pay: 310 });
      world.banner = { text: 'FARE COMPLETE', sub: '+$310', t: 2.5 }; s.fare = null;
    }
  }
  if (s.delivery) {
    s.delivery.time -= dt;
    if (world.cops.length > 0) addHeat(world, dt * 6); // spotted: heat climbs faster
    if (dist(p.x, p.y, s.delivery.dx, s.delivery.dy) < 85) {
      p.money += 220; world.events.push({ type: 'delivery', pay: 220 });
      world.banner = { text: 'DELIVERY DONE', sub: '+$220', t: 2.5 }; s.delivery = null;
    } else if (s.delivery.time <= 0) { world.banner = { text: 'DELIVERY FAILED', sub: 'Too slow', t: 2.5 }; s.delivery = null; }
  }
}
export function startDelivery(world) {
  const s = world.sidejobs; if (s.delivery) return false;
  s.delivery = { dx: 3260, dy: 1020, time: 90 };
  world.events.push({ type: 'deliveryStart' });
  return true;
}
export function tryTaxiKey(world) {
  const s = world.sidejobs; const p = world.player;
  if (!s.fare) { offerFare(world); return 'offered'; }
  if (!s.fare.picked && p.car && dist(p.x, p.y, s.fare.x, s.fare.y) < 80) { s.fare.picked = true; return 'picked'; }
  return 'waiting';
}
