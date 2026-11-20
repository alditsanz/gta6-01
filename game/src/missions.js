// missions.js — the three-job story of Rex Kane and Mama Lou.
// One job: hold the mission scripts (steps with targets), advance them
// as the player reaches targets / holds the vault / escapes, run the
// dialogue beats, and pay out. HUD helpers (missionStage,
// missionTarget) expose the current step for render.js.

import { dist } from './config.js';
import { landmarkById } from './landmarks.js';
import { addHeat, setWanted } from './world.js';
import { spawnGang } from './combat.js';

const lm = landmarkById;

// Step kinds: reach (get there, on foot or in a car), steal (be in the
// target car), drive (be there IN any car), vault (hold the circle),
// escape (get there while wanted).
export const MISSIONS = [
  {
    id: 'm1', title: 'Wheels for Lou', pay: 150,
    intro: { who: 'Mama Lou', text: 'Rex! My red Vento is parked by your safehouse. Bring it to the Mod Shop — gently.' },
    steps: [
      { label: 'Get to the red Vento', short: 'the red Vento', kind: 'steal', target: 'car' },
      { label: "Deliver the Vento to Lou's Mod Shop", short: 'the Mod Shop', kind: 'drive', target: 'modshop' },
    ],
    done: { who: 'Mama Lou', text: 'Clean work, baby. Lou owes you one — and Lou always pays.' },
  },
  {
    id: 'm2', title: 'The Palms Package', pay: 400,
    intro: { who: 'Mama Lou', text: 'A package waits at The Palms Motel. Pick it up, bring it to the Paint Shop. No questions.' },
    steps: [
      { label: 'Pick up the package at The Palms Motel', short: 'the package', kind: 'reach', target: 'motel' },
      { label: "Deliver the package to Lou's Paint Shop", short: 'the Paint Shop', kind: 'drive', target: 'paint' },
    ],
    done: { who: 'Mama Lou', text: 'Package received. Whatever it was, it is not our problem anymore.' },
  },
  {
    id: 'm3', title: 'National Bank Job', pay: 1200,
    intro: { who: 'Mama Lou', text: 'The big one, Rex. Solmar National Bank, the vault, then lose yourself at Pier 9.' },
    steps: [
      { label: 'Get to Solmar National Bank', short: 'the bank', kind: 'reach', target: 'bank' },
      { label: 'Hold the vault', short: 'the vault', kind: 'vault', target: 'bank' },
      { label: 'Escape to Pier 9', short: 'Pier 9', kind: 'escape', target: 'pier' },
    ],
    done: { who: 'Mama Lou', text: 'You did it, Rex. Solmar is yours now. Legend.' },
  },
];

export const VAULT_SECONDS = 6;

export function makeMissionState() {
  return { idx: 0, step: 0, vaultT: 0, started: false };
}

export function say(world, who, text, dur = 4.5) {
  world.dialogue = { who, text, t: dur };
}

export function notice(world, text, sub = '', dur = 2.6) {
  world.notice = { text, sub, t: dur };
}

// Begin the story (called once when play starts).
export function startStory(world) {
  if (!world.mission) world.mission = makeMissionState();
  if (!world.mission.started) {
    world.mission.started = true;
    say(world, MISSIONS[0].intro.who, MISSIONS[0].intro.text, 6);
  }
}

// Where the current step wants the player. {x, y, label, dist} or null.
export function missionTarget(world) {
  const m = world.mission;
  if (!m || m.idx >= MISSIONS.length) return null;
  const step = MISSIONS[m.idx].steps[m.step];
  let x, y;
  if (step.target === 'car') { x = world.ventoCar.x; y = world.ventoCar.y; }
  else { const l = lm(step.target); x = l.x; y = l.y; }
  return { x, y, label: step.label, dist: Math.round(dist(world.player.x, world.player.y, x, y)) };
}

// Header data for the HUD banner (Upgrade G grammar).
export function missionStage(world) {
  const m = world.mission;
  if (!m || m.idx >= MISSIONS.length) return null;
  const mission = MISSIONS[m.idx];
  const step = mission.steps[m.step];
  const next = mission.steps[m.step + 1] || null;
  return {
    idx: m.idx, total: MISSIONS.length, title: mission.title,
    step: m.step, steps: mission.steps.length,
    label: step.label, short: step.short,
    nextShort: next ? next.short : null,
  };
}

function stepDone(world) {
  const m = world.mission;
  const mission = MISSIONS[m.idx];
  m.step += 1;
  m.vaultT = 0;
  if (m.step >= mission.steps.length) {
    // Mission complete: pay, praise, advance.
    world.player.money += mission.pay;
    world.player.score += mission.pay;
    notice(world, 'MISSION PASSED', `${mission.title}  +$${mission.pay}`, 3);
    say(world, mission.done.who, mission.done.text, 5);
    m.idx += 1;
    m.step = 0;
    if (m.idx >= MISSIONS.length) {
      world.storyDone = true;
      world.player.rank = 'Solmar Legend';
    } else {
      const next = MISSIONS[m.idx];
      setTimeoutSay(world, next);
    }
  } else if (mission.id === 'm3' && m.step === 1) {
    // Entering the vault step: the bank crew defends it.
    const bank = lm('bank');
    spawnGang(world, bank.x, bank.y + 66, 7, 30);
    setWanted(world, 3);
    say(world, 'Mama Lou', 'Crew is on you, Rex! Hold the vault circle — do not leave it!', 4.5);
  } else if (mission.id === 'm3' && m.step === 2) {
    setWanted(world, 4);
    say(world, 'Mama Lou', 'Vault is open! Now run — Pier 9, and do not stop for anybody!', 4.5);
  } else if (mission.id === 'm2' && m.step === 1) {
    addHeat(world, 120);
    say(world, 'Mama Lou', 'You have it? Good. The heat noticed — move, baby, move!', 4);
  }
}

// The next mission's intro line is queued as a notice follow-up; we
// simply say it right away under the PASSED banner.
function setTimeoutSay(world, mission) {
  say(world, mission.intro.who, mission.intro.text, 6);
}

export function stepMissions(world, dt) {
  const m = world.mission;
  if (!m || !m.started || m.idx >= MISSIONS.length) return;
  const mission = MISSIONS[m.idx];
  const step = mission.steps[m.step];
  const p = world.player;
  const tgt = missionTarget(world);
  if (!tgt) return;
  const d = dist(p.x, p.y, tgt.x, tgt.y);

  if (step.kind === 'steal') {
    if (p.car === world.ventoCar) stepDone(world);
  } else if (step.kind === 'drive') {
    if (p.car && d < 78) stepDone(world);
  } else if (step.kind === 'reach') {
    if (d < 62) stepDone(world);
  } else if (step.kind === 'escape') {
    if (d < 84) stepDone(world);
  } else if (step.kind === 'vault') {
    if (d < 58 && !p.car) {
      m.vaultT += dt;
      if (m.vaultT >= VAULT_SECONDS) stepDone(world);
    } else {
      m.vaultT = Math.max(0, m.vaultT - dt * 1.5);
    }
  }
}

// 0..1 progress for the vault bar, or -1 when not on the vault step.
export function vaultProgress(world) {
  const m = world.mission;
  if (!m || m.idx >= MISSIONS.length) return -1;
  if (MISSIONS[m.idx].steps[m.step].kind !== 'vault') return -1;
  return Math.min(1, m.vaultT / VAULT_SECONDS);
}
