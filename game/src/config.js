// Solmar Heat — config.js
// Every constant, name and data table the game runs on. Nothing here touches
// the browser: the logic test imports this module straight into Node.

export const WORLD = 2440; // world is a square, WORLD x WORLD units
export const GRID = 9; // 9 roads across, 9 roads down
export const ROAD_COUNT = 9;
export const BLOCK = 271; // distance between neighbouring roads
export const ROAD_HALF = 17; // half the width of a road

/** Position of road i (0..8) along an axis. Road 8 sits at 2304. */
export function roadPos(i) {
  return 136 + i * BLOCK;
}

/** Clamp a world coordinate so the whole grid stays reachable. */
export function clampWorld(v) {
  return Math.max(20, Math.min(WORLD - 20, v));
}

export const PLAYER_SPEED = 150; // on-foot walk speed, units / s
export const SPRINT_MULT = 1.6;
export const CAR_TOP_SPEED = 420; // base top speed of the fastest cars
export const CAR_ACCEL = 260;
export const CAR_BRAKE = 420;
export const CAR_TURN = 2.6; // radians / s at full steer
export const WALL_DAMAGE = 8; // car health lost per wall hit
export const CAR_MAX_HEALTH = 100;
export const PLAYER_MAX_HEALTH = 100;
export const NEAR_MISS_SPEED = 150;
export const NEAR_MISS_PAY = 15;
export const NEAR_MISS_COOLDOWN = 1.5;
export const FREE_MINT_GAS_NOTE = 'no gas here — this is a game, not a chain';

// ---------------------------------------------------------------- districts

export const DISTRICTS = [
  { name: 'Solmar Bay', x0: 2000, y0: 2000, x1: WORLD, y1: WORLD, color: '#2e86c1' },
  { name: 'Sunset Mile', x0: 0, y0: 0, x1: 813, y1: 813, color: '#e67e22' },
  { name: 'Cactus Court', x0: 813, y0: 0, x1: 1626, y1: 813, color: '#27ae60' },
  { name: 'Neon Strip', x0: 1626, y0: 0, x1: WORLD, y1: 813, color: '#e84393' },
  { name: 'Old Solmar', x0: 0, y0: 813, x1: 813, y1: 1626, color: '#8e6e4a' },
  { name: 'Harbor Lights', x0: 813, y0: 813, x1: 1626, y1: 1626, color: '#16a085' },
  { name: 'Pier 9', x0: 1626, y0: 813, x1: WORLD, y1: 1626, color: '#2980b9' },
  { name: 'Marina', x0: 0, y0: 1626, x1: 813, y1: WORLD, color: '#5d6d7e' },
  { name: 'Canal Row', x0: 813, y0: 1626, x1: 1626, y1: WORLD, color: '#7d3c98' },
  { name: 'Vista Heights', x0: 1626, y0: 1626, x1: WORLD, y1: WORLD, color: '#b9770e' },
];

/** The district a world point sits in (first matching rect wins). */
export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  }
  return 'Solmar';
}

// ---------------------------------------------------------------- landmarks

export const LANDMARKS = [
  { id: 'scpd', name: 'SCPD Headquarters', x: 2050, y: 400, kind: 'hq', color: '#2c3e50' },
  { id: 'paint', name: "Lou's Paint Shop", x: 600, y: 600, kind: 'paint', color: '#e74c3c' },
  { id: 'modshop', name: "Lou's Mod Shop", x: 1200, y: 2100, kind: 'modshop', color: '#f39c12' },
  { id: 'marina', name: 'Marina', x: 300, y: 2100, kind: 'marina', color: '#3498db' },
  { id: 'pier9', name: 'Pier 9', x: 2150, y: 1200, kind: 'pier', color: '#9b59b6' },
  { id: 'plaza', name: 'Cactus Court Plaza', x: 1200, y: 400, kind: 'plaza', color: '#27ae60' },
  { id: 'canal', name: 'Canal Row Bridges', x: 1200, y: 1950, kind: 'canal', color: '#7d3c98' },
  { id: 'hospital', name: 'Solmar General Hospital', x: 950, y: 1350, kind: 'hospital', color: '#ecf0f1' },
];

/** Nearest landmark to a point, with its distance. */
export function nearestLandmark(x, y) {
  let best = null;
  let bd = Infinity;
  for (const l of LANDMARKS) {
    const d = Math.hypot(l.x - x, l.y - y);
    if (d < bd) { bd = d; best = l; }
  }
  return { landmark: best, dist: bd };
}

// ---------------------------------------------------------------- cars

