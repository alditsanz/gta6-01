// Solmar Heat — the five-job story arc. Each job is a chain of steps
// (goto / pickup / hold / escape) against a generous clock; finishing
// one banks cash, reputation and a letter grade, and finishing the
// bank job closes the story and unlocks the victory summary.

import { landmarkById } from './landmarks.js';
import { dist } from './random.js';
import { addHeat } from './world.js';

export const MISSIONS = [
  {
    id: 'm1', title: 'Wheels for Lou', giver: 'Mama Lou', pay: 150, par: 150,
    intro: "Lou's Vento is parked up by the safehouse. Bring it home.",
    steps: [
      { kind: 'goto', label: 'Get in the red Vento by the safehouse', x: 368, y: 1032, r: 70 },
      { kind: 'goto', label: "Deliver the Vento to Lou's Paint Shop", x: 600, y: 1000, r: 100 },
    ],
  },
  {
    id: 'm2', title: 'The Palms Package', giver: 'Mama Lou', pay: 400, par: 210,
    intro: 'A package is waiting at the motel. It is heavier than it looks.',
    steps: [
      { kind: 'pickup', label: 'Pick up the package at The Palms Motel', x: 2600, y: 600, r: 100, heat: 120 },
      { kind: 'escape', label: 'Escape to Pier 9 with the package', x: 3400, y: 200, r: 110 },
    ],
  },
  {
    id: 'm3', title: 'Neon Night Run', giver: 'Lena Voss', pay: 650, par: 240,
    intro: 'Lena needs a driver who does not ask what is in the bags.',
    steps: [
      { kind: 'pickup', label: 'Meet Lena at Cactus Court Plaza', x: 600, y: 600, r: 100 },
      { kind: 'goto', label: 'Run the drop to the Neon Strip', x: 3000, y: 600, r: 110, heat: 210 },
      { kind: 'escape', label: 'Escape to the Marina', x: 3400, y: 1800, r: 110 },
    ],
  },
  {
    id: 'm4', title: 'Canal Row Ambush', giver: 'Lena Voss', pay: 900, par: 260,
    intro: 'The Vipers want a word on Canal Row. Bring more than words.',
    steps: [
      { kind: 'goto', label: 'Go to the Canal Row meet', x: 3000, y: 1700, r: 110 },
      { kind: 'hold', label: 'Hold the canal bank against the Vipers', seconds: 14, gang: 5, heat: 260, r: 150 },
      { kind: 'escape', label: 'Escape to Solmar General Hospital', x: 3000, y: 3000, r: 110 },
    ],
  },
  {
    id: 'm5', title: 'National Bank Job', giver: 'Kane', pay: 1200, par: 300,
    intro: 'One vault. One crew. One very loud afternoon.',
    steps: [
      { kind: 'goto', label: 'Reach Solmar National Bank', x: 1800, y: 1800, r: 120 },
      { kind: 'hold', label: 'Hold the vault ring while it cracks', seconds: 20, gang: 7, heat: 320, vault: true, r: 140 },
      { kind: 'escape', label: 'Escape with the take to Pier 9', x: 3400, y: 200, r: 120 },
    ],
  },
];

export function missionByIndex(i) {
  return MISSIONS[i] || null;
}

export function startMission(world, idx) {
  const def = missionByIndex(idx);
  if (!def) return null;
  world.mission = {
    idx, def, step: 0, timer: def.par + 90,
    holdTimer: 0, vaultPct: 0, done: false, failed: false, gangSpawned: false,
  };
  return world.mission;
}

// Steps like "hold" carry no coordinates of their own — they happen
// wherever the previous step pointed, so walk back to find the spot.
export function stepPos(m, idx) {
  const steps = m.def.steps;
  for (let i = Math.min(idx, steps.length - 1); i >= 0; i--) {
    const s = steps[i];
    if (s.x !== undefined) return { x: s.x, y: s.y, r: s.r || 90 };
  }
  return { x: 0, y: 0, r: 90 };
}

