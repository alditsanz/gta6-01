// shots.js — staged scenes for the entry screenshots.
// One job: build a world, freeze it in a moment that shows the game
// at its best, and hand it to main.js (?shot=<name>). Every element
// is a real game entity placed by the real systems — stepPolice
// spawns the pursuit, spawnGang the bank crew — only positions are
// art-directed so each frame is full.

import { SEED } from './config.js';
import { createWorld, makeCar, setWanted, stepPolice } from './world.js';
import { say, VAULT_SECONDS } from './missions.js';
import { spawnGang, fireBullet } from './combat.js';

export const SHOT_NAMES = ['chase', 'vault', 'map', 'title'];

// The mid-game record the map and title frames report: story 2/3,
// coins 6/10, turf 3/5, one race won, a upgraded car history.
function midGame(world) {
  world.mission = { idx: 2, step: 0, vaultT: 0, started: true };
  world.coins.forEach((c, i) => { if (i < 6) c.taken = true; });
  world.turf.zones.forEach((z, i) => {
    if (i < 3) { z.owner = 'Player'; z.color = '#59c2e8'; }
  });
  world.raceWins = 1;
  const p = world.player;
  p.carsStolen = 14;
  p.fares = 3;
  p.deliveries = 2;
  p.nearMisses = 9;
  p.shots = 57;
  p.money = 1940;
  p.score = 4320;
  p.rank = 'Shot Caller';
  world.mods.engine = 2;
  world.mods.armor = 1;
  world.mods.tires = 1;
  world.playTime = 754;
  world.saveExists = true;
}

// COVER: a five-star chase at golden hour on the coast avenue, the
// beach in frame, helicopter overhead, roadblock ahead.
function stageChase(world) {
  world.clock = 18.1;
  world.weather.kind = 'clear';
  const p = world.player;
  const car = makeCar(world, 'sports', 2415, 1080, -Math.PI / 2, 'player');
  car.color = '#d9a521';
  car.speed = 205;
  car.hp = 82;
  world.cars.push(car);
  p.car = car;
  p.x = car.x; p.y = car.y; p.angle = -Math.PI / 2;
  p.money = 640; p.score = 1750; p.hp = 88; p.armor = 25;
  world.mission = { idx: 1, step: 0, vaultT: 0, started: true };
  say(world, 'Mama Lou', 'Rex, that motel package is hot — half of Solmar is watching. Move!', 99);
  setWanted(world, 5);

  // Traffic on the avenue and the cross street, both directions.
  const spots = [
    ['sedan', 2385, 830, -Math.PI / 2], ['coupe', 2415, 1330, Math.PI / 2],
    ['taxi', 2385, 1240, -Math.PI / 2], ['van', 2415, 690, Math.PI / 2],
    ['muscle', 2260, 1185, 0], ['compact', 2620, 1215, Math.PI],
    ['pickup', 2385, 1470, -Math.PI / 2], ['limo', 2030, 1185, 0],
    ['sedan', 2385, 560, -Math.PI / 2], ['coupe', 1560, 1215, Math.PI],
  ];
  for (const [t, x, y, a] of spots) {
    const c = makeCar(world, t, x, y, a, 'traffic');
    c.speed = 42;
    world.cars.push(c);
  }
  // Pedestrians on both sidewalks of the avenue.
  for (let i = 0; i < 12; i++) {
    const ped = world.peds[i];
    ped.x = (i % 2 ? 2472 : 2328) + ((i * 13) % 26);
    ped.y = 740 + i * 56;
    ped.tx = ped.x; ped.ty = ped.y;
    ped.angle = i % 2 ? Math.PI : 0;
  }
  // The real police system builds the response (cars, foot, block, air).
  for (let i = 0; i < 30; i++) stepPolice(world, 0.05);
  // Art-direct the closest units so the frame reads at a glance.
  const cops = world.cars.filter((c) => c.driver === 'cop' && c.role === 'pursuit');
  if (cops[0]) { cops[0].x = 2434; cops[0].y = 1215; cops[0].angle = -Math.PI / 2; cops[0].speed = 150; }
  if (cops[1]) { cops[1].x = 2396; cops[1].y = 1275; cops[1].angle = -Math.PI / 2; cops[1].speed = 146; }
  if (cops[2]) { cops[2].x = 2385; cops[2].y = 905; cops[2].angle = Math.PI / 2; cops[2].speed = 60; }
  if (cops[3]) { cops[3].x = 2200; cops[3].y = 1215; cops[3].angle = 0; cops[3].speed = 90; }
  if (world.heli) { world.heli.x = 2545; world.heli.y = 845; }
  // Extra beach dressing inside the cover frame.
  world.props.push(
    { kind: 'umbrella', x: 2720, y: 620, color: '#ff5d8f', angle: 0 },
    { kind: 'umbrella', x: 2920, y: 880, color: '#4dd0e1', angle: 0 },
    { kind: 'umbrella', x: 2650, y: 1020, color: '#ffb84d', angle: 0 },
    { kind: 'towel', x: 2780, y: 700, color: '#7ee787', angle: 0.6 },
    { kind: 'towel', x: 2880, y: 1010, color: '#ff7847', angle: 1.9 },
    { kind: 'palm', x: 2560, y: 520, color: '', angle: 1.2 },
  );
}

