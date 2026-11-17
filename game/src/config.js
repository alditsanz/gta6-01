// config.js — every tunable number for Solmar Heat in one place.
// The city, the cars, the missions, the wanted system and the feel of the
// controls are all defined here; the other modules read from this file and
// never hard-code a tuning value of their own.

// --- The city ---------------------------------------------------------------
export const CITY = {
  blocks: 9, // 9 x 9 blocks of buildings
  pitch: 280, // distance between street centrelines, in world pixels
  road: 76, // street width, in world pixels
  // World size is blocks * pitch (2520). Streets run along x = k * pitch and
  // y = k * pitch for k = 0..blocks; block (i, j) sits between them.
  get size() { return this.blocks * this.pitch; },
  get roadHalf() { return this.road / 2; },
  get block() { return this.pitch - this.road; },
};

// Sun-soaked coastal palette: warm sand, terracotta roofs, teal sea.
export const PALETTE = {
  grass: '#8fae5f',
  sand: '#e8d29a',
  sea: '#2e7f9e',
  seaDeep: '#1f5f7d',
  road: '#3a3a40',
  roadEdge: '#565660',
  sidewalk: '#b9b3a4',
  laneDash: '#e8e4d2',
  crosswalk: '#d8d4c4',
  buildingRoof: ['#c96f4a', '#d9a05b', '#b5533c', '#7d9b76', '#5b7d8c', '#c98a5b'],
  buildingWall: ['#e8dcc8', '#f0e6d2', '#dcc7a8', '#e2d3b8'],
  parkGreen: '#6f9e4e',
  tree: ['#3f7a34', '#4d8a3a', '#5da244'],
};

// --- Vehicles: 8 stealable cars ---------------------------------------------
// speed: top speed px/s. accel: px/s^2. turn: radians/s at full lock.
// grip: how much speed is kept through a turn. length/width in px.
export const VEHICLES = [
  { id: 'vento', name: 'Vento', kind: 'sedan', speed: 430, accel: 300, turn: 2.6, grip: 0.86, len: 52, wid: 26, color: '#c23b2e', price: 1200 },
  { id: 'sirocco', name: 'Sirocco', kind: 'coupe', speed: 470, accel: 340, turn: 2.9, grip: 0.84, len: 50, wid: 25, color: '#e8b13c', price: 1800 },
  { id: 'falco', name: 'Falco GT', kind: 'sports', speed: 560, accel: 420, turn: 3.2, grip: 0.8, len: 50, wid: 25, color: '#2e6fc2', price: 4200 },
  { id: 'cab', name: 'Solmar Cab', kind: 'taxi', speed: 420, accel: 290, turn: 2.7, grip: 0.86, len: 52, wid: 26, color: '#f2c230', price: 900 },
  { id: 'mule', name: 'Mule', kind: 'van', speed: 360, accel: 230, turn: 2.1, grip: 0.9, len: 60, wid: 28, color: '#8a8f96', price: 1100 },
  { id: 'hauler', name: 'Hauler', kind: 'truck', speed: 330, accel: 200, turn: 1.9, grip: 0.92, len: 72, wid: 30, color: '#5b7d3c', price: 1500 },
  { id: 'bison', name: 'Bison', kind: 'pickup', speed: 440, accel: 310, turn: 2.5, grip: 0.85, len: 56, wid: 27, color: '#7a4a8c', price: 1600 },
  { id: 'cruiser', name: 'Interceptor', kind: 'police', speed: 500, accel: 380, turn: 3.0, grip: 0.82, len: 54, wid: 26, color: '#20242e', price: 0 },
];

// --- People -----------------------------------------------------------------
export const PLAYER = {
  walkSpeed: 210, // px/s on foot
  runSpeed: 300, // holding Shift
  radius: 13,
  maxHp: 100,
  punchDamage: 18,
  punchRange: 34,
  punchCooldown: 0.45,
};

export const PISTOL = {
  damage: 34,
  range: 460,
  magSize: 12,
  reloadTime: 1.1,
  fireCooldown: 0.22,
  spread: 0.035,
};

// --- Wanted level -----------------------------------------------------------
export const WANTED = {
  maxStars: 5,
  decayDelay: 9, // seconds of no crime before heat starts to fall
  decayPerSecond: 0.12, // stars per second once decaying
  finePerStar: 150, // cash lost when busted
  // Police pressure per star: how many cruisers and foot cops are out.
  cruisersPerStar: [0, 1, 2, 3, 4, 5],
  copsPerStar: [0, 1, 2, 3, 4, 6],
  bustRadius: 20, // a foot cop this close, on foot, busts you
  bustTime: 0.7, // seconds inside bustRadius before the bust lands
};

// --- Missions ---------------------------------------------------------------
// Each mission is a list of stages. A stage has a kind (go / steal / deliver /
// hold / escape / talk), a target place or vehicle, and the line Mama Lou or
// the crew says when it starts.
export const MISSIONS = [
  {
    id: 'lou-errand',
    name: "Lou's Errand",
    reward: 800,
    intro: "Mama Lou: Rex, baby, you're back. I need that red Vento parked by the docks. Bring it to my paint shop — no scratches, no cops.",
    stages: [
      { kind: 'steal', label: 'Steal the red Vento at the docks', place: 'docks' },
      { kind: 'deliver', label: "Deliver the Vento to Lou's Paint Shop", place: 'paintshop' },
    ],
  },
  {
    id: 'palms-pickup',
    name: 'The Palms Pickup',
    reward: 1400,
    intro: 'Mama Lou: A package is waiting at The Palms Motel, room 7. Grab it and come home. And Rex — the Harbor Boys are watching that motel.',
    stages: [
      { kind: 'go', label: 'Reach The Palms Motel', place: 'motel' },
      { kind: 'pickup', label: 'Pick up the package (hold E)', place: 'motel' },
      { kind: 'escape', label: 'Escape the ambush — lose the heat, reach the paint shop', place: 'paintshop' },
    ],
  },
  {
    id: 'harbor-job',
    name: 'The Harbor Job',
    reward: 3500,
    intro: 'Mama Lou: The National Bank vault. We crack it tonight, we walk out rich, we never look back. The Harbor Boys will not let that happen quietly.',
    stages: [
      { kind: 'go', label: 'Reach the National Bank', place: 'bank' },
      { kind: 'crack', label: 'Crack the vault (hold E by the vault door)', place: 'bank' },
      { kind: 'escape', label: 'Escape the manhunt — reach Pier 9', place: 'pier' },
    ],
  },
];

// Named places on the map: block coordinates (i, j) in the 9x9 grid.
export const PLACES = {
  paintshop: { block: [1, 1], name: "Lou's Paint Shop" },
  motel: { block: [7, 2], name: 'The Palms Motel' },
  bank: { block: [4, 4], name: 'National Bank' },
  hospital: { block: [2, 7], name: 'Solmar General' },
  park: { block: [4, 1], name: 'Marlowe Park' },
  docks: { block: [8, 6], name: 'Solmar Docks' },
  pier: { block: [8, 8], name: 'Pier 9' },
  beach: { block: [8, 3], name: 'Solmar Beach' },
  safehouse: { block: [1, 6], name: "Rex's Safehouse" },
};

// --- Feel -------------------------------------------------------------------
export const FEEL = {
  cameraLerp: 5.5, // camera follow smoothing
  zoom: 1.0,
  skidMarkLife: 4,
  muzzleLife: 0.08,
  dayLength: 240, // seconds for a full in-game day cycle
  startHour: 9.5, // 09:30 in the morning sun
};

export const SAVE_KEY = 'solmar-heat-save-v1';
