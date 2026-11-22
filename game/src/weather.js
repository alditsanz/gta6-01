// Solmar Heat — weather.js
// The day clock, sky phases and the rolling weather system. Pure logic:
// the renderer asks this module what the sky looks like; missions never
// depend on it except that rain genuinely loosens car grip.

export const WEATHERS = [
  { id: 'clear', label: 'CLEAR', icon: '☀', grip: 1.0, view: 1.0 },
  { id: 'rain',  label: 'RAIN',  icon: '☂', grip: 0.78, view: 0.9 },
  { id: 'fog',   label: 'FOG',   icon: '≋', grip: 0.94, view: 0.62 },
];

export function skyPhase(clock) {
  // clock is hours 0..24. Phases drive light colour, shadow length and
  // which lamps/windows glow.
  if (clock >= 5.5 && clock < 8) return 'dawn';
  if (clock >= 8 && clock < 16.5) return 'day';
  if (clock >= 16.5 && clock < 19.5) return 'golden';
  if (clock >= 19.5 && clock < 21.5) return 'dusk';
  return 'night';
}

export function isNight(clock) {
  const p = skyPhase(clock);
  return p === 'night' || p === 'dusk';
}

export function createWeather(rng) {
  return {
    clock: 10.25,            // start mid-morning
    weatherIdx: 0,
    weatherTimer: 55,        // seconds until the weather may roll again
    phase: skyPhase(10.25),
  };
}

export function stepWeather(w, dt, rng, dayLengthSec) {
  w.clock = (w.clock + (dt * 24) / dayLengthSec) % 24;
  w.phase = skyPhase(w.clock);
  w.weatherTimer -= dt;
  if (w.weatherTimer <= 0) {
    w.weatherTimer = 45 + rng() * 50;
    const roll = rng();
    w.weatherIdx = roll < 0.55 ? 0 : roll < 0.8 ? 1 : 2;
  }
  return WEATHERS[w.weatherIdx];
}

export function weatherOf(w) {
  return WEATHERS[w.weatherIdx];
}

// Rush-hour traffic density as a pure function of the clock hour:
// peaks at the morning/evening commute, thin in the small hours.
export function trafficDensity(clock) {
  if ((clock >= 7 && clock < 9) || (clock >= 17 && clock < 19)) return 2.0;
  if (clock >= 0 && clock < 5) return 0.5;
  return 1.0;
}
