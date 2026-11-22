// Solmar Heat — missions.js
// The five-job story of Rex Kane, Lena Voss and the boss Kane. Each job
// is a list of steps (goto / pickup / hold / escape / deliver) with a
// timer, wanted pressure and a payout. The finale is the National Bank
// job: hold the vault ring to 70%, then run the take to Pier 9.

import { landmarkById } from './landmarks.js';
import { dist } from './random.js';
import { addHeat } from './world.js';

export const MISSIONS = [
  {
    id: 'm1', title: 'Wheels for Lou', giver: 'Mama Lou', pay: 150, par: 150,
    intro: 'Lou needs wheels. Take the Vento and bring it back clean.',
    steps: [
      { kind: 'goto', label: 'Get in the red Vento by the safehouse', x: 368, y: 1032, r: 70 },
      { kind: 'goto', label: "Deliver the Vento to Lou's Paint Shop", x: 600, y: 1000, r: 100 },
    ],
  },
  {
    id: 'm2', title: 'The Palms Package', giver: 'Mama Lou', pay: 400, par: 210,
    intro: 'A package waits at The Palms Motel. Kane\'s boys will notice.',
    steps: [
      { kind: 'pickup', label: 'Pick up the package at The Palms Motel', x: 2600, y: 600, r: 100, heat: 120 },
      { kind: 'escape', label: 'Lose the heat, then reach Pier 9', x: 3400, y: 200, r: 110 },
    ],
  },
  {
    id: 'm3', title: 'Neon Night Run', giver: 'Lena Voss', pay: 650, par: 240,
    intro: 'Lena runs a ledger across the Strip. Drive her route, fast.',
    steps: [
      { kind: 'pickup', label: 'Meet Lena at Cactus Court Plaza', x: 600, y: 600, r: 100 },
      { kind: 'goto', label: 'Run the ledger to the Neon Strip drop', x: 3000, y: 600, r: 110, heat: 210 },
      { kind: 'escape', label: 'Escape to the Marina with Lena', x: 3400, y: 1800, r: 110 },
    ],
  },
  {
    id: 'm4', title: 'Canal Row Ambush', giver: 'Lena Voss', pay: 900, par: 260,
    intro: 'The Vipers set a meet on Canal Row. It is a trap. Survive it.',
    steps: [
      { kind: 'goto', label: 'Go to the Canal Row meet', x: 3000, y: 1700, r: 110 },
      { kind: 'hold', label: 'Hold the canal bank against the Vipers', seconds: 14, gang: 5, heat: 260, r: 150 },
      { kind: 'escape', label: 'Escape to Solmar General Hospital', x: 3000, y: 3000, r: 110 },
    ],
  },
  {
    id: 'm5', title: 'National Bank Job', giver: 'Kane', pay: 1200, par: 300,
    intro: 'One last score: the Solmar National Bank vault. Hold it, run it.',
    steps: [
      { kind: 'goto', label: 'Reach Solmar National Bank', x: 1800, y: 1800, r: 120 },
      { kind: 'hold', label: 'Hold the vault ring while it cracks', seconds: 20, gang: 7, heat: 320, vault: true, r: 140 },
      { kind: 'escape', label: 'Escape with the take to Pier 9', x: 3400, y: 200, r: 120 },
    ],
  },
];

export function missionByIndex(i) { return MISSIONS[i] || null; }

export function startMission(world, idx) {
  const def = missionByIndex(idx);
  if (!def) return null;
  world.mission = {
    idx, def, step: 0, timer: def.par + 90, holdTimer: 0,
    vaultPct: 0, done: false, failed: false, gangSpawned: false,
  };
  return world.mission;
}

// A step without its own coordinates (a hold) happens where the
// previous step ended — resolve the effective position here.
export function stepPos(m, idx) {
  for (let i = Math.min(idx, m.def.steps.length - 1); i >= 0; i--) {
    const s = m.def.steps[i];
    if (s.x !== undefined) return { x: s.x, y: s.y, r: s.r || 90 };
  }
  return { x: 0, y: 0, r: 90 };
}

export function missionStage(world) {
  const m = world.mission;
  if (!m) return null;
  const step = m.def.steps[m.step];
  const next = m.def.steps[m.step + 1];
  return {
    idx: m.idx, title: m.def.title, step: m.step, steps: m.def.steps.length,
    label: step ? step.label : '', nextLabel: next ? next.label : null,
    timer: m.timer, vaultPct: m.vaultPct, kind: step ? step.kind : null,
  };
}

export function gradeFor(mission, timeLeft) {
  // Letter grade from how much of the generous timer is left. Accepts
  // either a live mission instance or a bare mission definition.
  const def = mission.def || mission;
  const frac = timeLeft / (def.par + 90);
  if (frac > 0.55) return 'S';
  if (frac > 0.38) return 'A';
  if (frac > 0.2) return 'B';
  return 'C';
}

export function stepMission(world, dt) {
  const events = [];
  const m = world.mission;
  if (!m || m.done || m.failed) return events;
  const step = m.def.steps[m.step];
  if (!step) { finishMission(world, events); return events; }
  m.timer -= dt;
  if (m.timer <= 0) {
    m.failed = true; events.push('mission-failed');
    world.mission = null;
    return events;
  }
  const p = world.player;
  const pos = stepPos(m, m.step);
  const near = dist(p.x, p.y, pos.x, pos.y) < pos.r;
  if (step.kind === 'hold') {
    if (!m.gangSpawned) {
      m.gangSpawned = true;
      events.push('spawn-gang:' + (step.gang || 5));
      if (step.heat) addHeat(world, step.heat);
    }
    if (near) {
      m.holdTimer += dt;
      if (step.vault) m.vaultPct = Math.min(100, (m.holdTimer / step.seconds) * 100);
      if (m.holdTimer >= step.seconds) advanceStep(world, events);
    }
    return events;
  }
  if (near) {
    if (step.heat) addHeat(world, step.heat);
    if (step.kind === 'pickup') events.push('pickup');
    advanceStep(world, events);
  }
  return events;
}

function advanceStep(world, events) {
  const m = world.mission;
  m.step += 1; m.holdTimer = 0; m.gangSpawned = false;
  events.push('step');
  if (m.step >= m.def.steps.length) finishMission(world, events);
}

function finishMission(world, events) {
  const m = world.mission;
  m.done = true;
  const grade = gradeFor(m, Math.max(0, m.timer));
  world.stats.money += m.def.pay;
  world.stats.rp += 90 + m.idx * 30;
  world.stats.score += 200 + m.idx * 60;
  world.stats.missionsDone = Math.max(world.stats.missionsDone, m.idx + 1);
  world.flags['grade_' + m.def.id] = grade;
  world.flags['done_' + m.def.id] = true;
  events.push('mission-done:' + grade);
  world.mission = null;
}

export function missionTarget(world) {
  const m = world.mission;
  if (!m) return null;
  const pos = stepPos(m, m.step);
  return { x: pos.x, y: pos.y };
}

export { landmarkById };
