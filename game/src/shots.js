// Solmar Heat — screenshot staging. Each staged scene is a real world
// with a believable save written into its actual fields, posed at a
// dramatic moment: the five-star beach chase, the bank vault hold at
// seventy percent, the pause map, and the story-complete celebration.

import { createWorld, makeCar, makePed } from './world.js';
import { startMission, gradeFor, MISSIONS } from './missions.js';
import { spawnGang } from './combat.js';
import { skyPhase } from './weather.js';

export const SHOT_NAMES = ['chase', 'vault', 'map', 'victory'];

function setClock(world, hour) {
  world.weather.clock = hour;
  world.weather.phase = skyPhase(hour);
}

// A mid-campaign Rex: two jobs banked, a car collection habit, some
// turf, some mods — written into the same fields the game itself uses.
function midGame(world) {
  const s = world.stats;
  s.money = 1940;
  s.rp = 780;
  s.score = 1450;
  s.carsStolen = 14;
  s.fares = 3;
  s.deliveries = 2;
  s.nearMisses = 9;
  s.kmDriven = 23.6;
  s.copsEscaped = 4;
  s.longestChase = 87;
  s.missionsDone = 2;
  s.playTime = 754;
  world.flags.done_m1 = true;
  world.flags.grade_m1 = 'A';
  world.flags.done_m2 = true;
  world.flags.grade_m2 = 'B';
  world.flags.race_coast = true;
  world.collectibles.coins.forEach((c, i) => { if (i < 6) c.taken = true; });
  world.collectibles.stashes.forEach((c, i) => { if (i < 4) c.taken = true; });
  world.collectibles.jumps.forEach((j, i) => { if (i < 2) j.done = true; });
  world.turf.zones.forEach((z, i) => { if (i < 3) z.owner = 'Rex'; });
  world.mods.engine = 2;
  world.mods.tires = 1;
  world.mods.armor = 1;
  return world;
}

// The campaign played out to its end, with grades produced by the
// game's own grader from plausible finishing clocks.
function completedStory(world) {
  midGame(world);
  const s = world.stats;
  const timeLeft = [190, 120, 150, 96, 210];
  MISSIONS.forEach((def, i) => {
    world.flags['done_' + def.id] = true;
    world.flags['grade_' + def.id] = gradeFor(def, timeLeft[i]);
    if (i >= 2) {
      s.money += def.pay;
      s.rp += 90 + i * 30;
      s.score += 200 + i * 60;
    }
  });
  s.missionsDone = 5;
  world.flags.storyComplete = true;
  world.flags.finalGrade = world.flags.grade_m5;
  return world;
}

function crowd(world, cx, cy, n, spread, flee) {
  for (let i = 0; i < n; i++) {
    const ped = makePed(
      world.rng,
      cx + world.rng.range(-spread, spread),
      cy + world.rng.range(-spread * 0.6, spread * 0.6),
    );
    if (flee && i % 3 === 0) {
      ped.flee = true;
      ped.armsUp = true;
    }
    ped.tx = ped.x;
    ped.ty = ped.y;
    ped.wait = 9;
    world.peds.push(ped);
  }
}

function trafficAround(world, cx, cy, n) {
  const types = ['sedan', 'coupe', 'taxi', 'van', 'pickup', 'compact', 'muscle', 'limo'];
  for (let i = 0; i < n; i++) {
    const eastWest = i % 2 === 0;
    const car = makeCar(
      world.rng,
      types[i % types.length],
      cx + world.rng.range(-420, 420),
      cy + world.rng.range(-260, 260),
      eastWest ? 0 : Math.PI / 2,
    );
    car.x = Math.round(car.x / 400) * 400 + (eastWest ? world.rng.range(-300, 300) : (i % 3 === 0 ? -26 : 26));
    car.y = Math.round(car.y / 400) * 400 + (eastWest ? (i % 3 === 0 ? -26 : 26) : world.rng.range(-300, 300));
    car.ai = { traffic: true };
    world.cars.push(car);
  }
}

