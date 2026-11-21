// modshop.js — Lou's Mod Shop: three upgrade tracks, three levels
// each, plus an armour refill. Levels live on the world, persist in
// the save, and feed real numbers (top speed, damage taken, grip).

export const MOD_TRACKS = [
  { id: 'engine', name: 'Engine', costs: [250, 500, 900],  blurb: '+8% top speed per level' },
  { id: 'armor',  name: 'Armor',  costs: [200, 450, 800],  blurb: 'car takes less damage' },
  { id: 'tires',  name: 'Tires',  costs: [150, 350, 650],  blurb: 'better grip, less slide' },
];
export const ARMOUR_REFILL_COST = 120;
export const MODS_TOTAL = 9;

export function modsBought(world) {
  return world.mods.engine + world.mods.armor + world.mods.tires;
}

export function buyMod(world, trackId) {
  const track = MOD_TRACKS.find(t => t.id === trackId);
  if (!track) return { ok: false, why: 'no such track' };
  const lvl = world.mods[trackId];
  if (lvl >= 3) return { ok: false, why: 'max level' };
  const cost = track.costs[lvl];
  if (world.player.money < cost) return { ok: false, why: 'not enough cash' };
  world.player.money -= cost;
  world.mods[trackId] = lvl + 1;
  return { ok: true, cost, level: lvl + 1 };
}

export function buyArmour(world) {
  if (world.player.armour >= 100) return { ok: false, why: 'armour full' };
  if (world.player.money < ARMOUR_REFILL_COST) return { ok: false, why: 'not enough cash' };
  world.player.money -= ARMOUR_REFILL_COST;
  world.player.armour = 100;
  return { ok: true, cost: ARMOUR_REFILL_COST };
}

export function engineMult(world) { return 1 + world.mods.engine * 0.08; }
export function armorMult(world) { return 1 - world.mods.armor * 0.15; }
export function tireMult(world) { return 1 + world.mods.tires * 0.10; }
