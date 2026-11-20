// Solmar Heat — config.js
// Every tuning constant for the city lives here so the other modules
// stay free of magic numbers. Round 12 fresh build.

export const WORLD_SIZE = 3600;
export const GRID = 9;                 // 9x9 street grid
export const BLOCK = 400;              // distance between avenues
export const ROAD_W = 92;              // road width in world units
export const SIDEWALK = 14;

export const PLAYER = {
  radius: 13,
  walkSpeed: 168,
  sprintSpeed: 252,
  health: 100,
  safehouse: { x: 420, y: 420 },
};

export const WANTED = {
  maxStars: 5,
  band: 100,                 // heat points per star
  decayDelay: 26,            // clean seconds before one star cools
  bustTime: 1.6,             // seconds a foot cop must hold to bust
  finePerStar: 40,
  fineCap: 200,
};

export const CAR_TYPES = [
  { id: 'sedan',  name: 'Solmar Sedan',  top: 305, accel: 150, grip: 3.4, len: 46, wid: 22, hp: 100, color: '#7fb2d9' },
  { id: 'coupe',  name: 'Coupe GT',      top: 385, accel: 205, grip: 3.9, len: 44, wid: 21, hp: 95,  color: '#d97f9e' },
  { id: 'sports', name: 'Falco S',       top: 470, accel: 265, grip: 4.4, len: 45, wid: 21, hp: 90,  color: '#e8b13c' },
  { id: 'taxi',   name: 'Vento Taxi',    top: 320, accel: 160, grip: 3.5, len: 47, wid: 22, hp: 105, color: '#f2c230' },
  { id: 'vento',  name: 'Vento',         top: 340, accel: 175, grip: 3.6, len: 47, wid: 22, hp: 110, color: '#c0272d' },
  { id: 'van',    name: 'Harbor Van',    top: 265, accel: 125, grip: 3.0, len: 54, wid: 25, hp: 130, color: '#b9c4c9' },
  { id: 'truck',  name: 'Dock Truck',    top: 240, accel: 105, grip: 2.7, len: 62, wid: 27, hp: 150, color: '#8a97a3' },
  { id: 'pickup', name: 'Dune Pickup',   top: 330, accel: 170, grip: 3.3, len: 50, wid: 24, hp: 120, color: '#6fae6a' },
  { id: 'muscle', name: 'Marlin Muscle', top: 430, accel: 240, grip: 3.8, len: 48, wid: 23, hp: 100, color: '#7a4fd0' },
  { id: 'compact',name: 'Pico Compact',  top: 285, accel: 145, grip: 3.6, len: 40, wid: 20, hp: 85,  color: '#4fc4b5' },
  { id: 'limo',   name: 'Regal Limo',    top: 300, accel: 135, grip: 3.1, len: 66, wid: 25, hp: 125, color: '#2e3440' },
  { id: 'police', name: 'SCPD Cruiser',  top: 445, accel: 250, grip: 4.2, len: 48, wid: 22, hp: 140, color: '#eef2f5' },
];

export const COLORS = {
  sky: '#ffd9a0', road: '#3c4148', roadEdge: '#565d66',
  sidewalk: '#cbb99b', grass: '#79b657', sand: '#eed9a4',
  water: '#3d9db8', gold: '#f5c542', red: '#e23b3b',
};

export const SAVE_KEY = 'solmar-heat-save-v1';
export const DAY_LENGTH = 300; // seconds per in-game day
