// modshop.js — Lou's Mod Shop: engine, armor and tires, three
// levels each. Levels live on the player, persist in the autosave,
// and feed the car's top speed, damage taken and grip.

export const MOD_TRACKS = [
  { key: 'engine', name: 'Engine', base: 120, desc: 'Top speed' },
  { key: 'armor', name: 'Armor', base: 150, desc: 'Damage resist' },
  { key: 'tires', name: 'Tires', base: 90, desc: 'Grip' },
];
export const MAX_LEVEL = 3;

export function createMods() {
  return { engine: 0, armor: 0, tires: 0 };
}

export function modCost(track, level) {
  const t = MOD_TRACKS.find((m) => m.key === track);
  return t ? t.base * (level + 1) : Infinity;
}

export function buyMod(world, track) {
  const lvl = world.player.mods[track];
  if (lvl === undefined || lvl >= MAX_LEVEL) return false;
  const cost = modCost(track, lvl);
  if (world.player.money < cost) return false;
  world.player.money -= cost;
  world.player.mods[track] = lvl + 1;
  world.stats.modsBought++;
  return true;
}

export function modsBought(mods) {
  return MOD_TRACKS.reduce((n, t) => n + (mods[t.key] || 0), 0);
}

export function speedBonus(mods) { return 1 + 0.12 * (mods.engine || 0); }
export function armorFactor(mods) { return 1 - 0.18 * (mods.armor || 0); }
export function tireGrip(mods) { return 1 + 0.1 * (mods.tires || 0); }
