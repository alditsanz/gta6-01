// Solmar Heat — modshop.js
// Lou's Mod Shop (round 10, new system): real car upgrades the player buys
// with mission money and keeps in the autosave. Three categories — Engine,
// Armor, Tires — three levels each, prices balanced against mission payouts
// (a level-1 part costs about one easy job; level 3 costs a story finale).
// Upgrades change the car the player is driving right now and are visible
// in the HUD and the garage panel.

import { MOD_CATEGORIES, modNextPrice } from './config.js';

/** Fresh mod state: every category at level 0, no car modded yet. */
export function createMods() {
  return { engine: 0, armor: 0, tires: 0 };
}

/** Level of one category (0 = stock). */
export function modLevel(mods, categoryId) {
  return mods[categoryId] || 0;
}

/** The bought level's stats for a category, or null at level 0. */
export function modLevelStats(categoryId, level) {
  const cat = MOD_CATEGORIES.find((c) => c.id === categoryId);
  if (!cat || level <= 0) return null;
  return cat.levels[level - 1] || null;
}

/**
 * Buy the next level of a category. `money` is the player's current cash.
 * Returns {ok, price, level} or {ok: false, reason}.
 */
export function buyMod(mods, categoryId, money) {
  const level = modLevel(mods, categoryId);
  const price = modNextPrice(categoryId, level);
  if (price === null) return { ok: false, reason: 'maxed' };
  if (money < price) return { ok: false, reason: 'broke' };
  mods[categoryId] = level + 1;
  return { ok: true, price, level: level + 1 };
}

/**
 * Apply the bought mods to a car's live stats. `base` is the car's model
 * stats {top, accel} plus its maxHealth. Returns the effective stats.
 */
export function moddedCarStats(mods, base) {
  const engine = modLevelStats('engine', modLevel(mods, 'engine'));
  const armor = modLevelStats('armor', modLevel(mods, 'armor'));
  const tires = modLevelStats('tires', modLevel(mods, 'tires'));
  return {
    top: base.top * (engine ? engine.topMult : 1),
    accel: base.accel * (engine ? engine.accelMult : 1),
    maxHealth: base.maxHealth + (armor ? armor.healthBonus : 0),
    grip: tires ? tires.gripMult : 1,
  };
}

/** Total dollars spent on mods so far (for the garage panel). */
export function modsSpent(mods) {
  let total = 0;
  for (const cat of MOD_CATEGORIES) {
    for (let l = 1; l <= modLevel(mods, cat.id); l++) {
      total += cat.levels[l - 1].price;
    }
  }
  return total;
}

/** One-line summary for the HUD ("ENG 2 · ARM 1 · TIR 0"). */
export function modsSummary(mods) {
  return `ENG ${mods.engine} · ARM ${mods.armor} · TIR ${mods.tires}`;
}

/** Serialise mods for the save file. */
export function modsSave(mods) {
  return { engine: mods.engine, armor: mods.armor, tires: mods.tires };
}

/** Restore mods from a save file. */
export function modsLoad(mods, saved) {
  if (!saved || typeof saved !== 'object') return;
  for (const id of ['engine', 'armor', 'tires']) {
    const v = saved[id];
    if (typeof v === 'number' && v >= 0 && v <= 3) mods[id] = Math.floor(v);
  }
}
