// props.js — deterministic street furniture for Solmar. Props are
// pure data ({kind,x,y,angle,color}) generated from the world rng
// inside createWorld; render.js knows how to draw each kind. This
// is what stops block interiors reading as flat empty rectangles.

import { BLOCK, CELL, WORLD, BEACH_X, PARK_BLOCK, roadCenter } from './config.js';
import { range, intRange, hash2 } from './random.js';

export function buildProps(world) {
  const rng = world.rng;
  const props = [];

  // Street lamps: both sides of every road, spaced ~200 units.
  for (let i = 0; i < 9; i++) {
    const c = roadCenter(i);
    for (let s = 60; s < WORLD; s += 200) {
      props.push({ kind: 'lamp', x: c - 52, y: s, angle: 0 });
      props.push({ kind: 'lamp', x: s, y: c + 52, angle: 0 });
    }
  }

  // Palms: a double row along the boardwalk, clusters on the sand,
  // and scattered shade trees in the park and random blocks.
  for (let y = 120; y < WORLD; y += 130) {
    props.push({ kind: 'palm', x: 3152, y: y + range(rng, -14, 14), angle: range(rng, 0, 6.28) });
  }
  for (let i = 0; i < 46; i++) {
    props.push({ kind: 'palm', x: range(rng, 3230, 3450), y: range(rng, 40, WORLD - 40), angle: range(rng, 0, 6.28) });
  }
  const parkX = PARK_BLOCK.bx * BLOCK, parkY = PARK_BLOCK.by * BLOCK;
  for (let i = 0; i < 30; i++) {
    props.push({ kind: 'tree', x: parkX + range(rng, 24, CELL - 24), y: parkY + range(rng, 24, CELL - 24), angle: 0 });
  }
  for (let i = 0; i < 90; i++) {
    const bx = intRange(rng, 0, 7), by = intRange(rng, 0, 8);
    if (bx === PARK_BLOCK.bx && by === PARK_BLOCK.by) continue;
    props.push({ kind: 'tree', x: bx * BLOCK + range(rng, 20, CELL - 20), y: by * BLOCK + range(rng, 20, CELL - 20), angle: 0 });
  }

  // Beach life: umbrellas and towels on the sand.
  const umbCols = ['#e4572e', '#2e86e4', '#f2c230', '#e45a9c', '#39b56b'];
  for (let i = 0; i < 34; i++) {
    props.push({ kind: 'umbrella', x: range(rng, 3240, 3440), y: range(rng, 40, WORLD - 40), angle: 0, color: umbCols[i % umbCols.length] });
  }
  for (let i = 0; i < 22; i++) {
    props.push({ kind: 'towel', x: range(rng, 3240, 3440), y: range(rng, 40, WORLD - 40), angle: range(rng, 0, 3.14), color: umbCols[(i + 2) % umbCols.length] });
  }

  // Plaza benches + planters; dock crates + barrels in the SE.
  for (let i = 0; i < 12; i++) {
    props.push({ kind: 'bench', x: 1630 + (i % 4) * 90, y: 430 + Math.floor(i / 4) * 120, angle: 0 });
    props.push({ kind: 'planter', x: 1660 + (i % 4) * 90, y: 480 + Math.floor(i / 4) * 120, angle: 0 });
  }
  for (let i = 0; i < 40; i++) {
    const kind = i % 3 === 0 ? 'barrel' : 'crate';
    props.push({ kind, x: range(rng, 2830, 3180), y: range(rng, 2830, 3550), angle: range(rng, 0, 3.14) });
  }

  // Small street clutter everywhere: hydrants, news boxes, bus stops.
  for (let i = 0; i < 120; i++) {
    const kinds = ['hydrant', 'newsbox', 'busstop'];
    const gx = intRange(rng, 0, 8), gy = intRange(rng, 0, 8);
    props.push({ kind: kinds[i % 3], x: gx * BLOCK + CELL + 14, y: gy * BLOCK + range(rng, 10, CELL), angle: 0 });
  }

  // Per-building roof furniture is derived from hash2 at draw time
  // (AC boxes, skylights, water towers) — no data needed here.
  return props;
}

// Roof furniture for a building, derived deterministically.
export function roofKit(building) {
  const h1 = hash2(building.bx * 31 + building.idx, building.by * 17 + 5);
  const h2 = hash2(building.bx * 7 + 3, building.by * 41 + building.idx);
  return {
    ac: h1 > 0.35, acX: 0.2 + h1 * 0.55, acY: 0.25 + h2 * 0.4,
    skylight: h2 > 0.55, tower: h1 > 0.86,
  };
}
