// Solmar Heat — sky and weather. A 24-hour clock drives the light
// phases; a slow dice roll swaps clear skies for rain or fog, and the
// renderer reads grip/view factors straight off the active entry.

export const WEATHERS = [
  { id: 'clear', label: 'CLEAR', grip: 1.0, view: 1.0 },
  { id: 'rain', label: 'RAIN', grip: 0.78, view: 0.9 },
  { id: 'fog', label: 'FOG', grip: 0.94, view: 0.62 },
];

export function skyPhase(clock) {
  if (clock >= 5.5 && clock < 8) return 'dawn';
  if (clock >= 8 && clock < 16.5) return 'day';
  if (clock >= 16.5 && clock < 19.5) return 'golden';
  if (clock >= 19.5 && clock < 21.5) return 'dusk';
  return 'night';
}

export function isNight(clock) {
  const phase = skyPhase(clock);
  return phase === 'night' || phase === 'dusk';
}

export function createWeather(rng) {
  void rng;
  return { clock: 10.25, weatherIdx: 0, weatherTimer: 55, phase: skyPhase(10.25) };
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

// Rush hours double the traffic on the avenues; the small hours thin it.
export function trafficDensity(clock) {
  if ((clock >= 7 && clock < 9) || (clock >= 17 && clock < 19)) return 2.0;
  if (clock >= 0 && clock < 5) return 0.5;
  return 1.0;
}
