// Solmar Heat — config.js
// Every tunable number and every piece of static game data lives here, in
// one place, so the rest of the game reads like a story instead of a pile
// of magic numbers. Nothing in this file touches the DOM or the network.

export const WORLD = 2440; // world is WORLD x WORLD units, origin top-left
export const ROAD_W = 64; // width of every street
export const ROAD_GAP = 252; // distance between neighbouring road lines

// The nine road lines in each direction. Road 8 sits at 2151 — the far
// road the player must be able to reach, so the movement clamp in main.js
// covers the whole grid, not just the middle of town.
export const ROADS = [135, 387, 639, 891, 1143, 1395, 1647, 1899, 2151];

export const VIEW_W = 1280;
export const VIEW_H = 720;

// ---------------------------------------------------------------- districts
// Ten districts on a 5-column x 2-row map. The column is picked from x,
// the row from y, so districtAt() is a pure function of position.
export const DISTRICT_COLS = [
  'Sunset Mile',
  'Cactus Court',
  'Neon Strip',
  'Palm Row',
  'Canal Row',
];
export const DISTRICT_ROWS = [
  ['Sunset Mile', 'Cactus Court', 'Neon Strip', 'Palm Row', 'Canal Row'],
  ['Marina', 'Harbor Lights', 'Old Solmar', 'Dune Fields', 'Pier 9'],
];

export function districtAt(x, y) {
  const col = Math.max(0, Math.min(4, Math.floor(x / 488)));
  const row = y < WORLD / 2 ? 0 : 1;
  return DISTRICT_ROWS[row][col];
}

// ------------------------------------------------------------------- cars
// Twelve stealable cars. Each model has its own colour, top speed and
// acceleration; the Falco is the quick getaway car, the Vento is the taxi.
export const CARS = [
  { model: 'Falco', color: '#e33f2f', top: 330, accel: 250 },
  { model: 'Vento', color: '#f2c230', top: 280, accel: 210, taxi: true },
  { model: 'Comet', color: '#3f7de3', top: 315, accel: 235 },
  { model: 'Bravo', color: '#7a4fd0', top: 295, accel: 220 },
  { model: 'Sable', color: '#22262e', top: 305, accel: 225 },
  { model: 'Dune', color: '#d08a3f', top: 270, accel: 200 },
  { model: 'Harlow', color: '#3fd0c0', top: 290, accel: 215 },
  { model: 'Marlin', color: '#2f8f5b', top: 285, accel: 210 },
  { model: 'Kestrel', color: '#e3e3e3', top: 320, accel: 240 },
  { model: 'Prowler', color: '#8a2f5b', top: 300, accel: 222 },
  { model: 'Solstice', color: '#f27bb0', top: 288, accel: 212 },
  { model: 'Mirage', color: '#c8b45a', top: 310, accel: 232 },
];

// ------------------------------------------------------------------ ranks
// Rank titles, 1-based: index 5 is "Street Royalty", index 6 is the
// story-complete "Solmar Legend".
export const RANKS = [
  'Wheelman',
  'Street Hustler',
  'Mile Runner',
  'King of the Mile',
  'Neon Baron',
  'Street Royalty',
  'Solmar Legend',
];

// -------------------------------------------------------------- story jobs
// Seven story jobs about the driver, Lena Voss and the crime boss Kane.
// target: where the job points; timer: seconds (0 = no timer);
// stars: wanted stars applied when the job starts.
export const MISSIONS = [
  {
    id: 1,
    name: 'First Wheels',
    brief: 'Steal any car and bring it to the Sunset Mile marker.',
    payout: 200,
    timer: 0,
    stars: 0,
    target: { x: 387, y: 387, label: 'Sunset Mile marker' },
    needCar: true,
  },
  {
    id: 2,
    name: "Lena's Errand",
    brief: 'Pick up Lena Voss and drive her to the Cactus Court plaza.',
    payout: 350,
    timer: 150,
    stars: 0,
    target: { x: 891, y: 387, label: 'Cactus Court plaza' },
    needCar: true,
  },
  {
    id: 3,
    name: 'The Quiet Lift',
    brief: 'Steal a Falco and deliver it to the Neon Strip garage.',
    payout: 500,
    timer: 180,
    stars: 1,
    target: { x: 1899, y: 387, label: 'Neon Strip garage' },
    needModel: 'Falco',
  },
  {
    id: 4,
    name: 'Hot Pursuit',
    brief: 'Shake the heat: reach the Marina with 2 stars on your tail.',
    payout: 700,
    timer: 180,
    stars: 2,
    target: { x: 387, y: 1899, label: 'Marina dock' },
    needCar: true,
  },
  {
    id: 5,
    name: 'Dead Drop',
    brief: 'Carry the package to Canal Row. Do not let the police spot you.',
    payout: 900,
    timer: 200,
    stars: 0,
    target: { x: 2151, y: 639, label: 'Canal Row drop' },
    needCar: false,
  },
  {
    id: 6,
    name: 'Pier 9 Getaway — Lena Voss',
    brief: 'Reach Pier 9 before the timer runs out. 3 stars from the start.',
    payout: 1500,
    timer: 120,
    stars: 3,
    target: { x: 2151, y: 2151, label: 'Pier 9' },
    needCar: true,
  },
  {
    id: 7,
    name: 'The Last Ledger',
    brief:
      "Steal Kane's ledger from SCPD Headquarters, clear 3 guards, grab the ledger, then escape to the Marina in 90 seconds under a 4-star manhunt.",
    payout: 4000,
    timer: 0, // the 90 s escape timer starts when the ledger is grabbed
    stars: 0,
    target: { x: 1143, y: 1143, label: 'SCPD Headquarters' },
    needCar: false,
    finale: true,
  },
];

