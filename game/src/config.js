// SOLMAR HEAT — config.js
// Every tunable number, the city layout and the story live here.
// Nothing in this file comes from any commercial game: the city of Solmar,
// its streets, its people and its story are all invented for this game.

// Canvas the game is drawn at (the page scales it to the window).
export const VIEW_W = 1280;
export const VIEW_H = 720;

// The city is a square, WORLD x WORLD world units (1 unit = 1 px at zoom 1).
export const WORLD = 3600;
// Streets run on this grid; blocks sit between neighbouring streets.
export const STREETS = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000, 3400];
export const ROAD_HALF = 34; // half the asphalt width
export const LANE = 15; // lane offset from a street centre line

// Golden-hour palette: a sun-soaked coastal city, late afternoon.
export const PALETTE = {
  grass: '#7fae5a',
  grassDry: '#93bd68',
  sand: '#e8d29a',
  water: '#3f8fb8',
  waterDeep: '#2f739c',
  asphalt: '#4a4a52',
  asphaltEdge: '#3a3a42',
  sidewalk: '#b9b3a4',
  laneMark: '#e8d44d',
  buildingTop: ['#c9a37e', '#b98d68', '#a8b6c4', '#d8c49a', '#9fb3a8', '#c47f6e'],
  buildingSide: ['#8a6b4d', '#7d5f45', '#6f7d8c', '#94825f', '#6b7d72', '#8a5546'],
  roofDetail: '#00000022',
  parkTree: '#3e7d3a',
  parkTreeLight: '#5da24e',
  minimapBg: '#1c2733',
  minimapRoad: '#5b6b7a',
  minimapWater: '#2f739c',
  minimapPark: '#3e7d3a',
};

export const CAR_TYPES = {
  sedan:   { name: 'Solmar Sedan',   len: 46, wid: 22, accel: 420, maxSpeed: 330, grip: 2.6, colors: ['#c0392b', '#2e6fb0', '#d8d8d8', '#3a3a3a', '#7d5ba6'] },
  coupe:   { name: 'Vento Coupe',    len: 44, wid: 21, accel: 520, maxSpeed: 380, grip: 3.0, colors: ['#e8b73a', '#c0392b', '#1f8a5b', '#d8d8d8'] },
  sports:  { name: 'Falco GT',       len: 46, wid: 22, accel: 640, maxSpeed: 470, grip: 3.4, colors: ['#e84a3a', '#f2c230', '#222831', '#2e6fb0'] },
  taxi:    { name: 'City Taxi',      len: 46, wid: 22, accel: 430, maxSpeed: 340, grip: 2.6, colors: ['#f2c230'] },
  van:     { name: 'Cargo Van',      len: 54, wid: 24, accel: 340, maxSpeed: 280, grip: 2.2, colors: ['#d8d8d8', '#7d8a96', '#3a3a3a'] },
  truck:   { name: 'Haul Truck',     len: 64, wid: 26, accel: 280, maxSpeed: 250, grip: 2.0, colors: ['#8a5a2b', '#5b6b7a', '#d8d8d8'] },
  police:  { name: 'SCPD Cruiser',   len: 47, wid: 22, accel: 560, maxSpeed: 430, grip: 3.1, colors: ['#1c2733'] },
  pickup:  { name: 'Dune Pickup',    len: 50, wid: 23, accel: 460, maxSpeed: 350, grip: 2.7, colors: ['#3a7d5a', '#b0492f', '#d8d8d8'] },
};

// Named places the story and the map use. x/y are world coordinates.
export const PLACES = {
  safehouse: { x: 600,  y: 620,  label: "Rex's Safehouse" },
  motel:     { x: 2600, y: 1000, label: 'The Palms Motel' },
  bank:      { x: 1800, y: 1800, label: 'Solmar National Bank' },
  hospital:  { x: 1400, y: 2600, label: 'St. Clara Hospital' },
  docks:     { x: 3300, y: 2200, label: 'Pier 9 Docks' },
  paintshop: { x: 1000, y: 2200, label: "Lou's Paint Shop" },
  beach:     { x: 1800, y: 3500, label: 'Solmar Beach' },
  plaza:     { x: 2200, y: 1400, label: 'Marina Plaza' },
};

