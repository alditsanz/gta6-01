// config.js — Solmar Heat: every tuneable number, name and table in one place.
// The game is a top-down open-world crime story set in the original city of Solmar.
// World: 2440 x 2440 units, a 9x9 road grid. Roads sit at x = 31 + i*265 (road 8 = 2151).

const CFG = {
  world: 2440,
  roads: [31, 296, 561, 826, 1091, 1356, 1621, 1886, 2151],
  roadHalf: 17,
  walkSpeed: 150,
  sprintSpeed: 235,
  carTopSpeed: 330,
  carAccel: 260,
  carReverse: 120,
  handbrakeGrip: 0.86,
  rainGrip: 0.85,
  nearMissSpeed: 150,
  nearMissPay: 15,
  nearMissCooldown: 1.5,
  carDamagePerHit: 8,
  carMaxHealth: 100,
  playerMaxHealth: 100,
  heatMax: 100,
  heatPerStar: 20,
  heatDecayPerSec: 0.9,
  heatCalmDelay: 5,
  paintShopFee: 50,
  wastedFine: 50,
  coinPay: 75,
  taxiBasePay: 310,
  turfIncomePerHour: 5,
  turfAllZonesBonusPerHour: 25,
  turfHoldSeconds: 30,
  dayLengthSec: 360, // one full in-game day = 6 real minutes
  weatherChangeSec: 90,
  baseTraffic: 14,
  saveKey: 'solmar-heat-save-v7',
};

// Ten districts. Each is a rectangle; the first match in this order wins.
// Canal Row sits in the south-centre and holds the canals and bridges.
const DISTRICTS = [
  { name: 'Sunset Mile', x0: 0, y0: 0, x1: 800, y1: 800 },
  { name: 'Cactus Court', x0: 800, y0: 0, x1: 1600, y1: 800 },
  { name: 'Neon Strip', x0: 1600, y0: 0, x1: 2440, y1: 800 },
  { name: 'Marina', x0: 0, y0: 800, x1: 800, y1: 1600 },
  { name: 'Downtown Solmar', x0: 800, y0: 800, x1: 1600, y1: 1600 },
  { name: 'Pier 9', x0: 1600, y0: 800, x1: 2440, y1: 1600 },
  { name: 'Old Town', x0: 0, y0: 1600, x1: 800, y1: 2440 },
  { name: 'Canal Row', x0: 800, y0: 1600, x1: 1600, y1: 2440 },
  { name: 'Harbor Lights', x0: 1600, y0: 1600, x1: 2440, y1: 2100 },
  { name: 'South Docks', x0: 1600, y0: 2100, x1: 2440, y1: 2440 },
];

// Twelve stealable cars. Falco and Vento (the taxi) are the two the player meets first.
const CARS = [
  { model: 'Falco', color: '#e33f2f', top: 330, accel: 280 },
  { model: 'Vento', color: '#f2c230', top: 300, accel: 250, taxi: true },
  { model: 'Comet', color: '#3f7de3', top: 345, accel: 300 },
  { model: 'Brisa', color: '#37b8a2', top: 290, accel: 240 },
  { model: 'Toro', color: '#7a4a21', top: 310, accel: 260 },
  { model: 'Lobo', color: '#5b5f6b', top: 320, accel: 270 },
  { model: 'Palma', color: '#d97bc0', top: 285, accel: 235 },
  { model: 'Sierra', color: '#4a8f3c', top: 305, accel: 255 },
  { model: 'Cobra', color: '#20242e', top: 350, accel: 310 },
  { model: 'Nube', color: '#dfe6ee', top: 295, accel: 245 },
  { model: 'Rayo', color: '#f2801f', top: 340, accel: 295 },
  { model: 'Duna', color: '#c9a86a', top: 280, accel: 230 },
];

// Ranks in order. Rank 6 is Street Royalty; rank 7 (story complete) is Solmar Legend.
const RANKS = [
  { name: 'Rookie', score: 0 },
  { name: 'Wheelman', score: 400 },
  { name: 'Street Hustler', score: 1000 },
  { name: 'King of the Mile', score: 2000 },
  { name: 'Neon Runner', score: 3500 },
  { name: 'District Boss', score: 5500 },
  { name: 'Street Royalty', score: 8000 },
  { name: 'Solmar Legend', score: 11000 },
];

// Seven story jobs. Jobs 6 and 7 are specified exactly by the brief.
const MISSIONS = [
  { id: 1, name: 'First Wheels', brief: 'Steal a car and drive it to the Sunset Mile marker.', target: { x: 600, y: 600 }, payout: 250, timer: 150, stars: 0, needCar: true },
  { id: 2, name: "Lena's Errand", brief: 'Drive Lena Voss to the Marina. Keep it smooth.', target: { x: 300, y: 1200 }, payout: 400, timer: 150, stars: 0, needCar: true },
  { id: 3, name: 'The Cactus Job', brief: 'Pick up the package at the Cactus Court plaza, deliver it Downtown.', target: { x: 1400, y: 1400 }, payout: 600, timer: 180, stars: 1, pickup: { x: 1200, y: 400 } },
  { id: 4, name: 'Hot Pursuit', brief: 'Reach Pier 9 with the law on your tail. 3 stars the whole way.', target: { x: 2100, y: 1200 }, payout: 900, timer: 100, stars: 3 },
  { id: 5, name: 'The Setup', brief: 'Drop the package on the Neon Strip and walk away clean.', target: { x: 2000, y: 400 }, payout: 1200, timer: 120, stars: 2 },
  { id: 6, name: 'Pier 9 Getaway', brief: 'Reach Pier 9 before the timer runs out. 3 stars from the start.', target: { x: 2100, y: 1200 }, payout: 1500, timer: 75, stars: 3 },
  { id: 7, name: 'The Last Ledger', brief: "Steal Kane's ledger from SCPD Headquarters, clear 3 guards, grab the ledger, then escape to the Marina in 90 seconds under a 4-star manhunt.", target: { x: 300, y: 1200 }, payout: 4000, guardPay: 150, timer: 90, stars: 4, hq: { x: 1200, y: 1100 } },
];

