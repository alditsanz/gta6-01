// turf.js — turf wars: five named zones, rival crews, hold-to-flip.
// One job: own the zone table and the challenge state machine —
// stand in a rival zone, survive the hold while its crew attacks,
// and the zone flips to Rex, pays out, and ticks income.

import { dist } from './config.js';

export const HOLD_SECONDS = 12;      // stand your ground this long
export const ZONE_PAY = 220;         // capture payout
export const INCOME_PER_ZONE = 6;    // $ per zone per income tick
export const INCOME_TICK = 45;       // seconds between income ticks

const ZONE_DEFS = [
  { name: 'Sunset Strip End', x: 620, y: 620, r: 300, owner: 'Rivas Crew', color: '#e05555' },
  { name: 'Old Market Yards', x: 620, y: 1800, r: 300, owner: 'Dock Union', color: '#e0913d' },
  { name: 'Canal Row Locks', x: 2980, y: 1800, r: 300, owner: 'Rivas Crew', color: '#e05555' },
  { name: 'Palm Heights Rise', x: 620, y: 2980, r: 300, owner: 'Yard Kings', color: '#b45fd6' },
  { name: 'Pier 9 Backlots', x: 2980, y: 2980, r: 300, owner: 'Dock Union', color: '#e0913d' },
];

export function makeTurf() {
  return {
    zones: ZONE_DEFS.map((z) => ({ ...z })),
    active: -1,        // zone index being contested, or -1
    holdT: 0,          // seconds held in the active zone
    waveT: 0,          // time until the next defender wave
    incomeT: INCOME_TICK,
  };
}

export function zonesHeld(turf) {
  return turf.zones.filter((z) => z.owner === 'Player').length;
}

export function zoneAt(turf, x, y) {
  for (let i = 0; i < turf.zones.length; i++) {
    if (dist(x, y, turf.zones[i].x, turf.zones[i].y) < turf.zones[i].r) return i;
  }
  return -1;
}

// Advance the turf state. combat.js spawns the defender waves via
// the returned event so the two systems stay decoupled:
// returns 'wave' when a defender wave should spawn, 'captured'
// on the frame a zone flips, 'income' when income lands, else null.
export function stepTurf(world, dt) {
  const turf = world.turf;
  const p = world.player;
  let event = null;

  // Income from held zones.
  turf.incomeT -= dt;
  if (turf.incomeT <= 0) {
    turf.incomeT = INCOME_TICK;
    const held = zonesHeld(turf);
    if (held > 0) { p.money += held * INCOME_PER_ZONE; event = 'income'; }
  }

  const zi = zoneAt(turf, p.x, p.y);
  if (turf.active === -1) {
    // Start a challenge by standing in a rival zone on foot.
    if (zi >= 0 && turf.zones[zi].owner !== 'Player' && !p.car) {
      turf.active = zi;
      turf.holdT = 0;
      turf.waveT = 0;
      event = 'wave';
    }
  } else {
    const zone = turf.zones[turf.active];
    if (zi !== turf.active || p.hp <= 0) {
      // Fled or fell: the zone keeps its owner, progress decays.
      turf.holdT = Math.max(0, turf.holdT - dt * 2);
      if (turf.holdT === 0) turf.active = -1;
    } else {
      turf.holdT += dt;
      turf.waveT -= dt;
      if (turf.waveT <= 0) { turf.waveT = 4.5; event = 'wave'; }
      if (turf.holdT >= HOLD_SECONDS) {
        zone.owner = 'Player';
        zone.color = '#59c2e8';
        p.money += ZONE_PAY;
        p.score += 300;
        turf.active = -1;
        turf.holdT = 0;
        if (zonesHeld(turf) === turf.zones.length && p.rank !== 'Solmar Legend') {
          p.rank = 'King of the Mile';
        }
        event = 'captured';
      }
    }
  }
  return event;
}