export function stageShot(name) {
  if (name === 'chase') {
    const world = createWorld();
    midGame(world);
    setClock(world, 18.1);
    world.weather.weatherIdx = 0;
    const p = world.player;
    p.x = 2920;
    p.y = 426;
    p.angle = 0;
    const falco = makeCar(world.rng, 'falco', 2920, 426, 0);
    falco.color = '#e8b13c';
    falco.speed = 262;
    falco.hp = 78;
    world.cars.push(falco);
    p.car = falco;
    world.flags.sliding = true;
    startMission(world, 1);
    world.dialogue = {
      who: 'Mama Lou', role: 'Fixer',
      line: 'Package is hot, Rex — keep the beach on your left and RUN.',
      until: 1e9,
    };
    world.heat = 542;
    world.peakStars = 5;
    world.cops = [];
    world.cars = world.cars.filter((c) => !c.police);
    const spots = [[-120, -52], [-128, 46], [-196, -8], [-215, 74], [-225, -60], [-58, 96]];
    for (const [ox, oy] of spots) {
      const cop = makeCar(world.rng, 'cruiser', p.x + ox, p.y + oy, 0, { police: true });
      cop.ai = { cop: true };
      cop.speed = 250;
      cop.behaviour = 'PURSUIT';
      world.cars.push(cop);
      world.cops.push(cop);
    }
    world.roadblock = { x: p.x + 235, y: p.y - 6, angle: Math.PI / 2 };
    const blockCop = makeCar(world.rng, 'cruiser', p.x + 235, p.y - 44, Math.PI / 2, { police: true, parked: true });
    blockCop.behaviour = 'ROADBLOCK';
    world.cars.push(blockCop);
    const wreck = makeCar(world.rng, 'sedan', p.x - 300, p.y + 30, 0.4, { parked: true });
    wreck.wrecked = true;
    wreck.smoke = 1;
    wreck.hp = 0;
    world.cars.push(wreck);
    trafficAround(world, p.x, p.y, 8);
    crowd(world, p.x - 60, p.y - 120, 11, 330, false);
    world.heli = { x: p.x + 30, y: p.y - 150, angle: 0.4, rotor: 2 };
    world.sighted = true;
    world.flags.target = { x: 2600, y: 600 };
    world.flags.perspCam = true;
    return { world, cam: { x: p.x + 40, y: p.y + 6, zoom: 1.06, persp: true }, state: 'play' };
  }

  if (name === 'vault') {
    const world = createWorld();
    midGame(world);
    setClock(world, 22.15);
    world.weather.weatherIdx = 0;
    world.weather.phase = skyPhase(world.weather.clock);
    const bank = { x: 1800, y: 1800 };
    for (const coin of world.collectibles.coins) {
      if (Math.abs(coin.x - bank.x) < 175 && Math.abs(coin.y - bank.y) < 175) coin.taken = true;
    }
    const p = world.player;
    p.x = bank.x + 8;
    p.y = bank.y + 26;
    p.angle = -0.7;
    p.weapon = 2;
    p.ammo = 21;
    p.armour = 55;
    startMission(world, 4);
    world.mission.step = 1;
    world.mission.holdTimer = 14;
    world.mission.gangSpawned = true;
    world.mission.vaultPct = 70;
    world.flags.vaultRing = { x: bank.x, y: bank.y + 8, pct: 70 };
    world.flags.cashBags = [
      { x: bank.x - 26, y: bank.y + 96 },
      { x: bank.x + 4, y: bank.y + 104 },
      { x: bank.x + 34, y: bank.y + 95 },
    ];
    spawnGang(world, 7, bank.x, bank.y + 6, 80);
    const hpTable = [60, 44, 52, 30, 58, 38, 48];
    world.gang.forEach((g, i) => {
      g.muzzle = 0.09;
      g.hp = hpTable[i] || 50;
    });
    const streaks = [
      [-88, -30, 760, 40], [88, 44, -760, -30], [-80, 58, 760, -50],
      [84, -52, -760, 60], [-88, 6, 760, 10], [88, -8, -760, -12],
    ];
    for (const [ox, oy, vx, vy] of streaks) {
      world.bullets.push({
        x: bank.x + ox, y: bank.y + oy, vx, vy,
        life: 0.4, damage: 5, from: vx > 0 ? 'gang' : 'player', tracer: true,
      });
    }
    world.sighted = true;
    world.dialogue = {
      who: 'Lena Voss', role: 'Crew',
      line: 'Vault is at seventy — hold the ring, Rex, hold it!',
      until: 1e9,
    };
    world.heat = 342;
    world.peakStars = 3;
    world.cops = [];
    for (const oy of [-58, 52]) {
      const cop = makeCar(world.rng, 'cruiser', bank.x - 218, bank.y + oy, 0, { police: true, parked: true });
      cop.behaviour = 'PURSUIT';
      world.cars.push(cop);
      world.cops.push(cop);
    }
    world.footCops = [
      makePed(world.rng, bank.x - 150, bank.y - 96, { role: 'cop' }),
      makePed(world.rng, bank.x - 132, bank.y + 118, { role: 'cop' }),
    ];
    for (const fc of world.footCops) {
      fc.color = '#274b8f';
      fc.behaviour = 'FOOT CHASE';
    }
    crowd(world, bank.x + 40, bank.y - 30, 13, 210, true);
    world.heli = null;
    world.flags.target = { x: bank.x, y: bank.y };
    world.flags.overShoulder = true;
    return { world, cam: { x: bank.x + 6, y: bank.y + 6, zoom: 1.55 }, state: 'play' };
  }

  if (name === 'map') {
    const world = createWorld();
    midGame(world);
    setClock(world, 11.4);
    startMission(world, 2);
    world.player.x = 1500;
    world.player.y = 1500;
    world.flags.target = { x: 2600, y: 600 };
    return { world, cam: { x: 1800, y: 1800, zoom: 1 }, state: 'pause' };
  }

  if (name === 'victory') {
    const world = createWorld();
    completedStory(world);
    setClock(world, 18.6);
    world.weather.weatherIdx = 0;
    world.player.x = 3050;
    world.player.y = 700;
    world.player.angle = 0.4;
    trafficAround(world, 3050, 700, 5);
    crowd(world, 3030, 640, 9, 220, false);
    return { world, cam: { x: 3140, y: 690, zoom: 1.02 }, state: 'victory' };
  }

  // Title staging: golden dusk over the beach strip.
  const world = createWorld();
  midGame(world);
  setClock(world, 19.8);
  world.weather.weatherIdx = 0;
  world.player.x = 3050;
  world.player.y = 700;
  world.player.angle = 0.4;
  trafficAround(world, 3050, 700, 5);
  crowd(world, 3030, 640, 8, 220, false);
  return { world, cam: { x: 3140, y: 690, zoom: 1.02 }, state: 'title' };
}
