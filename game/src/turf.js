// turf.js — five turf zones owned by rival crews. Stand in a rival
// zone and a hold starts: survive the timer while the crew attacks
// and the zone flips to Rex. Held zones pay rent every game hour.

import { distTo } from './landmarks.js';

export const TURF_ZONES = [
  { id: 'z-mile',  name: 'Sunset Mile Corner', x: 700,  y: 700,  r: 190, owner: 'rival' },
  { id: 'z-strip', name: 'Neon Strip Block',   x: 2900, y: 800,  r: 190, owner: 'rival' },
  { id: 'z-market', name: 'Old Market Yard',   x: 800,  y: 2000, r: 190, owner: 'rival' },
  { id: 'z-marina', name: 'Marina Front',      x: 2400, y: 2900, r: 190, owner: 'rival' },
  { id: 'z-docks', name: 'Pier 9 Yard',        x: 3000, y: 3300, r: 200, owner: 'rival' },
];
export const HOLD_SECONDS = 20;
export const TURF_RENT = 6; // $ per held zone per game hour

export function buildTurf() {
  return TURF_ZONES.map(z => ({ ...z }));
}

export function zonesHeld(world) { return world.turf.filter(z => z.owner === 'player').length; }

export function zoneAt(world, x, y) {
  return world.turf.find(z => distTo(z, { x, y }) < z.r) || null;
}

// Starts/continues a hold. Spawning attackers is main's job — this
// module reports events: 'hold-start', 'hold-done', 'hold-lost'.
export function stepTurf(world, dt, events) {
  const p = world.player;
  const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
  const hold = world.turfHold;
  if (hold) {
    const zone = world.turf.find(z => z.id === hold.zoneId);
    if (!zone || distTo(zone, { x: px, y: py }) > zone.r || p.hp <= 0) {
      world.turfHold = null;
      events.push({ type: 'hold-lost', zone });
      return;
    }
    hold.t -= dt;
    if (hold.t <= 0) {
      zone.owner = 'player';
      world.turfHold = null;
      p.rp += 40; p.money += 150;
      events.push({ type: 'hold-done', zone });
    }
    return;
  }
  const z = zoneAt(world, px, py);
  if (z && z.owner === 'rival' && !world.mission) {
    world.turfHold = { zoneId: z.id, t: HOLD_SECONDS };
    events.push({ type: 'hold-start', zone: z });
  }
}

// Rent tick — called by main when the game clock crosses an hour.
export function turfRent(world) {
  const rent = zonesHeld(world) * TURF_RENT;
  world.player.money += rent;
  return rent;
}
