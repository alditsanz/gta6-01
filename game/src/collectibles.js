// collectibles.js — the ten Solmar coins hidden around the city.
// One job: place the coins on fixed road-grid cells, pay out when the
// player walks or drives over one, and remember which were taken so a
// save file can restore them. The world owns the array (world.coins);
// this file builds it and steps the pickup check.
import { COINS } from './config.js';
import { roadCenter } from './world.js';
import { dist } from './random.js';

export function buildCoins() {
  return COINS.spots.map(([i, j], index) => ({
    id: `coin-${index}`,
    index,
    x: roadCenter(i),
    y: roadCenter(j),
    amount: COINS.pay,
    taken: false,
  }));
}

export function coinsTaken(coins) {
  let n = 0;
  for (const c of coins) if (c.taken) n += 1;
  return n;
}

// Walk or drive over a coin to pocket it. Returns how many were taken.
export function checkCoins(world) {
  const p = world.player;
  let found = 0;
  for (const coin of world.coins) {
    if (coin.taken) continue;
    if (dist(p.x, p.y, coin.x, coin.y) < 30) {
      coin.taken = true;
      world.cash += coin.amount;
      found += 1;
      world.flash(`Solmar coin +$${coin.amount} — ${coinsTaken(world.coins)}/${COINS.total} found`);
      if (world.onCoin) world.onCoin();
    }
  }
  return found;
}

// Restore a save's taken coins: the save stores taken coin indices.
export function applyCoinSave(coins, takenIndices) {
  if (!Array.isArray(takenIndices)) return;
  for (const i of takenIndices) {
    if (coins[i]) coins[i].taken = true;
  }
}

export function takenCoinIndices(coins) {
  return coins.filter((c) => c.taken).map((c) => c.index);
}
