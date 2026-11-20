// Solmar Heat — shots.js
// Deterministic staging for the four screenshots. The same functions
// are used by the screenshot script and by the Node logic test, so a
// scene that stages here is exactly what the camera captures.

import { createWorld, setWanted, enterCar } from './world.js';
import { startMission, stepMission } from './missions.js';
import { landmarkById } from './landmarks.js';

export const SHOT_NAMES = ['start', 'drive', 'chase', 'mission'];

export function stageShot(name, seed) {
  const world = createWorld(seed == null ? 20261121 : seed);
  world.gameState = 'play';
  if (name === 'start') {
    world.gameState = 'title';
    world.player.x = 1800; world.player.y = 2050;
    world.weather.clock = 17.6;
  } else if (name === 'drive') {
    // Mission 1 completed at Lou's: red Vento parked at the paint
    // shop, MISSION PASSED +$150 banner up.
    const paint = landmarkById('paint');
    enterCar(world, world.vento);
    world.vento.x = paint.x - 30; world.vento.y = paint.y + 40; world.vento.angle = 0; world.vento.speed = 0;
    world.player.x = world.vento.x; world.player.y = world.vento.y;
    world.player.money += 150;
    world.banner = { text: 'MISSION PASSED', sub: "+$150 — Wheels for Lou · Lou's Paint Shop", t: 999 };
    world.missionsDone = 1;
    world.weather.clock = 17.8;
  } else if (name === 'chase') {
    // Four-star chase on an avenue: Rex at speed, cruiser behind,
    // roadblock ahead, helicopter not yet (that is 5 stars).
    enterCar(world, world.vento);
    const car = world.vento;
    car.x = 1800; car.y = 2000; car.angle = -Math.PI / 2; car.speed = 430;
    world.player.x = car.x; world.player.y = car.y;
    setWanted(world, 4);
    world.time = 2;
    // Force-spawn the response now so the frame is populated.
    for (let i = 0; i < 30; i++) world.time += 0.016;
    const paintShopBlock = landmarkById('hq'); void paintShopBlock;
    world.banner = null;
    startMission(world, 1);
    world.mission.distance = 996; // frozen frame: precompute the readout
    world.weather.clock = 18.1; world.weather.kind = 'clear';
  } else if (name === 'mission') {
    // Bank vault standoff: Rex in the circle, vault ~70%, seven
    // gang members around, three stars.
    const bank = landmarkById('bank');
    world.player.x = bank.x; world.player.y = bank.y;
    startMission(world, 2);
    world.mission.step = 1; world.vaultProgress = 0.7;
    world.gang = [];
    for (let i = 0; i < 7; i++) {
      world.gang.push({ x: bank.x + 80 + (i % 4) * 44, y: bank.y + 66 - Math.floor(i / 4) * 52, hp: 30 - (i % 3) * 8, angle: 3.14, shootCd: 2, strafe: 1 });
    }
    setWanted(world, 3);
    world.weather.clock = 16.9;
  }
  return world;
}
export { stepMission };
