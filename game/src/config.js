// Solmar Heat — tuning constants.
// One home for every shared number so the rest of the game can stay
// declarative. The city is a 3600-unit square; avenues sit on a 400
// grid and every block keeps a 66-unit building inset.

export const WORLD_SIZE = 3600;
export const BLOCK_PITCH = 400;
export const STREET_HALF = 62;
export const BLOCK_INSET = 66;

export const VIEW_W = 1280;
export const VIEW_H = 720;

export const PLAYER_FOOT_SPEED = 148;
export const PLAYER_SPRINT_SPEED = 218;
export const PLAYER_RADIUS = 11;
export const PLAYER_MAX_HP = 100;
export const PLAYER_MAX_ARMOUR = 100;

// Heat runs 0..599 and maps to five wanted stars in bands of 100.
export const HEAT_MAX = 599;
export const HEAT_DECAY_PER_SEC = 3.1;
export const SIGHT_RANGE = 430;

export const TRAFFIC_COUNT = 42;
export const PARKED_COUNT = 34;
export const PED_COUNT = 72;

export const COIN_COUNT = 20;
export const STASH_COUNT = 12;
export const JUMP_COUNT = 5;

export const SAVE_KEY = 'solmar-heat-save-v16';
export const DAY_LENGTH_SEC = 240;
export const KMH_PER_UNIT = 0.62;

// The twelve rides of Solmar Bay. w is the nose-to-tail length, h the
// width across the doors; topSpeed/accel/grip drive the arcade physics.
export const CAR_TYPES = [
  { id: 'sedan', name: 'Meridian Sedan', w: 46, h: 22, topSpeed: 300, accel: 210, grip: 3.4, color: '#b8bec9' },
  { id: 'coupe', name: 'Vela Coupe', w: 45, h: 21, topSpeed: 340, accel: 250, grip: 3.8, color: '#7fb2d9' },
  { id: 'falco', name: 'Falco S', w: 47, h: 21, topSpeed: 430, accel: 330, grip: 4.4, color: '#e8b13c' },
  { id: 'taxi', name: 'Vento Taxi', w: 46, h: 22, topSpeed: 295, accel: 205, grip: 3.3, color: '#f2c230' },
  { id: 'vento', name: 'Vento', w: 46, h: 22, topSpeed: 305, accel: 215, grip: 3.4, color: '#c33d2e' },
  { id: 'van', name: 'Harbor Van', w: 52, h: 24, topSpeed: 265, accel: 175, grip: 2.9, color: '#d8d5cc' },
  { id: 'truck', name: 'Dock Truck', w: 58, h: 25, topSpeed: 245, accel: 155, grip: 2.7, color: '#8a97a5' },
  { id: 'pickup', name: 'Dune Pickup', w: 50, h: 23, topSpeed: 315, accel: 230, grip: 3.1, color: '#a5713f' },
  { id: 'muscle', name: 'Marlin Muscle', w: 48, h: 22, topSpeed: 385, accel: 300, grip: 3.6, color: '#5d3a8c' },
  { id: 'compact', name: 'Pico Compact', w: 40, h: 20, topSpeed: 275, accel: 225, grip: 3.9, color: '#79c98f' },
  { id: 'limo', name: 'Regal Limo', w: 60, h: 23, topSpeed: 320, accel: 200, grip: 3.2, color: '#2e3138' },
  { id: 'cruiser', name: 'SCPD Cruiser', w: 47, h: 22, topSpeed: 395, accel: 305, grip: 4.1, color: '#eef1f4' },
];

// Street reputation ladder, cheapest name first.
export const RANKS = [
  { rp: 0, name: 'Nobody' },
  { rp: 120, name: 'Wheelman' },
  { rp: 320, name: 'Street Name' },
  { rp: 650, name: 'King of the Mile' },
  { rp: 1100, name: 'Strip Royalty' },
  { rp: 1700, name: 'Street Royalty' },
  { rp: 2600, name: 'Solmar Legend' },
];

export function rankFor(rp) {
  let held = RANKS[0];
  for (const entry of RANKS) {
    if (rp >= entry.rp) held = entry;
  }
  return held;
}

export function nextRank(rp) {
  for (const entry of RANKS) {
    if (rp < entry.rp) return entry;
  }
  return null;
}
