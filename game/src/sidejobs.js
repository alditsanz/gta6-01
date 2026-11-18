// Solmar Heat — sidejobs.js
// One job: everything the player can do outside the story — taxi fares,
// street races, package deliveries, turf wars, near-miss bonuses and the
// paint-shop repaint. Each system is pure data + rules; main.js drives it.

import { PRICES, ROADS } from './config.js';
import { randPick, randRange } from './random.js';

// ---------------------------------------------------------------- taxi fares

export const FARE_PAY = PRICES.fareBase;

export function farePayout(distanceTravelled) {
  // A fare pays around $310, a little more for a long ride.
  return FARE_PAY + Math.min(90, Math.floor(distanceTravelled / 40));
}

export function makeFare(rng, playerX, playerY) {
  const pickups = [
    { x: 304, y: 304 }, { x: 1096, y: 568 }, { x: 1888, y: 304 },
    { x: 568, y: 1360 }, { x: 1360, y: 1096 }, { x: 2152, y: 1624 },
    { x: 304, y: 2152 }, { x: 1624, y: 1888 },
  ];
  const from = randPick(rng, pickups);
  let to = randPick(rng, pickups);
  let guard = 0;
  while (Math.abs(to.x - from.x) + Math.abs(to.y - from.y) < 800 && guard++ < 20) {
    to = randPick(rng, pickups);
  }
  return { fromX: from.x, fromY: from.y, toX: to.x, toY: to.y, pickedUp: false, timer: 150 };
}

// ---------------------------------------------------------------- street races

export const RACES = [
  {
    id: 'race-sunset', name: 'Sunset Sprint', district: 'Sunset Mile',
    difficulty: 'easy', par: 75, payout: 150,
    start: { x: 304, y: 304 },
    checkpoints: [
      { x: 1096, y: 304 }, { x: 1096, y: 1096 },
      { x: 304, y: 1096 }, { x: 304, y: 568 },
    ],
  },
  {
    id: 'race-neon', name: 'Neon Rush', district: 'Neon Strip',
    difficulty: 'medium', par: 110, payout: 300,
    start: { x: 1888, y: 304 },
    checkpoints: [
      { x: 1888, y: 1096 }, { x: 1096, y: 1096 },
      { x: 1096, y: 1888 }, { x: 1888, y: 1888 }, { x: 1888, y: 568 },
    ],
  },
  {
    id: 'race-canal', name: 'Canal Grand Prix', district: 'Canal Row',
    difficulty: 'hard', par: 150, payout: 600,
    start: { x: 1888, y: 1096 },
    checkpoints: [
      { x: 2152, y: 1096 }, { x: 2152, y: 1888 },
      { x: 1096, y: 1888 }, { x: 1096, y: 304 },
      { x: 304, y: 304 }, { x: 1888, y: 304 },
    ],
  },
];

export function raceById(id) {
  return RACES.find((r) => r.id === id) || null;
}

export function raceNearStart(x, y) {
  for (const r of RACES) {
    const dx = r.start.x - x;
    const dy = r.start.y - y;
    if (dx * dx + dy * dy <= 70 * 70) return r;
  }
  return null;
}

export function raceCheckpointReached(race, index, x, y) {
  const cp = race.checkpoints[index];
  if (!cp) return false;
  const dx = cp.x - x;
  const dy = cp.y - y;
  return dx * dx + dy * dy <= 60 * 60;
}

// ---------------------------------------------------------------- deliveries

export function makeDelivery(rng) {
  return {
    pickup: { x: 1096, y: 1360 },
    dropoff: { x: 2152, y: 2152 },
    pickedUp: false,
    timer: 120,
    payout: 350,
  };
}

// Being spotted by police mid-delivery raises heat faster than usual.
export function deliveryHeatGain(base) {
  return base * 2;
}

// ---------------------------------------------------------------- turf wars

export const TURF_ZONES = [
  { name: 'Sunset Mile',   x0: 0,    y0: 0,    x1: 813,  y1: 813,  owner: 'Vipers' },
  { name: 'Neon Strip',    x0: 1626, y0: 0,    x1: 2440, y1: 813,  owner: 'Crows' },
  { name: 'Canal Row',     x0: 1626, y0: 813,  x1: 2440, y1: 1626, owner: 'Kings' },
  { name: 'Old Foundry',   x0: 813,  y0: 813,  x1: 1626, y1: 1220, owner: 'Vipers' },
  { name: 'Harbor Lights', x0: 813,  y0: 1220, x1: 1626, y1: 1626, owner: 'Crows' },
];

export const PLAYER_CREW = 'Solmar Heat';
export const TURF_CHALLENGE_SECONDS = 30;
export const TURF_RIVALS_PER_CHALLENGE = 4;

export function turfZoneAt(x, y) {
  for (const z of TURF_ZONES) {
    if (x >= z.x0 && x < z.x1 && y >= z.y0 && y < z.y1) return z;
  }
  return null;
}

export function turfHeldCount(owners) {
  let n = 0;
  for (const z of TURF_ZONES) if (owners[z.name] === PLAYER_CREW) n++;
  return n;
}

export function turfIncomePerHour(owners) {
  return turfHeldCount(owners) * PRICES.turfIncomePerHour;
}

export function allTurfHeld(owners) {
  return turfHeldCount(owners) === TURF_ZONES.length;
}

export function defaultTurfOwners() {
  const out = {};
  for (const z of TURF_ZONES) out[z.name] = z.owner;
  return out;
}

// ---------------------------------------------------------------- near-miss

export const NEAR_MISS_MIN_SPEED = 150;
export const NEAR_MISS_RADIUS = 46;
export const NEAR_MISS_COOLDOWN = 1.5;

export function nearMissEligible(speed, dist, cooldownLeft) {
  return speed > NEAR_MISS_MIN_SPEED && dist < NEAR_MISS_RADIUS && cooldownLeft <= 0;
}

// ---------------------------------------------------------------- paint shop repaint (round 8)

// Repainting at Lou's costs $50 a coat and cycles the car's colour.
// The colour persists in the save, so the player's car stays theirs.
export const PAINT_COLOURS = [
  { name: 'Heat Red', color: '#d43d2a' },
  { name: 'Midnight', color: '#22242e' },
  { name: 'Ocean', color: '#3d7bd4' },
  { name: 'Lime Rush', color: '#2fae6e' },
  { name: 'Taxi Gold', color: '#f2c230' },
  { name: 'Neon Pink', color: '#e26fd5' },
  { name: 'Ghost White', color: '#e8e4d8' },
  { name: 'Royal Purple', color: '#5a3d8a' },
];

export function nextPaintIndex(current) {
  return (current + 1) % PAINT_COLOURS.length;
}

export function paintByIndex(index) {
  return PAINT_COLOURS[((index % PAINT_COLOURS.length) + PAINT_COLOURS.length) % PAINT_COLOURS.length];
}

export function canAffordRepaint(money) {
  return money >= PRICES.paintRepaint;
}
