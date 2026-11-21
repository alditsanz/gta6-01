// sidejobs.js — taxi fares and package deliveries, Solmar's honest
// work. A fare pays about $310; a delivery pays $220 against a
// timer, and being spotted by police mid-delivery raises heat fast.

export const FARE_PAY = 310;
export const DELIVERY_PAY = 220;
export const DELIVERY_TIME = 75;

export function createSideState(rng) {
  return { fare: null, delivery: null, rng };
}

function spot(rng) { return [200 + rng() * 3200, 200 + rng() * 3200]; }

export function offerFare(world) {
  if (world.side.fare) return world.side.fare;
  const [x, y] = spot(world.rng);
  const [dx, dy] = spot(world.rng);
  world.side.fare = { x, y, dx, dy, picked: false };
  return world.side.fare;
}

export function stepFare(world) {
  const f = world.side.fare;
  if (!f) return null;
  const p = world.player;
  if (!f.picked && p.car && Math.hypot(f.x - p.x, f.y - p.y) < 70) f.picked = true;
  if (f.picked && Math.hypot(f.dx - p.x, f.dy - p.y) < 80) {
    p.money += FARE_PAY;
    world.stats.fares++;
    world.side.fare = null;
    return 'fare-done';
  }
  return null;
}

export function startDelivery(world) {
  if (world.side.delivery) return false;
  const [dx, dy] = spot(world.rng);
  world.side.delivery = { dx, dy, t: DELIVERY_TIME };
  return true;
}

export function stepDelivery(world, dt) {
  const d = world.side.delivery;
  if (!d) return null;
  d.t -= dt;
  if (world.cops.length && Math.hypot(world.cops[0].x - world.player.x, world.cops[0].y - world.player.y) < 220) {
    world.heat += dt * 6; // spotted: heat climbs fast mid-delivery
  }
  if (d.t <= 0) { world.side.delivery = null; return 'delivery-failed'; }
  if (Math.hypot(d.dx - world.player.x, d.dy - world.player.y) < 80) {
    world.player.money += DELIVERY_PAY;
    world.stats.deliveries++;
    world.side.delivery = null;
    return 'delivery-done';
  }
  return null;
}
