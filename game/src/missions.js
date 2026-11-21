// missions.js — the five-job story of Rex Kane, getaway driver
// for Mama Lou. Each job is a list of steps with a kind the updater
// understands; jobs are genuinely completable end-to-end and are
// graded (S/A/B/C) on time against par and damage taken.

import { landmark, distTo } from './landmarks.js';
import { addHeat } from './world.js';

export const MISSIONS = [
  {
    id: 'm1', title: 'Wheels for Lou', giver: 'Mama Lou', pay: 150, par: 150,
    blurb: 'Lift the marked Falco S and bring it home to the Paint Shop.',
    steps: [
      { kind: 'steal', label: 'Steal the marked Falco S', short: 'STEAL THE FALCO', carType: 'falco' },
      { kind: 'goto', label: "Deliver it to Lou's Paint Shop", short: 'DELIVER TO PAINT SHOP', at: 'paintshop' },
    ],
  },
  {
    id: 'm2', title: 'The Palms Package', giver: 'Mama Lou', pay: 400, par: 210,
    blurb: 'Pick up a package at The Palms Motel. Drop it at Pier 9. Do not be followed.',
    steps: [
      { kind: 'goto', label: 'Pick up the package at The Palms Motel', short: 'PICK UP AT THE PALMS', at: 'motel' },
      { kind: 'goto', label: 'Drop the package at Pier 9', short: 'DROP AT PIER 9', at: 'pier9', heat: 120 },
    ],
  },
  {
    id: 'm3', title: 'National Bank Job', giver: 'Mama Lou', pay: 1200, par: 300,
    blurb: 'Walk into Solmar National, hold the vault, then run for Pier 9.',
    steps: [
      { kind: 'goto', label: 'Reach Solmar National Bank', short: 'REACH THE BANK', at: 'bank' },
      { kind: 'vault', label: 'Hold the vault circle', short: 'HOLD THE VAULT', at: 'bank', holdTo: 100 },
      { kind: 'goto', label: 'Escape to Pier 9', short: 'ESCAPE TO PIER 9', at: 'pier9', heat: 320 },
    ],
  },
  {
    id: 'm4', title: 'Harbor Lights', giver: 'Dex', pay: 700, par: 260,
    blurb: 'Crates off a boat at the Marina, across town to Cactus Court — with the whole SCPD awake.',
    steps: [
      { kind: 'goto', label: 'Collect the crates at Solmar Marina', short: 'COLLECT AT MARINA', at: 'marina' },
      { kind: 'goto', label: 'Deliver the crates to Cactus Court Plaza', short: 'DELIVER TO THE PLAZA', at: 'plaza', heat: 220 },
      { kind: 'goto', label: 'Shake the tail — reach the Safehouse', short: 'REACH THE SAFEHOUSE', at: 'safehouse' },
    ],
  },
  {
    id: 'm5', title: 'Neon Crown', giver: 'Mama Lou', pay: 1500, par: 330,
    blurb: 'Take the Neon Strip block and hold it. Whoever holds the Strip holds Solmar.',
    steps: [
      { kind: 'goto', label: 'Reach the Neon Strip block', short: 'REACH THE STRIP', at: 'motel' },
      { kind: 'hold', label: 'Hold the block against the Vipers', short: 'HOLD THE BLOCK', at: 'motel', holdSec: 24 },
      { kind: 'goto', label: 'Fall back to the Safehouse', short: 'FALL BACK — SAFEHOUSE', at: 'safehouse', heat: 200 },
    ],
  },
];

export function missionById(id) { return MISSIONS.find(m => m.id === id); }

// The next unfinished job in story order, or null when done.
export function nextMission(world) {
  return MISSIONS[world.stats.missionsDone] || null;
}

// Stage info for the HUD header: MISSION n/5 · STAGE x/y · NEXT.
export function missionStage(world) {
  if (!world.mission) return null;
  const m = world.mission.def;
  const step = m.steps[world.mission.step];
  const next = m.steps[world.mission.step + 1] || null;
  return {
    idx: MISSIONS.indexOf(m), total: MISSIONS.length, def: m, step,
    stepIdx: world.mission.step, stepCount: m.steps.length,
    nextLabel: next ? next.short : null,
  };
}

export function stepTarget(world) {
  const ms = missionStage(world);
  if (!ms) return null;
  const step = ms.step;
  if (step.kind === 'steal') {
    const car = world.cars.find(c => c.id === world.mission.targetCarId);
    return car ? { x: car.x, y: car.y } : null;
  }
  return landmark(step.at);
}

export function startMission(world, def) {
  world.mission = { def, step: 0, vault: 0, holdT: 0, targetCarId: null };
  world.missionTime = 0;
  world.missionDamage = 0;
  const first = def.steps[0];
  if (first.kind === 'steal') {
    // A marked car of the wanted type, parked across town. If the
    // seeded traffic rolled no such car, retype a donor so the job
    // can always be completed.
    const spot = { x: 2754, y: 1154 };
    let car = world.cars.find(c => c.type === first.carType);
    if (!car) {
      car = world.cars[0];
      car.type = 'falco'; car.name = 'Falco S'; car.style = 'sport'; car.color = '#e8a71c';
    }
    car.x = spot.x; car.y = spot.y; car.parked = false; car.speed = 0; car.driver = 'target';
    world.mission.targetCarId = car.id;
  }
  return world.mission;
}

export function gradeFor(def, seconds, damage) {
  const t = seconds / def.par;
  if (t <= 1 && damage < 25) return 'S';
  if (t <= 1.3 && damage < 60) return 'A';
  if (t <= 1.8) return 'B';
  return 'C';
}

function completeMission(world, events) {
  const def = world.mission.def;
  const grade = gradeFor(def, world.missionTime, world.missionDamage);
  world.grades[def.id] = grade;
  world.player.money += def.pay;
  world.player.rp += 60 + (grade === 'S' ? 40 : grade === 'A' ? 25 : 10);
  world.stats.missionsDone++;
  events.push({ type: 'mission-done', def, grade });
  world.mission = null;
}

function advanceStep(world, events) {
  world.mission.step++;
  const step = world.mission.def.steps[world.mission.step];
  if (!step) { completeMission(world, events); return; }
  if (step.heat) addHeat(world, step.heat);
  if (step.kind === 'vault') world.mission.vault = 0;
  if (step.kind === 'hold') world.mission.holdT = step.holdSec;
  events.push({ type: 'mission-step', step });
}

// Called every frame by main while a mission is active.
export function stepMission(world, dt, events) {
  if (!world.mission) return;
  world.missionTime += dt;
  const ms = missionStage(world);
  const step = ms.step;
  const p = world.player;
  const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;

  if (step.kind === 'goto' || step.kind === 'vault' || step.kind === 'hold') {
    const at = landmark(step.at);
    const d = distTo(at, { x: px, y: py });
    if (step.kind === 'goto' && d < 80) advanceStep(world, events);
    else if (step.kind === 'vault') {
      if (d < 95 && !p.car) {
        world.mission.vault += dt * 14; // ~7 s in the circle
        if (world.mission.vault >= step.holdTo) advanceStep(world, events);
      }
    } else if (step.kind === 'hold') {
      if (d < 200) {
        world.mission.holdT -= dt;
        if (world.mission.holdT <= 0) advanceStep(world, events);
      }
    }
  } else if (step.kind === 'steal') {
    if (p.car && p.car.id === world.mission.targetCarId) advanceStep(world, events);
  }
}
