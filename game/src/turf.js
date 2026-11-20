// Solmar Heat — turf.js
// Territory control: challenge a rival zone, hold it against the
// crew, flip its owner, and collect hourly income for zones held.

import { dist } from './random.js';

export const TURF_ZONES = [
  { id: 'sunset', name: 'Sunset Mile', x: 600, y: 600, owner: 'Vipers' },
  { id: 'neon', name: 'Neon Strip', x: 3000, y: 600, owner: 'Harbor Boys' },
  { id: 'docks', name: 'Pier 9 Docks', x: 3000, y: 3000, owner: 'Harbor Boys' },
  { id: 'palms', name: 'Palm Heights', x: 600, y: 3000, owner: 'Vipers' },
  { id: 'downtown', name: 'Downtown', x: 1800, y: 1800, owner: 'Kane Syndicate' },
];
export function createTurf() {
  return { zones: TURF_ZONES.map((z) => ({ ...z })), challenge: null, incomeTimer: 0 };
}
export function zonesHeld(t) { return t.zones.filter((z) => z.owner === 'Rex').length; }
export function startChallenge(world, zoneId) {
  const t = world.turf; const z = t.zones.find((x) => x.id === zoneId);
  if (!z || z.owner === 'Rex' || t.challenge) return false;
  if (dist(world.player.x, world.player.y, z.x, z.y) > 320) return false;
  t.challenge = { zoneId, time: 12 };
  for (let i = 0; i < 3; i++) world.gang.push({ x: z.x + 60 + i * 30, y: z.y + 50, hp: 30, angle: 3, shootCd: 1.4, strafe: 1 });
  return true;
}
export function stepTurf(world, dt) {
  const t = world.turf; if (!t) return;
  if (t.challenge) {
    const z = t.zones.find((x) => x.id === t.challenge.zoneId);
    if (world.player.dead || dist(world.player.x, world.player.y, z.x, z.y) > 380) {
      t.challenge = null; world.events.push({ type: 'turfLost' });
    } else {
      t.challenge.time -= dt;
      if (t.challenge.time <= 0) {
        z.owner = 'Rex'; t.challenge = null;
        world.events.push({ type: 'turfWon', zone: z.name });
        world.banner = { text: 'TURF TAKEN', sub: z.name + ' flies your colours', t: 3 };
        if (zonesHeld(t) === t.zones.length) world.player.rank = 'King of the Mile';
      }
    }
  }
  t.incomeTimer += dt;
  if (t.incomeTimer >= 60) { // one in-game hour tick
    t.incomeTimer = 0;
    const pay = zonesHeld(t) * 6;
    if (pay > 0) { world.player.money += pay; world.turfIncome = pay; }
  }
}
