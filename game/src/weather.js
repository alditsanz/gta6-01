// weather.js — day/night clock, sky phases, weather and rush hour.
// One full in-game day lasts a few real minutes. Weather (clear, rain,
// fog) rolls on a timer; rain cuts car grip, fog shortens view range.
// Rush hour is a pure function of the clock hour, so it is testable.

export const DAY_LENGTH_SECONDS = 300; // 5 real minutes per in-game day
export const WEATHERS = ['clear', 'rain', 'fog'];

export function phaseForHour(hour) {
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}

export const SKY_COLORS = {
  dawn: '#f7b267', day: '#87ceeb', dusk: '#f4845f', night: '#16213a',
};

export function skyColorForHour(hour) { return SKY_COLORS[phaseForHour(hour)]; }
export function streetlightsOn(hour) { const p = phaseForHour(hour); return p === 'night' || p === 'dusk' || p === 'dawn'; }
export function darknessForHour(hour) {
  const p = phaseForHour(hour);
  return p === 'night' ? 0.55 : p === 'dusk' ? 0.28 : p === 'dawn' ? 0.18 : 0;
}

// Rush hour: peaks at 07-09 and 17-19 (2x), quiet at 00-05 (0.5x).
export function rushHourDensity(hour) {
  if ((hour >= 7 && hour < 9) || (hour >= 17 && hour < 19)) return 2;
  if (hour >= 0 && hour < 5) return 0.5;
  return 1;
}

export function gripForWeather(weather) { return weather === 'rain' ? 0.82 : 1; }
export function viewRangeForWeather(weather) { return weather === 'fog' ? 420 : 950; }

export class WeatherSystem {
  constructor(rng) {
    this.rng = rng || Math.random;
    this.minutes = 10 * 60; // start at 10:00
    this.weather = 'clear';
    this.weatherTimer = 55; // seconds until the weather may change
    this.lastHour = 10;
    this.hourChanged = false;
  }

  hour() { return Math.floor(this.minutes / 60) % 24; }
  minuteOfHour() { return Math.floor(this.minutes % 60); }

  clockText() {
    const h = String(this.hour()).padStart(2, '0');
    const m = String(this.minuteOfHour()).padStart(2, '0');
    return h + ':' + m;
  }

  phase() { return phaseForHour(this.hour()); }
  density() { return rushHourDensity(this.hour()); }
  grip() { return gripForWeather(this.weather); }
  viewRange() { return viewRangeForWeather(this.weather); }

  update(dt) {
    const prevHour = this.hour();
    this.minutes += (dt / DAY_LENGTH_SECONDS) * 24 * 60;
    if (this.minutes >= 24 * 60) this.minutes -= 24 * 60;
    this.hourChanged = this.hour() !== prevHour;
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      this.weatherTimer = 45 + this.rng() * 40;
      const roll = this.rng();
      this.weather = roll < 0.55 ? 'clear' : (roll < 0.8 ? 'rain' : 'fog');
    }
    return this.hourChanged;
  }

  setWeather(w) { if (WEATHERS.includes(w)) this.weather = w; }
  setHour(h) { this.minutes = (h % 24) * 60 + (this.minutes % 60); }
}