// On-foot shootout at the bank vault, bright midday, crowd fleeing.
function stageVault(world) {
  world.clock = 14.5;
  world.weather.kind = 'clear';
  const p = world.player;
  p.x = 1800; p.y = 1846; p.angle = -Math.PI / 2; p.car = null;
  p.hp = 76; p.armor = 20; p.money = 1210; p.score = 2980; p.ammo = 8;
  world.mission = { idx: 2, step: 1, vaultT: VAULT_SECONDS * 0.7, started: true };
  say(world, 'Mama Lou', 'Crew is on you, Rex! Hold the vault circle — do not leave it!', 99);

  // Seven bank crew, hand-placed in a loose arc north of Rex.
  const gang = spawnGang(world, 1800, 1796, 7, 30);
  const arc = [[1690, 1760], [1752, 1728], [1800, 1712], [1852, 1728], [1912, 1760], [1660, 1830], [1940, 1830]];
  gang.forEach((g, i) => {
    g.x = arc[i][0]; g.y = arc[i][1];
    g.angle = Math.atan2(p.y - g.y, p.x - g.x);
    g.hp = [30, 22, 30, 14, 26, 30, 18][i];
  });
  // Tracers in the air, both ways, plus impact sparks.
  fireBullet(world, gang[1].x, gang[1].y, gang[1].angle, 'gang');
  fireBullet(world, gang[3].x, gang[3].y, gang[3].angle, 'gang');
  fireBullet(world, gang[5].x, gang[5].y, gang[5].angle, 'gang');
  fireBullet(world, gang[6].x, gang[6].y, gang[6].angle, 'gang');
  fireBullet(world, p.x, p.y, Math.atan2(gang[2].y - p.y, gang[2].x - p.x), 'player');
  fireBullet(world, p.x, p.y, Math.atan2(gang[4].y - p.y, gang[4].x - p.x), 'player');
  world.bullets.forEach((b) => { b.x += b.vx * 0.12; b.y += b.vy * 0.12; });
  for (let i = 0; i < 6; i++) {
    world.particles.push({
      x: gang[2].x + (i % 3) * 5 - 5, y: gang[2].y + ((i / 3) | 0) * 5 - 2,
      vx: 0, vy: 0, life: 9, color: '#ffd76a', size: 3,
    });
  }

  // A dozen civilians around the intersection, several fleeing.
  const civSpots = [
    [1620, 1690, false], [1985, 1700, true], [2060, 1860, true], [1560, 1900, false],
    [1700, 2050, true], [1905, 2060, false], [2130, 1620, false], [1480, 1760, true],
    [2010, 2140, false], [1620, 2180, true], [2260, 1960, false], [1400, 2050, false],
  ];
  civSpots.forEach(([x, y, flee], i) => {
    const ped = world.peds[i];
    ped.x = x; ped.y = y;
    ped.tx = x; ped.ty = y;
    ped.flee = flee; ped.fleeT = 99;
    ped.angle = Math.atan2(p.y - y, p.x - x) + (flee ? Math.PI : 0.4);
  });

  setWanted(world, 3);
  for (let i = 0; i < 24; i++) stepPolice(world, 0.05);
  // Foot cops arriving at the frame edges; one cruiser rolling in.
  const foot = world.copsFoot;
  if (foot[0]) { foot[0].x = 1655; foot[0].y = 1965; }
  if (foot[1]) { foot[1].x = 1965; foot[1].y = 1945; }
  if (foot[2]) { foot[2].x = 1805; foot[2].y = 1625; }
  const cruiser = world.cars.find((c) => c.driver === 'cop' && c.role === 'pursuit');
  if (cruiser) { cruiser.x = 2085; cruiser.y = 2060; cruiser.angle = -2.2; cruiser.speed = 70; }
}

// The map & record screen over a mid-game world.
function stageMap(world) {
  midGame(world);
  world.clock = 15.2;
  world.weather.kind = 'clear';
  const p = world.player;
  p.x = 1760; p.y = 1900; p.angle = -Math.PI / 2;
}

// Title over the beach boardwalk at dusk, mid-game record beneath.
function stageTitle(world) {
  midGame(world);
  world.clock = 19.8;
  world.weather.kind = 'clear';
  const p = world.player;
  p.x = 2860; p.y = 1040; p.angle = 0;
  // Extra beach dressing for the title backdrop.
  world.props.push(
    { kind: 'umbrella', x: 2760, y: 700, color: '#ff7847', angle: 0 },
    { kind: 'umbrella', x: 2980, y: 1080, color: '#b388ff', angle: 0 },
    { kind: 'towel', x: 2840, y: 820, color: '#4dd0e1', angle: 1.1 },
  );
  // Traffic crossing behind the dim, on the coast road + shore road.
  const movers = [
    ['taxi', 2560, 1185, 0], ['sedan', 2760, 1215, Math.PI], ['coupe', 2385, 880, Math.PI / 2],
  ];
  let ti = 0;
  for (const car of world.cars) {
    if (car.driver !== 'traffic') continue;
    const [t, x, y, a] = movers[ti];
    car.type = t; car.name = t === 'taxi' ? 'Vento Taxi' : t === 'sedan' ? 'Meridian Sedan' : 'Vireo Coupe';
    car.x = x; car.y = y; car.angle = a; car.speed = 30;
    ti += 1;
    if (ti >= movers.length) break;
  }
  // Strollers on the boardwalk.
  for (let i = 0; i < 5; i++) {
    const ped = world.peds[i];
    ped.x = 2474;
    ped.y = 640 + i * 130;
    ped.tx = ped.x; ped.ty = ped.y;
    ped.angle = Math.PI / 2;
  }
}

export function stageShot(name, seed = SEED) {
  const world = createWorld(seed);
  if (name === 'chase') stageChase(world);
  else if (name === 'vault') stageVault(world);
  else if (name === 'map') stageMap(world);
  else if (name === 'title') stageTitle(world);
  return world;
}
