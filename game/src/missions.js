// missions.js — Rex Kane's three story jobs for Mama Lou.
// m1 Wheels for Lou, m2 The Palms Package, m3 The National Bank Job.
// Each mission is a list of steps: go somewhere, pick something up,
// hold a circle (the vault), or escape. missionStage() feeds the
// HUD header with MISSION n/3, STAGE x/y and the NEXT step label.

import { landmark } from './landmarks.js';

export const MISSIONS = [
  {
    key: 'm1', title: 'Wheels for Lou', pay: 150, from: 'Mama Lou',
    line: 'Rex — Lou needs wheels. Bring me the Falco S by the motel.',
    steps: [
      { kind: 'go', label: 'Reach the Falco S at The Palms Motel', short: 'Falco S', at: 'motel', r: 90 },
      { kind: 'go', label: "Deliver the car to Lou's Mod Shop", short: 'Mod Shop', at: 'modshop', r: 95 },
    ],
  },
  {
    key: 'm2', title: 'The Palms Package', pay: 400, from: 'Mama Lou',
    line: 'Pick up the package at The Palms Motel. No questions, no stops.',
    steps: [
      { kind: 'go', label: 'Pick up the package at The Palms Motel', short: 'Package pickup', at: 'motel', r: 85 },
      { kind: 'go', label: 'Drop the package at the Marina', short: 'Marina drop', at: 'marina', r: 95 },
    ],
  },
  {
    key: 'm3', title: 'National Bank Job', pay: 1200, from: 'Mama Lou',
    line: 'The National Bank vault, Rex. Hold it, then vanish to Pier 9.',
    steps: [
      { kind: 'go', label: 'Enter the vault at Solmar National Bank', short: 'Bank vault', at: 'bank', r: 95 },
      { kind: 'hold', label: 'Hold the vault while it opens', short: 'Vault hold', at: 'bank', r: 110, hold: 14 },
      { kind: 'go', label: 'Escape to Pier 9', short: 'Pier 9 escape', at: 'pier9', r: 110 },
    ],
  },
];

export function createMissionState() {
  return { idx: -1, step: 0, holdT: 0, done: [false, false, false], active: false };
}

export function startMission(world, idx) {
  if (idx < 0 || idx >= MISSIONS.length || world.missions.done[idx]) return false;
  world.missions.idx = idx; world.missions.step = 0;
  world.missions.holdT = 0; world.missions.active = true;
  if (MISSIONS[idx].key === 'm3') world.gang = spawnBankGang();
  return true;
}

export function spawnBankGang() {
  const bank = landmark('bank');
  const gang = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    gang.push({ x: bank.x + Math.cos(a) * 130, y: bank.y + Math.sin(a) * 130, hp: 3, maxHp: 3, speed: 58, flee: false });
  }
  return gang;
}

export function currentStep(world) {
  const m = world.missions;
  if (!m.active) return null;
  return MISSIONS[m.idx].steps[m.step] || null;
}

export function missionStage(world) {
  const m = world.missions;
  if (!m.active) return null;
  const mission = MISSIONS[m.idx];
  const step = mission.steps[m.step];
  const next = mission.steps[m.step + 1] || null;
  const at = landmark(step.at);
  const dist = at ? Math.round(Math.hypot(at.x - world.player.x, at.y - world.player.y)) : 0;
  return {
    missionIdx: m.idx, title: mission.title, stepIdx: m.step,
    stepCount: mission.steps.length, stepLabel: step.label,
    nextLabel: next ? next.label : null, nextShort: next ? next.short : null,
    target: at, dist,
  };
}

// Advance the active mission. Returns 'step', 'done', or null.
export function stepMission(world, dt) {
  const m = world.missions;
  if (!m.active) return null;
  const mission = MISSIONS[m.idx];
  const step = mission.steps[m.step];
  const at = landmark(step.at);
  const inside = Math.hypot(at.x - world.player.x, at.y - world.player.y) < step.r;
  if (step.kind === 'hold') {
    if (!inside) { m.holdT = Math.max(0, m.holdT - dt); return null; }
    m.holdT += dt;
    world.vaultProgress = Math.min(1, m.holdT / step.hold);
    if (m.holdT < step.hold) return null;
  } else if (!inside) return null;
  m.step++; m.holdT = 0;
  if (mission.key === 'm3' && m.step === 2) world.addHeat(300); // escape under pressure
  if (m.step >= mission.steps.length) {
    m.active = false; m.done[m.idx] = true;
    world.player.money += mission.pay;
    world.stats.missionsDone = m.done.filter(Boolean).length;
    world.player.rank = rankFor(world);
    return 'done';
  }
  return 'step';
}

export function rankFor(world) {
  const done = world.missions.done.filter(Boolean).length;
  if (done >= 3) return 'Solmar Legend';
  const score = world.player.money + world.stats.coinsFound * 40 + done * 300;
  if (score > 1600) return 'King of the Mile';
  if (score > 900) return 'Street Royalty';
  if (score > 450) return 'Made Driver';
  if (score > 200) return 'Hustler';
  if (score > 60) return 'Wheelman';
  return 'Runner';
}
