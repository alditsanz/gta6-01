// Solmar Heat — collectibles.js
// One job: the 10 hidden Solmar coins — fixed positions, pickup rules,
// payout and save/restore. Coins are the game's quiet treasure hunt.

import { PRICES } from './config.js';

// Ten fixed cells, spread so the player must cross the whole city.
export const COINS = [
  { x: 304,  y: 304,  hint: 'Sunset Mile rooftops' },
  { x: 1096, y: 304,  hint: 'Cactus Plaza fountain' },
  { x: 1888, y: 304,  hint: 'Neon Strip alley' },
  { x: 304,  y: 1096, hint: 'Marina boardwalk' },
  { x: 1096, y: 1096, hint: 'Old Foundry yard' },
  { x: 1888, y: 1096, hint: 'Canal Row bridge' },
  { x: 304,  y: 1888, hint: 'Pier 9 crates' },
  { x: 1096, y: 1888, hint: 'Harbor Lights docks' },
  { x: 1888, y: 1888, hint: 'Vista Heights view' },
  { x: 2152, y: 2152, hint: 'Coral Bay corner' },
];

export const COIN_PICKUP_RADIUS = 46;
export const COIN_PAYOUT = PRICES.coin;

// Index of the coin within pickup range of (x, y), or -1.
export function coinNear(x, y, collected) {
  for (let i = 0; i < COINS.length; i++) {
    if (collected.has(i)) continue;
    const c = COINS[i];
    const dx = c.x - x;
    const dy = c.y - y;
    if (dx * dx + dy * dy <= COIN_PICKUP_RADIUS * COIN_PICKUP_RADIUS) return i;
  }
  return -1;
}

// Collect the coin: returns the payout, or 0 when there is none to take.
export function collectCoinAt(x, y, collected) {
  const i = coinNear(x, y, collected);
  if (i < 0) return { payout: 0, index: -1 };
  collected.add(i);
  return { payout: COIN_PAYOUT, index: i };
}

export function coinsRemaining(collected) {
  return COINS.length - collected.size;
}

export function allCoinsFound(collected) {
  return collected.size >= COINS.length;
}

// Save/restore: coins are stored as a sorted list of collected indices.
export function serializeCoins(collected) {
  return [...collected].sort((a, b) => a - b);
}

export function deserializeCoins(list) {
  const out = new Set();
  for (const i of list || []) {
    if (Number.isInteger(i) && i >= 0 && i < COINS.length) out.add(i);
  }
  return out;
}

// Ammo pickups scattered near landmarks; walking over one refills reserve.
export const AMMO_PICKUPS = [
  { x: 560,  y: 560,  amount: 24 },
  { x: 1360, y: 560,  amount: 24 },
  { x: 560,  y: 1360, amount: 24 },
  { x: 1888, y: 1624, amount: 24 },
  { x: 1360, y: 2152, amount: 24 },
];

export function ammoPickupNear(x, y, taken) {
  for (let i = 0; i < AMMO_PICKUPS.length; i++) {
    if (taken.has(i)) continue;
    const p = AMMO_PICKUPS[i];
    const dx = p.x - x;
    const dy = p.y - y;
    if (dx * dx + dy * dy <= 46 * 46) return i;
  }
  return -1;
}
