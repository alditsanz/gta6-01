// config.js — every tunable number and named thing in Solmar Heat.
// One place to balance the city, the cars, the police and the story.
export const CITY = {
  blocks: 9, // 9 x 9 blocks of streets
  block: 220, // pixels per block edge
  road: 46, // road width
  name: 'SOLMAR',
  districts: [
    'Marina', 'Old Port', 'Palm Row', 'Civic Plaza', 'Harborlight',
    'Sunset Mile', 'Cactus Court', 'The Docks', 'Neon Strip',
  ],
};

export const WORLD = {
  // The grid has blocks+1 roads of `road` width with `block` blocks between
  // them: 10 roads * 46 + 9 blocks * 220 = 2440. (It used to read 2026, which
  // cut the grid short: road 8 sits at x=2151, past the old 2014 clamp, so
  // the Marina drop-off, the Falco and Pier 9 could never be reached and
  // missions 1, 2, 5 and 6 could never complete. Now the whole grid is in.)
  width: (CITY.blocks + 1) * CITY.road + CITY.blocks * CITY.block,
  height: (CITY.blocks + 1) * CITY.road + CITY.blocks * CITY.block,
};

export const PLAYER = {
  walkSpeed: 170,
  runSpeed: 260,
  radius: 10,
  maxHealth: 100,
  punchDamage: 12,
  bulletDamage: 34,
  magSize: 12,
  reserveAmmo: 48,
  reloadSeconds: 1.1,
};

export const CARS = [
  { name: 'Sunny', color: '#e8b93c', top: 235, accel: 430, grip: 3.4, seats: 1 },
  { name: 'Corto', color: '#3f7fd0', top: 260, accel: 500, grip: 3.8, seats: 1 },
  { name: 'Vela', color: '#c94f6d', top: 285, accel: 560, grip: 4.0, seats: 1 },
  { name: 'Bruma', color: '#7a5fb0', top: 300, accel: 620, grip: 4.3, seats: 1 },
  { name: 'Toro GT', color: '#d84a2f', top: 330, accel: 700, grip: 4.6, seats: 1 },
  { name: 'Palma', color: '#2fae7d', top: 250, accel: 470, grip: 3.6, seats: 1 },
  { name: 'Dune', color: '#c98a3f', top: 275, accel: 540, grip: 3.9, seats: 1 },
  { name: 'Falco', color: '#22262e', top: 350, accel: 760, grip: 4.9, seats: 1 },
  // New in this round: a street taxi for fares, and a work pickup with grip.
  { name: 'Vento', color: '#f5c542', top: 265, accel: 520, grip: 3.9, seats: 1, taxi: true },
  { name: 'Rumbo', color: '#8a6f4d', top: 255, accel: 480, grip: 4.4, seats: 1 },
];

export const POLICE = {
  maxStars: 5,
  chaseSpeed: 300,
  spawnGap: 3.2,
  starHeat: [0, 1, 2, 4, 7, 11], // heat points per star
  decayPerSecond: 0.6,
  bustRadius: 26,
};

export const MISSIONS = [
  {
    id: 'm1',
    title: 'The First Key',
    giver: 'Lena Voss',
    brief: 'Lena needs a ride across town. Steal any car, pick her up at Palm Row, and drop her at the Marina — the port guards are watching.',
    objective: 'Pick up Lena, then reach the Marina marker.',
    reward: 400,
  },
  {
    id: 'm2',
    title: 'Hot Wheels',
    giver: 'Marco Sol',
    brief: 'Marco wants the Falco — the black coupe parked by Neon Strip. Take it, lose the cops, and bring it to the garage on Sunset Mile.',
    objective: 'Steal the black Falco and deliver it to the Sunset garage.',
    reward: 900,
  },
  {
    id: 'm3',
    title: 'Solmar Nights',
    giver: 'Lena Voss',
    brief: 'The crew is moving a shipment through the Docks at midnight. Escort the van, keep the police off it, and get it to the Old Port warehouse.',
    objective: 'Escort the van to the Old Port warehouse. Keep it alive.',
    reward: 1500,
  },
  {
    id: 'm4',
    title: 'The Palms Package',
    giver: 'Mama Lou',
    brief: 'A package is waiting at The Palms Motel. Pick it up, but the Harbor Boys are watching the motel — expect an ambush and a 2-star tail. Bring the package to Lou’s Paint Shop.',
    objective: 'Grab the package at the motel, survive the ambush, deliver it to the paint shop.',
    reward: 1100,
  },
  {
    id: 'm5',
    title: 'The Solmar Vault',
    giver: 'Mama Lou',
    brief: 'The National Bank vault holds the crew’s future. Crack it: clear the Harbor Boys guarding the vault, grab the cash, then shake the 3-star manhunt and reach Pier 9.',
    objective: 'Clear the vault guards, take the cash, escape to Pier 9.',
    reward: 2500,
  },
  {
    id: 'm6',
    title: 'Pier 9 Getaway',
    giver: 'Lena Voss',
    brief: 'Detective Kane has the whole SCPD on the streets and the clock is running. Drive to Pier 9 before the timer dies — every star on your tail wants you in a cell, not on a boat.',
    objective: 'Reach Pier 9 before the timer runs out. 3 stars from the start.',
    reward: 3000,
    timer: 75,
  },
];

