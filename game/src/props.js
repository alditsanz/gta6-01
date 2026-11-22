// Solmar Heat — props.js
// Deterministic street furniture. Props are plain data ({kind,x,y,...})
// generated from the world's seeded rng inside createWorld, so the city
// dressing is identical for a given seed and the renderer stays dumb.

import { hash2 } from './random.js';
import { BEACH, PARK } from './landmarks.js';

const PROP_KINDS = ['lamp', 'palm', 'tree', 'bench', 'planter', 'hydrant', 'newsbox', 'busstop', 'crate', 'barrel', 'umbrella', 'towel'];

export function buildProps(rng) {
  const props = [];
  const push = (kind, x, y, extra) => props.push(Object.assign({ kind, x, y, a: 0, c: 0 }, extra || {}));

  // Street lamps along every street, both sides, staggered.
  for (let line = 0; line <= 3600; line += 400) {
    for (let at = 90; at < 3600; at += 200) {
      push('lamp', line - 52, at, { a: 0 });
      push('lamp', at, line + 52, { a: 1 });
    }
  }
  // Palms crowd the beach and the boardwalk edge.
  for (let i = 0; i < 46; i++) {
    push('palm', rng.range(BEACH.x0 + 30, BEACH.x1 - 60), rng.range(30, BEACH.y1 - 40), { s: rng.range(0.85, 1.3) });
  }
  // Beach umbrellas + towels on the sand.
  for (let i = 0; i < 26; i++) {
    const x = rng.range(BEACH.x0 + 130, BEACH.x1 - 90), y = rng.range(50, BEACH.y1 - 60);
    push(rng.chance(0.6) ? 'umbrella' : 'towel', x, y, { c: rng.int(0, 5) });
  }
  // Trees in the park and scattered through residential blocks.
  for (let i = 0; i < 34; i++) push('tree', rng.range(PARK.x0 + 25, PARK.x1 - 25), rng.range(PARK.y0 + 25, PARK.y1 - 25), { s: rng.range(0.9, 1.4) });
  for (let bx = 0; bx < 9; bx++) for (let by = 0; by < 9; by++) {
    const n = 1 + Math.floor(hash2(bx * 7 + 1, by * 13 + 2) * 3);
    for (let i = 0; i < n; i++) {
      const x = bx * 400 + 84 + hash2(bx * 31 + i, by * 17) * 232;
      const y = by * 400 + 84 + hash2(bx * 11, by * 29 + i) * 232;
      if (x > BEACH.x0 && y < BEACH.y1) continue;
      push('tree', x, y, { s: 0.8 + hash2(bx + i, by) * 0.5 });
    }
  }
  // Benches + planters on plaza / commercial blocks, hydrants + news
  // boxes along sidewalks, bus stops on the avenues.
  for (let i = 0; i < 40; i++) {
    const bx = rng.int(0, 8), by = rng.int(0, 8);
    push(rng.chance(0.5) ? 'bench' : 'planter', bx * 400 + rng.range(80, 320), by * 400 + rng.range(80, 320), { a: rng.int(0, 3) });
  }
  for (let i = 0; i < 48; i++) push(rng.chance(0.5) ? 'hydrant' : 'newsbox', rng.range(70, 3530), rng.int(0, 8) * 400 + rng.range(70, 86));
  for (let i = 0; i < 12; i++) push('busstop', rng.int(0, 8) * 400 + 70, rng.range(200, 3400), { a: 0 });
  // Crates + barrels around the docks and industrial blocks.
  for (let i = 0; i < 44; i++) {
    const zone = rng.chance(0.55) ? { x: 3000, y: 1300 } : { x: 2600, y: 2500 };
    push(rng.chance(0.5) ? 'crate' : 'barrel', zone.x + rng.range(0, 520), zone.y + rng.range(0, 900), { c: rng.int(0, 3) });
  }
  return props;
}

export { PROP_KINDS };
