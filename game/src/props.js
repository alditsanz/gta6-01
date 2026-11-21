// props.js — the street furniture that keeps Solmar's blocks from
// reading as flat rectangles: lamps, crosswalks, palms, umbrellas,
// benches, planters, crates, barrels, bus stops, hydrants, news
// boxes and storefront awnings. Props are plain data; render.js
// knows how to draw each kind. Generation uses only the world rng.

import { BLOCK, ROAD_W, WORLD_SIZE } from './config.js';

const KINDS_ROAD = ['lamp', 'hydrant', 'newsbox', 'busstop'];

export function buildProps(rng) {
  const props = [];
  const push = (kind, x, y, color, angle) => props.push({ kind, x, y, color: color || '#888', angle: angle || 0 });

  // Street lamps along both sides of every road, spaced ~200 units.
  for (let i = 0; i <= 9; i++) {
    const line = i * BLOCK;
    for (let p = 100; p < WORLD_SIZE; p += 200) {
      push('lamp', line + ROAD_W / 2 + 8, p, '#3c4652', 0);
      push('lamp', p, line + ROAD_W / 2 + 8, '#3c4652', 0);
    }
  }
  // Crosswalk stripes at every intersection.
  for (let ix = 0; ix < 9; ix++) for (let iy = 0; iy < 9; iy++) {
    push('crosswalk', ix * BLOCK + 200, iy * BLOCK + 200, '#e8e8e2', (ix + iy) % 2);
  }
  // Palms and beach dressing on the beach block (2400,400)-(3600,1600).
  for (let i = 0; i < 46; i++) push('palm', 2450 + rng() * 1100, 450 + rng() * 1100, '#3f8f4f', rng() * 6.28);
  for (let i = 0; i < 22; i++) push('umbrella', 2500 + rng() * 1000, 500 + rng() * 1000, rng.pick(['#e85d75', '#f2a541', '#4ec9b8', '#5f7fe8']), rng() * 6.28);
  for (let i = 0; i < 18; i++) push('towel', 2500 + rng() * 1000, 500 + rng() * 1000, rng.pick(['#e8e3d5', '#7fd1e8', '#f2b8c6']), rng() * 6.28);
  // Scattered trees in ordinary blocks plus a dense park grove.
  for (let i = 0; i < 90; i++) push('tree', 250 + rng() * 3100, 250 + rng() * 3100, '#4d9a57', rng() * 6.28);
  for (let i = 0; i < 34; i++) push('tree', 450 + rng() * 700, 2450 + rng() * 700, '#3f8f4f', rng() * 6.28);
  // Plaza dressing.
  for (let i = 0; i < 16; i++) push('bench', 850 + rng() * 300, 450 + rng() * 300, '#8a6a45', rng() * 6.28);
  for (let i = 0; i < 14; i++) push('planter', 850 + rng() * 300, 450 + rng() * 300, '#5aa86a', 0);
  // Docks and industrial clutter near Pier 9.
  for (let i = 0; i < 26; i++) push('crate', 2850 + rng() * 650, 2850 + rng() * 650, '#a87f4a', rng() * 0.8);
  for (let i = 0; i < 20; i++) push('barrel', 2850 + rng() * 650, 2850 + rng() * 650, rng.pick(['#c9534e', '#4e7fc9', '#6b7280']), 0);
  // Small street props scattered along roads.
  for (let i = 0; i < 120; i++) {
    const kind = rng.pick(KINDS_ROAD.slice(1));
    const onX = rng.chance(0.5);
    const line = rng.int(0, 9) * BLOCK + ROAD_W / 2 + 14;
    const along = 150 + rng() * 3300;
    push(kind, onX ? line : along, onX ? along : line, '#9aa3ad', rng() * 6.28);
  }
  // Awnings on commercial storefronts (Neon Strip, Downtown, Cactus Court).
  const commercial = [[800, 0], [1600, 1600], [800, 400]];
  for (const [bx, by] of commercial) {
    for (let i = 0; i < 14; i++) {
      push('awning', bx + 60 + rng() * 280, by + 60 + rng() * 280,
        rng.pick(['#e85d75', '#4ec9b8', '#f2a541', '#5f7fe8']), rng() * 6.28);
    }
  }
  return props;
}

export const PROP_KINDS = ['lamp', 'crosswalk', 'palm', 'umbrella', 'towel', 'tree', 'bench', 'planter', 'crate', 'barrel', 'hydrant', 'newsbox', 'busstop', 'awning'];
