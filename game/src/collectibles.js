// collectibles.js — the ten hidden Solmar coins.
// Fixed grid cells (road intersections offset onto the sidewalk), $75
// each, persisted through the autosave.

import { COIN_VALUE, dist } from './config.js';

// Fixed cells: [gridColumn, gridRow] on the 9x9 intersection grid.
export const COIN_CELLS = [
  [0, 0], [2, 1], [4, 0], [6, 2], [8, 1],
  [1, 4], [3, 6], [5, 5], [7, 7], [8, 8],
];

import { ROAD_CENTERS } from './config.js';

export function coinPositions() {
  return COIN_CELLS.map((c, i) => ({
    id: 'coin' + i,
    x: ROAD_CENTERS[c[0]] + 58,
    y: ROAD_CENTERS[c[1]] + 58,
  }));
}

export function createCollectibles() {
  return coinPositions().map((p) => ({ ...p, taken: false }));
}

export function checkCoinPickup(coins, x, y, radius) {
  const r = radius || 30;
  for (const c of coins) {
    if (!c.taken && dist(x, y, c.x, c.y) <= r) {
      c.taken = true;
      return { coin: c, value: COIN_VALUE };
    }
  }
  return null;
}

export function coinsTaken(coins) { return coins.filter((c) => c.taken).length; }

export function serializeCoins(coins) { return coins.map((c) => !!c.taken); }

export function restoreCoins(coins, saved) {
  if (!Array.isArray(saved)) return coins;
  coins.forEach((c, i) => { c.taken = !!saved[i]; });
  return coins;
}
