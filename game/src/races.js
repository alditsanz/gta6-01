// Solmar Heat — races.js
// Street races: three routes, a checkpoint chain, a par time and a payout
// scaled by difficulty. Completable in any stealable car. Pure state.

import { RACES } from './config.js';

/** Fresh race state. */
export function createRaces() {
  return {
    active: null, // {race, checkpoint, timer}
    results: {}, // race id -> {best, wins}
  };
}

/** Start a race by id. Returns the active race or null. */
export function startRace(state, raceId) {
  const race = RACES.find((r) => r.id === raceId);
  if (!race || state.active) return null;
  state.active = { race, checkpoint: 0, timer: race.par };
  return state.active;
}

/**
 * Advance the active race by dt. `near` is (x, y) => boolean for the
 * current checkpoint. Returns events: [{type: 'checkpoint'|'won'|'lost', ...}]
 */
export function tickRace(state, dt, near) {
  const events = [];
  const a = state.active;
  if (!a) return events;
  a.timer -= dt;
  const cp = a.race.checkpoints[a.checkpoint];
  if (cp && near(cp.x, cp.y, 56)) {
    a.checkpoint++;
    events.push({ type: 'checkpoint', index: a.checkpoint, total: a.race.checkpoints.length });
    if (a.checkpoint >= a.race.checkpoints.length) {
      const rec = state.results[a.race.id] || { best: null, wins: 0 };
      rec.wins++;
      const time = a.race.par - a.timer;
      if (rec.best === null || time < rec.best) rec.best = time;
      state.results[a.race.id] = rec;
      events.push({ type: 'won', amount: a.race.payout, race: a.race, time });
      state.active = null;
      return events;
    }
  }
  if (a.timer <= 0) {
    events.push({ type: 'lost', race: a.race });
    state.active = null;
  }
  return events;
}

/** The next checkpoint the HUD arrow should point at, or null. */
export function nextCheckpoint(state) {
  const a = state.active;
  if (!a) return null;
  return a.race.checkpoints[a.checkpoint] || null;
}

/** Checkpoint progress as "2/6". */
export function raceProgress(state) {
  const a = state.active;
  if (!a) return '';
  return `${a.checkpoint}/${a.race.checkpoints.length}`;
}

/** The race starter nearest to (x, y), within range, or null. */
export function raceAt(x, y, range = 60) {
  let best = null;
  let bd = Infinity;
  for (const r of RACES) {
    const d = Math.hypot(r.start.x - x, r.start.y - y);
    if (d < range && d < bd) { bd = d; best = r; }
  }
  return best;
}
