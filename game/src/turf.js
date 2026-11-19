// Solmar Heat — turf.js
// Turf wars: five named zones, each held by a rival crew. Stand in a rival
// zone, survive the hold timer while crew members come at you, and the zone
// flips to your crew. Held zones pay $5 per in-game hour each; holding all
// five pays a $500 bonus and a title. State persists in the autosave.

import { TURF_ZONES, TURF_HOLD_SECONDS, TURF_INCOME_PER_HOUR, TURF_ALL_BONUS } from './config.js';

/** Fresh turf state: every zone owned by its rival crew. */
export function createTurf() {
  return {
    owners: Object.fromEntries(TURF_ZONES.map((z) => [z.id, z.crew])),
    challenge: null, // {zoneId, timer, spawned}
    incomeEarned: 0,
    allBonusPaid: false,
  };
}

/** The zone a point sits in, or null. */
export function zoneAt(x, y) {
  return TURF_ZONES.find((z) => x >= z.x0 && x < z.x1 && y >= z.y0 && y < z.y1) || null;
}

/** How many zones the player holds. */
export function zonesHeld(state) {
  return TURF_ZONES.filter((z) => state.owners[z.id] === 'You').length;
}

/** Is every zone the player's? */
export function allZonesHeld(state) {
  return zonesHeld(state) === TURF_ZONES.length;
}

/**
 * Start challenging a rival zone. Returns the challenge or null
 * (null when the zone is already yours or a challenge is running).
 */
export function startChallenge(state, zoneId) {
  const zone = TURF_ZONES.find((z) => z.id === zoneId);
  if (!zone || state.challenge) return null;
  if (state.owners[zoneId] === 'You') return null;
  state.challenge = { zoneId, timer: TURF_HOLD_SECONDS, spawned: 0 };
  return state.challenge;
}

/**
 * Advance a challenge by dt. `inside` says whether the player is still in
 * the zone, `wasted` whether the player just died. Returns events:
 * [{type: 'rival'|'flipped'|'fled'|'lost', zone, count?}]
 */
export function tickChallenge(state, dt, inside, wasted) {
  const events = [];
  const c = state.challenge;
  if (!c) return events;
  if (wasted) {
    state.challenge = null;
    events.push({ type: 'lost', zone: TURF_ZONES.find((z) => z.id === c.zoneId) });
    return events;
  }
  if (!inside) {
    state.challenge = null;
    events.push({ type: 'fled', zone: TURF_ZONES.find((z) => z.id === c.zoneId) });
    return events;
  }
  c.timer -= dt;
  // A rival crew member shows up every ~8 seconds of the hold.
  const want = Math.floor((TURF_HOLD_SECONDS - c.timer) / 8);
  while (c.spawned < want) {
    c.spawned++;
    events.push({ type: 'rival', zone: TURF_ZONES.find((z) => z.id === c.zoneId), count: c.spawned });
  }
  if (c.timer <= 0) {
    state.owners[c.zoneId] = 'You';
    state.challenge = null;
    const zone = TURF_ZONES.find((z) => z.id === c.zoneId);
    events.push({ type: 'flipped', zone });
    if (allZonesHeld(state) && !state.allBonusPaid) {
      state.allBonusPaid = true;
      events.push({ type: 'all-held', amount: TURF_ALL_BONUS });
    }
  }
  return events;
}

/**
 * Turf income for a stretch of in-game hours. Returns the dollars earned
 * (also added to incomeEarned).
 */
export function turfIncome(state, hours) {
  const amount = zonesHeld(state) * TURF_INCOME_PER_HOUR * hours;
  state.incomeEarned += amount;
  return amount;
}

/** Serialise turf owners for the save file. */
export function turfSave(state) {
  return { owners: state.owners, incomeEarned: state.incomeEarned, allBonusPaid: state.allBonusPaid };
}

/** Restore turf owners from a save file. */
export function turfLoad(state, saved) {
  if (!saved || typeof saved !== 'object') return;
  if (saved.owners) {
    for (const z of TURF_ZONES) {
      if (typeof saved.owners[z.id] === 'string') state.owners[z.id] = saved.owners[z.id];
    }
  }
  if (typeof saved.incomeEarned === 'number') state.incomeEarned = saved.incomeEarned;
  if (saved.allBonusPaid) state.allBonusPaid = true;
}
