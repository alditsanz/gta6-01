// landmarks.js — the named places of Solmar and district lookup.
// One job: hold the landmark table (name, position, kind, map initials)
// and answer "which district is this point in".

import { BLOCK, DISTRICTS } from './config.js';

// kind drives the marker colour and which system uses the place:
// home, police, paint, modshop, plaza, marina, bank, motel, hospital, pier.
export const LANDMARKS = [
  { id: 'safehouse', name: "Rex's Safehouse",    short: 'SF', x: 420,  y: 420,  kind: 'home' },
  { id: 'hq',        name: 'SCPD Headquarters',  short: 'HQ', x: 1800, y: 420,  kind: 'police' },
  { id: 'paint',     name: "Lou's Paint Shop",   short: 'PS', x: 2820, y: 620,  kind: 'paint' },
  { id: 'modshop',   name: "Lou's Mod Shop",     short: 'MS', x: 2820, y: 760,  kind: 'modshop' },
  { id: 'plaza',     name: 'Cactus Court Plaza', short: 'PL', x: 1020, y: 1020, kind: 'plaza' },
  { id: 'marina',    name: 'Solmar Marina',      short: 'MA', x: 3260, y: 1020, kind: 'marina' },
  { id: 'bank',      name: 'Solmar National Bank', short: 'BK', x: 1800, y: 1800, kind: 'bank' },
  { id: 'motel',     name: 'The Palms Motel',    short: 'MO', x: 1020, y: 2620, kind: 'motel' },
  { id: 'hospital',  name: 'Solmar General Hospital', short: 'HO', x: 620, y: 3020, kind: 'hospital' },
  { id: 'pier',      name: 'Pier 9',             short: 'P9', x: 3260, y: 3260, kind: 'pier' },
];

export function landmarkById(id) {
  return LANDMARKS.find((l) => l.id === id) || null;
}

// District of a point: the city is a 3 x 3 arrangement of districts,
// each covering 3 x 3 blocks.
export function districtAt(x, y) {
  const gx = Math.min(2, Math.max(0, Math.floor(x / (BLOCK * 3))));
  const gy = Math.min(2, Math.max(0, Math.floor(y / (BLOCK * 3))));
  return DISTRICTS[gy * 3 + gx];
}

export function districtIndexAt(x, y) {
  const gx = Math.min(2, Math.max(0, Math.floor(x / (BLOCK * 3))));
  const gy = Math.min(2, Math.max(0, Math.floor(y / (BLOCK * 3))));
  return gy * 3 + gx;
}

// Nearest landmark within maxDist, or null.
export function nearestLandmark(x, y, maxDist) {
  let best = null, bestD = maxDist;
  for (const l of LANDMARKS) {
    const d = Math.hypot(l.x - x, l.y - y);
    if (d < bestD) { bestD = d; best = l; }
  }
  return best;
}
