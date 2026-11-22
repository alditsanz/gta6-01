// Solmar Heat — modshop.js
// Lou's Mod Shop: three upgrade tracks (engine, armor, tires), three
// levels each, bought with cash and persisted in the autosave. Lou's
// Paint Shop lives here too — it clears heat and repairs the car.

export const MOD_TRACKS = [
  { id: 'engine', name: 'Engine', blurb: '+9% top speed per level', prices: [250, 450, 800] },
  { id: 'armor',  name: 'Armor',  blurb: 'car shrugs off damage',   prices: [200, 400, 700] },
  { id: 'tires',  name: 'Tires',  blurb: '+8% grip per level',      prices: [180, 350, 600] },
];

export function createModState() {
  return { engine: 0, armor: 0, tires: 0 };
}

export function modsBought(mods) {
  return mods.engine + mods.armor + mods.tires;
}

export function buyMod(world, trackId) {
  const track = MOD_TRACKS.find((t) => t.id === trackId);
  if (!track) return { ok: false, why: 'no such track' };
  const level = world.mods[trackId];
  if (level >= 3) return { ok: false, why: 'maxed' };
  const price = track.prices[level];
  if (world.stats.money < price) return { ok: false, why: 'cannot afford' };
  world.stats.money -= price;
  world.mods[trackId] = level + 1;
  return { ok: true, price, level: level + 1 };
}

export function applyMods(car, mods) {
  // Returns the effective performance of a car under the player's mods.
  const base = { topSpeed: car.topSpeed, grip: car.grip, armor: 1 };
  base.topSpeed *= 1 + mods.engine * 0.09;
  base.grip *= 1 + mods.tires * 0.08;
  base.armor = 1 - mods.armor * 0.18;
  return base;
}

export const PAINT_PRICE = 120;

export function usePaintShop(world) {
  if (world.stats.money < PAINT_PRICE) return { ok: false, why: 'cannot afford' };
  world.stats.money -= PAINT_PRICE;
  world.heat = 0; world.peakStars = 0; world.chaseTime = 0;
  world.cops.length = 0; world.footCops = [];
  world.cars = world.cars.filter((c) => !c.police);
  world.heli = null; world.roadblock = null;
  if (world.player.car) world.player.car.hp = 100;
  return { ok: true, price: PAINT_PRICE };
}
