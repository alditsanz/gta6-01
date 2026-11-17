// config.js — every number, name and story beat in Solmar Heat, in one place.
// Balance the city, the cars, the police and the seven jobs from here.
export const CITY = {
  blocks: 9, // a 9 x 9 grid of blocks, ringed by streets
  block: 220, // pixels along one block edge
  road: 46, // street width
  name: 'SOLMAR',
  districts: [
    'Marina', 'Old Port', 'Palm Row', 'Civic Plaza', 'Harborlight',
    'Sunset Mile', 'Cactus Court', 'The Docks', 'Neon Strip',
  ],
};

export const WORLD = {
  // Streets sit every `block + road` pixels: 10 roads of 46 px and 9 blocks
  // of 220 px add up to 2440 px a side, so the farthest road (index 9, centre
  // 2417) is inside the world. A smaller world cut the grid short and left
  // the Marina, the Falco and Pier 9 unreachable — missions died there.
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
  { name: 'Sunny', color: '#e8b93c', top: 235, accel: 430, grip: 3.4 },
  { name: 'Corto', color: '#3f7fd0', top: 260, accel: 500, grip: 3.8 },
  { name: 'Vela', color: '#c94f6d', top: 285, accel: 560, grip: 4.0 },
  { name: 'Bruma', color: '#7a5fb0', top: 300, accel: 620, grip: 4.3 },
  { name: 'Toro GT', color: '#d84a2f', top: 330, accel: 700, grip: 4.6 },
  { name: 'Palma', color: '#2fae7d', top: 250, accel: 470, grip: 3.6 },
  { name: 'Dune', color: '#c98a3f', top: 275, accel: 540, grip: 3.9 },
  { name: 'Falco', color: '#22262e', top: 350, accel: 760, grip: 4.9 },
  { name: 'Vento', color: '#f5c542', top: 265, accel: 520, grip: 3.9, taxi: true },
  { name: 'Rumbo', color: '#8a6f4d', top: 255, accel: 480, grip: 4.4 },
];

export const POLICE = {
  maxStars: 5,
  chaseSpeed: 300,
  spawnGap: 3.2,
  starHeat: [0, 1, 2, 4, 7, 11], // heat points that buy each star
  decayPerSecond: 0.6,
  bustRadius: 26,
  roadblockAtStars: 4, // from 4 stars the SCPD parks a roadblock ahead of you
};

export const CAR_DAMAGE = {
  wallHit: 8, // health lost by slamming a building
  wreckAt: 0, // at 0 the car is totaled and cannot be driven again
};

export const NEAR_MISS = {
  pay: 15, // cash for threading past traffic at speed
  minSpeed: 150,
  range: 42, // how close the other car must be
  cooldown: 1.5, // seconds between payouts
};

export const COINS = {
  pay: 75, // cash per Solmar coin found
  total: 10,
  // Fixed road-grid cells, so the set is the same every run and in saves.
  spots: [
    [0, 3], [1, 5], [2, 8], [3, 1], [4, 6],
    [5, 0], [6, 8], [7, 2], [8, 5], [9, 9],
  ],
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
  {
    id: 'm7',
    title: 'The Last Ledger',
    giver: 'Mama Lou',
    brief: 'Kane kept a ledger of everything the crew ever did — names, dates, plates. It sits in the SCPD headquarters under guard. Take it back: clear the guards, grab the ledger, then outrun a 4-star manhunt to the Marina before the timer dies.',
    objective: 'Clear the HQ guards, take the ledger, escape to the Marina in 90 seconds.',
    reward: 4000,
    timer: 90,
  },
];

// Named places on the Solmar map. Each is a road-grid cell [i, j]; the
// renderer draws its label and the minimap draws its glyph.
export const LANDMARKS = [
  { id: 'bank', name: 'NATIONAL BANK', kind: 'bank', i: 6, j: 2, note: 'The Solmar Vault — job 5' },
  { id: 'hospital', name: 'SOLMAR GENERAL', kind: 'hospital', i: 2, j: 7, note: 'You wake up here when WASTED' },
  { id: 'paint', name: 'LOU’S PAINT SHOP', kind: 'paint', i: 6, j: 5, note: 'New paint, $200 — the heat forgets you' },
  { id: 'motel', name: 'THE PALMS MOTEL', kind: 'motel', i: 1, j: 6, note: 'The package waits here — job 4' },
  { id: 'pier', name: 'PIER 9', kind: 'pier', i: 8, j: 1, note: 'The getaway boat — job 6' },
  { id: 'docks', name: 'THE DOCKS', kind: 'docks', i: 1, j: 8, note: 'The crew’s midnight shipment' },
  { id: 'plaza', name: 'CIVIC PLAZA', kind: 'plaza', i: 4, j: 4, note: 'Where the busted get dropped' },
  { id: 'hq', name: 'SCPD HEADQUARTERS', kind: 'hq', i: 7, j: 3, note: 'Kane’s ledger — job 7' },
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
    'The ledger burns on the boat at Pier 9. Kane has nothing left on the crew.',
    'Mama Lou counts the vault cash. Lena guns the engine.',
    'Seven jobs. One city. Rex Marlowe owns the night.',
  ],
};

// Rank names the HUD shows as the player’s standing grows with jobs done.
export const RANKS = [
  { at: 0, name: 'WHEELMAN' },
  { at: 1, name: 'CREW DRIVER' },
  { at: 3, name: 'SOLMAR FIXER' },
  { at: 5, name: 'KING OF THE MILE' },
  { at: 6, name: 'STREET ROYALTY' },
  { at: 7, name: 'SOLMAR LEGEND' },
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
