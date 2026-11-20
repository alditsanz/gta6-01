// landmarks.js — named places in Solmar, snapped to road intersections
// so every one of them is reachable by car and on foot.

import { dist } from './config.js';

export const LANDMARKS = [
  { id: 'hq', name: 'SCPD Headquarters', short: 'SCPD HQ', x: 660, y: 660, color: '#3a6ea5', icon: 'HQ' },
  { id: 'paint', name: "Lou's Paint Shop", short: 'Paint Shop', x: 1180, y: 920, color: '#e67e22', icon: 'LS' },
  { id: 'modshop', name: "Lou's Mod Shop", short: 'Mod Shop', x: 1440, y: 920, color: '#d35400', icon: 'MOD' },
  { id: 'marina', name: 'The Marina', short: 'Marina', x: 1960, y: 1180, color: '#2980b9', icon: 'MA' },
  { id: 'pier9', name: 'Pier 9', short: 'Pier 9', x: 2220, y: 400, color: '#16a085', icon: 'P9' },
  { id: 'plaza', name: 'Cactus Court Plaza', short: 'Plaza', x: 660, y: 1180, color: '#27ae60', icon: 'PL' },
  { id: 'hospital', name: 'Solmar General Hospital', short: 'Hospital', x: 400, y: 1440, color: '#ecf0f1', icon: '+' },
  { id: 'canal-market', name: 'Canal Row Market', short: 'Canal Market', x: 1960, y: 1960, color: '#8e6e2f', icon: 'CM' },
  { id: 'strip', name: 'Neon Strip Club', short: 'Neon Strip', x: 920, y: 140, color: '#c56cf0', icon: 'NS' },
  { id: 'depot', name: 'Harbor Depot', short: 'Depot', x: 140, y: 1960, color: '#7f8c8d', icon: 'HD' },
];

export function landmarkById(id) {
  return LANDMARKS.find((l) => l.id === id) || null;
}

export function landmarkAt(x, y, radius) {
  const r = radius || 70;
  for (const l of LANDMARKS) if (dist(x, y, l.x, l.y) <= r) return l;
  return null;
}

export function nearestLandmark(x, y) {
  let best = null, bd = Infinity;
  for (const l of LANDMARKS) { const d = dist(x, y, l.x, l.y); if (d < bd) { bd = d; best = l; } }
  return { landmark: best, distance: bd };
}
