// Solmar Heat — every tuning number, name and story beat in one place.
// The playfield is a fixed 1280x720 logical view; the world itself is a
// 2440x2440 street grid. Nothing here touches the DOM: it is pure data.

/** The fixed simulation step, in seconds: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

/** The logical view the renderer scales to the window. */
export const VIEW = { width: 1280, height: 720 };

/** The city: 9 roads each way, evenly spaced, road 8 at x = 2151. */
export const WORLD = {
  size: 2440,
  roads: 9,
  roadStart: 103,
  roadSpacing: 256,
  roadWidth: 64,
};

/** Road centre coordinate for road index i (0..8), both axes. */
export function roadAt(i) {
  return WORLD.roadStart + i * WORLD.roadSpacing;
}

/** The city clamp: the player and cars may roam the whole grid, road 8 included. */
export function clampToWorld(v) {
  return Math.max(24, Math.min(WORLD.size - 24, v));
}

/** District names on a 3x3 map of the city. */
export const DISTRICTS = [
  ['Sunset Mile', 'Cactus Court', 'Neon Strip'],
  ['Palm Row', 'Downtown', 'Harbor Lights'],
  ['Marina', 'The Yards', 'Pier 9'],
];

/** District name for a world position. */
export function districtAt(x, y) {
  const third = WORLD.size / 3;
  const col = Math.min(2, Math.max(0, Math.floor(x / third)));
  const row = Math.min(2, Math.max(0, Math.floor(y / third)));
  return DISTRICTS[row][col];
}

/** Landmark spots, fixed on the grid (block centres between roads). */
export const LANDMARKS = {
  hq: { name: 'SCPD Headquarters', x: 1255, y: 1255, kind: 'hq' },
  paint: { name: "Lou's Paint Shop", x: 487, y: 1255, kind: 'paint' },
  marina: { name: 'Marina', x: 487, y: 2023, kind: 'marina' },
  pier: { name: 'Pier 9', x: 2023, y: 2023, kind: 'pier' },
  plaza: { name: 'Cactus Court Plaza', x: 1255, y: 487, kind: 'plaza' },
  hospital: { name: 'Solmar General', x: 1255, y: 2023, kind: 'hospital' },
};

/** The ten stealable car models. The Vento is the city's taxi. */
export const CAR_MODELS = [
  { name: 'Falco', color: '#e5484d', taxi: false },
  { name: 'Vento', color: '#f5c542', taxi: true },
  { name: 'Comet', color: '#4d7cfe', taxi: false },
  { name: 'Bison', color: '#5b6770', taxi: false },
  { name: 'Dune', color: '#d97b2f', taxi: false },
  { name: 'Sable', color: '#2f2a33', taxi: false },
  { name: 'Raptor', color: '#3fae6a', taxi: false },
  { name: 'Lumen', color: '#e8e6df', taxi: false },
  { name: 'Orca', color: '#7a5cff', taxi: false },
  { name: 'Pinto', color: '#c65d8f', taxi: false },
];

/** The ten hidden Solmar coins, on fixed grid cells. */
export const COIN_SPOTS = [
  { x: 103, y: 103 },
  { x: 2151, y: 103 },
  { x: 103, y: 2151 },
  { x: 2151, y: 2151 },
  { x: 1127, y: 615 },
  { x: 615, y: 1383 },
  { x: 1895, y: 871 },
  { x: 871, y: 1895 },
  { x: 1383, y: 1639 },
  { x: 1639, y: 359 },
];

/** A Solmar coin pays this much. */
export const COIN_VALUE = 75;

/** Ranks by story jobs completed (0..7). Rank 6 is Street Royalty, rank 7 Solmar Legend. */
export const RANKS = [
  'Nobody',
  'Small Timer',
  'Wheelman',
  'King of the Mile',
  'Heat Magnet',
  'Solmar Outlaw',
  'Street Royalty',
  'Solmar Legend',
];

