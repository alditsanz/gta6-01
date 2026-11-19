// Solmar Heat — shots.js
// The screenshot staging API. The play-test (and only the play-test)
// drives the game through window.__solmar: start the game, teleport the
// player, set the wanted level, the clock and the weather, start a
// mission, and hand the player a car. Nothing here changes how the game
// plays for a real player — it only stages scenes so the screenshots
// show the real systems working.

import { HEAT_PER_STAR } from './config.js';
import { startMission } from './missions.js';
import { startRace } from './sidejobs.js';
import { RACES } from './config.js';

export function installShotsApi(state, input) {
  if (typeof window === 'undefined') return;
  window.__solmar = {
    state,
    input,
    version: 'round9',
    // Jump straight into play from the title screen.
    play() {
      state.screen = 'play';
      return state.screen;
    },
    // Open the mission board.
    board() {
      state.screen = 'board';
      return state.screen;
    },
    // Move the player (and their car, if any) to a spot.
    teleport(x, y) {
      state.player.x = x;
      state.player.y = y;
      if (state.player.car) {
        state.player.car.x = x;
        state.player.car.y = y;
      }
      state.camera.x = x;
      state.camera.y = y;
      return { x, y };
    },
    // Put the player in a car of the given model, parked nearby.
    giveCar(model) {
      const car = state.parked.find((c) => c.model === model && !c.wrecked) || state.parked[0];
      car.stolen = true;
      state.player.inCar = true;
      state.player.car = car;
      state.player.angle = car.angle;
      state.player.x = car.x;
      state.player.y = car.y;
      state.player.speed = 0;
      return car.model;
    },
    // Set the wanted level directly (heat lands mid-band).
    setWanted(stars) {
      const s = Math.max(0, Math.min(5, stars));
      state.heat = s === 0 ? 0 : Math.min(100, s * HEAT_PER_STAR + HEAT_PER_STAR / 2);
      state.lastCrime = state.time;
      return s;
    },
    // Set the in-game clock hour (0..24).
    setTime(hour) {
      state.time = ((hour - 8 + 24) % 24) / 24 * 360;
      return hour;
    },
    // Force the weather: 'clear', 'rain' or 'fog'.
    setWeather(w) {
      state.weather = w;
      state.weatherTimer = 120;
      return w;
    },
    // Start a story job by id.
    mission(id) {
      state.screen = 'play';
      return startMission(state, id);
    },
    // Start a race by difficulty id ('easy' | 'medium' | 'hard').
    race(id) {
      const def = RACES.find((r) => r.id === id) || RACES[0];
      state.screen = 'play';
      return startRace(state, def);
    },
    // Give the player cash (staging only).
    giveMoney(n) {
      state.money += n;
      return state.money;
    },
    // Pause / resume.
    pause() {
      state.screen = 'pause';
      return state.screen;
    },
    // Clear any active mission, race and delivery (staging only).
    abort() {
      state.mission = { active: false, id: 0, def: null, stage: '', timer: 0, guards: [], ledgerTaken: false, escapeTimer: 0 };
      state.race = { active: false, def: null, index: 0, timer: 0, done: false };
      state.delivery = { active: false, pickedUp: false, x: 0, y: 0, destX: 0, destY: 0, timer: 0, spotted: false };
      state.turf.active = false;
      return true;
    },
    // Step out of the car on foot (staging only).
    onFoot() {
      state.player.inCar = false;
      state.player.car = null;
      state.player.speed = 0;
      return true;
    },
    // One-line summary of the live state, for the play-test to assert on.
    summary() {
      return {
        screen: state.screen,
        money: state.money,
        heat: Math.round(state.heat),
        stars: Math.min(5, Math.floor(state.heat / HEAT_PER_STAR)),
        x: Math.round(state.player.x),
        y: Math.round(state.player.y),
        inCar: state.player.inCar,
        mission: state.mission.active ? state.mission.id : 0,
        missionStage: state.mission.stage,
        cops: state.police.length,
        heli: !!state.heli,
        roadblocks: state.roadblocks.length,
        hour: Math.floor(state.clockHours),
        weather: state.weather,
        coins: state.coins.filter((c) => c.taken).length,
        carsStolen: state.stats.carsStolen,
        health: Math.round(state.player.health),
      };
    },
  };
}
