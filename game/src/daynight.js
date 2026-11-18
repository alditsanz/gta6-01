// Solmar Heat — day / night + weather (NEW in round 6).
// A full in-game day lasts 240 real seconds, starting at 08:00.
// Night (20:00–06:00) darkens the city, lights the windows and lamps,
// and the player's car gets a headlight cone; police spot you a little
// slower in the dark. Weather rolls every 40–60 seconds: clear, rain
// or fog. Rain makes the roads slippery (grip 0.72 — longer braking,
// wider slides); fog closes the view in. The HUD shows the clock and
// the weather, so both systems are always visible.

const DayNight = {
  minutes: 8 * 60,   // 08:00 at the start of a run
  weather: 'clear',  // 'clear' | 'rain' | 'fog'
  weatherTimer: 45,
  rainDrops: [],

  init() {
    this.minutes = 8 * 60;
    this.weather = 'clear';
    this.weatherTimer = 45;
    this.rainDrops = [];
    for (let i = 0; i < 90; i++) {
      this.rainDrops.push({
        x: Math.random(), y: Math.random(),
        len: 10 + Math.random() * 14, spd: 0.9 + Math.random() * 0.7,
      });
    }
  },

  update(dt) {
    this.minutes = (this.minutes + (dt / CFG.dayLengthSec) * 1440) % 1440;
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      this.weatherTimer = 40 + Math.random() * 20;
      const roll = Math.random();
      this.weather = roll < 0.6 ? 'clear' : roll < 0.85 ? 'rain' : 'fog';
    }
    if (this.weather === 'rain') {
      for (const d of this.rainDrops) {
        d.y += d.spd * dt;
        d.x += 0.12 * dt;
        if (d.y > 1) { d.y = -0.05; d.x = Math.random(); }
        if (d.x > 1) d.x = 0;
      }
    }
  },

  isNight() {
    return this.minutes >= CFG.nightStartMin || this.minutes < CFG.nightEndMin;
  },

  // 0 in full daylight, 1 at the depth of night. Dawn/dusk blend.
  darkness() {
    const m = this.minutes;
    const fade = 60; // minutes of blend at each edge
    if (m >= CFG.nightStartMin && m < CFG.nightStartMin + fade) return (m - CFG.nightStartMin) / fade;
    if (m >= CFG.nightEndMin - fade && m < CFG.nightEndMin) return 1 - (m - (CFG.nightEndMin - fade)) / fade;
    if (m >= CFG.nightStartMin || m < CFG.nightEndMin) return 1;
    return 0;
  },

  clockText() {
    const h = Math.floor(this.minutes / 60);
    const m = Math.floor(this.minutes % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  },

  weatherLabel() {
    if (this.weather === 'rain') return 'Rain — slippery roads';
    if (this.weather === 'fog') return 'Fog — low visibility';
    return this.isNight() ? 'Clear night' : 'Clear day';
  },

  // Grip multiplier for driving right now.
  grip() {
    return this.weather === 'rain' ? CFG.rainGrip : 1;
  },

  // Police spot the player a little slower in the dark.
  policeVision() {
    return this.isNight() ? 0.8 : 1;
  },
};
