// races.js — three street races: checkpoint routes against par times.
// One job: hold the route table, run the active race (timer, next
// checkpoint, finish/fail), and pay out on a clean win.

import { dist } from './config.js';
import { notice, say } from './missions.js';

export const RACES = [
  {
    name: 'Sunset Sprint', diff: 'Easy', par: 75, pay: 150,
    start: { x: 400, y: 1050 },
    checkpoints: [[400, 1800], [1200, 1800], [1200, 2600], [400, 2600]],
  },
  {
    name: 'Canal Run', diff: 'Medium', par: 95, pay: 300,
    start: { x: 2400, y: 650 },
    checkpoints: [[2400, 1400], [3200, 1400], [3200, 2200], [2400, 2200], [2400, 3000]],
  },
  {
    name: 'Pier 9 Grand Prix', diff: 'Hard', par: 120, pay: 600,
    start: { x: 3200, y: 3350 },
    checkpoints: [[3200, 2400], [2000, 2400], [2000, 1200], [800, 1200], [800, 400], [2000, 400]],
  },
];

// Can a race be started here? Returns the race index or -1.
export function raceAt(world) {
  const p = world.player;
  if (!p.car || world.race) return -1;
  for (let i = 0; i < RACES.length; i++) {
    if (dist(p.x, p.y, RACES[i].start.x, RACES[i].start.y) < 70) return i;
  }
  return -1;
}

export function startRace(world, idx) {
  const r = RACES[idx];
  world.race = { idx, cp: 0, t: 0, par: r.par };
  notice(world, 'RACE STARTED', `${r.name} — beat ${r.par}s for $${r.pay}`, 2.4);
  say(world, 'Flag Marshal', 'Checkpoints lit up on your map. Go, go, go!', 3);
}

export function stepRaces(world, dt) {
  const race = world.race;
  if (!race) return;
  const r = RACES[race.idx];
  race.t += dt;
  const cp = r.checkpoints[race.cp];
  if (cp && dist(world.player.x, world.player.y, cp[0], cp[1]) < 78) {
    race.cp += 1;
    if (race.cp >= r.checkpoints.length) {
      if (race.t <= race.par) {
        world.player.money += r.pay;
        world.player.score += r.pay;
        world.raceWins += 1;
        notice(world, 'RACE WON', `${r.name} in ${race.t.toFixed(1)}s  +$${r.pay}`, 3);
      } else {
        notice(world, 'RACE LOST', `${r.name} — par was ${r.par}s, you ran ${race.t.toFixed(1)}s`, 3);
      }
      world.race = null;
      return;
    }
  }
  if (race.t > race.par + 45) {
    notice(world, 'RACE OVER', `${r.name} — out of time. Line up and try again.`, 2.6);
    world.race = null;
  }
}

// The live checkpoint the HUD/minimap should point at, or null.
export function raceTarget(world) {
  if (!world.race) return null;
  const r = RACES[world.race.idx];
  const cp = r.checkpoints[world.race.cp];
  if (!cp) return null;
  return { x: cp[0], y: cp[1], label: `${r.name} — checkpoint ${world.race.cp + 1}/${r.checkpoints.length}` };
}
