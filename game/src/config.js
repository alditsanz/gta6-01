// config.js — Solmar Heat: every shared constant lives here.
// World geometry, road grid, districts, ranks, car models and tuning.

export const WORLD_SIZE = 2440;
export const GRID_ROADS = 9;
export const ROAD_WIDTH = 92;
export const ROAD_CENTERS = [140, 400, 660, 920, 1180, 1440, 1700, 1960, 2220];
export const BLOCK_SIZE = 260;

export const CANVAS_W = 1280;
export const CANVAS_H = 720;

export const PLAYER_SPEED = 168;
export const PLAYER_SPRINT = 248;
export const PLAYER_RADIUS = 13;
export const PLAYER_MAX_HEALTH = 100;

// 600, not 500: the 5-star band is 500-599, so a fresh 5th star can
// land mid-band at 550 and decay cannot remove it on the next frame.
export const HEAT_MAX = 600;
export const HEAT_PER_STAR = 100;
// A fresh star must land mid-band so decay cannot remove it next frame.
export const HEAT_MID_BAND = 50;

export const COIN_VALUE = 75;
export const COIN_TOTAL = 10;
export const NEAR_MISS_VALUE = 15;
export const NEAR_MISS_MIN_SPEED = 150;
export const NEAR_MISS_COOLDOWN = 1.5;
export const WALL_HIT_DAMAGE = 8;

export const SAVE_KEY = 'solmar-heat-save-v1';

// Districts are rectangles over the grid; the first match wins, so the
// more specific zones (Canal Row, Marina, Pier 9) come first.
export const DISTRICTS = [
  { name: 'Canal Row', x: 1560, y: 1560, w: 880, h: 880 },
  { name: 'Marina', x: 1560, y: 1040, w: 880, h: 520 },
  { name: 'Pier 9', x: 1900, y: 0, w: 540, h: 520 },
  { name: 'Neon Strip', x: 520, y: 0, w: 1040, h: 520 },
  { name: 'Sunset Mile', x: 0, y: 0, w: 520, h: 780 },
  { name: 'Cactus Court', x: 520, y: 520, w: 520, h: 520 },
  { name: 'Palm Heights', x: 1040, y: 520, w: 520, h: 520 },
  { name: 'Downtown Solmar', x: 520, y: 1040, w: 1040, h: 520 },
  { name: 'Old Market', x: 0, y: 780, w: 520, h: 780 },
  { name: 'Harbor View', x: 0, y: 1560, w: 1560, h: 880 },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
  }
  return 'Downtown Solmar';
}

export const RANKS = [
  'Lookout',
  'Runner',
  'Wheelman',
  'Hustler',
  'King of the Mile',
  'Street Royalty',
  'Solmar Legend',
];

export function rankFor(score, storyComplete) {
  if (storyComplete) return RANKS[6];
  if (score >= 6000) return RANKS[5];
  if (score >= 4200) return RANKS[4];
  if (score >= 2600) return RANKS[3];
  if (score >= 1400) return RANKS[2];
  if (score >= 500) return RANKS[1];
  return RANKS[0];
}

// Twelve stealable models. speed is top speed in units/second.
export const CAR_MODELS = [
  { model: 'Falco', color: '#e8452c', speed: 342, accel: 210, grip: 0.92 },
  { model: 'Vento Taxi', color: '#f2b01e', speed: 292, accel: 175, grip: 0.9 },
  { model: 'Marlin', color: '#2c7be8', speed: 318, accel: 195, grip: 0.91 },
  { model: 'Dune Bug', color: '#7ac74f', speed: 268, accel: 185, grip: 0.86 },
  { model: 'Corsair', color: '#8e44ad', speed: 356, accel: 225, grip: 0.93 },
  { model: 'Pickup Ox', color: '#95a5a6', speed: 258, accel: 160, grip: 0.85 },
  { model: 'Sol Coupe', color: '#ecf0f1', speed: 332, accel: 205, grip: 0.92 },
  { model: 'Nightline', color: '#2c3e50', speed: 348, accel: 218, grip: 0.94 },
  { model: 'Canal Skiff', color: '#16a085', speed: 302, accel: 188, grip: 0.9 },
  { model: 'Ember GT', color: '#d35400', speed: 368, accel: 232, grip: 0.93 },
  { model: 'Harbor Van', color: '#bdc3c7', speed: 248, accel: 150, grip: 0.84 },
  { model: 'Viperette', color: '#c0392b', speed: 378, accel: 240, grip: 0.95 },
];

export const POLICE_SPEED = 322;
export const HELI_SPEED = 398;
export const TRAFFIC_BASE_COUNT = 14;
export const PEDESTRIAN_COUNT = 26;

export function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
export function dist(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); }
export function starsForHeat(heat) { return Math.max(0, Math.min(5, Math.floor(heat / HEAT_PER_STAR))); }
