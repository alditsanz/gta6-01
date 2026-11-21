// races.js — three street races: a start flag, a chain of
// checkpoints across Solmar, a par time and a cash prize scaled
// by difficulty. Failing pays nothing and can be retried at once.

export const RACES = [
  {
    id: 'r-mile', name: 'Sunset Mile Sprint', diff: 'EASY', par: 75, pay: 150,
    start: { x: 754, y: 354 },
    checkpoints: [{ x: 754, y: 1154 }, { x: 754, y: 1954 }, { x: 1554, y: 1954 }, { x: 1554, y: 2754 }],
  },
  {
    id: 'r-canal', name: 'Canal Row Run', diff: 'MEDIUM', par: 105, pay: 300,
    start: { x: 2354, y: 354 },
    checkpoints: [{ x: 2354, y: 1554 }, { x: 1554, y: 1554 }, { x: 1554, y: 2354 }, { x: 754, y: 2354 }, { x: 754, y: 3154 }],
  },
  {
    id: 'r-crown', name: 'Crown of Solmar', diff: 'HARD', par: 140, pay: 600,
    start: { x: 3154, y: 3154 },
    checkpoints: [{ x: 3154, y: 754 }, { x: 1954, y: 754 }, { x: 1954, y: 1954 }, { x: 754, y: 1954 }, { x: 754, y: 3154 }, { x: 1954, y: 3154 }],
  },
];

export function raceById(id) { return RACES.find(r => r.id === id); }

export function startRace(world, def) {
  world.race = { def, cp: 0, t: 0, done: false };
  return world.race;
}

export function stepRace(world, dt, events) {
  const race = world.race;
  if (!race || race.done) return;
  race.t += dt;
  const p = world.player;
  if (!p.car) return;
  const target = race.def.checkpoints[race.cp];
  if (target && Math.hypot(target.x - p.car.x, target.y - p.car.y) < 85) {
    race.cp++;
    events.push({ type: 'checkpoint', n: race.cp, total: race.def.checkpoints.length });
    if (race.cp >= race.def.checkpoints.length) {
      race.done = true;
      if (race.t <= race.def.par) {
        world.player.money += race.def.pay;
        world.player.rp += 30;
        world.stats.racesWon++;
        events.push({ type: 'race-won', def: race.def, t: race.t });
      } else {
        events.push({ type: 'race-late', def: race.def, t: race.t });
      }
      world.race = null;
    }
  }
}