export function missionStage(world) {
  const m = world.mission;
  if (!m) return null;
  const current = m.def.steps[m.step];
  const upcoming = m.def.steps[m.step + 1];
  return {
    idx: m.idx,
    title: m.def.title,
    step: m.step,
    steps: m.def.steps.length,
    label: current ? current.label : '',
    nextLabel: upcoming ? upcoming.label : null,
    timer: m.timer,
    vaultPct: m.vaultPct,
    kind: current ? current.kind : null,
  };
}

export function gradeFor(missionOrDef, timeLeft) {
  const def = missionOrDef.def || missionOrDef;
  const frac = timeLeft / (def.par + 90);
  if (frac > 0.55) return 'S';
  if (frac > 0.38) return 'A';
  if (frac > 0.2) return 'B';
  return 'C';
}

export function missionTarget(world) {
  const m = world.mission;
  if (!m) return null;
  const pos = stepPos(m, m.step);
  return { x: pos.x, y: pos.y };
}

function finishMission(world, events) {
  const m = world.mission;
  const grade = gradeFor(m, Math.max(0, m.timer));
  world.stats.money += m.def.pay;
  world.stats.rp += 90 + m.idx * 30;
  world.stats.score += 200 + m.idx * 60;
  world.stats.missionsDone = Math.max(world.stats.missionsDone, m.idx + 1);
  world.flags['grade_' + m.def.id] = grade;
  world.flags['done_' + m.def.id] = true;
  events.push('mission-done:' + grade);
  if (m.idx === MISSIONS.length - 1) {
    world.flags.storyComplete = true;
    world.flags.finalGrade = grade;
    events.push('story-complete');
  }
  world.mission = null;
}

function advanceStep(world, events) {
  const m = world.mission;
  m.step += 1;
  m.holdTimer = 0;
  m.gangSpawned = false;
  events.push('step');
  if (m.step >= m.def.steps.length) finishMission(world, events);
}

export function stepMission(world, dt) {
  const events = [];
  const m = world.mission;
  if (!m || m.done || m.failed) return events;
  const step = m.def.steps[m.step];
  if (!step) {
    finishMission(world, events);
    return events;
  }

  m.timer -= dt;
  if (m.timer <= 0) {
    m.failed = true;
    world.mission = null;
    events.push('mission-failed');
    return events;
  }

  const pos = stepPos(m, m.step);
  const near = dist(world.player.x, world.player.y, pos.x, pos.y) < pos.r;

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

// The victory screen reads everything from here: grades, money and
// feats are all derived from the world's real recorded fields, and a
// fresh world honestly reports an empty feat list.
export function victorySummary(world) {
  const s = world.stats;
  const grades = MISSIONS.map((def) => ({
    id: def.id,
    title: def.title,
    pay: def.pay,
    done: !!world.flags['done_' + def.id],
    grade: world.flags['grade_' + def.id] || null,
  }));

  const feats = [];
  if (world.flags.storyComplete && s.missionsDone >= 5) {
    feats.push('FULL STORY — all five jobs closed');
  }
  if (s.money >= 4000) feats.push('HIGH ROLLER — banked over $4,000');
  if (s.copsEscaped >= 4) feats.push('GHOST — shook the SCPD four times');
  if (MISSIONS.some((def) => world.flags['race_' + def.id])) feats.push('STREET RACER — a Solmar route conquered');
  const heldZones = world.turf ? world.turf.zones.filter((z) => z.owner === 'Rex').length : 0;
  if (heldZones >= 3) feats.push('LANDLORD — three turf zones fly Rex colours');
  const jumps = world.collectibles ? world.collectibles.jumps.filter((j) => j.done).length : 0;
  if (jumps >= 2) feats.push('AIRBORNE — stunt jumps stuck');

  return {
    complete: !!world.flags.storyComplete,
    grades,
    finalScore: s.score,
    money: s.money,
    rp: s.rp,
    missionsDone: s.missionsDone,
    feats,
  };
}

export { landmarkById };
