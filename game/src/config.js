// Solmar Heat — config.js
// One job: every fixed number, name and table the rest of the game reads.
// Nothing here touches the DOM, so the logic test can import it directly.

export const WORLD_SIZE = 2440;
export const ROAD_START = 40;
export const ROAD_STEP = 264;
export const ROAD_COUNT = 9;

// The nine road lines, both axes. Road 8 sits at 40 + 8 * 264 = 2152.
export function roadPositions() {
  const out = [];
  for (let i = 0; i < ROAD_COUNT; i++) out.push(ROAD_START + i * ROAD_STEP);
  return out;
}

export const ROADS = roadPositions();

export const SAVE_KEY = 'solmar-heat-save-v8';
export const SAVE_VERSION = 8;

// Ten districts that tile the whole map, no gaps, no overlaps.
export const DISTRICTS = [
  { name: 'Sunset Mile',   x0: 0,    y0: 0,    x1: 813,  y1: 813,  color: '#e8a34c' },
  { name: 'Cactus Court',  x0: 813,  y0: 0,    x1: 1626, y1: 813,  color: '#7fb069' },
  { name: 'Neon Strip',    x0: 1626, y0: 0,    x1: 2440, y1: 813,  color: '#e26fd5' },
  { name: 'Marina',        x0: 0,    y0: 813,  x1: 813,  y1: 1626, color: '#4fa8c9' },
  { name: 'Old Foundry',   x0: 813,  y0: 813,  x1: 1626, y1: 1220, color: '#9a8f7a' },
  { name: 'Harbor Lights', x0: 813,  y0: 1220, x1: 1626, y1: 1626, color: '#c9b458' },
  { name: 'Canal Row',     x0: 1626, y0: 813,  x1: 2440, y1: 1626, color: '#5ec2b8' },
  { name: 'Pier 9',        x0: 0,    y0: 1626, x1: 813,  y1: 2440, color: '#8a6fd6' },
  { name: 'Vista Heights', x0: 1626, y0: 1626, x1: 2440, y1: 2033, color: '#d97b6c' },
  { name: 'Coral Bay',     x0: 1626, y0: 2033, x1: 2440, y1: 2440, color: '#f2a541' },
];

// Twelve stealable cars. The Falco is the common street car; the Vento
// is the city's taxi. Each has its own top speed and colour.
export const CARS = [
  { model: 'Falco',   color: '#d43d2a', topSpeed: 430, parked: { x: 320,  y: 300 } },
  { model: 'Vento',   color: '#f2c230', topSpeed: 400, parked: { x: 1900, y: 320 } },
  { model: 'Comet',   color: '#3d7bd4', topSpeed: 470, parked: { x: 600,  y: 900 } },
  { model: 'Bravo',   color: '#2fae6e', topSpeed: 410, parked: { x: 1100, y: 500 } },
  { model: 'Sable',   color: '#22242e', topSpeed: 450, parked: { x: 1500, y: 1400 } },
  { model: 'Dusty',   color: '#b08954', topSpeed: 380, parked: { x: 300,  y: 1800 } },
  { model: 'Kite',    color: '#e26fd5', topSpeed: 440, parked: { x: 2100, y: 1000 } },
  { model: 'Marlin',  color: '#4fa8c9', topSpeed: 420, parked: { x: 900,  y: 2100 } },
  { model: 'Onyx',    color: '#5a3d8a', topSpeed: 460, parked: { x: 1750, y: 1900 } },
  { model: 'Rover',   color: '#7a7f8a', topSpeed: 390, parked: { x: 1300, y: 700 } },
  { model: 'Zephyr',  color: '#e8e4d8', topSpeed: 480, parked: { x: 2200, y: 500 } },
  { model: 'Lumen',   color: '#39c2a5', topSpeed: 435, parked: { x: 700,  y: 1500 } },
];

export const RANKS = [
  { min: 0,     title: 'Street Rookie' },
  { min: 500,   title: 'Corner Regular' },
  { min: 1500,  title: 'Mile Runner' },
  { min: 3000,  title: 'Wheelman' },
  { min: 5000,  title: 'King of the Mile' },
  { min: 8000,  title: 'Sunset Boss' },
  { min: 12000, title: 'Street Royalty' },
  { min: 20000, title: 'Solmar Legend' },
];

export function rankForScore(score) {
  let rank = RANKS[0];
  for (const r of RANKS) if (score >= r.min) rank = r;
  return rank;
}

export const PRICES = {
  coin: 75,
  nearMiss: 15,
  fareBase: 310,
  paintRepaint: 50,
  guardDrop: 50,
  turfIncomePerHour: 5,
  turfAllBonus: 500,
};

export const WANTED = {
  maxHeat: 100,
  bandSize: 20,
  decayPerSecond: 1.5,
  stealHeat: 12,
  shootHeat: 8,
  speedHeat: 5,
  deliverySpotHeat: 10,
};

export const CAR = {
  maxHealth: 100,
  wallHitDamage: 8,
  trafficHitDamage: 5,
  wallHitCooldown: 0.5,
};

export const PLAYER = {
  walkSpeed: 230,
  sprintSpeed: 350,
  health: 100,
  magSize: 12,
  reserveAmmo: 48,
  punchRange: 55,
  punchDamage: 1,
};

export const CLOCK = {
  // One full in-game day lasts 360 real seconds.
  dayLengthSeconds: 360,
  startHour: 8,
};

export const WEATHER_CYCLE_SECONDS = 90;

// Rush-hour windows, in clock hours.
export const RUSH_MORNING = [7, 9];
export const RUSH_EVENING = [17, 19];
export const NIGHT_QUIET = [0, 5];

export const BASE_TRAFFIC = 14;
export const BASE_PEDESTRIANS = 26;
