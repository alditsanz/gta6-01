// Solmar Heat — config: every number and name the game runs on.
// One place for tuning so the other files stay about behaviour, not data.

const CFG = {
  world: 2440,            // square city, units
  roadWidth: 34,
  // Roads run both ways at these coordinates; road 8 sits at 2151.
  roads: [31, 296, 561, 826, 1091, 1356, 1621, 1886, 2151],
  playerRadius: 13,
  walkSpeed: 170,
  sprintMult: 1.6,
  carAccel: 320,
  carMaxSpeed: 420,
  carReverseMax: 150,
  carTurn: 2.6,
  handbrakeGrip: 0.86,
  // Wanted: heat 0..500, one star per 100 heat. A fresh star lands
  // mid-band (star*100 + 50) so it never decays back the next frame.
  heatMax: 500,
  heatPerStar: 100,
  heatDecayPerSec: 3,
  heatSteal: 60,
  heatShot: 25,
  heatSpeeding: 10,
  heatKill: 80,
  // Money
  coinValue: 75,
  nearMissValue: 15,
  nearMissCooldown: 1.5,
  nearMissMinSpeed: 150,
  taxiFare: 310,
  deliveryPay: 250,
  turfTakeoverPay: 150,
  turfIncomePerDistrict: 40,
  turfIncomeEverySec: 60,
  hospitalFee: 50,
  // Car damage
  wallDamage: 8,
  carMaxHealth: 100,
  // Combat
  magSize: 12,
  reserveAmmo: 48,
  bulletSpeed: 900,
  bulletDamage: 34,
  guardHealth: 100,
  punchDamage: 25,
  punchRange: 34,
  // Day / night: a full in-game day lasts 240 real seconds.
  dayLengthSec: 240,
  nightStartMin: 20 * 60,
  nightEndMin: 6 * 60,
  rainGrip: 0.72,
  // Turf war
  turfWarDuration: 30,
  turfWarCooldown: 20,
  gangCarDamage: 5,
};

// Districts: 10 rectangles that tile the city. Canal Row is the thin
// eastern strip with two vertical canals and bridges on the roads.
const DISTRICTS = [
  { name: 'Sunset Mile',   x0: 0,    y0: 0,    x1: 813,  y1: 813 },
  { name: 'Cactus Court',  x0: 813,  y0: 0,    x1: 1626, y1: 813 },
  { name: 'Neon Strip',    x0: 1626, y0: 0,    x1: 2440, y1: 813 },
  { name: 'Marina',        x0: 0,    y0: 813,  x1: 813,  y1: 1626 },
  { name: 'Pier 9',        x0: 813,  y0: 813,  x1: 1626, y1: 1626 },
  { name: 'East Market',   x0: 1626, y0: 813,  x1: 2200, y1: 1626 },
  { name: 'Canal Row',     x0: 2200, y0: 813,  x1: 2440, y1: 1626 },
  { name: 'Old Town',      x0: 0,    y0: 1626, x1: 813,  y1: 2440 },
  { name: 'Harbor Lights', x0: 813,  y0: 1626, x1: 1626, y1: 2440 },
  { name: 'Southgate',     x0: 1626, y0: 1626, x1: 2440, y1: 2440 },
];

// Canals: vertical water bands inside Canal Row. Horizontal roads
// cross them on bridges; anywhere else the water blocks movement.
const CANALS = [
  { x0: 2260, x1: 2320, y0: 813, y1: 1626 },
  { x0: 2360, x1: 2420, y0: 813, y1: 1626 },
];

