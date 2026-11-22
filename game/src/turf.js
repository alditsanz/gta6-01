// Solmar Heat — turf.js
// Territory control: five named zones, each held by a rival crew until
// Rex stands his ground inside it for a full hold timer while Vipers
// spawn and press him. Held zones pay income every in-game hour.

export const TURF_ZONES = [
  { id: 'mile',   name: 'Sunset Mile Turf',  x: 600,  y: 200,  r: 300, owner: 'Vipers' },
  { id: 'court',  name: 'Cactus Court Turf', x: 600,  y: 1400, r: 300, owner: 'Vipers' },
  { id: 'strip',  name: 'Neon Strip Turf',   x: 3000, y: 600,  r: 300, owner: 'Vipers' },
  { id: 'market', name: 'Old Market Turf',   x: 1400, y: 1400, r: 300, owner: 'Vipers' },
  { id: 'docks',  name: 'Pier 9 Turf',       x: 3000, y: 2600, r: 300, owner: 'Vipers' },
];

export const HOLD_SECONDS = 12;
export const TURF_INCOME_PER_HOUR = 6;

export function createTurf() {
  return {
    zones: TURF_ZONES.map((z) => Object.assign({}, z)),
    activeZone: null, holdTimer: 0, incomeClock: 0, spawnTimer: 0,
  };
}

export function zonesHeld(turf) {
  return turf.zones.filter((z) => z.owner === 'Rex').length;
}

export function zoneAt(turf, x, y) {
  for (const z of turf.zones) {
    const dx = x - z.x, dy = y - z.y;
    if (dx * dx + dy * dy < z.r * z.r) return z;
  }
  return null;
}

// Called every frame from main. Spawning attackers is the caller's job
// (it owns the gang list); this returns event strings.
export function stepTurf(world, dt) {
  const events = [];
  const turf = world.turf;
  const p = world.player;
  const zone = zoneAt(turf, p.x, p.y);
  if (turf.activeZone && (!zone || zone.id !== turf.activeZone)) {
    turf.activeZone = null; turf.holdTimer = 0; events.push('turf-lost-ground');
  }
  if (zone && zone.owner !== 'Rex') {
    if (turf.activeZone !== zone.id) { turf.activeZone = zone.id; turf.holdTimer = 0; events.push('turf-start'); }
    turf.holdTimer += dt;
    turf.spawnTimer -= dt;
    if (turf.spawnTimer <= 0) { turf.spawnTimer = 2.6; events.push('turf-spawn'); }
    if (turf.holdTimer >= HOLD_SECONDS) {
      zone.owner = 'Rex';
      turf.activeZone = null; turf.holdTimer = 0;
      world.stats.money += 200; world.stats.rp += 60; world.stats.score += 150;
      events.push('turf-flipped');
      if (zonesHeld(turf) === turf.zones.length) {
        world.stats.rp += 200; events.push('turf-all');
      }
    }
  }
  // Income tick: one in-game hour = day length / 24.
  turf.incomeClock += dt;
  const hourLen = 240 / 24;
  if (turf.incomeClock >= hourLen) {
    turf.incomeClock -= hourLen;
    const held = zonesHeld(turf);
    if (held > 0) { world.stats.money += held * TURF_INCOME_PER_HOUR; events.push('turf-income'); }
  }
  return events;
}
