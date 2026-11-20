// Solmar Heat — landmarks.js
// Named places and districts. District names show under the minimap.

export const LANDMARKS = [
  { id: 'safehouse', name: "Rex's Safehouse", x: 420, y: 420, color: '#8fd07a' },
  { id: 'paint', name: "Lou's Paint Shop", x: 2820, y: 620, color: '#e879c6' },
  { id: 'modshop', name: "Lou's Mod Shop", x: 2820, y: 760, color: '#c65df0' },
  { id: 'bank', name: 'Solmar National Bank', x: 1800, y: 1800, color: '#f5c542' },
  { id: 'motel', name: 'The Palms Motel', x: 1020, y: 2620, color: '#ffb36b' },
  { id: 'pier', name: 'Pier 9', x: 3260, y: 3260, color: '#6bd3e8' },
  { id: 'hospital', name: 'Solmar General Hospital', x: 620, y: 3020, color: '#ffffff' },
  { id: 'hq', name: 'SCPD Headquarters', x: 1800, y: 420, color: '#9db8e8' },
  { id: 'marina', name: 'Solmar Marina', x: 3260, y: 1020, color: '#5fc9a7' },
  { id: 'plaza', name: 'Cactus Court Plaza', x: 1020, y: 1020, color: '#d8c26a' },
];

export const DISTRICTS = [
  { name: 'Sunset Mile', x0: 0, y0: 0, x1: 1200, y1: 1200 },
  { name: 'Cactus Court', x0: 1200, y0: 0, x1: 2400, y1: 1200 },
  { name: 'Neon Strip', x0: 2400, y0: 0, x1: 3600, y1: 1200 },
  { name: 'Old Market', x0: 0, y0: 1200, x1: 1200, y1: 2400 },
  { name: 'Downtown Solmar', x0: 1200, y0: 1200, x1: 2400, y1: 2400 },
  { name: 'Canal Row', x0: 2400, y0: 1200, x1: 3600, y1: 2400 },
  { name: 'Palm Heights', x0: 0, y0: 2400, x1: 1200, y1: 3600 },
  { name: 'The Marina', x0: 1200, y0: 2400, x1: 2400, y1: 3600 },
  { name: 'Pier 9 Docks', x0: 2400, y0: 2400, x1: 3600, y1: 3600 },
];

export function landmarkById(id) { return LANDMARKS.find((l) => l.id === id) || null; }
export function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  return 'Solmar Outskirts';
}
