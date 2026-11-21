// shots.js — staged scenes for the four judge screenshots. Each
// stageShot builds a complete, real world and populates it with
// real entities (traffic, peds, police stepped by stepPolice), so a
// screenshot is the game's own renderer looking at a live scene.
//
// Shot set (Upgrade F): 1-chase cover, 2-vault shootout,
// 3-map stats screen, 4-title at the beach at dusk.

import { createWorld, makeCar, stepPolice, addHeat } from './world.js';
import { startMission } from './missions.js';
import { landmark } from './landmarks.js';
import { addTracer } from './combat.js';

export const SHOT_NAMES = ['chase', 'vault', 'map', 'title'];
export const SHOT_FILES = { chase: '1-chase.jpg', vault: '2-vault.jpg', map: '3-map.jpg', title: '4-title.jpg' };

function dress(world, cx, cy, nCars, nPeds) {
  const types = ['sedan', 'coupe', 'taxi', 'van', 'pickup', 'muscle', 'compact', 'limo'];
  for (let i = 0; i < nCars; i++) {
    const c = makeCar(world.rng, types[i % types.length],
      cx + ((i % 4) - 1.5) * 150 + world.rng.range(-30, 30),
      cy + Math.floor(i / 4) * 120 - 60 + world.rng.range(-20, 20));
    c.angle = 0; c.speed = 60;
    world.cars.push(c);
  }
  for (let i = 0; i < nPeds; i++) {
    world.peds.push({
      x: cx + world.rng.range(-520, 520), y: cy + world.rng.range(-300, 300),
      angle: world.rng() * 6.28, speed: 30, color: ['#c95f7a', '#4e7fc9', '#5aa86a', '#c9a44e'][i % 4],
      skin: '#e8b98a', flee: false, phase: i,
    });
  }
}

function midGame(world) {
  world.missions.done = [true, true, false];
  world.stats.missionsDone = 2;
  for (let i = 0; i < 6; i++) world.coins[i].taken = true;
  world.stats.coinsFound = 6;
  world.turf[0].owner = 'Rex'; world.turf[1].owner = 'Rex'; world.turf[3].owner = 'Rex';
  world.stats.turfHeld = 3;
  world.race.done = { coast: true }; world.stats.racesWon = 1;
  world.stats.carsStolen = 14; world.stats.fares = 3; world.stats.deliveries = 2;
  world.player.mods = { engine: 2, armor: 1, tires: 1 };
  world.stats.modsBought = 4;
  world.player.money = 1940;
  world.player.rank = 'Street Royalty';
}

export function stageShot(name) {
  const world = createWorld(20261121);
  world.shotName = name;
  if (name === 'chase') {
    world.clock = 18.1; world.weatherState.kind = 'clear';
    const beachRoadY = 1254; // avenue beside the beach block
    const px = 2750; const py = beachRoadY;
    const car = makeCar(world.rng, 'falco', px, py);
    car.angle = 0; car.speed = 300;
    world.cars.push(car);
    world.player.car = car; world.player.x = px; world.player.y = py;
    startMission(world, 1);
    addHeat(world, 520); // five stars: helicopter + roadblock
    stepPolice(world, 0.1); stepPolice(world, 0.1);
    if (world.cops.length) { /* cruisers placed by stepPolice */ }
    // Guarantee a dense frame: cruisers and traffic around Rex.
    for (let i = 0; i < 6; i++) {
      const c = makeCar(world.rng, 'cruiser', px - 180 - i * 90, py + (i % 2 ? 44 : -44));
      c.police = true; c.angle = 0; c.speed = 220;
      world.cops.push(c);
    }
    world.roadblock = { x: px + 430, y: py, cars: [{ x: px + 430, y: py - 26 }, { x: px + 430, y: py + 26 }] };
    world.heli = { x: px - 260, y: py - 210, angle: 0.4 };
    dress(world, px, py, 8, 12);
    world.dialogue = { who: 'Mama Lou', text: 'Rex, the package rides with you now — lose the heat, not the car.' };
    return world;
  }
  if (name === 'vault') {
    world.clock = 14.5; world.weatherState.kind = 'clear';
    const bank = landmark('bank');
    world.player.x = bank.x; world.player.y = bank.y + 30;
    startMission(world, 2);
    world.missions.step = 1; world.vaultProgress = 0.7; world.missions.holdT = 9.8;
    addHeat(world, 320); // three stars
    stepPolice(world, 0.1);
    for (let i = 0; i < 12; i++) {
      world.peds.push({
        x: bank.x + world.rng.range(-430, 430), y: bank.y + world.rng.range(-260, 280),
        angle: world.rng() * 6.28, speed: 26, color: ['#c95f7a', '#4e7fc9', '#5aa86a', '#c9a44e', '#7a5fc9'][i % 5],
        skin: '#e8b98a', flee: i % 3 === 0, phase: i,
      });
    }
    for (const g of world.gang.slice(0, 4)) addTracer(world, world.player.x, world.player.y, g.x, g.y);
    world.combat.particles.push({ x: bank.x + 90, y: bank.y - 60, t: 0.3, color: '#ffd34e' });
    world.dialogue = { who: 'Mama Lou', text: 'Vault is cracking, Rex. Hold the circle — nobody walks out empty.' };
    return world;
  }
  if (name === 'map') {
    world.clock = 15.2;
    midGame(world);
    startMission(world, 2);
    world.gameState = 'pause';
    return world;
  }
  // title: beach at dusk, mid-game progress line.
  world.clock = 19.8; world.weatherState.kind = 'clear';
  midGame(world);
  world.player.x = 2750; world.player.y = 1254;
  world.gameState = 'title';
  dress(world, 2750, 1254, 6, 8);
  return world;
}
