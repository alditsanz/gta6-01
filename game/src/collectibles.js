// Solmar Heat — collectibles.js
// Ten hidden Solmar coins ($75 each), health and ammo pickups, and
// near-miss bonuses for threading past traffic at speed.

import { dist } from './random.js';

export const COIN_SPOTS = [
  [600, 1800], [1400, 600], [2200, 3000], [3000, 1800], [800, 3200],
  [2600, 800], [1800, 1400], [3400, 2600], [400, 2600], [2000, 2200],
];
export function createCollectibles() {
  return {
    coins: COIN_SPOTS.map(([x, y], i) => ({ id: i, x, y, taken: false })),
    pickups: [
      { kind: 'health', x: 660, y: 2980, taken: false },
      { kind: 'ammo', x: 1840, y: 1760, taken: false },
      { kind: 'health', x: 2900, y: 660, taken: false },
      { kind: 'ammo', x: 1060, y: 1060, taken: false },
    ],
    nearMissCooldown: 0,
  };
}
export function coinsFound(c) { return c.coins.filter((x) => x.taken).length; }
export function stepCollectibles(world, dt) {
  const c = world.collectibles; const p = world.player;
  c.nearMissCooldown = Math.max(0, c.nearMissCooldown - dt);
  for (const coin of c.coins) {
    if (!coin.taken && dist(p.x, p.y, coin.x, coin.y) < 30) {
      coin.taken = true; p.money += 75; p.coins = coinsFound(c);
      world.events.push({ type: 'coin', amount: 75 });
    }
  }
  for (const pk of c.pickups) {
    if (!pk.taken && dist(p.x, p.y, pk.x, pk.y) < 30) {
      pk.taken = true;
      if (pk.kind === 'health') p.health = Math.min(100, p.health + 40);
      else p.reserve = Math.min(96, p.reserve + 24);
      world.events.push({ type: 'pickup', kind: pk.kind });
    }
  }
  // Near miss: fast, close, no contact, with a cooldown.
  if (p.car && c.nearMissCooldown <= 0) {
    const speed = Math.abs(p.car.speed);
    if (speed > 150) {
      for (const other of world.cars) {
        if (other === p.car || other.wrecked) continue;
        const d = dist(p.car.x, p.car.y, other.x, other.y);
        if (d > 34 && d < 62) {
          c.nearMissCooldown = 1.5; p.money += 15; p.nearMisses += 1;
          world.events.push({ type: 'nearmiss', amount: 15 });
          break;
        }
      }
    }
  }
}
