// Solmar Heat — missions.js
// The 7-job story arc about the player, Lena Voss and the crime boss Kane.
// A small state machine per job: start → objectives → timer → payout.
// Job 7 is the finale: clear 3 guards, grab Kane's ledger, escape to the
// Marina in 90 seconds under a 4-star manhunt. Completing job 7 completes
// the story and grants "Solmar Legend".

import { MISSIONS, JOB7_GUARD_PAY, JOB7_TOTAL } from './config.js';
import { landmarkById } from './landmarks.js';
import { createGuard } from './combat.js';

/** Fresh mission state. */
export function createMissions() {
  return {
    done: [], // ids of completed jobs
    active: null, // {job, stage, timer, target, guards, ledgerTaken, planted, plantTimer, lena}
    storyComplete: false,
  };
}

/** The job definition for an id. */
export function jobById(id) {
  return MISSIONS.find((m) => m.id === id) || null;
}

/** Is a job done? */
export function isDone(state, id) {
  return state.done.includes(id);
}

/** The next job to play (lowest undone id), or null when all are done. */
export function nextJob(state) {
  return MISSIONS.find((m) => !state.done.includes(m.id)) || null;
}

/**
 * Start a job. Returns the active mission or null (null when the job is
 * already done or another mission is running).
 */
export function startMission(state, id) {
  const job = jobById(id);
  if (!job || state.active || state.done.includes(id)) return null;
  const m = { job, stage: 'start', timer: job.timer, guards: [], ledgerTaken: false, planted: false, plantTimer: 10, lena: false };
  if (id === 7) {
    const hq = landmarkById('scpd');
    m.guards = [createGuard(hq.x - 60, hq.y - 40), createGuard(hq.x + 40, hq.y - 60), createGuard(hq.x + 70, hq.y + 50)];
  }
  state.active = m;
  return m;
}

/** Where the mission marker points right now (world coords) or null. */
export function missionTarget(state) {
  const m = state.active;
  if (!m) return null;
  const id = m.job.id;
  const hq = landmarkById('scpd');
  const pier = landmarkById('pier9');
  const marina = landmarkById('marina');
  const plaza = landmarkById('plaza');
  switch (id) {
    case 1: return m.stage === 'start' ? { x: 400, y: 300 } : { x: 600, y: 600 };
    case 2: return m.stage === 'start' ? { x: 950, y: 1350 } : { x: 1800, y: 300 };
    case 3: return m.stage === 'start' ? { x: plaza.x, y: plaza.y } : { x: marina.x, y: marina.y };
    case 4: return { x: pier.x, y: pier.y };
    case 5: return m.stage === 'start' ? { x: hq.x, y: hq.y } : { x: 400, y: 1400 };
    case 6: return { x: pier.x, y: pier.y };
    case 7:
      if (m.stage === 'escape') return { x: marina.x, y: marina.y };
      return { x: hq.x, y: hq.y };
    default: return null;
  }
}

/**
 * Advance the active mission by dt. `ctx` carries the live facts main.js
 * knows: {x, y, inCar, carModel, near(x,y,r), guardsDown, ledgerAt(x,y)}.
 * Returns events: [{type: 'stage'|'paid'|'failed'|'story-complete', ...}]
 */
export function tickMission(state, dt, ctx) {
  const events = [];
  const m = state.active;
  if (!m) return events;
  const job = m.job;
  if (job.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      state.active = null;
      events.push({ type: 'failed', job, reason: 'time' });
      return events;
    }
  }
  const near = (x, y, r) => Math.hypot(ctx.x - x, ctx.y - y) <= r;

  const complete = (extra = 0) => {
    state.done.push(job.id);
    state.active = null;
    const amount = job.payout + extra;
    events.push({ type: 'paid', job, amount });
    if (job.id === 7) {
      state.storyComplete = true;
      events.push({ type: 'story-complete', job, amount });
    }
  };

  switch (job.id) {
    case 1:
      if (m.stage === 'start' && ctx.inCar && ctx.carModel === 'Falco') {
        m.stage = 'drive';
        events.push({ type: 'stage', text: 'Falco stolen — drive to the garage marker.' });
      } else if (m.stage === 'drive' && near(600, 600, 70)) complete();
      break;
    case 2:
      if (m.stage === 'start' && near(950, 1350, 60)) {
        m.stage = 'drive';
        m.lena = true;
        events.push({ type: 'stage', text: 'Lena is in — drive her to the Neon Strip!' });
      } else if (m.stage === 'drive' && near(1800, 300, 70)) complete();
      break;
    case 3:
      if (m.stage === 'start' && ctx.inCar && ctx.carModel === 'Comet' && near(1200, 400, 90)) {
        m.stage = 'drive';
        events.push({ type: 'stage', text: 'Comet lifted — deliver it to the Marina.' });
      } else if (m.stage === 'drive' && near(300, 2100, 80)) complete();
      break;
    case 4:
      if (near(2150, 1200, 80)) complete();
      break;
    case 5:
      if (m.stage === 'start' && near(2050, 400, 70)) {
        m.stage = 'plant';
        m.plantTimer = 10;
        events.push({ type: 'stage', text: 'Planting… hold still for 10 seconds!' });
      } else if (m.stage === 'plant') {
        m.plantTimer -= dt;
        if (m.plantTimer <= 0) {
          m.planted = true;
          m.stage = 'escape';
          events.push({ type: 'stage', text: 'Package planted — get out of there!' });
        }
      } else if (m.stage === 'escape' && near(400, 1400, 80)) complete();
      break;
    case 6:
      if (near(2150, 1200, 80)) complete();
      break;
    case 7: {
      const guardsLeft = m.guards.filter((g) => g.hp > 0).length;
      if (m.stage === 'start' && guardsLeft === 0) {
        m.stage = 'grab';
        events.push({ type: 'stage', text: 'Guards down — grab the ledger!' });
      } else if (m.stage === 'grab' && near(2050, 400, 56)) {
        m.ledgerTaken = true;
        m.stage = 'escape';
        m.timer = 90; // the 90-second escape clock starts at the grab
        events.push({ type: 'stage', text: "Ledger taken! Escape to the Marina — 90 seconds, 4 stars!" });
      } else if (m.stage === 'escape' && near(300, 2100, 80)) {
        complete(3 * JOB7_GUARD_PAY);
      }
      break;
    }
    default: break;
  }
  return events;
}

/** Guard drops for a finished job 7: 3 guards x $50 = $150 on top of $4,000. */
export function job7Total() {
  return JOB7_TOTAL;
}
