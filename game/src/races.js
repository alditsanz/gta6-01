// races.js — three street races, one per difficulty.
// A checkered starter marker, a chain of checkpoints across the city,
// a par time, and a cash payout scaled by difficulty. Fail and retry.

import { dist, ROAD_CENTERS } from './config.js';

function at(col, row) { return { x: ROAD_CENTERS[col], y: ROAD_CENTERS[row] }; }

export const RACES = [
  {
    id: 'race-easy', name: 'Sunset Sprint', difficulty: 'easy', pay: 150, par: 75,
    start: at(0, 2),
    checkpoints: [at(2, 2), at(4, 2), at(4, 0), at(6, 0)],
  },
  {
    id: 'race-medium', name: 'Canal Circuit', difficulty: 'medium', pay: 300, par: 115,
    start: at(6, 6),
    checkpoints: [at(8, 6), at(8, 8), at(6, 8), at(5, 6), at(6, 4)],
  },
  {
    id: 'race-hard', name: 'Solmar Grand Run', difficulty: 'hard', pay: 600, par: 165,
    start: at(0, 8),
    checkpoints: [at(3, 8), at(3, 5), at(6, 5), at(6, 2), at(8, 2), at(8, 0)],
  },
];

export function raceById(id) { return RACES.find((r) => r.id === id) || null; }

export class RaceManager {
  constructor() {
    this.active = null;
    this.index = 0;
    this.timeLeft = 0;
    this.elapsed = 0;
    this.wins = {};
  }

  start(race) {
    this.active = race;
    this.index = 0;
    this.timeLeft = race.par;
    this.elapsed = 0;
    return race;
  }

  currentCheckpoint() {
    if (!this.active) return null;
    return this.active.checkpoints[this.index] || null;
  }

  update(dt, px, py) {
    if (!this.active) return null;
    this.timeLeft -= dt; this.elapsed += dt;
    if (this.timeLeft <= 0) {
      const race = this.active; this.active = null;
      return { type: 'race-failed', race };
    }
    const cp = this.currentCheckpoint();
    if (cp && dist(px, py, cp.x, cp.y) <= 72) {
      this.index += 1;
      if (this.index >= this.active.checkpoints.length) {
        const race = this.active; this.active = null;
        this.wins[race.id] = (this.wins[race.id] || 0) + 1;
        return { type: 'race-complete', race, pay: race.pay, elapsed: this.elapsed };
      }
      return { type: 'checkpoint', index: this.index, total: this.active.checkpoints.length };
    }
    return null;
  }

  cancel() { this.active = null; }
}
