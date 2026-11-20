// modshop.js — Lou's Mod Shop: engine / armor / tires upgrades.
// One job: hold the upgrade catalogue (3 tracks x 3 levels, priced),
// apply purchases, and expose the performance multipliers the car
// physics reads. Mods belong to the player, not to one car.

export const MOD_TRACKS = [
  { key: 'engine', name: 'Engine', blurb: 'Top speed + acceleration', costs: [150, 300, 550] },
  { key: 'armor', name: 'Armor', blurb: 'Tougher body, less crash damage', costs: [200, 350, 600] },
  { key: 'tires', name: 'Tires', blurb: 'Grip in corners and in rain', costs: [120, 260, 480] },
];

export function makeMods() {
  return { engine: 0, armor: 0, tires: 0 };
}

export function modsBought(mods) {
  return mods.engine + mods.armor + mods.tires;
}

export function nextCost(mods, key) {
  const track = MOD_TRACKS.find((t) => t.key === key);
  const lvl = mods[key];
  return lvl >= 3 ? null : track.costs[lvl];
}

// Try to buy the next level of a track. Returns true on success.
export function buyMod(world, key) {
  const cost = nextCost(world.mods, key);
  if (cost === null) return false;
  if (world.player.money < cost) return false;
  world.player.money -= cost;
  world.mods[key] += 1;
  return true;
}

// Multipliers read by the driving physics in world.js.
export function engineFactor(mods) { return 1 + mods.engine * 0.09; }
export function armorFactor(mods) { return 1 - mods.armor * 0.18; } // damage taken
export function tireFactor(mods) { return 1 + mods.tires * 0.07; }
