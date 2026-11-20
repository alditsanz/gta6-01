// collectibles.js — the 10 hidden Solmar coins and world pickups.
// One job: place the coins, watch for the player walking/driving over
// coins and pickups, and pay out their effects.

import { dist } from './config.js';

// Fixed hiding spots, spread across all nine districts.
export const COIN_SPOTS = [
  { x: 620, y: 620 }, { x: 1800, y: 660 }, { x: 3020, y: 500 },
  { x: 500, y: 1800 }, { x: 2220, y: 1420 }, { x: 3260, y: 1900 },
  { x: 1020, y: 2380 }, { x: 1800, y: 2980 }, { x: 2620, y: 2620 },
  { x: 3380, y: 3380 },
];

export const COIN_VALUE = 75;

export function makeCoins() {
  return COIN_SPOTS.map((s) => ({ x: s.x, y: s.y, taken: false }));
}

// Pickups sit near landmarks: health at the hospital, armour at HQ,
// ammo at the plaza and the pier.
export function makePickups() {
  return [
    { kind: 'health', x: 700, y: 3020, taken: false, respawn: 0 },
    { kind: 'armor', x: 1880, y: 500, taken: false, respawn: 0 },
    { kind: 'ammo', x: 1100, y: 1100, taken: false, respawn: 0 },
    { kind: 'ammo', x: 3180, y: 3180, taken: false, respawn: 0 },
    { kind: 'health', x: 3340, y: 1100, taken: false, respawn: 0 },
  ];
}

export function coinsTaken(world) {
  return world.coins.filter((c) => c.taken).length;
}

// Per-frame check. Returns a short event string when something was
// picked up ('coin' | 'health' | 'armor' | 'ammo') or null.
export function stepCollectibles(world, dt) {
  const p = world.player;
  let event = null;
  for (const c of world.coins) {
    if (!c.taken && dist(p.x, p.y, c.x, c.y) < 26) {
      c.taken = true;
      p.money += COIN_VALUE;
      p.score += 50;
      event = 'coin';
    }
  }
  for (const pk of world.pickups) {
    if (pk.taken) {
      pk.respawn -= dt;
      if (pk.respawn <= 0) pk.taken = false;
      continue;
    }
    if (dist(p.x, p.y, pk.x, pk.y) < 26) {
      if (pk.kind === 'health' && p.hp < 100) { p.hp = Math.min(100, p.hp + 35); pk.taken = true; pk.respawn = 45; event = 'health'; }
      if (pk.kind === 'armor' && p.armor < 100) { p.armor = Math.min(100, p.armor + 50); pk.taken = true; pk.respawn = 45; event = 'armor'; }
      if (pk.kind === 'ammo') { p.reserve += 36; pk.taken = true; pk.respawn = 45; event = 'ammo'; }
    }
  }
  return event;
}
