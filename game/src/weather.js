// weather.js — Solmar weather and the day-clock sky phases.
// One job: roll clear/rain/fog on a timer, expose the grip and view
// range each kind imposes, and name the sky phase for an hour.

export const WEATHER_KINDS = ['clear', 'rain', 'fog'];

const GRIP = { clear: 1, rain: 0.82, fog: 0.95 };
const VIEW = { clear: 100000, rain: 100000, fog: 540 };

export function makeWeather(rng) {
  return { kind: 'clear', t: 55 + rng.range(0, 50), grip: 1, viewRange: VIEW.clear };
}

// Advance the weather clock; on expiry pick the next kind (weighted
// toward clear) and refresh the derived grip / view range.
export function stepWeather(world, dt) {
  const w = world.weather;
  w.t -= dt;
  if (w.t <= 0) {
    const roll = world.rng();
    w.kind = roll < 0.55 ? 'clear' : roll < 0.8 ? 'rain' : 'fog';
    w.t = 50 + world.rng.range(0, 60);
  }
  w.grip = GRIP[w.kind];
  w.viewRange = VIEW[w.kind];
}

// Sky phase for an hour in [0, 24). Golden and dusk are the postcard
// hours the screenshots are staged at.
export function skyPhase(clock) {
  if (clock < 5.5 || clock >= 21.5) return 'night';
  if (clock < 10.5) return 'morning';
  if (clock < 16.5) return 'day';
  if (clock < 19.5) return 'golden';
  return 'dusk';
}

// Rush-hour traffic multiplier for an hour: peaks at the commute,
// thin in the small hours. Pure function of the clock (testable).
export function trafficDensity(clock) {
  const h = Math.floor(clock);
  if ((h >= 7 && h < 9) || (h >= 17 && h < 19)) return 1.6;
  if (h >= 0 && h < 5) return 0.55;
  return 1;
}

// Format an hour float as "18:06".
export function clockText(clock) {
  const h = Math.floor(clock) % 24;
  const m = Math.floor((clock - Math.floor(clock)) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
