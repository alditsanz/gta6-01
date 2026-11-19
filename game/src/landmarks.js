// Solmar Heat — landmarks.js
// The named places of Solmar and the zones around them that gameplay hooks
// into: Lou's Paint Shop (heat + repair), Lou's Mod Shop (upgrades), the
// hospital (respawn), and the mission destinations. Pure lookups.

import { LANDMARKS } from './config.js';

export const PAINT_RADIUS = 90;
export const MOD_RADIUS = 90;
export const LANDMARK_RADIUS = 70;

export function landmarkById(id) {
  return LANDMARKS.find((l) => l.id === id) || null;
}

/** Is a point inside Lou's Paint Shop's service zone? */
export function inPaintShop(x, y) {
  const shop = landmarkById('paint');
  return Math.hypot(x - shop.x, y - shop.y) <= PAINT_RADIUS;
}

/** Is a point inside Lou's Mod Shop's service zone? */
export function inModShop(x, y) {
  const shop = landmarkById('modshop');
  return Math.hypot(x - shop.x, y - shop.y) <= MOD_RADIUS;
}

/** Is a point within reach of a landmark (for mission arrival checks)? */
export function atLandmark(x, y, id) {
  const l = landmarkById(id);
  if (!l) return false;
  return Math.hypot(x - l.x, y - l.y) <= LANDMARK_RADIUS;
}

/** Hospital respawn point (where WASTED sends the player). */
export function hospitalPoint() {
  const h = landmarkById('hospital');
  return { x: h.x, y: h.y };
}

/**
 * Apply the paint shop: clears all heat and repairs the car to full.
 * Returns what changed, for the HUD message.
 */
export function paintShopService(state) {
  const hadHeat = state.heat > 0;
  const car = state.car;
  const hadDamage = car ? car.health < car.maxHealth : false;
  state.heat = 0;
  if (car) car.health = car.maxHealth;
  return { clearedHeat: hadHeat, repaired: hadDamage };
}
