// SOLMAR HEAT — shots.js
// Deterministic staging for the screenshots: each ?shot= scene puts the
// game in a real, playable state (never a mock render) and steps the world
// forward with scripted inputs, so the screenshots are honest frames of
// the game itself. The same file also drives the logic test harness.
//
// Scenes:
//   start   — the title screen over the city at golden hour
//   drive   — Rex driving the Vento through downtown traffic
//   chase   — a 3-star police chase: two cruisers + foot cops, sirens on
//   mission  — the bank vault standoff: gangsters, gunfire, wanted stars

import { GAME, PLACES } from './config.js';
import { createWorld, startMission, addWanted, stepWorld } from './world.js';
import { mulberry32, angleDiff, clamp } from './random.js';

export const SHOT_NAMES = ['start', 'drive', 'chase', 'mission'];

// A scripted input object: the world steps read it like real input.
function scriptedInput() {
  return {
    keys: new Set(),
    mouse: { x: 640, y: 360, down: false, clicked: false, wheel: 0 },
    down: () => false,
    wasPressed: () => false,
    axisX: () => 0,
    axisY: () => 0,
    endFrame: () => {},
  };
}

function driveInput(steer, throttle) {
  const keys = new Set();
  if (throttle) keys.add('w');
  if (steer < 0) keys.add('a');
  if (steer > 0) keys.add('d');
  return {
    keys,
    mouse: { x: 640, y: 300, down: false, clicked: false, wheel: 0 },
    down: (...names) => names.some((n) => keys.has(n)),
    wasPressed: () => false,
    axisX: () => (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0),
    axisY: () => (keys.has('s') ? 1 : 0) - (keys.has('w') ? 1 : 0),
    endFrame: () => {},
  };
}

// A road-following driver: aim at a point ahead ON the avenue's centre
// line, so the staged car stays on the road at full speed.
// dir: +1 drives east, -1 drives west.
function roadDriver(world, i, streetY, dir = 1) {
  const car = world.player.inCar;
  if (!car) return driveInput(0, false);
  const targetX = car.x + dir * 320;
  const targetY = streetY + Math.sin(i / 55) * 10;
  const want = Math.atan2(targetY - car.y, targetX - car.x);
  const steer = clamp(angleDiff(car.angle, want) * 2.4, -1, 1);
  return driveInput(steer, true);
}

function stepN(world, input, audio, n, dt = 1 / 60) {
  for (let i = 0; i < n; i++) {
    stepWorld(world, input, audio, dt, { x: world.player.x + 200, y: world.player.y - 100 });
  }
}

function findParkedCoupe(world) {
  return world.cars.find((c) => c.missionCar) || world.cars.find((c) => c.type === 'coupe' && c.driver === 'parked');
}

export function stageShot(name, seed = GAME.seed) {
  const world = createWorld(seed);
  const audio = null; // screenshots run silent
  const rng = mulberry32(seed + 77);

  if (name === 'start') {
    world.screen = 'title';
    world.camera.x = 1800;
    world.camera.y = 1800;
    stepN(world, scriptedInput(), audio, 30);
    return world;
  }

  world.screen = 'play';
  if (name === 'drive') {
    const car = findParkedCoupe(world);
    // Rex is already behind the wheel, driving west along the paint
    // shop's avenue toward Lou's — the distance visibly shrinks.
    world.player.inCar = car;
    car.driver = 'player';
    car.x = 2600;
    car.y = 2200;
    car.angle = Math.PI;
    car.speed = 240;
    world.player.x = car.x;
    world.player.y = car.y;
    world.camera.x = car.x;
    world.camera.y = car.y;
    startMission(world, audio);
    world.missionStep = 2; // already stole it: drive to the paint shop
    for (let i = 0; i < 240; i++) {
      stepWorld(world, roadDriver(world, i, 2200, -1), audio, 1 / 60, { x: car.x - 300, y: car.y - 60 });
    }
    world.messages.length = 0; // clean frame: the intro toast has said its piece
    return world;
  }

  if (name === 'chase') {
    const car = findParkedCoupe(world);
    world.player.inCar = car;
    car.driver = 'player';
    car.x = 1400;
    car.y = 1800;
    car.angle = 0;
    car.speed = 300;
    world.player.x = car.x;
    world.player.y = car.y;
    world.camera.x = car.x;
    world.camera.y = car.y;
    world.missionIndex = 1;
    startMission(world, audio);
    world.missionStep = 2;
    addWanted(world, 3, 'The cops are onto you!');
    for (let i = 0; i < 260; i++) {
      stepWorld(world, roadDriver(world, i, 1800), audio, 1 / 60, { x: car.x + 300, y: car.y });
    }
    world.messages.length = 0;
    return world;
  }

  // mission: the bank vault standoff, on foot, pistol out.
  world.player.x = PLACES.bank.x - 10;
  world.player.y = PLACES.bank.y + 10;
  world.player.aimAngle = 0.6;
  world.camera.x = world.player.x;
  world.camera.y = world.player.y;
  world.missionIndex = 2;
  startMission(world, audio);
  world.missionStep = 1;
  world.waitTimer = 1.2; // vault cracking, ~70% when the frame is taken
  addWanted(world, 3, 'The vault is open — every cop in Solmar is coming!');
  // A few gangsters close in; one shot has already been fired.
  const g = world.gang;
  if (g.length === 0) {
    for (let i = 0; i < 3; i++) {
      g.push({
        x: world.player.x + 140 + rng() * 120,
        y: world.player.y - 80 + rng() * 160,
        angle: 0, hp: 3, shootCd: 0.5 + rng(), moveCd: 0,
      });
    }
  }
  stepN(world, scriptedInput(), audio, 100);
  return world;
}

// A headless logic check used by the test harness: every scene must stage
// without throwing and leave the world in the state its name promises.
export function checkScenes() {
  const results = {};
  for (const name of SHOT_NAMES) {
    const w = stageShot(name);
    results[name] = {
      screen: w.screen,
      playerInCar: !!w.player.inCar,
      wanted: w.player.wanted,
      cops: w.cops.length,
      gang: w.gang.length,
      mission: w.missionIndex,
      cars: w.cars.length,
      peds: w.peds.length,
    };
  }
  return results;
}
