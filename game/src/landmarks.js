// landmarks.js — named places in Solmar and helpers around them.
// Coordinates sit on block corners beside roads so missions can
// always route the player to a reachable kerb.

export const LANDMARKS = [
  { id: 'safehouse', name: "Rex's Safehouse",        short: 'SAFEHOUSE', x: 500,  y: 3154 },
  { id: 'paintshop', name: "Lou's Paint Shop",       short: 'PAINT',     x: 1154, y: 500 },
  { id: 'modshop',   name: "Lou's Mod Shop",         short: 'MODS',      x: 1254, y: 640 },
  { id: 'bank',      name: 'Solmar National Bank',   short: 'BANK',      x: 1800, y: 1800 },
  { id: 'motel',     name: 'The Palms Motel',        short: 'MOTEL',     x: 2500, y: 954 },
  { id: 'pier9',     name: 'Pier 9',                 short: 'PIER 9',    x: 3350, y: 3300 },
  { id: 'hospital',  name: 'Solmar General Hospital', short: 'HOSPITAL', x: 954,  y: 2500 },
  { id: 'hq',        name: 'SCPD Headquarters',      short: 'SCPD HQ',   x: 600,  y: 1554 },
  { id: 'marina',    name: 'Solmar Marina',          short: 'MARINA',    x: 2154, y: 2900 },
  { id: 'plaza',     name: 'Cactus Court Plaza',     short: 'PLAZA',     x: 1700, y: 600 },
];

export function landmark(id) { return LANDMARKS.find(l => l.id === id); }

export function nearestLandmark(x, y) {
  let best = null, bd = Infinity;
  for (const l of LANDMARKS) {
    const d = (l.x - x) * (l.x - x) + (l.y - y) * (l.y - y);
    if (d < bd) { bd = d; best = l; }
  }
  return best;
}

export function distTo(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
