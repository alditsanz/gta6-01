// config.js — Solmar Heat shared constants.
// World geometry: a 9x9 grid of 400-unit cells. Each cell holds a
// 308-unit building block; the remaining 92 units are road. Road
// centrelines therefore sit at cell*400 + 354 on both axes.

export const WORLD = 3600;
export const BLOCK = 400;
export const ROAD_W = 92;
export const CELL = BLOCK - ROAD_W; // 308
export const GRID = 9;

export function roadCenter(i) { return i * BLOCK + CELL + ROAD_W / 2; }
export function isRoadCoord(v) { return (v % BLOCK) >= CELL; }
export function isRoad(x, y) { return isRoadCoord(x) || isRoadCoord(y); }
export function clampWorld(v) { return Math.max(8, Math.min(WORLD - 8, v)); }

// District names for the 3x3 macro grid (each macro cell is 1200).
export const DISTRICTS = [
  'Sunset Mile', 'Cactus Court', 'Neon Strip',
  'Old Market', 'Downtown Solmar', 'Canal Row',
  'Palm Heights', 'The Marina', 'Pier 9 Docks',
];
export function districtIndex(x, y) {
  const cx = Math.min(2, Math.floor(x / 1200));
  const cy = Math.min(2, Math.floor(y / 1200));
  return cy * 3 + cx;
}
export function districtAt(x, y) { return DISTRICTS[districtIndex(x, y)]; }

// The beach occupies the east column of blocks (bx = 8): sand from
// x = 3200, boardwalk near x = 3160, water beyond x = 3480.
export const BEACH_X = 3200;
export const WATER_X = 3480;
export const PARK_BLOCK = { bx: 1, by: 6 };   // green park block
export const PLAZA_BLOCK = { bx: 4, by: 1 };  // paved plaza block

// Car catalogue: name, top speed (units/s), acceleration, colour
// family and a body style the renderer switches on.
export const CAR_TYPES = [
  { id: 'sedan',   name: 'Meridian Sedan',  top: 300, acc: 190, style: 'sedan',   color: '#7d8ea3' },
  { id: 'coupe',   name: 'Vela Coupe',      top: 340, acc: 230, style: 'coupe',   color: '#b0483e' },
  { id: 'falco',   name: 'Falco S',         top: 430, acc: 320, style: 'sport',   color: '#e8a71c' },
  { id: 'taxi',    name: 'Vento Taxi',      top: 300, acc: 200, style: 'taxi',    color: '#f2c230' },
  { id: 'vento',   name: 'Vento Hatch',     top: 290, acc: 195, style: 'hatch',   color: '#c33d31' },
  { id: 'van',     name: 'Harbor Van',      top: 260, acc: 160, style: 'van',     color: '#cfd4d8' },
  { id: 'truck',   name: 'Dock Truck',      top: 240, acc: 140, style: 'truck',   color: '#5d7a52' },
  { id: 'pickup',  name: 'Dune Pickup',     top: 310, acc: 210, style: 'pickup',  color: '#8a6f4d' },
  { id: 'muscle',  name: 'Marlin Muscle',   top: 380, acc: 280, style: 'muscle',  color: '#3e5f8a' },
  { id: 'compact', name: 'Pico Compact',    top: 265, acc: 185, style: 'compact', color: '#6fae7d' },
  { id: 'limo',    name: 'Regal Limo',      top: 295, acc: 175, style: 'limo',    color: '#2e3138' },
  { id: 'cruiser', name: 'SCPD Cruiser',    top: 360, acc: 260, style: 'police',  color: '#e8ebee' },
];
export function carType(id) { return CAR_TYPES.find(t => t.id === id) || CAR_TYPES[0]; }

// Respect ranks: RP thresholds ascending; the HUD shows name + x/y.
export const RANKS = [
  { name: 'Nobody',        rp: 0 },
  { name: 'Runner',        rp: 120 },
  { name: 'Wheelman',      rp: 300 },
  { name: 'Hustler',       rp: 550 },
  { name: 'Shot Caller',   rp: 850 },
  { name: 'Street Royalty', rp: 1200 },
  { name: 'Solmar Legend', rp: 1600 },
];
export function rankFor(rp) {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) if (rp >= RANKS[i].rp) idx = i;
  const cur = RANKS[idx];
  const next = RANKS[idx + 1] || null;
  return { idx, name: cur.name, cur: cur.rp, next: next ? next.rp : cur.rp, nextName: next ? next.name : null };
}

// Crew: named characters with one usable ability each.
export const CREW = [
  { name: 'Mama Lou', role: 'Fixer',    ability: 'Swap Plates', key: 'C', cooldown: 120 },
  { name: 'Dex',      role: 'Wheelman', ability: 'Nitro Surge', key: 'V', cooldown: 45 },
];

export const SAVE_PREFIX = 'solmar-heat-save-';
