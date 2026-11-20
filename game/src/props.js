// props.js — deterministic city dressing: lamps, palms, umbrellas,
// benches, crates, crosswalks and more.
// One job: build world.props (plain data: kind, x, y, color, angle)
// from the seeded rng during createWorld. render.js draws each kind.
// This is what stops the city reading as flat empty blocks.

import { BLOCK, ROAD_W, WORLD_SIZE } from './config.js';

const UMBRELLA_COLORS = ['#ff5d8f', '#ffb84d', '#4dd0e1', '#ff7847', '#b388ff', '#7ee787'];

export function buildProps(world) {
  const rng = world.rng;
  const props = [];
  const add = (kind, x, y, extra = {}) => props.push({ kind, x, y, color: '', angle: 0, ...extra });

  // Street lamps: both edges of every road, spaced ~200 units.
  for (let line = 0; line <= WORLD_SIZE; line += BLOCK) {
    for (let t = 100; t < WORLD_SIZE; t += 200) {
      add('lamp', line - ROAD_W / 2 - 7, t);
      add('lamp', line + ROAD_W / 2 + 7, t + 100 > WORLD_SIZE ? t - 100 : t + 100);
      add('lamp', t, line - ROAD_W / 2 - 7);
      add('lamp', t + 100 > WORLD_SIZE ? t - 100 : t + 100, line + ROAD_W / 2 + 7);
    }
  }

  // Crosswalks at every intersection.
  for (let ix = 0; ix <= WORLD_SIZE; ix += BLOCK) {
    for (let iy = 0; iy <= WORLD_SIZE; iy += BLOCK) {
      add('crosswalk', ix, iy);
    }
  }

  // Beach block (x 2400-3200, y 400-1200): boardwalk palms down the
  // west edge, umbrellas + towels scattered on the sand.
  for (let y = 470; y <= 1150; y += 86) {
    add('palm', 2452 + rng.range(-8, 8), y + rng.range(-14, 14), { angle: rng.range(0, 6.28) });
  }
  for (let i = 0; i < 15; i++) {
    add('umbrella', rng.range(2560, 3120), rng.range(480, 1120), { color: rng.pick(UMBRELLA_COLORS) });
  }
  for (let i = 0; i < 10; i++) {
    add('towel', rng.range(2540, 3140), rng.range(470, 1140), { color: rng.pick(UMBRELLA_COLORS), angle: rng.range(0, 3.14) });
  }
  // A few palms along the coast road south of the beach.
  for (let y = 1300; y <= 2100; y += 160) {
    add('palm', 2348, y + rng.range(-20, 20), { angle: rng.range(0, 6.28) });
  }

  // Park block (x 400-800, y 2400-2800): a loose grid of trees,
  // benches along the crossing paths.
  for (let x = 450; x <= 770; x += 74) {
    for (let y = 2450; y <= 2770; y += 74) {
      if (Math.abs(x - 600) < 40 || Math.abs(y - 2600) < 40) continue; // keep paths clear
      add('tree', x + rng.range(-14, 14), y + rng.range(-14, 14), { angle: rng.range(0, 6.28) });
    }
  }
  for (const [bx, by] of [[520, 2560], [680, 2560], [520, 2640], [680, 2640]]) {
    add('bench', bx, by, { angle: 0 });
  }

  // Plaza block around Cactus Court Plaza (1020, 1020): benches and
  // planters in a ring.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    add('bench', 1020 + Math.cos(a) * 120, 1020 + Math.sin(a) * 120, { angle: a });
    add('planter', 1020 + Math.cos(a + 0.4) * 165, 1020 + Math.sin(a + 0.4) * 165);
  }

  // Docks + marina (east edge blocks): crates and barrels in clusters.
  for (let i = 0; i < 26; i++) {
    const cx = rng.range(2880, 3520), cy = rng.range(2880, 3520);
    add(rng.chance(0.55) ? 'crate' : 'barrel', cx, cy, { angle: rng.range(0, 3.14) });
    if (rng.chance(0.5)) add('crate', cx + rng.range(-26, 26), cy + rng.range(-26, 26));
  }
  for (let i = 0; i < 8; i++) {
    add('crate', rng.range(3160, 3520), rng.range(880, 1160), { angle: rng.range(0, 3.14) });
  }

  // Bus stops on the two main avenues.
  for (let t = 500; t < WORLD_SIZE; t += 800) {
    add('busstop', 1200 + ROAD_W / 2 + 10, t);
    add('busstop', t, 2000 + ROAD_W / 2 + 10);
  }

  // Hydrants + newspaper boxes near intersections and storefronts.
  for (let i = 0; i < 18; i++) {
    const ix = Math.floor(rng.range(0, 10)) * BLOCK, iy = Math.floor(rng.range(0, 10)) * BLOCK;
    add('hydrant', ix + 58, iy + 58);
  }
  for (let i = 0; i < 12; i++) {
    // Commercial super-blocks: Neon Strip, Downtown, Cactus Court.
    const gx = rng.pick([1, 2, 4]), gy = rng.pick([0, 1]);
    add('newsbox', gx * BLOCK + rng.range(70, 330), gy * BLOCK + rng.range(70, 330),
      { color: rng.pick(['#3d7bd9', '#e8b93e', '#59b06a']) });
  }

  // Scattered shade trees at block corners city-wide.
  for (let bi = 0; bi < 9; bi++) {
    for (let bj = 0; bj < 9; bj++) {
      if (rng.chance(0.55)) {
        add('tree', bi * BLOCK + 66, bj * BLOCK + 66, { angle: rng.range(0, 6.28) });
      }
      if (rng.chance(0.4)) {
        add('tree', bi * BLOCK + 334, bj * BLOCK + 334, { angle: rng.range(0, 6.28) });
      }
    }
  }

  return props;
}
