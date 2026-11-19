// Solmar Heat — landmarks.js
// The named places of Solmar: SCPD Headquarters, Lou's Paint Shop and
// Mod Shop, the Marina, Pier 9, the plaza, the canal locks and the
// Sunset Mile arch. Helpers here answer "where is the nearest X?" and
// "is the player inside the paint shop?" — the logic the paint shop,
// the mod shop and the missions lean on.

import { LANDMARKS } from './config.js';

export const PAINT_RADIUS = 130; // service radius around Lou's Paint Shop
export const MOD_RADIUS = 130; // service radius around Lou's Mod Shop

export function landmarkByKind(kind) {
  return LANDMARKS.find((l) => l.kind === kind) || null;
}

export function nearestLandmark(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const l of LANDMARKS) {
    const d = Math.hypot(x - l.x, y - l.y);
    if (d < bestD) {
      bestD = d;
      best = l;
    }
  }
  return { landmark: best, dist: bestD };
}

// True when the player is close enough to Lou's Paint Shop for service.
export function inPaintShop(x, y) {
  const shop = landmarkByKind('paint');
  return shop ? Math.hypot(x - shop.x, y - shop.y) <= PAINT_RADIUS : false;
}

// True when the player is close enough to Lou's Mod Shop to buy upgrades.
export function inModShop(x, y) {
  const shop = landmarkByKind('modshop');
  return shop ? Math.hypot(x - shop.x, y - shop.y) <= MOD_RADIUS : false;
}

export { LANDMARKS };
