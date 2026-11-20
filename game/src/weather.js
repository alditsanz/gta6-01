// Solmar Heat — weather.js
// Day/night clock plus rolling weather. Rain trims car grip, fog
// shortens the visible range, and rush hour follows the clock.

import { DAY_LENGTH } from './config.js';

export function createWeather() {
  return { clock: 17.2, kind: 'clear', timer: 55, rain: [], fogAlpha: 0 };
}
export function hourOf(w) { return w.clock % 24; }
export function skyPhase(clock) {
  const h = clock % 24;
  if (h >= 6 && h < 11) return 'morning';
  if (h >= 11 && h < 16.5) return 'day';
  if (h >= 16.5 && h < 19.5) return 'golden';
  if (h >= 19.5 && h < 21.5) return 'dusk';
  return 'night';
}
export function isNight(clock) { const p = skyPhase(clock); return p === 'night' || p === 'dusk'; }
export function gripFactor(w) { return w.kind === 'rain' ? 0.72 : 1; }
export function viewRange(w) { return w.kind === 'fog' ? 520 : 1400; }
export function rushDensity(hour) {
  if ((hour >= 7 && hour < 9) || (hour >= 17 && hour < 19)) return 2;
  if (hour >= 0 && hour < 5) return 0.5;
  return 1;
}
export function formatClock(clock) {
  const h = Math.floor(clock % 24), m = Math.floor(((clock % 24) - h) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
export function stepWeather(w, dt, rng) {
  w.clock = (w.clock + (dt * 24) / DAY_LENGTH) % 24;
  w.timer -= dt;
  if (w.timer <= 0) {
    w.timer = 45 + rng() * 40;
    const roll = rng();
    w.kind = roll < 0.62 ? 'clear' : roll < 0.84 ? 'rain' : 'fog';
  }
  w.fogAlpha += ((w.kind === 'fog' ? 0.35 : 0) - w.fogAlpha) * Math.min(1, dt * 0.8);
  if (w.kind === 'rain' && w.rain.length < 90) {
    for (let i = 0; i < 4; i++) w.rain.push({ x: Math.random() * 1280, y: -10, s: 620 + Math.random() * 260 });
  }
  for (const r of w.rain) { r.y += r.s * dt; r.x += 90 * dt; }
  w.rain = w.rain.filter((r) => r.y < 760);
  return w;
}
