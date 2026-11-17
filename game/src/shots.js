// Screenshot staging for Solmar Heat: ?shot=start|drive|chase|mission
// (with &seed=N) puts the game into a fixed, deterministic scene so the
// four screenshots are real renders of the game's own code.

import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';
import { LANDMARKS } from './config.js';
import { startMission } from './main.js';

/** Stage one named scene on a fresh state. Deterministic for a fixed seed. */
export function stageShot(state, name) {
  const p = state.player;
  if (name === 'start') {
    state.screen = SCREEN_TITLE;
    state.money = 1250;
    state.missionsDone = [true, true, false, false, false, false, false];
    state.rank = 2;
    state.saveExists = true;
    return;
  }
  state.screen = SCREEN_PLAY;
  if (name === 'drive') {
    // Cruising down Sunset Mile in the Falco, traffic around, coins ahead.
    const falco = state.cars.find((c) => c.model === 'Falco');
    p.inCar = true;
    p.car = falco;
    falco.stolen = true;
    falco.x = 103;
    falco.y = 871;
    falco.angle = 0;
    falco.speed = 260;
    p.x = falco.x;
    p.y = falco.y;
    p.angle = 0;
    state.money = 1840;
    state.score = 3120;
    state.carsStolen = 3;
    state.faresDone = 2;
    state.nearMisses = 5;
    state.coins[4].taken = true;
    state.coins[8].taken = true;
    state.rank = 2;
    state.traffic[0].x = 420;
    state.traffic[0].y = 871;
    state.traffic[1].x = 700;
    state.traffic[1].y = 839;
    state.traffic[2].x = 103;
    state.traffic[2].y = 1127;
    state.traffic[2].angle = Math.PI / 2;
    state.peds[0].x = 160;
    state.peds[0].y = 820;
    state.peds[1].x = 500;
    state.peds[1].y = 930;
    setToast(state, 'Near miss! +$15', true);
    return;
  }
  if (name === 'chase') {
    // Job 6 in full flight: 4 stars, a roadblock ahead, police on the tail,
    // the Pier 9 timer running, the objective on the HUD.
    state.missionsDone = [true, true, true, true, true, false, false];
    state.rank = 5;
    startMission(state, 6);
    state.mission.t = 42;
    const falco = state.cars.find((c) => c.model === 'Falco');
    p.inCar = true;
    p.car = falco;
    falco.stolen = true;
    falco.x = 1383;
    falco.y = 1895;
    falco.angle = 0;
    falco.speed = 330;
    p.x = falco.x;
    p.y = falco.y;
    p.angle = 0;
    state.heat = 90;
    state.stars = 4;
    state.money = 3210;
    state.score = 8450;
    state.carsStolen = 6;
    state.faresDone = 4;
    state.nearMisses = 9;
    state.rank = 5;
    state.roadblocks = [{ x: 1895, y: 1895, angle: Math.PI / 2 }];
    state.police = [
      { x: 1127, y: 1895, angle: 0, speed: 380, maxSpeed: 390, path: [], pathI: 0, repath: 0, siren: 1 },
      { x: 1639, y: 2151, angle: Math.PI / 2, speed: 360, maxSpeed: 390, path: [], pathI: 0, repath: 0, siren: 3 },
    ];
    state.traffic[0].x = 1639;
    state.traffic[0].y = 1895;
    state.traffic[1].x = 1383;
    state.traffic[1].y = 2151;
    setToast(state, '3 stars from the start — run!', false);
    return;
  }
  if (name === 'mission') {
    // The Last Ledger at SCPD HQ: guards with health pips, the player
    // aiming on foot, ammo on the HUD, 4 stars overhead.
    state.missionsDone = [true, true, true, true, true, true, false];
    state.rank = 6;
    startMission(state, 7);
    p.inCar = false;
    p.car = null;
    p.x = LANDMARKS.hq.x - 190;
    p.y = LANDMARKS.hq.y + 60;
    p.angle = 0;
    p.health = 82;
    state.weapon.mag = 9;
    state.weapon.reserve = 36;
    state.guards[0].health = 66;
    state.money = 4980;
    state.score = 12400;
    state.carsStolen = 8;
    state.faresDone = 5;
    state.nearMisses = 12;
    state.rank = 6;
    state.bullets = [{ x: p.x + 90, y: p.y - 6, px: p.x + 40, py: p.y - 6, vx: 900, vy: 0, life: 0.5 }];
    return;
  }
  // Unknown shot name: fall back to the title screen.
  state.screen = SCREEN_TITLE;
}

function setToast(state, text, good) {
  state.toast = { text, t: state.time, good: !!good };
}
