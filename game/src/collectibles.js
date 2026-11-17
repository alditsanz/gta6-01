// The ten hidden Solmar coins: fixed spots, $75 each, saved with the game.

import { COIN_SPOTS, COIN_VALUE } from './config.js';

/** Fresh coin state: one entry per fixed spot, none taken. */
export function createCoins() {
  return COIN_SPOTS.map((s, i) => ({ id: i, x: s.x, y: s.y, taken: false, bob: i * 0.7 }));
}

/** Coins still on the map. */
export function coinsLeft(coins) {
  return coins.filter((c) => !c.taken).length;
}

/** Coins collected so far. */
export function coinsGot(coins) {
  return coins.filter((c) => c.taken).length;
}

/**
 * Pick up any coin the player stands on. Returns the payout earned
 * this call (0 or more coins x COIN_VALUE) and marks them taken.
 */
export function collectCoins(coins, px, py) {
  let earned = 0;
  for (const c of coins) {
    if (c.taken) continue;
    if (Math.hypot(c.x - px, c.y - py) < 34) {
      c.taken = true;
      earned += COIN_VALUE;
    }
  }
  return earned;
}

/** Restore taken-coin ids into fresh coin state (save/load). */
export function restoreCoins(coins, takenIds) {
  const taken = new Set(takenIds);
  for (const c of coins) c.taken = taken.has(c.id);
}

/** The taken-coin ids to store in a save. */
export function takenCoinIds(coins) {
  return coins.filter((c) => c.taken).map((c) => c.id);
}