// The 12 stealable cars. Falco and the Vento taxi are the familiar ones.
const CAR_MODELS = [
  { id: 'falco',  name: 'Falco',  color: '#e33f2f', speed: 430 },
  { id: 'vento',  name: 'Vento',  color: '#f2c230', speed: 380, taxi: true },
  { id: 'comet',  name: 'Comet',  color: '#3f7de3', speed: 450 },
  { id: 'brisa',  name: 'Brisa',  color: '#39c0a5', speed: 400 },
  { id: 'toro',   name: 'Toro',   color: '#7a4a21', speed: 360 },
  { id: 'lobo',   name: 'Lobo',   color: '#5b5f6b', speed: 410 },
  { id: 'palma',  name: 'Palma',  color: '#e38ec2', speed: 390 },
  { id: 'siroco', name: 'Siroco', color: '#d8d8d8', speed: 440 },
  { id: 'mamba',  name: 'Mamba',  color: '#20242e', speed: 460 },
  { id: 'kite',   name: 'Kite',   color: '#8fd13f', speed: 370 },
  { id: 'rondo',  name: 'Rondo',  color: '#b06ae0', speed: 385 },
  { id: 'atlas',  name: 'Atlas',  color: '#c98a2e', speed: 350 },
];

// Where the stealable cars park at the start of a run.
const CAR_SPAWNS = [
  { model: 'falco',  x: 296,  y: 340 },
  { model: 'vento',  x: 826,  y: 826 },
  { model: 'comet',  x: 1621, y: 296 },
  { model: 'brisa',  x: 561,  y: 1356 },
  { model: 'toro',   x: 1886, y: 561 },
  { model: 'lobo',   x: 1091, y: 1886 },
  { model: 'palma',  x: 2151, y: 1091 },
  { model: 'siroco', x: 296,  y: 1886 },
  { model: 'mamba',  x: 1356, y: 2151 },
  { model: 'kite',   x: 826,  y: 1621 },
  { model: 'rondo',  x: 1886, y: 2151 },
  { model: 'atlas',  x: 2280, y: 950 },
];

// Landmarks the player navigates by.
const LANDMARKS = {
  scpdHq:     { x: 1356, y: 561,  label: 'SCPD Headquarters' },
  paintShop:  { x: 561,  y: 561,  label: "Lou's Paint Shop" },
  marina:     { x: 296,  y: 1091, label: 'Marina' },
  pier9:      { x: 1091, y: 1091, label: 'Pier 9' },
  plaza:      { x: 1091, y: 296,  label: 'Cactus Court Plaza' },
  hospital:   { x: 561,  y: 296,  label: 'Solmar General Hospital' },
  canalDepot: { x: 2280, y: 880,  label: 'Canal Row Depot' },
};

// 10 hidden Solmar coins on fixed grid cells, $75 each.
const COIN_SPOTS = [
  [296, 561], [826, 296], [1356, 826], [1886, 296], [2151, 561],
  [561, 1091], [1091, 1621], [1621, 1886], [2151, 1356], [2280, 1500],
];

const RANKS = [
  'Small Timer', 'Wheelman', 'Street Hustler', 'Mile Runner',
  'King of the Mile', 'Night Operator', 'Street Royalty', 'Solmar Legend',
];

