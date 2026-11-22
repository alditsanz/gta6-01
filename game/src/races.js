// Solmar Heat — races.js
// Three street-race routes (easy / medium / hard) run as checkpoint
// sequences. Beat the par time and the purse scales with difficulty;
// run dry and the route simply resets for another try.

import { dist } from './random.js';

export const RACES = [
  {
    id: 'coast', name: 'Coast Cruise', difficulty: 'EASY', par: 95, pay: 150,
    start: { x: 3200, y: 400 },
    points: [[3200, 1200], [2400, 1200], [2400, 400], [3200, 400]],
  },
  {
    id: 'grid', name: 'Grid Runner', difficulty: 'MEDIUM', par: 130, pay: 300,
    start: { x: 400, y: 400 },
    points: [[1200, 400], [1200, 1200], [2000, 1200], [2000, 400], [400, 400]],
  },
  {
    id: 'grand', name: 'Grand Solmar', difficulty: 'HARD', par: 175, pay: 600,
    start: { x: 400, y: 3200 },
    points: [[1600, 3200], [3200, 3200], [3200, 1600], [1600, 1600], [1600, 2400], [400, 3200]],
  },
];

export function raceById(id) { return RACES.find((r) => r.id === id) || null; }

export function startRace(world, raceId) {
  const def = raceById(raceId);
  if (!def) return null;
  world.race = { def, idx: 0, timer: def.par, done: false };
  return world.race;
}

export function stepRace(world, dt) {
  const events = [];
  const race = world.race;
  if (!race) return events;
  race.timer -= dt;
  if (race.timer <= 0) { world.race = null; events.push('race-failed'); return events; }
  const target = race.def.points[race.idx];
  if (target && dist(world.player.x, world.player.y, target[0], target[1]) < 95) {
    race.idx += 1;
    events.push('race-checkpoint');
    if (race.idx >= race.def.points.length) {
      const bonus = Math.floor(race.timer * 2);
      const pay = race.def.pay + bonus;
      world.stats.money += pay; world.stats.racesWon += 1;
      world.stats.rp += 45; world.stats.score += 120;
      world.flags['race_' + race.def.id] = true;
      world.race = null;
      events.push('race-won:' + pay);
    }
  }
  return events;
}

export function racesWon(world) {
  return RACES.filter((r) => world.flags['race_' + r.id]).length;
}
