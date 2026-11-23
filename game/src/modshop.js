// Solmar Heat — Lou's workshops. The Mod Shop sells three upgrade
// tracks at three levels apiece; the Paint Shop resprays your ride,
// repairs it, and wipes the SCPD's memory of you for a flat fee.

export const MOD_TRACKS = [
  { id: 'engine', name: 'Engine', prices: [250, 450, 800] },
  { id: 'armor', name: 'Armor', prices: [200, 400, 700] },
  { id: 'tires', name: 'Tires', prices: [180, 350, 600] },
];

export function createModState() {
  return { engine: 0, armor: 0, tires: 0 };
}

export function modsBought(mods) {
  return mods.engine + mods.armor + mods.tires;
}

export function buyMod(world, trackId) {
  const track = MOD_TRACKS.find((t) => t.id === trackId);
  if (!track) return { ok: false };
  const level = world.mods[trackId];
  if (level >= 3) return { ok: false };
  const price = track.prices[level];
  if (world.stats.money < price) return { ok: false };
  world.stats.money -= price;
  world.mods[trackId] = level + 1;
  return { ok: true, price, level: level + 1 };
}

// Fold the bought levels into a car's numbers: +9% top speed per
// engine level, +8% grip per tire level, and armor shrinks damage.
export function applyMods(car, mods) {
  return {
    topSpeed: car.topSpeed * (1 + mods.engine * 0.09),
    grip: car.grip * (1 + mods.tires * 0.08),
    armor: 1 - mods.armor * 0.18,
  };
}

export const PAINT_PRICE = 120;

export function usePaintShop(world) {
  if (world.stats.money < PAINT_PRICE) return { ok: false };
  world.stats.money -= PAINT_PRICE;
  world.heat = 0;
  world.peakStars = 0;
  world.chaseTime = 0;
  world.cops = [];
  world.footCops = [];
  world.cars = world.cars.filter((car) => !car.police);
  world.heli = null;
  world.roadblock = null;
  if (world.player.car) world.player.car.hp = 100;
  return { ok: true, price: PAINT_PRICE };
}
