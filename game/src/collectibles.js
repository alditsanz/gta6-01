// collectibles.js — ten hidden Solmar coins and the street pickups
// (ammo, health). Coins pay $75 each and persist in the autosave.

export const COIN_COUNT = 10;
export const COIN_VALUE = 75;

const COIN_SPOTS = [
  [300, 300], [1500, 500], [2700, 700], [700, 1500], [1900, 1300],
  [3300, 1700], [500, 2500], [1700, 2700], [2900, 2500], [1100, 3300],
];

export function createCoins() {
  return COIN_SPOTS.map(([x, y], i) => ({ id: i, x, y, taken: false }));
}

export function createPickups(rng) {
  const out = [];
  for (let i = 0; i < 8; i++) {
    out.push({ kind: i % 2 ? 'ammo' : 'health', x: 200 + rng() * 3200, y: 200 + rng() * 3200, taken: false });
  }
  return out;
}

export function stepCollectibles(world) {
  const p = world.player;
  for (const c of world.coins) {
    if (!c.taken && Math.hypot(c.x - p.x, c.y - p.y) < 30) {
      c.taken = true;
      world.player.money += COIN_VALUE;
      world.stats.coinsFound++;
    }
  }
  for (const pk of world.pickups) {
    if (pk.taken || Math.hypot(pk.x - p.x, pk.y - p.y) >= 28) continue;
    pk.taken = true;
    if (pk.kind === 'ammo') world.player.reserve += 24;
    else world.player.hp = Math.min(100, world.player.hp + 35);
  }
}
