// Solmar Heat — geography: the 3x3 district grid, the ten named
// landmarks, and the special ground zones (beach, park, canal).

import { clamp } from './random.js';

export const DISTRICTS = [
  'Sunset Mile', 'Cactus Court', 'Neon Strip',
  'Old Market', 'Downtown Solmar', 'Canal Row',
  'Palm Heights', 'The Marina', 'Pier 9 Docks',
];

export function districtAt(x, y) {
  const gx = clamp(Math.floor(x / 1200), 0, 2);
  const gy = clamp(Math.floor(y / 1200), 0, 2);
  return DISTRICTS[gy * 3 + gx];
}

// Landmarks sit on block centres so they always front a street.
export const LANDMARKS = [
  { id: 'safehouse', name: "Rex's Safehouse", short: 'SAFEHOUSE', x: 200, y: 1000, color: '#e06666' },
  { id: 'paint', name: "Lou's Paint Shop", short: 'PAINT', x: 600, y: 1000, color: '#66c2e0' },
  { id: 'modshop', name: "Lou's Mod Shop", short: 'MODS', x: 1000, y: 1000, color: '#b088e0' },
  { id: 'bank', name: 'Solmar National Bank', short: 'BANK', x: 1800, y: 1800, color: '#7dd87d' },
  { id: 'motel', name: 'The Palms Motel', short: 'MOTEL', x: 2600, y: 600, color: '#e0a866' },
  { id: 'pier', name: 'Pier 9', short: 'PIER 9', x: 3400, y: 200, color: '#66e0c8' },
  { id: 'hospital', name: 'Solmar General Hospital', short: 'HOSPITAL', x: 3000, y: 3000, color: '#f2f2f2' },
  { id: 'hq', name: 'SCPD Headquarters', short: 'SCPD HQ', x: 1800, y: 2600, color: '#7d9fd8' },
  { id: 'marina', name: 'Solmar Marina', short: 'MARINA', x: 3400, y: 1800, color: '#66a8e0' },
  { id: 'plaza', name: 'Cactus Court Plaza', short: 'PLAZA', x: 600, y: 600, color: '#e0d866' },
];

export function landmarkById(id) {
  for (const spot of LANDMARKS) {
    if (spot.id === id) return spot;
  }
  return null;
}

export const BEACH = { x0: 2920, y0: 0, x1: 3600, y1: 1200 };
export const PARK = { x0: 400, y0: 2400, x1: 800, y1: 2800 };
export const CANAL = { x0: 2400, y0: 1746, x1: 3600, y1: 1854 };

// Water blocks movement and drowns shortcuts. The canal can still be
// crossed wherever an avenue bridges it, and the park pond is real.
export function isWaterAt(x, y) {
  if (x >= CANAL.x0 && x <= CANAL.x1 && y >= CANAL.y0 && y <= CANAL.y1) {
    const along = ((x % 400) + 400) % 400;
    const onBridge = along < 66 || along > 400 - 66;
    return !onBridge;
  }
  if (x > 520 && x < 680 && y > 2520 && y < 2680) return true;
  return false;
}
