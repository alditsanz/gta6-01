// Solmar Heat — races.js
// Three street-race routes with checkpoint sequences and par times.

import { dist } from './random.js';

export const RACES = [
  { id: 'mile', name: 'Sunset Mile Sprint', diff: 'easy', par: 75, pay: 150, points: [[1000, 600], [1800, 600], [2600, 1000]] },
  { id: 'canal', name: 'Canal Row Run', diff: 'medium', par: 105, pay: 300, points: [[3000, 1400], [2200, 2200], [1400, 2600], [1000, 1800]] },
  { id: 'heat', name: 'Harbor Heat GP', diff: 'hard', par: 140, pay: 600, points: [[600, 3000], [1400, 3000], [2600, 2600], [3000, 1400], [1800, 1000]] },
];
export function createRaceState() { return { active: null, idx: 0, time: 0, done: {} }; }
export function startRace(world, raceId) {
  const r = RACES.find((x) => x.id === raceId); if (!r || !world.player.car) return false;
  world.race = { active: r, idx: 0, time: 0 };
  return true;
}
export function stepRace(world, dt) {
  const st = world.race; if (!st || !st.active) return;
  st.time += dt;
  const r = st.active; const p = world.player;
  const cp = r.points[st.idx];
  if (cp && dist(p.x, p.y, cp[0], cp[1]) < 95) {
    st.idx += 1; world.events.push({ type: 'checkpoint', idx: st.idx });
    if (st.idx >= r.points.length) {
      if (st.time <= r.par) { p.money += r.pay; world.banner = { text: 'RACE WON', sub: '+$' + r.pay + ' — ' + r.name, t: 3.5 }; }
      else world.banner = { text: 'RACE DONE — OVER PAR', sub: r.name, t: 3 };
      world.raceDone = world.raceDone || {}; world.raceDone[r.id] = st.time;
      world.race = createRaceState(); return;
    }
  }
  if (st.time > r.par * 2.2) { world.banner = { text: 'RACE FAILED', sub: 'Out of time — retry at the flag', t: 3 }; world.race = createRaceState(); }
}