// The story: three missions. Each mission is a list of steps; a step is
// finished by reaching its marker, stealing a car, waiting somewhere, or
// surviving until the wanted level drops.
export const MISSIONS = [
  {
    id: 'first-wheels',
    title: '1 — First Wheels',
    intro: 'Mama Lou: "Rex, my boy. You want work in this town, you need wheels. There is a Vento parked by the plaza — take it. Then bring it to my paint shop so the law forgets its plates."',
    reward: 150,
    steps: [
      { kind: 'goto',   x: 2200, y: 1400, text: 'Go to the Vento Coupe at Marina Plaza', radius: 90 },
      { kind: 'steal',  x: 2200, y: 1400, text: 'Steal the Vento (press E beside it)', radius: 90 },
      { kind: 'drive',  x: 1000, y: 2200, text: "Drive it to Lou's Paint Shop", radius: 110 },
    ],
    outro: 'Mama Lou: "Clean plates, clean conscience. Come see me when you want real money."',
  },
  {
    id: 'the-pickup',
    title: '2 — The Pickup',
    intro: 'Mama Lou: "A friend left a package at The Palms Motel, room 7. Pick it up on foot — no car at the door, the desk man talks. Then get back here fast."',
    reward: 400,
    steps: [
      { kind: 'drive',  x: 2600, y: 1000, text: 'Drive to The Palms Motel', radius: 110 },
      { kind: 'wait',   x: 2600, y: 1000, text: 'Walk in and grab the package (stand in the circle)', radius: 70, wait: 2.5 },
      { kind: 'escape', x: 600,  y: 620,  text: 'Cops! Lose them and get back to the Safehouse', radius: 110, wantedOnStart: 2 },
    ],
    outro: 'Mama Lou: "That package was worth more than my shop. You are in the family now, Rex."',
  },
  {
    id: 'the-big-score',
    title: '3 — The Big Score',
    intro: 'Detective Kane is on to us. One last job: the National Bank vault. Grab the cash, the Harbor Boys will try to stop you — and so will every cop in Solmar. Get to Pier 9 and the boat is waiting.',
    reward: 1200,
    steps: [
      { kind: 'drive',  x: 1800, y: 1800, text: 'Get to Solmar National Bank', radius: 110 },
      { kind: 'wait',   x: 1800, y: 1800, text: 'Crack the vault — hold the circle', radius: 80, wait: 4, spawnGang: 4 },
      { kind: 'escape', x: 3300, y: 2200, text: 'Escape to Pier 9 Docks — lose the cops or outrun them', radius: 120, wantedOnStart: 3 },
    ],
    outro: 'Mama Lou: "Solmar is yours now, Rex. The boat leaves at dawn — or you stay and run this town."',
  },
];

export const GAME = {
  seed: 2026,
  playerWalk: 175,
  playerSprint: 265,
  playerRadius: 13,
  playerMaxHp: 100,
  pistolDamage: 34,
  pistolRange: 430,
  pistolAmmo: 12,
  pistolReloadSecs: 1.1,
  bulletSpeed: 950,
  punchDamage: 12,
  punchRange: 34,
  trafficCars: 26,
  parkedCars: 22,
  pedestrians: 34,
  maxWanted: 5,
  wantedDecaySecs: 26,
  bustSeconds: 1.6,
  bustFine: 200,
  cashPickupValue: 25,
  saveKey: 'solmar-heat-save-v1',
};

export const DIALOGUE = {
  stealSeen: 'A witness called it in! The cops are coming.',
  copDown: 'Officer down! Every cop in Solmar is on you now.',
  pedDown: 'That was a civilian! Wanted level up.',
  busted: 'BUSTED — Detective Kane has you. Fine paid, back to the safehouse.',
  wasted: 'WASTED — St. Clara patched you up. The city keeps moving.',
  saved: 'Progress saved.',
  lowHp: 'You are hurt — get to St. Clara Hospital (green cross on the map).',
};
