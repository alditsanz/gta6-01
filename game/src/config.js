// config.js — shared constants: city geometry, districts, car types.
// Solmar is a 3600x3600 coastal city on a 9x9 block grid. Roads sit
// between blocks; BLOCK is the block pitch and ROAD_W the road width.

export const WORLD_SIZE = 3600;
export const GRID = 9;
export const BLOCK = 400;
export const ROAD_W = 92;
export const VIEW_W = 1280;
export const VIEW_H = 720;

export const DISTRICTS = [
  'Sunset Mile', 'Cactus Court', 'Neon Strip',
  'Old Market', 'Downtown Solmar', 'Canal Row',
  'Palm Heights', 'The Marina', 'Pier 9 Docks',
];

export const CAR_TYPES = [
  { key: 'sedan', name: 'Solmar Sedan', len: 44, wid: 20, speed: 150, color: '#7fa6c9' },
  { key: 'coupe', name: 'Coupe GT', len: 42, wid: 19, speed: 175, color: '#c95f4e' },
  { key: 'falco', name: 'Falco S', len: 46, wid: 20, speed: 235, color: '#e8b53a' },
  { key: 'taxi', name: 'Vento Taxi', len: 44, wid: 20, speed: 155, color: '#f2c230' },
  { key: 'vento', name: 'Vento', len: 44, wid: 20, speed: 160, color: '#d43a2e' },
  { key: 'van', name: 'Harbor Van', len: 52, wid: 22, speed: 130, color: '#b9c0c7' },
  { key: 'truck', name: 'Dock Truck', len: 60, wid: 24, speed: 115, color: '#8a97a5' },
  { key: 'pickup', name: 'Dune Pickup', len: 50, wid: 22, speed: 145, color: '#6f9e5a' },
  { key: 'muscle', name: 'Marlin Muscle', len: 48, wid: 21, speed: 205, color: '#7048a8' },
  { key: 'compact', name: 'Pico Compact', len: 36, wid: 17, speed: 135, color: '#58b8a6' },
  { key: 'limo', name: 'Regal Limo', len: 64, wid: 22, speed: 140, color: '#2e3440' },
  { key: 'cruiser', name: 'SCPD Cruiser', len: 46, wid: 20, speed: 195, color: '#eef1f4' },
];

export const RANKS = [
  'Nobody', 'Runner', 'Wheelman', 'Hustler',
  'Made Driver', 'Street Royalty', 'King of the Mile', 'Solmar Legend',
];

export const SKIN_TONES = ['#f2c79b', '#d99e63', '#a96f3f', '#7a4a28'];
export const PED_COLORS = ['#c95f7a', '#4e7fc9', '#5aa86a', '#c9a44e', '#7a5fc9', '#4ec9b8', '#d97b3f', '#8892a0'];
