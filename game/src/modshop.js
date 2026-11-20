// Solmar Heat — modshop.js
// Lou's Mod Shop: Engine / Armor / Tires, three levels each, bought
// with mission cash and persisted in the autosave. Upgrades apply to
// whichever car Rex currently owns (his Vento) and stack by level.

export const MOD_KINDS = [
  { id: 'engine', name: 'Engine', blurb: 'Top speed and acceleration', costs: [150, 300, 550] },
  { id: 'armor', name: 'Armor', blurb: 'Hull strength and crash resistance', costs: [120, 260, 500] },
  { id: 'tires', name: 'Tires', blurb: 'Grip and cornering', costs: [100, 220, 450] },
];
export function createMods() { return { engine: 0, armor: 0, tires: 0 }; }
export function modDef(id) { return MOD_KINDS.find((k) => k.id === id) || null; }
export function nextCost(mods, id) {
  const d = modDef(id); if (!d) return null;
  const lvl = mods[id] || 0;
  return lvl >= 3 ? null : d.costs[lvl];
}
export function buyUpgrade(world, id) {
  const cost = nextCost(world.mods, id);
  if (cost === null) return { ok: false, reason: 'maxed' };
  if (world.player.money < cost) return { ok: false, reason: 'cash' };
  world.player.money -= cost;
  world.mods[id] += 1;
  applyMods(world);
  world.modBuys = (world.modBuys || 0) + 1;
  return { ok: true, cost, level: world.mods[id] };
}
export function applyMods(world) {
  const car = world.cars.find((c) => c.isPlayerCar);
  if (!car) return;
  const base = car.base;
  car.top = base.top * (1 + 0.12 * world.mods.engine);
  car.accel = base.accel * (1 + 0.14 * world.mods.engine);
  car.maxHp = base.hp * (1 + 0.3 * world.mods.armor);
  car.hp = Math.min(car.maxHp, car.hp + (world.mods.armor ? base.hp * 0.3 : 0));
  car.grip = base.grip * (1 + 0.11 * world.mods.tires);
}
export function modSummary(world) {
  return MOD_KINDS.map((k) => ({ id: k.id, name: k.name, level: world.mods[k.id] || 0, next: nextCost(world.mods, k.id) }));
}