export const CARS = [
  { model: 'Falco', color: '#c0392b', top: 380, accel: 1.0 },
  { model: 'Vento', color: '#f1c40f', top: 340, accel: 0.95, taxi: true },
  { model: 'Comet', color: '#2980b9', top: 400, accel: 1.05 },
  { model: 'Brisa', color: '#1abc9c', top: 330, accel: 0.9 },
  { model: 'Toro', color: '#7f8c8d', top: 360, accel: 1.0 },
  { model: 'Lobo', color: '#2c3e50', top: 410, accel: 1.1 },
  { model: 'Palma', color: '#e67e22', top: 350, accel: 0.95 },
  { model: 'Solara', color: '#f39c12', top: 370, accel: 1.0 },
  { model: 'Marlin', color: '#16a085', top: 390, accel: 1.05 },
  { model: 'Cactus', color: '#27ae60', top: 320, accel: 0.9 },
  { model: 'Riviera', color: '#8e44ad', top: 400, accel: 1.05 },
  { model: 'Dune', color: '#d4ac0d', top: 350, accel: 0.95 },
];

/** Fixed spawn spots for the 12 stealable cars, spread over the whole grid. */
export const CAR_SPAWNS = [
  { model: 0, x: 400, y: 300 }, { model: 1, x: 1500, y: 300 },
  { model: 2, x: 1250, y: 450 }, { model: 3, x: 700, y: 950 },
  { model: 4, x: 2100, y: 700 }, { model: 5, x: 400, y: 1400 },
  { model: 6, x: 1100, y: 1700 }, { model: 7, x: 2000, y: 1700 },
  { model: 8, x: 500, y: 2000 }, { model: 9, x: 1450, y: 2150 },
  { model: 10, x: 2200, y: 2200 }, { model: 11, x: 950, y: 550 },
];

// ---------------------------------------------------------------- story jobs

export const MISSIONS = [
  {
    id: 1, name: 'First Wheels', payout: 250, timer: 0, stars: 0,
    brief: 'Steal the red Falco parked on Sunset Mile and drive it to the garage marker.',
    objective: 'Steal the Falco, then reach the garage marker.',
  },
  {
    id: 2, name: "Lena's Errand", payout: 400, timer: 90, stars: 0,
    brief: 'Lena Voss needs a ride to the Neon Strip. Pick her up and get her there in 90 seconds.',
    objective: 'Pick up Lena, then drive her to the Neon Strip.',
  },
  {
    id: 3, name: 'The Cactus Lift', payout: 600, timer: 120, stars: 1,
    brief: 'Lift the Comet from Cactus Court Plaza and deliver it to the Marina. Cops will notice.',
    objective: 'Steal the Comet at the plaza, then deliver it to the Marina.',
  },
  {
    id: 4, name: 'Hot Pursuit', payout: 800, timer: 120, stars: 2,
    brief: 'The SCPD is on your tail. Shake the heat and reach Pier 9 before the timer runs out.',
    objective: 'Reach Pier 9 with a 2-star tail on you.',
  },
  {
    id: 5, name: 'The Setup', payout: 1200, timer: 150, stars: 2,
    brief: 'Plant the package at SCPD Headquarters and hold still for 10 seconds. Then vanish.',
    objective: 'Reach SCPD HQ, plant the package, survive 10 seconds, then escape.',
  },
  {
    id: 6, name: 'Pier 9 Getaway — Lena Voss', payout: 2000, timer: 100, stars: 3,
    brief: 'Reach Pier 9 before the timer runs out. 3 stars from the start.',
    objective: 'Reach Pier 9 before the timer runs out. 3 stars from the start.',
  },
  {
    id: 7, name: 'The Last Ledger', payout: 4000, timer: 90, stars: 4,
    brief: "Steal Kane's ledger from SCPD Headquarters. Clear 3 guards, grab the ledger, then escape to the Marina in 90 seconds under a 4-star manhunt.",
    objective: "Clear the 3 guards, grab Kane's ledger, then escape to the Marina in 90 seconds.",
  },
];

export const JOB7_GUARD_PAY = 50; // each guard drops $50, so the job totals $4,150
export const JOB7_TOTAL = 4150;

// ---------------------------------------------------------------- races

export const RACES = [
  {
    id: 'sunset', name: 'Sunset Sprint', district: 'Sunset Mile', difficulty: 'easy',
    par: 75, payout: 150, start: { x: 300, y: 300 },
    checkpoints: [{ x: 900, y: 300 }, { x: 900, y: 900 }, { x: 300, y: 900 }, { x: 300, y: 300 }],
  },
  {
    id: 'neon', name: 'Neon Rush', district: 'Neon Strip', difficulty: 'medium',
    par: 110, payout: 300, start: { x: 1800, y: 300 },
    checkpoints: [
      { x: 2100, y: 300 }, { x: 2100, y: 900 }, { x: 1500, y: 1200 },
      { x: 1200, y: 900 }, { x: 1200, y: 300 }, { x: 1800, y: 300 },
    ],
  },
  {
    id: 'grand', name: 'Solmar Grand', district: 'Canal Row', difficulty: 'hard',
    par: 150, payout: 600, start: { x: 1000, y: 2000 },
    checkpoints: [
      { x: 1400, y: 2000 }, { x: 2000, y: 2000 }, { x: 2100, y: 1200 },
      { x: 2100, y: 400 }, { x: 1200, y: 400 }, { x: 500, y: 900 },
      { x: 500, y: 1700 }, { x: 1000, y: 2000 },
    ],
  },
];

