// Solmar Heat — shots.js
// One job: deterministic scene setups for the maker's screenshots.
// A ?shot=start|drive|chase|mission URL parameter asks main.js to pose
// the game in that scene. Nothing here plays the game; it only arranges
// the state so a screenshot shows the systems that matter.

import { missionById } from './missions.js';
import { heatBandMid } from './world.js';
import { createGuard } from './combat.js';

export const SHOT_NAMES = ['start', 'drive', 'chase', 'mission'];

export function shotFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    return SHOT_NAMES.includes(shot) ? shot : null;
  } catch (e) {
    return null;
  }
}

// Pose the game for a screenshot. Called once after the world is built,
// before the first frame is drawn.
export function applyShot(state, shot) {
  if (!state || !shot) return;
  if (shot === 'start') {
    state.mode = 'title';
    return;
  }
  if (shot === 'drive') {
    state.mode = 'play';
    // Put the player behind the wheel of a Falco on a Sunset Mile road,
    // mid-morning, with a couple of traffic cars alongside.
    const car = state.playerCar || null;
    if (car) {
      state.player.x = 568;
      state.player.y = 568;
      state.player.inCar = true;
      state.player.car = car;
      car.x = 568;
      car.y = 568;
      car.angle = 0;
      car.speed = 240;
      state.carsStolen = 1;
    }
    state.clock.hour = 10;
    state.clock.minute = 15;
    return;
  }
  if (shot === 'chase') {
    state.mode = 'play';
    // Five stars, police on the tail, a roadblock ahead, the helicopter
    // overhead, and a mission timer running — several systems at once.
    const car = state.playerCar || null;
    if (car) {
      state.player.x = 1096;
      state.player.y = 1096;
      state.player.inCar = true;
      state.player.car = car;
      car.x = 1096;
      car.y = 1096;
      car.angle = 0;
      car.speed = 320;
      state.carsStolen = 1;
    }
    state.heat = heatBandMid(5);
    state.clock.hour = 17;
    state.clock.minute = 42;
    state.weather = 'clear';
    startMissionForShot(state, 6);
    return;
  }
  if (shot === 'mission') {
    state.mode = 'play';
    // The ledger heist at SCPD Headquarters: guards with health pips,
    // ammo on the HUD, four stars overhead.
    state.player.x = 1830;
    state.player.y = 460;
    state.player.inCar = false;
    state.player.car = null;
    state.heat = heatBandMid(4);
    state.clock.hour = 21;
    state.clock.minute = 5;
    state.weather = 'clear';
    startMissionForShot(state, 7);
    return;
  }
}

function startMissionForShot(state, missionId) {
  const mission = missionById(missionId);
  if (!mission) return;
  state.mission = {
    id: mission.id,
    stage: 0,
    timer: missionId === 7 ? mission.timer : 85,
    escapeTimer: 0,
    started: true,
  };
  if (missionId === 7) {
    state.guards = [
      createGuard(1880, 280, 3),
      createGuard(1990, 300, 3),
      createGuard(1940, 380, 3),
    ];
    state.ledger = { x: 1940, y: 315, taken: false };
  }
}
