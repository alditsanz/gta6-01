// turf.js — turf wars: territory control over named zones.
// Stand in a rival zone and hold it against waves of crew for a short
// timer to flip it to your crew. Held zones pay income every in-game
// hour; holding them all grants a bonus title. State autosaves.

import { dist } from './config.js';

export const TURF_ZONES = [
  { id: 'turf-sunset', name: 'Sunset Mile Turf', x: 260, y: 390, r: 210, owner: 'Vipers' },
  { id: 'turf-neon', name: 'Neon Strip Turf', x: 1180, y: 260, r: 210, owner: 'Vipers' },
  { id: 'turf-cactus', name: 'Cactus Court Turf', x: 780, y: 780, r: 200, owner: 'Jackals' },
  { id: 'turf-downtown', name: 'Downtown Turf', x: 1180, y: 1300, r: 220, owner: 'Jackals' },
  { id: 'turf-harbor', name: 'Harbor Turf', x: 780, y: 1960, r: 210, owner: 'Cobras' },
  { id: 'turf-canal', name: 'Canal Row Turf', x: 2000, y: 2000, r: 220, owner: 'Cobras' },
];

export const PLAYER_CREW = 'Solmar Crew';
export const HOLD_TIME = 20;
export const INCOME_PER_ZONE = 6; // dollars per in-game hour per zone

export class TurfManager {
  constructor() {
    this.zones = TURF_ZONES.map((z) => ({ ...z }));
    this.challenge = null; // {zone, timeLeft, waves}
    this.incomeAcc = 0;
  }

  zoneAt(x, y) {
    for (const z of this.zones) if (dist(x, y, z.x, z.y) <= z.r) return z;
    return null;
  }

  heldCount() { return this.zones.filter((z) => z.owner === PLAYER_CREW).length; }
  allHeld() { return this.heldCount() === this.zones.length; }

  startChallenge(px, py) {
    const zone = this.zoneAt(px, py);
    if (!zone || zone.owner === PLAYER_CREW || this.challenge) return null;
    this.challenge = { zone, timeLeft: HOLD_TIME, waves: 0 };
    return this.challenge;
  }

  // dt seconds held inside the zone; fled=true when the player leaves.
  update(dt, px, py, alive) {
    if (!this.challenge) return null;
    const zone = this.challenge.zone;
    const inside = dist(px, py, zone.x, zone.y) <= zone.r;
    if (!alive) { this.challenge = null; return { type: 'turf-lost', zone, reason: 'wasted' }; }
    if (!inside) { this.challenge = null; return { type: 'turf-lost', zone, reason: 'fled' }; }
    this.challenge.timeLeft -= dt;
    this.challenge.waves = Math.floor((HOLD_TIME - this.challenge.timeLeft) / 7);
    if (this.challenge.timeLeft <= 0) {
      zone.owner = PLAYER_CREW;
      this.challenge = null;
      return { type: 'turf-won', zone, allHeld: this.allHeld() };
    }
    return null;
  }

  // Income tick: call once per in-game hour.
  incomeForHour() {
    const amount = this.heldCount() * INCOME_PER_ZONE;
    this.incomeAcc += amount;
    return amount;
  }

  serialize() { return { owners: this.zones.map((z) => z.owner), incomeAcc: this.incomeAcc }; }

  restore(data) {
    if (!data || !Array.isArray(data.owners)) return;
    this.zones.forEach((z, i) => { if (data.owners[i]) z.owner = data.owners[i]; });
    this.incomeAcc = data.incomeAcc || 0;
  }
}
