// modshop.js — Lou's Mod Shop: Engine, Armor and Tires upgrades.
// Three categories, three levels each, bought with game money at Lou's
// (next door to the Paint Shop). Levels persist in the autosave and
// apply to whatever car the player is driving.

export const MOD_CATEGORIES = [
  {
    id: 'engine', name: 'Engine', blurb: 'Top speed and acceleration',
    costs: [250, 500, 950], perLevel: 0.09, // +9% speed/accel per level
  },
  {
    id: 'armor', name: 'Armor', blurb: 'Damage taken is reduced',
    costs: [220, 480, 900], perLevel: 0.22, // -22% damage per level
  },
  {
    id: 'tires', name: 'Tires', blurb: 'Grip in corners and rain',
    costs: [180, 400, 800], perLevel: 0.05, // +grip per level
  },
];

export const MOD_MAX_LEVEL = 3;

export function createMods() {
  return { engine: 0, armor: 0, tires: 0 };
}

export function categoryById(id) { return MOD_CATEGORIES.find((c) => c.id === id) || null; }

export function nextCost(mods, catId) {
  const cat = categoryById(catId);
  if (!cat) return null;
  const level = mods[catId] || 0;
  if (level >= MOD_MAX_LEVEL) return null;
  return cat.costs[level];
}

// Buy the next level. wallet is {money}; returns a result event.
export function buyMod(mods, wallet, catId) {
  const cat = categoryById(catId);
  if (!cat) return { ok: false, reason: 'unknown-category' };
  const cost = nextCost(mods, catId);
  if (cost === null) return { ok: false, reason: 'max-level', category: cat };
  if (wallet.money < cost) return { ok: false, reason: 'cannot-afford', category: cat, cost };
  wallet.money -= cost;
  mods[catId] = (mods[catId] || 0) + 1;
  return { ok: true, category: cat, cost, level: mods[catId] };
}

// Apply mods to a car's base stats, returning effective stats.
export function effectiveStats(car, mods) {
  const e = mods.engine || 0, t = mods.tires || 0;
  const engineCat = categoryById('engine'), tiresCat = categoryById('tires');
  return {
    topSpeed: car.topSpeed * (1 + engineCat.perLevel * e),
    accel: car.accel * (1 + engineCat.perLevel * e),
    grip: Math.min(0.99, car.grip + tiresCat.perLevel * t),
  };
}

// Damage after armor: level 3 armor cuts wall/crash damage by 66%.
export function damageAfterArmor(amount, mods) {
  const armorCat = categoryById('armor');
  const factor = 1 - armorCat.perLevel * (mods.armor || 0);
  return Math.max(1, Math.round(amount * Math.max(0.1, factor)));
}

export function serializeMods(mods) { return { engine: mods.engine | 0, armor: mods.armor | 0, tires: mods.tires | 0 }; }

export function restoreMods(mods, saved) {
  if (!saved) return mods;
  for (const cat of MOD_CATEGORIES) {
    const v = saved[cat.id];
    if (typeof v === 'number') mods[cat.id] = Math.max(0, Math.min(MOD_MAX_LEVEL, Math.floor(v)));
  }
  return mods;
}
