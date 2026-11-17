// shots.js — deterministic states for the four screenshots, driven by query params.
//   ?shot=start   — title screen over the city
//   ?shot=drive   — the player driving the Vento taxi with a fare aboard
//   ?shot=chase   — a 4-star police chase in the Pier 9 getaway: timer, cops, mission banner
//   ?shot=mission — the bank vault shootout: Harbor Boys, ammo HUD, wanted stars
// Every state is built from the same seeded world, so a re-render looks the same.
import { roadCenter } from './world.js';
import { CARS } from './config.js';
import { landmarkById } from './landmarks.js';

export function applyShot(game, shot, seed) {
  const world = game.world;
  const player = world.player;
  if (shot === 'start') {
    game.state = 'start';
    return;
  }
  if (shot === 'drive') {
    game.state = 'play';
    const car = world.cars.find((c) => c.def === 8);
    car.stolen = true;
    world.carsStolen = 1;
    player.onFoot = false;
    player.car = car;
    car.x = roadCenter(4);
    car.y = roadCenter(4);
    car.angle = Math.PI / 2;
    car.speed = 200;
    player.x = car.x;
    player.y = car.y;
    world.cash = 1250;
    // A fare aboard: the rider is in the taxi, the destination is the pier.
    const pier = landmarkById(world.landmarks, 'pier');
    const rider = world.pedestrians[0];
    rider.x = car.x;
    rider.y = car.y;
    world.side.fare = {
      rider,
      destX: pier.x,
      destY: pier.y,
      destName: pier.name,
      pay: 310,
      pickedUp: true,
    };
    world.faresDone = 2;
    return;
  }
  if (shot === 'chase') {
    game.state = 'play';
    world.startMission(5);
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
    world.cash = 5400;
    world.addHeat(16, 'Pier 9 getaway');
    world.missionTimer = 68;
    // four cop cars right behind the player for the chase frame
    for (let i = 0; i < 4; i++) {
      world.police.push({
        id: `shot-cop-${i}`,
        x: car.x - 160 - i * 90,
        y: car.y + (i - 1) * 46,
        angle: 0, speed: 280,
        path: [], pathIndex: 0, repath: 0, sirenPhase: i * 2,
      });
    }
    world.flash('Kane has the whole SCPD on you — Pier 9, 68 seconds!');
    return;
  }
  if (shot === 'mission') {
    game.state = 'play';
    world.startMission(4);
    const bank = landmarkById(world.landmarks, 'bank');
    player.onFoot = true;
    player.car = null;
    player.x = bank.x - 90;
    player.y = bank.y + 40;
    player.angle = 0;
    player.health = 82;
    world.cash = 3200;
    world.ammo.mag = 9;
    world.ammo.reserve = 36;
    world.addHeat(12, 'Vault alarm');
    // two cop cars closing in on the shootout
    for (let i = 0; i < 2; i++) {
      world.police.push({
        id: `shot-cop-m5-${i}`,
        x: bank.x - 260 - i * 110,
        y: bank.y - 60 + i * 90,
        angle: 0, speed: 280,
        path: [], pathIndex: 0, repath: 0, sirenPhase: i * 2.5,
      });
    }
    world.flash('Four Harbor Boys guard the vault — clear them out');
    return;
  }
  game.state = 'start';
}

export function shotList() {
  return ['start', 'drive', 'chase', 'mission'];
}

export { CARS };
