// Solmar Heat — collectibles.js
// The hidden-things layer: 20 Solmar coins ($75), 12 Lantern Stashes
// ($120, tucked against walls) and 5 stunt jumps (hit the mark fast in
// a car). Positions are seeded and fixed per world.

import { COIN_COUNT, STASH_COUNT, JUMP_COUNT } from './config.js';

export function createCollectibles(rng) {
  const coins = [], stashes = [], jumps = [];
  const cells = [];
  for (let i = 0; i < COIN_COUNT; i++) {
    // Spread coins over distinct grid cells so the hunt crosses the city.
    let bx = (i * 4 + 1) % 9, by = (i * 5 + 2) % 9;
    if (cells.includes(bx + ',' + by)) { bx = (bx + 1) % 9; by = (by + 3) % 9; }
    cells.push(bx + ',' + by);
    coins.push({ x: bx * 400 + 120 + rng.range(0, 160), y: by * 400 + 120 + rng.range(0, 160), taken: false });
  }
  for (let i = 0; i < STASH_COUNT; i++) {
    const bx = (i * 7 + 3) % 9, by = (i * 3 + 1) % 9;
    stashes.push({ x: bx * 400 + 84 + rng.range(0, 40), y: by * 400 + 84 + rng.range(0, 220), taken: false });
  }
  // Jumps sit on fast straights: two avenues, the coast road, the canal
  // bridge run and the dock straight.
  const jumpSpots = [
    { x: 800, y: 1600 }, { x: 2000, y: 800 }, { x: 3200, y: 400 },
    { x: 1600, y: 2800 }, { x: 2800, y: 2000 },
  ];
  for (let i = 0; i < JUMP_COUNT; i++) jumps.push({ x: jumpSpots[i].x, y: jumpSpots[i].y, done: false });
  return { coins, stashes, jumps, airTime: 0 };
}

export function coinsTaken(c) { return c.coins.filter((k) => k.taken).length; }
export function stashesTaken(c) { return c.stashes.filter((k) => k.taken).length; }
export function jumpsDone(c) { return c.jumps.filter((k) => k.done).length; }

// Step pickups against the player (on foot or in a car). Returns a list
// of event strings the caller turns into cash / HUD flashes.
export function stepCollectibles(world, dt) {
  const events = [];
  const p = world.player;
  const c = world.collectibles;
  for (const coin of c.coins) {
    if (!coin.taken && Math.abs(coin.x - p.x) < 26 && Math.abs(coin.y - p.y) < 26) {
      coin.taken = true; world.stats.money += 75; world.stats.rp += 6; events.push('coin');
    }
  }
  for (const stash of c.stashes) {
    if (!stash.taken && Math.abs(stash.x - p.x) < 24 && Math.abs(stash.y - p.y) < 24) {
      stash.taken = true; world.stats.money += 120; world.stats.rp += 10; events.push('stash');
    }
  }
  if (c.airTime > 0) c.airTime = Math.max(0, c.airTime - dt);
  if (p.car && Math.abs(p.car.speed) > 235) {
    for (const jump of c.jumps) {
      if (!jump.done && Math.abs(jump.x - p.x) < 44 && Math.abs(jump.y - p.y) < 44) {
        jump.done = true; c.airTime = 0.85;
        world.stats.money += 90; world.stats.rp += 18; events.push('jump');
      }
    }
  }
  return events;
}
