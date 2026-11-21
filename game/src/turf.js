// turf.js — five turf zones fought over by Solmar's crews. Hold a
// rival zone through a timed defence to flip it; held zones pay a
// small income each in-game hour and all five held earns a bonus.

export const TURF_ZONES = [
  { key: 'mile', name: 'Sunset Mile', x: 600, y: 600, r: 330, owner: 'Vipers', color: '#c9534e' },
  { key: 'strip', name: 'Neon Strip', x: 2600, y: 600, r: 330, owner: 'Vipers', color: '#c9534e' },
  { key: 'market', name: 'Old Market', x: 600, y: 1800, r: 330, owner: 'Dockside', color: '#4e7fc9' },
  { key: 'canal', name: 'Canal Row', x: 1800, y: 2600, r: 330, owner: 'Dockside', color: '#4e7fc9' },
  { key: 'docks', name: 'Pier 9 Docks', x: 3000, y: 3000, r: 330, owner: 'Cartel', color: '#a86fd9' },
];

export function createTurf() {
  return TURF_ZONES.map((z) => ({ ...z, holdT: 0, active: false }));
}

export function zoneAt(world, x, y) {
  return world.turf.find((z) => Math.hypot(z.x - x, z.y - y) < z.r) || null;
}

export function startChallenge(world, zone) {
  if (!zone || zone.owner === 'Rex') return false;
  zone.active = true; zone.holdT = 0;
  world.gang = world.gang || [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    world.gang.push({ x: zone.x + Math.cos(a) * 180, y: zone.y + Math.sin(a) * 180, hp: 3, maxHp: 3, speed: 62, flee: false });
  }
  return true;
}

export const HOLD_SECONDS = 20;
export const TURF_INCOME = 6;

export function stepTurf(world, dt) {
  for (const z of world.turf) {
    if (!z.active) continue;
    const inside = Math.hypot(z.x - world.player.x, z.y - world.player.y) < z.r;
    if (world.player.hp <= 0 || !inside) { z.active = false; z.holdT = 0; continue; }
    z.holdT += dt;
    if (z.holdT >= HOLD_SECONDS) {
      z.owner = 'Rex'; z.active = false; z.holdT = 0;
      world.stats.turfHeld = world.turf.filter((t) => t.owner === 'Rex').length;
      if (world.stats.turfHeld === world.turf.length) world.player.money += 500;
    }
  }
}

export function turfIncome(world) {
  return world.turf.filter((z) => z.owner === 'Rex').length * TURF_INCOME;
}
