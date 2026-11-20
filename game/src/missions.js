// Solmar Heat — missions.js
// Three story missions for Rex Marlowe and Mama Lou, with dialogue,
// beacons and payouts. Step flags live on the world, never on the
// shared MISSIONS constants.

import { dist } from './random.js';
import { landmarkById } from './landmarks.js';
import { addHeat, setWanted, enterCar } from './world.js';

export const MISSIONS = [
  {
    id: 'm1', title: 'Wheels for Lou', pay: 150,
    intro: ["Mama Lou: Rex, you're back and you owe me.", 'Mama Lou: Bring my red Vento to the Paint Shop.'],
    steps: [
      { kind: 'goto', label: 'Get to the red Vento', target: 'vento' },
      { kind: 'steal', label: 'Steal the Vento (E)', target: 'vento' },
      { kind: 'drive', label: "Deliver the Vento to Lou's Paint Shop", target: 'paint' },
    ],
  },
  {
    id: 'm2', title: 'The Palms Package', pay: 400,
    intro: ['Mama Lou: A package waits at The Palms Motel.', 'Mama Lou: Bring it home. Watch for Harbor Boys.'],
    steps: [
      { kind: 'goto', label: 'Pick up the package at The Palms Motel', target: 'motel' },
      { kind: 'escape', label: 'Escape to the safehouse', target: 'safehouse', wanted: 2 },
    ],
  },
  {
    id: 'm3', title: 'National Bank Job', pay: 1200,
    intro: ['Mama Lou: The National Bank vault. Crack it, hold it, run to Pier 9.', 'Rex: One last job, then we are even.'],
    steps: [
      { kind: 'goto', label: 'Reach the National Bank', target: 'bank' },
      { kind: 'vault', label: 'Hold the vault circle', target: 'bank', hold: 6 },
      { kind: 'escape', label: 'Escape to Pier 9', target: 'pier', wanted: 3 },
    ],
  },
];

export function missionTargetPos(world, step) {
  if (step.target === 'vento') return { x: world.vento.x, y: world.vento.y };
  const lm = landmarkById(step.target);
  return lm ? { x: lm.x, y: lm.y } : { x: 0, y: 0 };
}
export function startMission(world, idx) {
  const m = MISSIONS[idx]; if (!m) return false;
  world.mission = { idx, step: 0, holdTime: 0, done: false, title: m.title };
  world.stepFlags = {};
  world.dialogue = [...m.intro];
  return true;
}
export function flag(world, key) {
  const k = world.mission.idx + ':' + world.mission.step + ':' + key;
  if (world.stepFlags[k]) return true;
  world.stepFlags[k] = true; return false;
}
function completeMission(world) {
  const m = MISSIONS[world.mission.idx];
  world.player.money += m.pay; world.player.score += m.pay;
  world.banner = { text: 'MISSION PASSED', sub: '+$' + m.pay + ' — ' + m.title, t: 4 };
  world.events.push({ type: 'missionPassed', pay: m.pay, id: m.id });
  world.missionsDone = Math.max(world.missionsDone, world.mission.idx + 1);
  if (m.id === 'm3') { world.storyDone = true; world.player.rank = 'Solmar Legend'; }
  world.mission.done = true; world.mission = null;
}
export function stepMission(world, dt) {
  const ms = world.mission; if (!ms || ms.done) return;
  const m = MISSIONS[ms.idx]; const step = m.steps[ms.step]; if (!step) { completeMission(world); return; }
  const pos = missionTargetPos(world, step); const p = world.player;
  const d = dist(p.x, p.y, pos.x, pos.y);
  world.mission.distance = Math.round(d);
  if (step.wanted && !flag(world, 'wantedSet')) setWanted(world, step.wanted);
  if (step.kind === 'goto') {
    if (d < 70) advance(world);
  } else if (step.kind === 'steal') {
    if (p.car === world.vento) advance(world);
  } else if (step.kind === 'drive') {
    if (p.car && d < 110) { completeMission(world); }
  } else if (step.kind === 'escape') {
    if (d < 100) {
      if (ms.step >= m.steps.length - 1) completeMission(world); else advance(world);
    }
  } else if (step.kind === 'vault') {
    if (d < 90) {
      if (!flag(world, 'gangSpawned')) spawnVaultGang(world);
      ms.holdTime += dt; world.vaultProgress = Math.min(1, ms.holdTime / step.hold);
      if (ms.holdTime >= step.hold) { world.vaultProgress = 1; advance(world); }
    }
  }
}
function advance(world) {
  world.mission.step += 1; world.mission.holdTime = 0;
  if (world.mission.step >= MISSIONS[world.mission.idx].steps.length) completeMission(world);
}
export function spawnVaultGang(world) {
  const bank = landmarkById('bank');
  for (let i = 0; i < 4; i++) {
    world.gang.push({ x: bank.x + 90 + i * 36, y: bank.y + 70 - i * 22, hp: 30, angle: 3.14, shootCd: 1 + i * 0.3, strafe: i % 2 ? 1 : -1 });
  }
  addHeat(world, 260); // bank job heat — lands at 3 stars mid-band-ish
  setWanted(world, 3);
}
export function tryStealNearby(world) {
  const p = world.player;
  let best = null, bd = 64;
  for (const c of world.cars) { const d = dist(p.x, p.y, c.x, c.y); if (d < bd) { bd = d; best = c; } }
  if (!best) return false;
  const ok = enterCar(world, best);
  if (ok) { addHeat(world, 110); world.events.push({ type: 'steal' }); } // a witness calls it in: +1 star
  return ok;
}