// ---------------------------------------------------------------- turf wars

export const TURF_ZONES = [
  { id: 'sunset', name: 'Sunset Mile', crew: 'Vipers', color: '#e74c3c', x0: 0, y0: 0, x1: 813, y1: 813 },
  { id: 'cactus', name: 'Cactus Court', crew: 'Coyotes', color: '#27ae60', x0: 813, y0: 0, x1: 1626, y1: 813 },
  { id: 'neon', name: 'Neon Strip', crew: 'Neons', color: '#e84393', x0: 1626, y0: 0, x1: WORLD, y1: 813 },
  { id: 'marina', name: 'Marina', crew: 'Marlins', color: '#3498db', x0: 0, y0: 1626, x1: 813, y1: WORLD },
  { id: 'canal', name: 'Canal Row', crew: 'Canal Kings', color: '#7d3c98', x0: 813, y0: 1626, x1: 1626, y1: WORLD },
];

export const TURF_HOLD_SECONDS = 30;
export const TURF_INCOME_PER_HOUR = 5; // $ per zone per in-game hour
export const TURF_ALL_BONUS = 500;

// ---------------------------------------------------------------- coins

export const COIN_VALUE = 75;
export const COIN_SPOTS = [
  { x: 250, y: 250 }, { x: 1350, y: 250 }, { x: 2200, y: 250 },
  { x: 700, y: 700 }, { x: 1750, y: 700 }, { x: 250, y: 1350 },
  { x: 1200, y: 1200 }, { x: 2050, y: 1350 }, { x: 700, y: 2050 },
  { x: 1750, y: 2150 },
];

// ---------------------------------------------------------------- ranks

export const RANKS = [
  { score: 0, title: 'Nobody' },
  { score: 500, title: 'Street Rookie' },
  { score: 1500, title: 'Wheelman' },
  { score: 3000, title: 'King of the Mile' },
  { score: 5000, title: 'Neon Runner' },
  { score: 8000, title: 'Heat Seeker' },
  { score: 12000, title: 'Street Royalty' },
  { score: 20000, title: 'Solmar Legend' },
];

/** Rank title for a score. */
export function rankFor(score) {
  let title = RANKS[0].title;
  for (const r of RANKS) if (score >= r.score) title = r.title;
  return title;
}

// ---------------------------------------------------------------- wanted

export const HEAT_PER_STAR = 100;
export const HEAT_MAX = 500;
export const HEAT_DECAY = 2; // heat / s while laying low
export const HEAT_CRIME_STEAL = 60;
export const HEAT_CRIME_SHOT = 35;
export const HEAT_CRIME_SPEED = 8;

/** Stars for a heat value. */
export function starsFor(heat) {
  return Math.max(0, Math.min(5, Math.floor(heat / HEAT_PER_STAR)));
}

/**
 * Add heat, landing mid-band when a star boundary is crossed: a new star
 * must sit inside its band, never exactly on the boundary (else the next
 * decay tick drops the star again).
 */
export function addHeat(heat, amount) {
  const before = starsFor(heat);
  let next = Math.min(HEAT_MAX, heat + amount);
  const after = starsFor(next);
  if (after > before) next = Math.min(HEAT_MAX, after * HEAT_PER_STAR + HEAT_PER_STAR / 2);
  return next;
}

// ---------------------------------------------------------------- Lou's Mod Shop (round 10, new system)

export const MOD_CATEGORIES = [
  {
    id: 'engine', name: 'Engine',
    levels: [
      { level: 1, name: 'Street Tuned', price: 150, topMult: 1.1, accelMult: 1.1 },
      { level: 2, name: 'Race Tuned', price: 350, topMult: 1.22, accelMult: 1.2 },
      { level: 3, name: 'Solmar Works', price: 700, topMult: 1.38, accelMult: 1.35 },
    ],
  },
  {
    id: 'armor', name: 'Armor',
    levels: [
      { level: 1, name: 'Plated Doors', price: 120, healthBonus: 40 },
      { level: 2, name: 'Reinforced Frame', price: 300, healthBonus: 90 },
      { level: 3, name: 'Armored Shell', price: 600, healthBonus: 160 },
    ],
  },
  {
    id: 'tires', name: 'Tires',
    levels: [
      { level: 1, name: 'Sport Grip', price: 100, gripMult: 1.12 },
      { level: 2, name: 'Track Grip', price: 250, gripMult: 1.25 },
      { level: 3, name: 'Solmar Slicks', price: 500, gripMult: 1.42 },
    ],
  },
];

/** Price of the next level of a category, or null when maxed. */
export function modNextPrice(categoryId, level) {
  const cat = MOD_CATEGORIES.find((c) => c.id === categoryId);
  if (!cat) return null;
  const next = cat.levels.find((l) => l.level === level + 1);
  return next ? next.price : null;
}