// Named places on the Solmar map: the bank, the hospital, the paint shop,
// the motel, the pier and the docks. Each is a road-grid cell [i, j] plus a
// label the renderer and the minimap show. (gridIndex helper in landmarks.js)
export const LANDMARKS = [
  { id: 'bank', name: 'NATIONAL BANK', kind: 'bank', i: 6, j: 2, note: 'The Solmar Vault — job 5' },
  { id: 'hospital', name: 'SOLMAR GENERAL', kind: 'hospital', i: 2, j: 7, note: 'You wake up here when WASTED' },
  { id: 'paint', name: 'LOU’S PAINT SHOP', kind: 'paint', i: 6, j: 5, note: 'New paint, $200 — the heat forgets you' },
  { id: 'motel', name: 'THE PALMS MOTEL', kind: 'motel', i: 1, j: 6, note: 'The package waits here — job 4' },
  { id: 'pier', name: 'PIER 9', kind: 'pier', i: 8, j: 1, note: 'The getaway boat — job 6' },
  { id: 'docks', name: 'THE DOCKS', kind: 'docks', i: 1, j: 8, note: 'The crew’s midnight shipment' },
  { id: 'plaza', name: 'CIVIC PLAZA', kind: 'plaza', i: 4, j: 4, note: 'Where the busted get dropped' },
];

export const STORY = {
  intro: [
    'SOLMAR — a sun-soaked port city where the tide brings money and trouble in equal measure.',
    'You are REX MARLOWE, a wheelman with a debt to pay and a city to learn.',
    'Mama Lou runs the quiet jobs. Lena Voss runs the loud ones. Detective Kane runs the police.',
    'Steal a car. Earn the crew. Own the night.',
  ],
  outro: 'The van made it. The crew is paid. Solmar is yours — for now.',
  finale: [
    'The boat is waiting at Pier 9. Kane’s sirens fade behind you.',
    'Mama Lou counts the vault cash. Lena guns the engine.',
    'Six jobs. One city. Rex Marlowe owns the night.',
  ],
};

// Rank names the HUD shows as the player’s standing grows.
export const RANKS = [
  { at: 0, name: 'WHEELMAN' },
  { at: 1, name: 'CREW DRIVER' },
  { at: 3, name: 'SOLMAR FIXER' },
  { at: 5, name: 'KING OF THE MILE' },
  { at: 6, name: 'SOLMAR LEGEND' },
];

export const TAXI = {
  fareBase: 60,
  farePerPixel: 0.12,
  maxFare: 420,
};

export const PAINT_SHOP = {
  cost: 200,
  radius: 70,
};

export const CONTROLS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  enterCar: 'KeyE',
  exitCar: 'KeyE',
  punch: 'KeyF',
  shoot: 'Mouse0',
  sprint: 'ShiftLeft',
  pause: 'KeyP',
  mute: 'KeyM',
  reload: 'KeyR',
  handbrake: 'Space',
  taxi: 'KeyT',
};

export const COLORS = {
  sky: '#ffd9a0',
  sand: '#f2d8a7',
  asphalt: '#3a3f47',
  asphaltEdge: '#2c3038',
  lane: '#e8e4d8',
  sidewalk: '#cbb98f',
  building: ['#b98a5e', '#8fa3b8', '#c9a86a', '#7d8b6f', '#a8705a', '#6f7f96'],
  palm: '#2f7d4f',
  water: '#3f9db5',
  hud: '#f5eeda',
  danger: '#e0453a',
  gold: '#f0c040',
};

export const SAVE_KEY = 'solmar-heat-save-v1';
export const SEED_DEFAULT = 2026;
