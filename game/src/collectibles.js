// Solmar Heat — collectibles.js
// The 10 hidden Solmar coins: fixed spots, $75 each, a HUD counter, minimap
// dots, and persistence in the autosave. Pure state, no DOM.

import { COIN_SPOTS, COIN_VALUE } from './config.js';

/** Fresh coin state: one entry per fixed spot, none collected. */
export function createCoins() {
  return COIN_SPOTS.map((s, i) => ({ id: i, x: s.x, y: s.y, taken: false }));
}

/** How many coins are still on the map. */
export function coinsLeft(coins) {
  return coins.filter((c) => !c.taken).length;
}

/** How many coins the player has collected. */
export function coinsGot(coins) {
  return coins.filter((c) => c.taken).length;
}

/**
 * Collect any coin within pickup range of (x, y). Returns the coins
 * collected this call (0 or more) and their total value.
 */
export function collectCoins(coins, x, y, radius = 26) {
  let count = 0;
  for (const c of coins) {
    if (!c.taken && Math.hypot(c.x - x, c.y - y) <= radius) {
      c.taken = true;
      count++;
    }
  }
  return { count, value: count * COIN_VALUE };
}

/** Serialise collected coin ids for the save file. */
export function coinsSave(coins) {
  return coins.filter((c) => c.taken).map((c) => c.id);
}

/** Restore collected coin ids from a save file. */
export function coinsLoad(coins, ids) {
  if (!Array.isArray(ids)) return;
  const set = new Set(ids);
  for (const c of coins) c.taken = set.has(c.id);
}
