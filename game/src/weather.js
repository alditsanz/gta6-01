// weather.js — the day clock's sky phases and rolling weather.
// Weather is atmosphere plus one real effect: rain cuts tyre grip.

export const WEATHERS = ['clear', 'rain', 'fog'];

export function skyPhase(clock) {
  if (clock >= 5.5 && clock < 11) return 'morning';
  if (clock >= 11 && clock < 16.5) return 'day';
  if (clock >= 16.5 && clock < 19.5) return 'golden';
  if (clock >= 19.5 && clock < 21.5) return 'dusk';
  return 'night';
}

export function isNight(clock) {
  const p = skyPhase(clock);
  return p === 'night' || p === 'dusk';
}

// Sky wash colour + strength per phase, used by the renderer.
export const PHASE_TINT = {
  morning: { color: 'rgba(255,214,150,0.06)', shadow: 10, warm: false },
  day:     { color: 'rgba(255,255,255,0.00)', shadow: 7,  warm: false },
  golden:  { color: 'rgba(255,150,50,0.16)',  shadow: 26, warm: true },
  dusk:    { color: 'rgba(90,60,140,0.20)',   shadow: 20, warm: true },
  night:   { color: 'rgba(8,12,40,0.42)',     shadow: 6,  warm: false },
};

export function gripFor(weather) {
  if (weather === 'rain') return 0.72;
  if (weather === 'fog') return 0.92;
  return 1;
}
export function viewRangeFor(weather) {
  return weather === 'fog' ? 0.62 : 1;
}

// Advance the weather machine: each kind lasts a while, then the
// seeded rng picks the next (clear is favoured).
export function stepWeather(world, dt) {
  world.weatherTimer -= dt;
  if (world.weatherTimer <= 0) {
    const r = world.rng();
    world.weather = r < 0.55 ? 'clear' : (r < 0.8 ? 'rain' : 'fog');
    world.weatherTimer = 70 + world.rng() * 80;
  }
}

export function formatClock(clock) {
  const h = Math.floor(clock) % 24;
  const m = Math.floor((clock - Math.floor(clock)) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