/** The seven story jobs: Lena Voss, the player, and the crime boss Kane. */
export const MISSIONS = [
  {
    id: 1,
    title: 'First Wheels',
    brief: 'Steal any car and bring it to Lena at Cactus Court Plaza.',
    banner: 'Steal a car and drive it to Lena at Cactus Court Plaza.',
    payout: 250,
    timer: 0,
    startStars: 0,
  },
  {
    id: 2,
    title: 'The Escort',
    brief: 'Pick Lena up at the plaza and drive her to the Neon Strip hotel before the clock runs out.',
    banner: 'Drive Lena to the Neon Strip hotel before the timer runs out.',
    payout: 400,
    timer: 75,
    startStars: 0,
  },
  {
    id: 3,
    title: 'The Lift',
    brief: 'Lift the Vento taxi from the Marina lot and deliver it to Lou’s Paint Shop.',
    banner: 'Steal the Vento taxi at the Marina and deliver it to Lou’s Paint Shop.',
    payout: 500,
    timer: 90,
    startStars: 1,
  },
  {
    id: 4,
    title: 'Hot Pursuit',
    brief: 'Chase down Kane’s courier in the Comet, ram it three times to stop it, grab the package.',
    banner: 'Ram the courier’s Comet three times, then grab the package.',
    payout: 700,
    timer: 120,
    startStars: 2,
  },
  {
    id: 5,
    title: 'The Setup',
    brief: 'Carry the rigged package to Pier 9 while the heat is on. Two stars from the start.',
    banner: 'Deliver the package to Pier 9. 2 stars from the start.',
    payout: 900,
    timer: 90,
    startStars: 2,
  },
  {
    id: 6,
    title: 'Pier 9 Getaway — Lena Voss',
    brief: 'Lena is cornered at the Marina. Reach Pier 9 before the timer runs out.',
    banner: 'Reach Pier 9 before the timer runs out. 3 stars from the start.',
    payout: 1200,
    timer: 60,
    startStars: 3,
  },
  {
    id: 7,
    title: 'The Last Ledger',
    brief: 'Steal Kane’s ledger from SCPD Headquarters: clear 3 guards, grab the ledger, then escape to the Marina in 90 seconds under a 4-star manhunt.',
    banner: 'Clear the guards, grab Kane’s ledger, escape to the Marina in 90 seconds.',
    payout: 4000,
    timer: 90,
    startStars: 4,
  },
];

/** Guard drops in the finale add this each, so job 7 takes $4,150 in all. */
export const GUARD_DROP = 50;

/** On-foot tuning. */
export const PLAYER = {
  radius: 14,
  walk: 175,
  sprint: 265,
  health: 100,
};

/** Driving tuning. */
export const CAR = {
  accel: 300,
  brake: 620,
  maxSpeed: 430,
  reverseMax: 150,
  turnRate: 2.7,
  handbrakeTurn: 1.6,
  drag: 0.35,
  wallDamage: 8,
  health: 100,
};

/** Wanted tuning: heat 0..100, a star every 20 heat. */
export const WANTED = {
  maxHeat: 100,
  perStar: 20,
  stealHeat: 20,
  shotHeat: 3,
  guardHeat: 10,
  decayPerSec: 1.5,
  calmSeconds: 4,
  /** A star gained lands mid-band, never on a boundary that decays back next frame. */
  midBand: 10,
};

/** Combat tuning. */
export const COMBAT = {
  magSize: 12,
  reserveStart: 48,
  reloadSeconds: 1.1,
  bulletSpeed: 900,
  bulletDamage: 34,
  punchDamage: 20,
  punchRange: 36,
  guardHealth: 100,
  ammoPickup: 24,
};

/** Taxi fares pay around this much. */
export const FARE_PAY = 310;

/** Near-miss bonus: threading past traffic at speed over this, with this cooldown. */
export const NEAR_MISS = { speed: 150, payout: 15, cooldown: 1.5, gap: 48 };

/** The palette: sun-soaked Solmar. */
export const COLORS = {
  grass: '#7fae5a',
  park: '#6da34e',
  road: '#3c3f46',
  roadEdge: '#2c2e33',
  lane: '#e8d44d',
  sidewalk: '#b9b3a4',
  building: '#c98d5f',
  building2: '#8fa3b8',
  building3: '#d9c08a',
  water: '#3f8fb5',
  sand: '#e3cf9e',
  hud: '#101318',
  accent: '#ffb02e',
  star: '#ffd23e',
  danger: '#ff4d4d',
  good: '#58d68d',
};
