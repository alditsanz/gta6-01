// weather.js — Solmar's clock and sky. The clock runs a full day in
// a few real minutes; weather rolls between clear, rain and fog.
// Rain is the only weather with a gameplay effect: it cuts grip.

export const WEATHERS = ['clear', 'rain', 'fog'];

export function skyPhase(hour) {
  if (hour < 5.5) return 'night';
  if (hour < 8) return 'morning';
  if (hour < 16.5) return 'day';
  if (hour < 19.5) return 'golden';
  if (hour < 21.5) return 'dusk';
  return 'night';
}

export function createWeather(rng) {
  return { kind: 'clear', timer: 90, roll: rng };
}

export function stepWeather(world, dt) {
  // A full Solmar day passes in about four real minutes of play.
  world.clock = (world.clock + dt * 0.1) % 24;
  const w = world.weatherState;
  w.timer -= dt;
  if (w.timer <= 0) {
    const r = world.rng();
    w.kind = r < 0.55 ? 'clear' : r < 0.8 ? 'rain' : 'fog';
    w.timer = 60 + world.rng() * 90;
  }
}

export function gripFactor(world) {
  return world.weatherState.kind === 'rain' ? 0.78 : 1;
}

export function viewFactor(world) {
  return world.weatherState.kind === 'fog' ? 0.62 : 1;
}

export function rushFactor(hour) {
  if ((hour >= 7 && hour < 9) || (hour >= 17 && hour < 19)) return 2;
  if (hour >= 0 && hour < 5) return 0.5;
  return 1;
}

export function formatClock(hour) {
  const h = Math.floor(hour); const m = Math.floor((hour - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
