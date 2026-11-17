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
  width: CITY.blocks * CITY.block + CITY.road,
  height: CITY.blocks * CITY.block + CITY.road,
};

export const PLAYER = {
  walkSpeed: 170,
  runSpeed: 260,
  radius: 10,
  maxHealth: 100,
  punchDamage: 12,
  bulletDamage: 34,
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
];

export const STORY = {
  intro: [
    'SOLMAR — a sun-soaked port city where the tide brings money and trouble in equal measure.',
    'You are RAY DELGADO, a wheelman with a debt to pay and a city to learn.',
    'Lena Voss runs the quiet jobs. Marco Sol runs the loud ones. The police run everything else.',
    'Steal a car. Earn the crew. Own the night.',
  ],
  outro: 'The van made it. The crew is paid. Solmar is yours — for now.',
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
