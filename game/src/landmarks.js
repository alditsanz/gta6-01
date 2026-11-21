// landmarks.js — named places of Solmar with world positions.
// Coordinates are block centres on the 400-unit grid, nudged onto the
// street plan in the round-13 upgrade spec.

export const LANDMARKS = [
  { key: 'safehouse', name: "Rex's Safehouse", x: 600, y: 600, kind: 'home' },
  { key: 'paint', name: "Lou's Paint Shop", x: 1000, y: 1400, kind: 'shop' },
  { key: 'modshop', name: "Lou's Mod Shop", x: 1400, y: 1400, kind: 'shop' },
  { key: 'bank', name: 'Solmar National Bank', x: 1800, y: 1800, kind: 'bank' },
  { key: 'motel', name: 'The Palms Motel', x: 2600, y: 1000, kind: 'motel' },
  { key: 'pier9', name: 'Pier 9', x: 3000, y: 3000, kind: 'pier' },
  { key: 'hospital', name: 'Solmar General Hospital', x: 1000, y: 2600, kind: 'hospital' },
  { key: 'hq', name: 'SCPD Headquarters', x: 2200, y: 2200, kind: 'police' },
  { key: 'marina', name: 'Solmar Marina', x: 3000, y: 2200, kind: 'marina' },
  { key: 'plaza', name: 'Cactus Court Plaza', x: 1000, y: 600, kind: 'plaza' },
];

export function landmark(key) {
  return LANDMARKS.find((l) => l.key === key) || null;
}

export function nearestLandmark(x, y) {
  let best = null; let bestD = Infinity;
  for (const l of LANDMARKS) {
    const d = (l.x - x) ** 2 + (l.y - y) ** 2;
    if (d < bestD) { bestD = d; best = l; }
  }
  return best;
}