// --------------------------------------------------------------- side work
export const FARE_PAY = 310; // a taxi fare pays around $310
export const COIN_PAY = 75; // each hidden Solmar coin
export const NEAR_MISS_PAY = 15; // threading past traffic at speed
export const NEAR_MISS_SPEED = 150; // speed needed for a near miss
export const NEAR_MISS_COOLDOWN = 1.5; // seconds between near-miss payouts
export const DELIVERY_PAY = 250;
export const DELIVERY_TIME = 150;
export const RACE_PAYOUTS = { easy: 150, medium: 300, hard: 600 };
export const TURF_INCOME_PER_HOUR = 5; // $ per zone held, per game hour
export const TURF_ALL_BONUS = 500; // holding every zone at once
export const PAINT_COST = 50; // heat clear + full repair at Lou's
export const REPAINT_COST = 25; // change the car's colour
export const CAR_DAMAGE_PER_HIT = 8; // wall hits cost 8 car health
export const MOD_SHOP = {
  // Lou's Mod Shop (new in round 9): three upgrade tracks, three levels.
  engine: { name: 'Engine', costs: [300, 600, 1000], speedBonus: [0, 45, 90, 140] },
  armor: { name: 'Armor', costs: [250, 500, 900], healthBonus: [0, 40, 80, 140] },
  tires: { name: 'Tires', costs: [200, 450, 800], gripBonus: [0, 0.12, 0.24, 0.38] },
};

// ------------------------------------------------------------------ wanted
export const HEAT_PER_STAR = 20; // heat 0..100, one star per 20 heat
export const HEAT_DECAY_PER_SEC = 1.5; // heat fades while the player lays low
export const HEAT_STEAL = 25;
export const HEAT_SHOT = 10;
export const HEAT_SPEEDING = 5;
export const HEAT_DELIVERY_SPOTTED = 8;

// ------------------------------------------------------------------- clock
// One full in-game day lasts 360 real seconds (6 minutes).
export const DAY_LENGTH_SEC = 360;
export const CLOCK_START_HOUR = 8; // the game opens at 08:00

// ------------------------------------------------------------------ turf
export const TURF_ZONES = [
  { name: 'Sunset Mile', rect: { x: 135, y: 135, w: 700, h: 700 }, owner: 'Vipers', defaultOwner: 'Vipers', color: '#c0392b' },
  { name: 'Neon Strip', rect: { x: 1600, y: 135, w: 700, h: 700 }, owner: 'Kings', defaultOwner: 'Kings', color: '#8e44ad' },
  { name: 'Old Solmar', rect: { x: 800, y: 1220, w: 760, h: 700 }, owner: 'Saints', defaultOwner: 'Saints', color: '#2980b9' },
  { name: 'Canal Row', rect: { x: 1952, y: 135, w: 488, h: 1085 }, owner: 'Reapers', defaultOwner: 'Reapers', color: '#27ae60' },
  { name: 'Pier 9', rect: { x: 1600, y: 1600, w: 800, h: 700 }, owner: 'Vipers', defaultOwner: 'Vipers', color: '#c0392b' },
];

// ------------------------------------------------------------------ coins
// Ten hidden Solmar coins on fixed grid cells, $75 each.
export const COIN_SPOTS = [
  { x: 639, y: 891 },
  { x: 891, y: 135 },
  { x: 1395, y: 891 },
  { x: 2151, y: 387 },
  { x: 639, y: 1647 },
  { x: 1647, y: 1395 },
  { x: 135, y: 2151 },
  { x: 1899, y: 1899 },
  { x: 1143, y: 639 },
  { x: 2151, y: 1647 },
];

// --------------------------------------------------------------- landmarks
export const LANDMARKS = [
  { name: 'SCPD Headquarters', x: 1143, y: 1143, kind: 'hq' },
  { name: "Lou's Paint Shop", x: 387, y: 639, kind: 'paint' },
  { name: "Lou's Mod Shop", x: 639, y: 387, kind: 'modshop' },
  { name: 'Marina', x: 387, y: 2151, kind: 'marina' },
  { name: 'Pier 9', x: 2151, y: 2151, kind: 'pier' },
  { name: 'Cactus Court Plaza', x: 891, y: 387, kind: 'plaza' },
  { name: 'Canal Row Locks', x: 2151, y: 891, kind: 'locks' },
  { name: 'Sunset Mile Arch', x: 135, y: 135, kind: 'arch' },
];

// ------------------------------------------------------------------- races
// Three race routes, one per difficulty, each a run of checkpoints.
export const RACES = [
  {
    id: 'easy',
    name: 'Sunset Sprint',
    district: 'Sunset Mile',
    par: 75,
    checkpoints: [
      { x: 387, y: 387 },
      { x: 891, y: 387 },
      { x: 891, y: 891 },
      { x: 387, y: 891 },
    ],
  },
  {
    id: 'medium',
    name: 'Neon Loop',
    district: 'Neon Strip',
    par: 110,
    checkpoints: [
      { x: 1647, y: 387 },
      { x: 2151, y: 387 },
      { x: 2151, y: 891 },
      { x: 1647, y: 891 },
      { x: 1647, y: 1395 },
      { x: 2151, y: 1395 },
    ],
  },
  {
    id: 'hard',
    name: 'Solmar Grand Tour',
    district: 'Old Solmar',
    par: 170,
    checkpoints: [
      { x: 387, y: 387 },
      { x: 1143, y: 387 },
      { x: 2151, y: 639 },
      { x: 2151, y: 1647 },
      { x: 1143, y: 2151 },
      { x: 387, y: 2151 },
      { x: 387, y: 1143 },
      { x: 1143, y: 1143 },
    ],
  },
];
