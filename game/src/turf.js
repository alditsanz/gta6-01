// Solmar Heat — turf war. Five Viper-held zones flip to Rex if he
// stands his ground inside one for a full hold while the crew presses
// in; held ground pays a quiet hourly tribute.

export const TURF_ZONES = [
  { id: 'mile', name: 'Sunset Mile Turf', x: 600, y: 200, r: 300, owner: 'Vipers' },
  { id: 'court', name: 'Cactus Court Turf', x: 600, y: 1400, r: 300, owner: 'Vipers' },
  { id: 'strip', name: 'Neon Strip Turf', x: 3000, y: 600, r: 300, owner: 'Vipers' },
  { id: 'market', name: 'Old Market Turf', x: 1400, y: 1400, r: 300, owner: 'Vipers' },
  { id: 'docks', name: 'Pier 9 Turf', x: 3000, y: 2600, r: 300, owner: 'Vipers' },
];

export const HOLD_SECONDS = 12;
export const TURF_INCOME_PER_HOUR = 6;

export function createTurf() {
  return {
    zones: TURF_ZONES.map((z) => ({ ...z })),
    activeZone: null,
    holdTimer: 0,
    incomeClock: 0,
    spawnTimer: 0,
  };
}

export function zonesHeld(turf) {
  return turf.zones.filter((z) => z.owner === 'Rex').length;
}

export function zoneAt(turf, x, y) {
  for (const zone of turf.zones) {
    const dx = x - zone.x;
    const dy = y - zone.y;
    if (dx * dx + dy * dy < zone.r * zone.r) return zone;
  }
  return null;
}

export function stepTurf(world, dt) {
  const events = [];
  const turf = world.turf;
  const p = world.player;
  const here = zoneAt(turf, p.x, p.y);

  if (turf.activeZone && (!here || here.id !== turf.activeZone)) {
    turf.activeZone = null;
    turf.holdTimer = 0;
    events.push('turf-lost-ground');
  }

  if (here && here.owner !== 'Rex') {
    if (turf.activeZone !== here.id) {
      turf.activeZone = here.id;
      turf.holdTimer = 0;
      events.push('turf-start');
    }
    turf.holdTimer += dt;
    turf.spawnTimer -= dt;
    if (turf.spawnTimer <= 0) {
      turf.spawnTimer = 2.6;
      events.push('turf-spawn');
    }
    if (turf.holdTimer >= HOLD_SECONDS) {
      here.owner = 'Rex';
      turf.activeZone = null;
      turf.holdTimer = 0;
      world.stats.money += 200;
      world.stats.rp += 60;
      world.stats.score += 150;
      events.push('turf-flipped');
      if (zonesHeld(turf) === turf.zones.length) {
        world.stats.rp += 200;
        events.push('turf-all');
      }
    }
  }

  // One in-game hour is DAY_LENGTH_SEC/24 = 10 real seconds.
  turf.incomeClock += dt;
  if (turf.incomeClock >= 10) {
    turf.incomeClock -= 10;
    const heldCount = zonesHeld(turf);
    if (heldCount > 0) {
      world.stats.money += heldCount * TURF_INCOME_PER_HOUR;
      events.push('turf-income');
    }
  }

  return events;
}
