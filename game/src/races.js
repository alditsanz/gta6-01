// races.js — three street races, each a checkpoint route across
// Solmar with a par time. Beat par to win; the payout scales with
// the route's difficulty. A failed run can always be retried.

export const RACES = [
  { key: 'coast', name: 'Coast Run', par: 75, pay: 150, start: [300, 3400], points: [[300, 3400], [1500, 3400], [2700, 3300], [3300, 2500]] },
  { key: 'grid', name: 'Grid Runner', par: 95, pay: 300, start: [500, 500], points: [[500, 500], [1700, 900], [900, 2100], [2500, 2100], [2100, 500]] },
  { key: 'heat', name: 'Heat Lap', par: 120, pay: 600, start: [3300, 300], points: [[3300, 300], [1900, 300], [700, 1300], [1900, 2300], [3300, 1900], [3300, 300]] },
];

export function createRaceState() {
  return { active: null, idx: 0, t: 0, done: {} };
}

export function startRace(world, key) {
  const race = RACES.find((r) => r.key === key);
  if (!race || !world.player.car) return false;
  world.race = { active: race, idx: 0, t: 0, done: world.race.done };
  return true;
}

export function stepRace(world, dt) {
  const st = world.race;
  if (!st.active) return null;
  st.t += dt;
  const race = st.active;
  if (st.t > race.par) { st.active = null; return 'failed'; }
  const [tx, ty] = race.points[st.idx];
  if (Math.hypot(tx - world.player.x, ty - world.player.y) < 90) {
    st.idx++;
    if (st.idx >= race.points.length) {
      world.player.money += race.pay;
      st.done[race.key] = true;
      world.stats.racesWon = Object.keys(st.done).length;
      st.active = null;
      return 'won';
    }
  }
  return null;
}