// Three street-race routes. Par times are beatable in a stolen car.
const RACES = [
  { id: 'sunset', name: 'Sunset Sprint', diff: 'Easy', start: { x: 400, y: 400 }, par: 75, payout: 150,
    checkpoints: [{ x: 826, y: 296 }, { x: 1395, y: 561 }, { x: 1091, y: 1091 }, { x: 400, y: 826 }] },
  { id: 'neon', name: 'Neon Loop', diff: 'Medium', start: { x: 2000, y: 300 }, par: 120, payout: 300,
    checkpoints: [{ x: 2151, y: 826 }, { x: 1621, y: 1395 }, { x: 1091, y: 1886 }, { x: 561, y: 1395 }, { x: 826, y: 561 }, { x: 2000, y: 826 }] },
  { id: 'canal', name: 'Canal Grand Tour', diff: 'Hard', start: { x: 1200, y: 1900 }, par: 180, payout: 600,
    checkpoints: [{ x: 826, y: 2151 }, { x: 561, y: 1621 }, { x: 1091, y: 1091 }, { x: 1621, y: 826 }, { x: 2151, y: 1395 }, { x: 1886, y: 2151 }, { x: 1356, y: 1886 }, { x: 1200, y: 2151 }] },
];

// Turf zones: five districts with rival crews. Flipping all five pays a bonus.
const TURF_ZONES = [
  { id: 'sunset', name: 'Sunset Mile', crew: 'Vipers', x0: 0, y0: 0, x1: 800, y1: 800 },
  { id: 'cactus', name: 'Cactus Court', crew: 'Coyotes', x0: 800, y0: 0, x1: 1600, y1: 800 },
  { id: 'neon', name: 'Neon Strip', crew: 'Kings', x0: 1600, y0: 0, x1: 2440, y1: 800 },
  { id: 'marina', name: 'Marina', crew: 'Sharks', x0: 0, y0: 800, x1: 800, y1: 1600 },
  { id: 'pier', name: 'Pier 9', crew: 'Docks', x0: 1600, y0: 800, x1: 2440, y1: 1600 },
];

// Ten hidden Solmar coins on fixed road cells, $75 each.
const COIN_CELLS = [
  { x: 296, y: 296 }, { x: 826, y: 561 }, { x: 1395, y: 296 }, { x: 1886, y: 826 },
  { x: 561, y: 1395 }, { x: 2151, y: 1091 }, { x: 1091, y: 1886 }, { x: 1621, y: 561 },
  { x: 826, y: 2151 }, { x: 1886, y: 1886 },
];

// Landmarks the player can find on the map.
const LANDMARKS = {
  hq: { name: 'SCPD Headquarters', x: 1200, y: 1100 },
  paint: { name: "Lou's Paint Shop", x: 500, y: 500 },
  marina: { name: 'Marina', x: 300, y: 1200 },
  pier: { name: 'Pier 9', x: 2100, y: 1200 },
  plaza: { name: 'Cactus Court Plaza', x: 1200, y: 400 },
  hospital: { name: 'Solmar General Hospital', x: 400, y: 2000 },
  depot: { name: 'Canal Row Depot', x: 1200, y: 2000 },
};

// Canals in Canal Row: water bands the player can only cross on bridges.
const CANALS = [
  { x0: 800, y0: 1900, x1: 1600, y1: 1960 },
  { x0: 800, y0: 2180, x1: 1600, y1: 2240 },
];
const BRIDGES = [
  { x: 1091, half: 40, y0: 1900, y1: 1960 },
  { x: 1356, half: 40, y0: 1900, y1: 1960 },
  { x: 1091, half: 40, y0: 2180, y1: 2240 },
  { x: 1356, half: 40, y0: 2180, y1: 2240 },
];

// --- shared game state (one object, every module reads/writes it) ---
const G = {
  screen: 'title', // title | board | play | pause | wasted
  time: 0,
  clockHours: 8, // in-game clock, starts 08:00
  weather: 'clear', // clear | rain | fog
  weatherTimer: 45,
  money: 0,
  score: 0,
  carsStolen: 0,
  faresDone: 0,
  nearMisses: 0,
  coinsGot: [],
  rankIndex: 0,
  storyDone: false,
  missionIndex: 0, // next story job to play (0-based)
  mission: null, // active mission runtime state
  missionDone: [false, false, false, false, false, false, false],
  race: null, // active race runtime state
  racesWon: [],
  delivery: null,
  taxi: null,
  turf: {}, // zone id -> owner: 'player' or crew name
  turfChallenge: null,
  turfIncomeEarned: 0,
  heat: 0,
  lastCrimeAt: -99,
  player: { x: 561, y: 700, angle: 0, speed: 0, hp: 100, onFoot: true, carId: -1, sprint: false },
  cars: [], // parked/stealable cars {id, model, color, x, y, angle, health, totaled, top, accel}
  traffic: [],
  peds: [],
  police: [],
  roadblocks: [],
  heli: null,
  bullets: [],
  guards: [],
  pickups: [],
  particles: [],
  nearMissAt: -99,
  fareMarkers: [],
  raceMarkers: [],
  message: '',
  messageAt: 0,
  banner: '',
  bannerAt: 0,
  muted: false,
  camX: 400,
  camY: 400,
  shake: 0,
};
