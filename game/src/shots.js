// shots.js — deterministic states for the four screenshots, driven by query params.
//   ?shot=start   — title screen over the city
//   ?shot=drive   — the player driving a stolen car through traffic
//   ?shot=chase   — a police chase: wanted stars, minimap, mission banner, cops closing in
//   ?shot=mission — a story mission in progress with its marker and objective on screen
// Every state is built from the same seeded world, so a re-render looks the same.
import { roadCenter } from './world.js';
import { CARS } from './config.js';

export function applyShot(game, shot, seed) {
  const world = game.world;
  const player = world.player;
  if (shot === 'start') {
    game.state = 'start';
    return;
  }
  if (shot === 'drive') {
    game.state = 'play';
    const car = world.cars[1];
    car.stolen = true;
    world.carsStolen = 1;
    player.onFoot = false;
    player.car = car;
    car.x = roadCenter(4);
    car.y = roadCenter(4);
    car.angle = Math.PI / 2;
    car.speed = 220;
    player.x = car.x;
    player.y = car.y;
    world.cash = 1250;
    return;
  }
  if (shot === 'chase') {
    game.state = 'play';
    world.startMission(1);
    const car = world.cars.find((c) => c.def === 7);
    car.stolen = true;
    world.carsStolen = 1;
    player.onFoot = false;
    player.car = car;
    car.x = roadCenter(4);
    car.y = roadCenter(5);
    car.angle = 0;
    car.speed = 260;
    player.x = car.x;
    player.y = car.y;
    world.cash = 2400;
    world.addHeat(14, 'Grand theft auto');
    // park three cop cars right behind the player for the chase frame
    for (let i = 0; i < 3; i++) {
      world.police.push({
        id: `shot-cop-${i}`,
        x: car.x - 160 - i * 90,
        y: car.y + (i - 1) * 46,
        angle: 0, speed: 280,
        path: [], pathIndex: 0, repath: 0, sirenPhase: i * 2,
      });
    }
    world.flash('The Falco is yours — lose the cops, reach the garage');
    return;
  }
  if (shot === 'mission') {
    game.state = 'play';
    const car = world.cars[0];
    car.stolen = true;
    world.carsStolen = 1;
    player.onFoot = false;
    player.car = car;
    car.x = roadCenter(3);
    car.y = roadCenter(3);
    car.angle = Math.PI / 2;
    car.speed = 140;
    player.x = car.x;
    player.y = car.y;
    world.cash = 800;
    world.startMission(0);
    return;
  }
  game.state = 'start';
}

export function shotList() {
  return ['start', 'drive', 'chase', 'mission'];
}

export { CARS };
