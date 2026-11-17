// shots.js — deterministic states for the four screenshots, driven by query params.
//   ?shot=start   — title screen over the city
//   ?shot=drive   — the player driving the Vento taxi with a fare aboard, a Solmar coin ahead
//   ?shot=chase   — a 4-star police chase in the Pier 9 getaway: timer, roadblock, cops, mission banner
//   ?shot=mission — the ledger heist at SCPD HQ: guards, cops closing in, wanted stars, ammo HUD
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
    // A Solmar coin sits on the road just ahead, and a traffic car rides
    // alongside for a near-miss moment.
    const coin = world.coins[0];
    coin.x = car.x + 40;
    coin.y = car.y + 190;
    world.coins[1].taken = true;
    world.cash += 75;
    const near = world.traffic[0];
    near.x = car.x + 60;
    near.y = car.y + 90;
    near.angle = Math.PI / 2;
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
    world.addHeat(4, 'Pier 9 getaway'); // 14 from the mission start + 4 = 18 heat, 4 stars
    world.missionTimer = 68;
    // four cop cars right behind the player for the chase frame
    for (let i = 0; i < 4; i++) {
      world.police.push({
        id: `shot-cop-${i}`,
        x: car.x - 160 - i * 90,
        y: car.y + (i - 1) * 46,
        angle: 0, speed: 280, block: false,
        path: [], pathIndex: 0, repath: 0, sirenPhase: i * 2,
      });
    }
    // and the roadblock waiting ahead on the same street
    world.spawnRoadblock();
    world.flash('Kane has the whole SCPD on you — Pier 9, 68 seconds!');
    return;
  }
  if (shot === 'mission') {
    game.state = 'play';
    world.missionIndex = 6;
    world.startMission(6);
    const hq = landmarkById(world.landmarks, 'hq');
    player.onFoot = true;
    player.car = null;
    player.x = hq.x - 120;
    player.y = hq.y + 60;
    player.angle = 0;
    player.health = 82;
    world.cash = 7400;
    world.ammo.mag = 9;
    world.ammo.reserve = 36;
    world.addHeat(12, 'Ledger alarm');
    // two cop cars closing in on the heist
    for (let i = 0; i < 2; i++) {
      world.police.push({
        id: `shot-cop-m7-${i}`,
        x: hq.x - 280 - i * 110,
        y: hq.y - 80 + i * 100,
        angle: 0, speed: 280, block: false,
        path: [], pathIndex: 0, repath: 0, sirenPhase: i * 2.5,
      });
    }
    world.flash('Three guards on the ledger room — clear them out');
    return;
  }
  game.state = 'start';
}

export function shotList() {
  return ['start', 'drive', 'chase', 'mission'];
}

export { CARS };
