// Solmar Heat — collectibles.js
// The ten hidden Solmar coins. They sit on fixed grid cells, pay $75
// each, show on the minimap, and persist in the autosave so a collected
// coin never comes back.

import { COIN_SPOTS, COIN_PAY } from './config.js';

export function createCoins() {
  return COIN_SPOTS.map((spot, i) => ({
    id: i,
    x: spot.x,
    y: spot.y,
    taken: false,
  }));
}

// How many coins the player has collected.
export function coinsCollected(coins) {
  return coins.filter((c) => c.taken).length;
}

// Walk over the coins; any coin within pickup range of the player is
// collected for $75. Returns the money earned this call.
export function collectCoins(coins, playerX, playerY) {
  let earned = 0;
  for (const c of coins) {
    if (!c.taken && Math.hypot(playerX - c.x, playerY - c.y) < 34) {
      c.taken = true;
      earned += COIN_PAY;
    }
  }
  return earned;
}

// Save/restore helpers: the autosave stores just the taken flags.
export function coinsSave(coins) {
  return coins.map((c) => (c.taken ? 1 : 0));
}

export function coinsLoad(coins, saved) {
  if (!Array.isArray(saved)) return;
  for (let i = 0; i < coins.length && i < saved.length; i++) {
    coins[i].taken = saved[i] === 1;
  }
}
