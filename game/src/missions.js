// Solmar Heat — missions.js
// The seven story jobs: the arc of the driver, Lena Voss and the crime
// boss Kane. Each job is a small state machine — reach a target, survive
// a timer, clear guards, grab the ledger — and the story completes only
// when job 7, "The Last Ledger", is done. Job 6 completes the job but
// NOT the story; only the finale grants "Solmar Legend".

import { MISSIONS, HEAT_PER_STAR } from './config.js';
import { spawnHqGuards } from './combat.js';

export function missionDef(id) {
  return MISSIONS.find((m) => m.id === id) || null;
}

// Start a job: set the wanted stars it demands, arm its timer, and for
// the finale spawn the three HQ guards. Returns false if it cannot start.
export function startMission(state, id) {
  const def = missionDef(id);
  if (!def) return false;
  if (state.mission.active) return false;
  if (state.missionsDone.includes(id)) return false;
  state.mission = {
    active: true,
    id,
    def,
    stage: def.finale ? 'reach-hq' : 'go',
    timer: def.timer || 0,
    guards: def.finale ? spawnHqGuards() : [],
    ledgerTaken: false,
    escapeTimer: 0,
  };
  // A star gained lands mid-band, never exactly on a boundary: heat set
  // to the middle of the star's band so it cannot decay a star away on
  // the very next frame.
  if (def.stars > 0) {
    state.heat = def.stars * HEAT_PER_STAR + HEAT_PER_STAR / 2;
  }
  state.message = `${def.name} — ${def.brief}`;
  return true;
}

// Distance check helper: is the player close to the job's target?
function atTarget(state, radius = 70) {
  const t = state.mission.def.target;
  return Math.hypot(state.player.x - t.x, state.player.y - t.y) < radius;
}

// Tick the active job. Returns the payout earned this frame (0 normally,
// the job's payout — plus guard drops for the finale — on completion).
export function updateMission(state, dt) {
  const m = state.mission;
  if (!m.active) return 0;
  const def = m.def;

  // A job timer running out fails the job (the finale's escape timer is
  // handled in its own stage below).
  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      failMission(state, 'Time ran out.');
      return 0;
    }
  }

  // ---- Finale: The Last Ledger, four stages.
  if (def.finale) {
    if (m.stage === 'reach-hq') {
      if (atTarget(state, 110)) {
        m.stage = 'clear-guards';
        state.message = 'Clear the 3 HQ guards, then grab the ledger!';
      }
      return 0;
    }
    if (m.stage === 'clear-guards') {
      const alive = m.guards.filter((g) => !g.dead && g.hp > 0).length;
      if (alive === 0) {
        m.stage = 'grab-ledger';
        state.message = 'Guards down — grab the ledger!';
      }
      return 0;
    }
    if (m.stage === 'grab-ledger') {
      if (Math.hypot(state.player.x - 1143, state.player.y - 1143) < 60) {
        m.ledgerTaken = true;
        m.stage = 'escape';
        m.escapeTimer = 90;
        // The 4-star manhunt starts the moment the ledger is taken.
        state.heat = 4 * HEAT_PER_STAR + HEAT_PER_STAR / 2;
        state.message = 'Ledger taken! Escape to the Marina in 90 seconds — 4 stars!';
      }
      return 0;
    }
    if (m.stage === 'escape') {
      m.escapeTimer -= dt;
      if (m.escapeTimer <= 0) {
        failMission(state, 'The manhunt caught up with you.');
        return 0;
      }
      if (Math.hypot(state.player.x - 387, state.player.y - 2151) < 80) {
        return completeMission(state, def.payout + 150); // $4,000 + $150 guard drops
      }
      return 0;
    }
    return 0;
  }

  // ---- Regular jobs: reach the target, in the right car if one is named.
  if (m.stage === 'go') {
    if (!atTarget(state)) return 0;
    if (def.needCar && !state.player.inCar) {
      state.message = 'You need a car for this job.';
      return 0;
    }
    if (def.needModel) {
      const car = state.player.car;
      if (!car || car.model !== def.needModel) {
        state.message = `This job needs a ${def.needModel}.`;
        return 0;
      }
    }
    return completeMission(state, def.payout);
  }
  return 0;
}

function completeMission(state, payout) {
  const m = state.mission;
  const def = m.def;
  state.mission = { active: false, id: 0, def: null, stage: '', timer: 0, guards: [], ledgerTaken: false, escapeTimer: 0 };
  state.missionsDone.push(def.id);
  state.stats.missions = state.missionsDone.length;
  if (def.finale) {
    state.storyComplete = true;
    state.message = `THE LAST LEDGER — story complete! +$${payout}. You are a Solmar Legend.`;
  } else {
    state.message = `${def.name} complete! +$${payout}`;
  }
  return payout;
}

function failMission(state, why) {
  const def = state.mission.def;
  state.mission = { active: false, id: 0, def: null, stage: '', timer: 0, guards: [], ledgerTaken: false, escapeTimer: 0 };
  state.message = `${def.name} failed — ${why} Try again from the board.`;
}

// The mission board lists all seven jobs with their state.
export function boardRows(state) {
  return MISSIONS.map((m) => ({
    id: m.id,
    name: m.name,
    brief: m.brief,
    payout: m.payout,
    done: state.missionsDone.includes(m.id),
    active: state.mission.active && state.mission.id === m.id,
  }));
}