// The 7 story jobs. Steps are interpreted by the mission engine:
// steal / reach / timedReach / pickup / deliver / follow / clearGuards / grab / escape.
const JOBS = [
  {
    id: 1, name: 'First Wheels', pay: 200,
    brief: 'Steal a car, then bring it to Lou\u2019s Paint Shop.',
    steps: [
      { type: 'steal', text: 'Steal any car (E)' },
      { type: 'reach', x: 561, y: 561, r: 70, text: 'Drive to Lou\u2019s Paint Shop' },
    ],
  },
  {
    id: 2, name: 'Lena\u2019s Errand', pay: 350,
    brief: 'Pick Lena Voss up at Cactus Court Plaza and get her to the Marina.',
    steps: [
      { type: 'reach', x: 1091, y: 296, r: 60, text: 'Meet Lena at Cactus Court Plaza' },
      { type: 'timedReach', x: 296, y: 1091, r: 70, time: 60, text: 'Drive Lena to the Marina — 60s' },
    ],
  },
  {
    id: 3, name: 'The Quiet Lift', pay: 500,
    brief: 'The Vento taxi in Cactus Court belongs to Kane now. Take it east.',
    steps: [
      { type: 'stealModel', model: 'vento', text: 'Steal the Vento taxi in Cactus Court' },
      { type: 'reach', x: 2151, y: 561, r: 70, text: 'Deliver the Vento to the east end of Neon Strip' },
    ],
  },
  {
    id: 4, name: 'Hot Pursuit', pay: 650,
    brief: 'Tail Kane\u2019s courier through the city. Stay close, don\u2019t spook him.',
    steps: [
      { type: 'follow', time: 20, maxDist: 260, text: 'Tail the courier car — stay within range for 20s' },
      { type: 'reach', x: 1091, y: 1886, r: 70, text: 'Follow him to the Harbor Lights drop' },
    ],
  },
  {
    id: 5, name: 'The Setup', pay: 800,
    brief: 'Move a package from Old Town to Pier 9. Cops are watching — keep it smooth.',
    steps: [
      { type: 'pickup', x: 561, y: 1621, r: 60, text: 'Pick up the package in Old Town' },
      { type: 'timedReach', x: 1091, y: 1091, r: 70, time: 75, text: 'Deliver to Pier 9 — 75s, stay out of trouble' },
    ],
  },
  {
    id: 6, name: 'Pier 9 Getaway — Lena Voss', pay: 1200,
    brief: 'Reach Pier 9 before the timer runs out. 3 stars from the start.',
    steps: [
      { type: 'timedReach', x: 1091, y: 1091, r: 70, time: 75, stars: 3,
        text: 'Reach Pier 9 before the timer runs out. 3 stars from the start.' },
    ],
  },
  {
    id: 7, name: 'The Last Ledger', pay: 4000,
    brief: 'Steal Kane\u2019s ledger from SCPD Headquarters, then escape to the Marina.',
    steps: [
      { type: 'reach', x: 1356, y: 561, r: 90, text: 'Reach SCPD Headquarters' },
      { type: 'clearGuards', text: 'Clear the 3 guards at HQ' },
      { type: 'grab', x: 1356, y: 561, r: 55, text: 'Grab Kane\u2019s ledger' },
      { type: 'escape', x: 296, y: 1091, r: 70, time: 90, stars: 4,
        text: 'Escape to the Marina in 90s — 4-star manhunt!' },
    ],
  },
];

// Street races: one route per district, checkpoints in order.
const RACES = [
  {
    id: 'sunset', name: 'Sunset Sprint', diff: 'Easy', pay: 150, par: 60,
    start: { x: 296, y: 296 },
    checkpoints: [
      { x: 296, y: 1091 }, { x: 1091, y: 1091 }, { x: 1091, y: 296 },
    ],
    finish: { x: 296, y: 296 },
  },
  {
    id: 'neon', name: 'Neon Circuit', diff: 'Medium', pay: 300, par: 90,
    start: { x: 1886, y: 296 },
    checkpoints: [
      { x: 1886, y: 1091 }, { x: 1091, y: 1091 }, { x: 1091, y: 1886 }, { x: 1886, y: 1886 },
    ],
    finish: { x: 1886, y: 296 },
  },
  {
    id: 'canal', name: 'Canal Grand Tour', diff: 'Hard', pay: 600, par: 120,
    start: { x: 2151, y: 296 },
    checkpoints: [
      { x: 2151, y: 1091 }, { x: 2151, y: 1886 }, { x: 1091, y: 1886 }, { x: 1091, y: 296 },
    ],
    finish: { x: 2151, y: 296 },
  },
];

// Rival gangs for the turf system. The player starts holding Sunset Mile.
const GANGS = {
  player: { name: 'Solmar Kings', color: '#39d353' },
  vipers: { name: 'Vipers', color: '#e33f2f' },
  crows: { name: 'Crows', color: '#b06ae0' },
};
const TURF_START = {
  'Sunset Mile': 'player',
  'Cactus Court': 'vipers',
  'Neon Strip': 'crows',
  'Marina': 'vipers',
  'Pier 9': 'crows',
  'East Market': 'vipers',
  'Canal Row': 'crows',
  'Old Town': 'vipers',
  'Harbor Lights': 'crows',
  'Southgate': 'vipers',
};
