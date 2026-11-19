// Solmar Heat — weather.js
// The living clock, the sky and the weather. Pure functions over a small
// state object, so the logic test can drive them without a browser.
//
// The clock: one in-game hour lasts 15 real seconds, so a full day takes
// six real minutes. Weather rolls every 45 seconds.

export const SECONDS_PER_HOUR = 15;
export const WEATHER_ROLL_SECONDS = 45;

/** Fresh clock/weather state. */
export function createClock() {
  return {
    time: 8 * 3600, // seconds since midnight; the game opens at 08:00
    weather: 'clear', // 'clear' | 'rain' | 'fog'
    weatherTimer: WEATHER_ROLL_SECONDS,
    rainDrops: [],
  };
}

/** Advance the clock by dt real seconds; returns the weather roll events. */
export function tickClock(clock, dt, rng) {
  clock.time = (clock.time + dt * 3600 / SECONDS_PER_HOUR) % 86400;
  clock.weatherTimer -= dt;
  if (clock.weatherTimer <= 0) {
    clock.weatherTimer = WEATHER_ROLL_SECONDS;
    const roll = rng();
    const next = roll < 0.6 ? 'clear' : roll < 0.85 ? 'rain' : 'fog';
    if (next !== clock.weather) {
      clock.weather = next;
      return { changed: true, weather: next };
    }
  }
  return { changed: false, weather: clock.weather };
}

/** Current hour of day, 0..23. */
export function hourOf(clock) {
  return Math.floor(clock.time / 3600) % 24;
}

/** Minutes past the hour, 0..59. */
export function minuteOf(clock) {
  return Math.floor((clock.time % 3600) / 60);
}

/** "08:24" style clock text for the HUD. */
export function clockText(clock) {
  const h = String(hourOf(clock)).padStart(2, '0');
  const m = String(minuteOf(clock)).padStart(2, '0');
  return `${h}:${m}`;
}

/** Sky phase for an hour: day / dusk / night / dawn. */
export function skyPhase(hour) {
  if (hour >= 6 && hour < 18) return 'day';
  if (hour >= 18 && hour < 20) return 'dusk';
  if (hour >= 5 && hour < 6) return 'dawn';
  return 'night';
}

/** Is it dark enough for streetlights and lit windows? */
export function isNight(hour) {
  const p = skyPhase(hour);
  return p === 'night' || p === 'dusk';
}

/** Rain reduces grip a little; fog does not touch the car, only the view. */
export function gripFactor(weather) {
  return weather === 'rain' ? 0.85 : 1.0;
}

/** Fog shortens how far the player can see (render range multiplier). */
export function viewRangeFactor(weather) {
  return weather === 'fog' ? 0.55 : 1.0;
}

/**
 * Rush-hour traffic density as a pure function of the clock hour:
 * peak hours (07:00–09:00, 17:00–19:00) run about twice the usual traffic,
 * quiet night hours (00:00–05:00) about half, everything else baseline.
 */
export function trafficDensity(hour) {
  if ((hour >= 7 && hour < 9) || (hour >= 17 && hour < 19)) return 2.0;
  if (hour >= 0 && hour < 5) return 0.5;
  return 1.0;
}

/** How many traffic cars the density calls for (base 14). */
export function trafficTarget(hour, base = 14) {
  return Math.round(base * trafficDensity(hour));
}
