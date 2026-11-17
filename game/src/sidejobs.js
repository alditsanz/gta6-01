// sidejobs.js — the work between story missions: taxi fares, the paint
// shop and dropped cash. One job: small paid activities that keep the
// free-roam city worth driving, with their own state and payouts.
// The world owns the state (world.side.fare, world.side.bags); this file
// steps it.
import { TAXI, PAINT_SHOP } from './config.js';
import { dist } from './random.js';
import { landmarkById } from './landmarks.js';

export function createSideJobs() {
  return { fare: null, fareCooldown: 0, bags: [] };
}

// Start a taxi fare: a waiting rider on a sidewalk, a destination across
// town, a fare that grows with the distance. Only one fare at a time.
export function startFare(world) {
  if (world.side.fare) return null;
  const p = world.player;
  const rider = world.pedestrians.find((ped) => dist(ped.x, ped.y, p.x, p.y) < 260 && ped.panic <= 0);
  if (!rider) return null;
  const dests = world.landmarks.filter((l) => dist(l.x, l.y, p.x, p.y) > 500);
  const dest = dests[Math.floor(world.rng.next() * dests.length)] || world.landmarks[0];
  const pay = Math.min(
    TAXI.maxFare,
    Math.round(TAXI.fareBase + dist(p.x, p.y, dest.x, dest.y) * TAXI.farePerPixel),
  );
  world.side.fare = {
    rider,
    destX: dest.x,
    destY: dest.y,
    destName: dest.name,
    pay,
    pickedUp: false,
  };
  rider.fareRider = true;
  world.flash(`Fare: pick up the rider, then ${dest.name} — $${pay}`);
  return world.side.fare;
}

export function updateFare(world) {
  const fare = world.side.fare;
  if (!fare) return;
  const p = world.player;
  if (!fare.pickedUp) {
    // The rider walks to the car when it stops nearby.
    if (dist(fare.rider.x, fare.rider.y, p.x, p.y) < 46 && !p.onFoot) {
      fare.pickedUp = true;
      world.flash(`Rider aboard — take them to ${fare.destName}`);
    } else if (dist(fare.rider.x, fare.rider.y, p.x, p.y) < 46) {
      world.flash('The rider wants a car — steal one first');
    }
    return;
  }
  if (dist(p.x, p.y, fare.destX, fare.destY) < 80 && !p.onFoot) {
    world.cash += fare.pay;
    world.faresDone += 1;
    world.flash(`Fare paid — $${fare.pay}`);
    fare.rider.fareRider = false;
    world.side.fare = null;
    world.side.fareCooldown = 4;
  }
}

// Driving through Lou's Paint Shop buys a new identity: the wanted level
// clears (for $200, when there is heat to clear) and a battered car comes
// out repaired. The shop only works while driving.
export function checkPaintShop(world) {
  const p = world.player;
  if (p.onFoot) return;
  const shop = landmarkById(world.landmarks, 'paint');
  if (!shop) return;
  if (dist(p.x, p.y, shop.x, shop.y) >= PAINT_SHOP.radius) return;
  const car = p.car;
  if (car && car.health < 100) {
    car.health = 100;
    world.flash('Paint shop — car repaired, good as new');
  }
  if (world.wanted > 0 && world.cash >= PAINT_SHOP.cost) {
    world.cash -= PAINT_SHOP.cost;
    world.heat = 0;
    world.wanted = 0;
    world.police = [];
    world.paintJobs += 1;
    world.flash(`New paint — $${PAINT_SHOP.cost}. The heat forgot you.`);
  }
}

// Dropped cash bags respawn around the city so free roam always pays a
// little: walk or drive over one to pocket it.
export function spawnCashBag(world, x, y, amount) {
  const bag = { x, y, amount, taken: false };
  world.side.bags.push(bag);
  return bag;
}

export function checkCashBags(world) {
  const p = world.player;
  for (const bag of world.side.bags) {
    if (bag.taken) continue;
    if (dist(p.x, p.y, bag.x, bag.y) < 30) {
      bag.taken = true;
      world.cash += bag.amount;
      world.flash(`Found $${bag.amount} in a dropped bag`);
      if (world.onPickup) world.onPickup();
    }
  }
  world.side.bags = world.side.bags.filter((b) => !b.taken);
}
