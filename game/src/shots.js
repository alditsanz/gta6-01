// shots.js — staged scenes for the four judge screenshots. Each
// scene is built from real game entities and real state fields
// (missions, counters, saves), then held perfectly still. The
// camera lives on world.camera; main.js renders what we stage.

import { makeCar, createWorld, saveToSlot, readSlot } from './world.js';
import { MISSIONS } from './missions.js';
import { spawnGang } from './combat.js';
import { landmark } from './landmarks.js';
import { formatClock } from './weather.js';

export const SHOT_NAMES = ['chase', 'vault', 'map', 'title'];

const PED_COLORS = ['#d94f3d', '#3d7ad9', '#f2f2f2', '#39b56b', '#e4a11b', '#9c5ae4', '#e45a9c', '#4dd0e1'];

function addPed(world, x, y, color, flee = 0) {
  world.peds.push({ x, y, angle: -Math.PI / 2, speed: 0, color, flee, tx: 0, ty: 0, retarget: 99 });
}
function addTraffic(world, type, x, y, angle, speed = 120) {
  const c = makeCar(world, type, x, y, angle);
  c.speed = speed;
  world.cars.push(c);
  return c;
}
function stageCounters(world) {
  // A believable mid-game: story 2/5 done with grades, some of
  // everything collected — all through the real state fields.
  world.stats.missionsDone = 2;
  world.grades = { m1: 'S', m2: 'A' };
  world.coins.forEach((c, i) => { c.taken = i < 6; });
  world.stashes.forEach((s, i) => { s.taken = i < 3; });
  world.turf.forEach((z, i) => { z.owner = i < 3 ? 'player' : 'rival'; });
  world.ramps.forEach((r, i) => { r.done = i < 2; });
  Object.assign(world.stats, {
    carsStolen: 14, fares: 3, deliveries: 2, racesWon: 1, nearMisses: 9,
    kmDriven: 12.4, copsEscaped: 3, longestChaseSec: 74, shotsFired: 61,
    jumpsLanded: 2, playSeconds: 1500,
  });
  world.mods = { engine: 2, armor: 1, tires: 1 };
  world.player.money = 1940;
  world.player.rp = 385;
}

export function stageShot(world, name) {
  world.time = 2.4;
  const p = world.player;
  if (name === 'chase') {
    world.clock = 18.1; world.weather = 'clear';
    stageCounters(world);
    p.money = 2340; p.hp = 86; p.armour = 40;
    // Rex in the gold Falco S, northbound on the beach avenue.
    const car = addTraffic(world, 'falco', 3131, 1500, -Math.PI / 2, 300);
    car.color = '#e8a71c'; car.driver = 'player';
    p.car = car; p.x = car.x; p.y = car.y;
    // Five-star response: six cruisers in pursuit, heli overhead,
    // roadblock ahead, one wreck already burning on the kerb.
    world.heat = 500; world.exposure = 0.8;
    const spots = [[3180, 1620, -Math.PI / 2], [3090, 1660, -Math.PI / 2], [3190, 1760, -Math.PI / 2], [3060, 1830, -Math.PI / 2], [3240, 1700, -Math.PI / 2], [3000, 1560, -Math.PI / 2]];
    for (const [x, y, a] of spots) {
      const c = makeCar(world, 'cruiser', x, y, a);
      c.speed = 280; c.driver = 'cop'; world.cops.push(c);
    }
    world.heli = { x: 3064, y: 1318, angle: 1.08 };
    world.roadblocks.push({ x: 3154, y: 1145, angle: 0 });
    const wreck = addTraffic(world, 'muscle', 3177, 1215, 0.4, 0);
    wreck.wrecked = true; wreck.burning = true; wreck.hp = 0;
    // Traffic variety sharing the avenue and the cross street.
    addTraffic(world, 'taxi', 3177, 1150, Math.PI / 2, 130);
    addTraffic(world, 'sedan', 3177, 900, Math.PI / 2, 120);
    addTraffic(world, 'van', 3131, 1950, -Math.PI / 2, 110);
    addTraffic(world, 'coupe', 2900, 1531, 0, 140);
    addTraffic(world, 'pickup', 2600, 1577, Math.PI, 125);
    addTraffic(world, 'compact', 3350, 1531, 0, 100);
    addTraffic(world, 'limo', 2200, 1531, 0, 115);
    addTraffic(world, 'truck', 3131, 2150, -Math.PI / 2, 95);
    // Beach crowd on the boardwalk and sand.
    for (let i = 0; i < 12; i++) addPed(world, 3168 + (i % 3) * 16, 1230 + i * 42, PED_COLORS[i % 8], i % 4 === 0 ? 1 : 0);
    for (let i = 0; i < 5; i++) addPed(world, 3300 + i * 30, 1300 + i * 90, PED_COLORS[(i + 3) % 8]);
    // Mission 2 in progress + Mama Lou on the radio.
    world.mission = { def: MISSIONS[1], step: 0, vault: 0, holdT: 0, targetCarId: null };
    world.dialogue = { who: 'Mama Lou', role: 'Fixer', line: '"Five stars, baby — lose them by the water."' };
    world.dialogueT = 999;
    world.crewCd.dex = 12;
    world.radioIdx = 2;
    world.camera = { x: 3154, y: 1400, zoom: 1.12 };
    world.gameState = 'play';
  } else if (name === 'vault') {
    world.clock = 21.7; world.weather = 'clear'; // night job
    const bank = landmark('bank');
    p.x = bank.x; p.y = bank.y + 34; p.angle = -Math.PI / 2;
    p.car = null; p.hp = 72; p.armour = 55; p.money = 3110; p.rp = 520;
    p.weapon = 2; p.mag.smg = 18; p.ammo.smg = 120;
    world.mission = { def: MISSIONS[2], step: 1, vault: 70, holdT: 0, targetCarId: null };
    world.missionTime = 141; world.heat = 350; world.exposure = 0.5;
    // Seven Vipers in the vault circle, some already hurt.
    const gang = spawnGang(world, bank.x, bank.y - 52, 7);
    gang.forEach((g, i) => { g.hp = [50, 38, 50, 22, 50, 44, 29][i]; g.angle = Math.PI / 2; });
    // A dozen civilians on the plaza, several with hands up.
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      addPed(world, bank.x + Math.cos(a) * (150 + (i % 3) * 36), bank.y + Math.sin(a) * (140 + (i % 4) * 26), PED_COLORS[i % 8], i % 3 === 0 ? 1 : 0);
    }
    // Foot cops arriving at the edges + two cruisers on the kerb.
    world.footCops.push(
      { x: bank.x - 215, y: bank.y + 120, angle: 0.6, hp: 30, color: '#2c4a7c' },
      { x: bank.x + 225, y: bank.y + 105, angle: 2.4, hp: 30, color: '#2c4a7c' },
      { x: bank.x + 40, y: bank.y + 235, angle: -Math.PI / 2, hp: 30, color: '#2c4a7c' },
    );
    const kerb1 = makeCar(world, 'cruiser', bank.x - 240, bank.y + 250, 0.5);
    kerb1.driver = 'cop'; world.cops.push(kerb1);
    const kerb2 = makeCar(world, 'cruiser', bank.x + 252, bank.y - 240, -2.2);
    kerb2.driver = 'cop'; world.cops.push(kerb2);
    // A mid-job history so the counters do not read empty.
    world.stats.carsStolen = 9;
    world.coins.forEach((c, i) => { c.taken = i < 4; });
    world.stashes.forEach((s, i) => { s.taken = i < 2; });
    // Tracers mid-flight both ways + hit sparks.
    world.bullets.push(
      { x: bank.x - 20, y: bank.y - 6, vx: 0, vy: -760, life: 0.4, from: 'player', damage: 17 },
      { x: bank.x + 26, y: bank.y - 30, vx: -120, vy: -740, life: 0.4, from: 'player', damage: 17 },
      { x: bank.x - 44, y: bank.y - 44, vx: 180, vy: 700, life: 0.4, from: 'gang', damage: 14 },
      { x: bank.x + 52, y: bank.y - 40, vx: -200, vy: 690, life: 0.4, from: 'gang', damage: 14 },
    );
    for (let i = 0; i < 6; i++) world.particles.push({ x: bank.x - 30 + i * 11, y: bank.y - 48, life: 0.5, maxLife: 0.5, color: '#ffd23e' });
    world.dialogue = { who: 'Mama Lou', role: 'Fixer', line: '"Vault\'s nearly open — hold them off, Rex."' };
    world.dialogueT = 999;
    world.camera = { x: bank.x, y: bank.y + 6, zoom: 1.55 };
    world.gameState = 'play';
  } else if (name === 'map') {
    world.clock = 14.5; world.weather = 'clear';
    stageCounters(world);
    // Story at m3, routed to the bank; player cruising Canal Row.
    world.mission = { def: MISSIONS[2], step: 0, vault: 0, holdT: 0, targetCarId: null };
    const car = addTraffic(world, 'vento', 2354, 2354, 0, 0);
    p.car = car; p.x = car.x; p.y = car.y;
    // Real saves through the real serializer: slot 1 = this world,
    // slot 2 = an earlier, poorer Rex; slot 3 stays empty.
    saveToSlot(world, 1);
    const earlier = createWorld(777);
    earlier.stats.missionsDone = 1;
    earlier.grades = { m1: 'B' };
    earlier.player.money = 640; earlier.player.rp = 180; earlier.clock = 9.4;
    earlier.coins.forEach((c, i) => { c.taken = i < 2; });
    saveToSlot(earlier, 2);
    world.gameState = 'pause';
    world.camera = { x: p.x, y: p.y, zoom: 1 };
  } else if (name === 'title') {
    world.clock = 19.8; world.weather = 'clear'; // dusk over the beach
    stageCounters(world);
    saveToSlot(world, 1);
    // Coast traffic crossing the frame behind the dim.
    addTraffic(world, 'sedan', 3131, 1180, -Math.PI / 2, 120);
    addTraffic(world, 'taxi', 3177, 1640, Math.PI / 2, 110);
    addTraffic(world, 'coupe', 3131, 1980, -Math.PI / 2, 135);
    addTraffic(world, 'muscle', 2900, 1531, 0, 125);
    addTraffic(world, 'van', 2500, 1577, Math.PI, 100);
    for (let i = 0; i < 8; i++) addPed(world, 3166, 1240 + i * 74, PED_COLORS[i % 8]);
    for (let i = 0; i < 5; i++) addPed(world, 3300 + i * 26, 1380 + i * 110, PED_COLORS[(i + 2) % 8]);
    p.x = 3162; p.y = 1440; p.car = null;
    world.camera = { x: 3270, y: 1500, zoom: 1.0 };
    world.gameState = 'title';
  }
  return world;
}

// Enriched save-slot view objects for the map + title screens.
export function slotViews(world) {
  const out = [];
  for (let s = 1; s <= 3; s++) {
    const d = readSlot(s);
    if (!d) { out.push(null); continue; }
    const next = MISSIONS[d.missionsDone];
    out.push({
      act: next ? `ACT ${d.missionsDone + 1} — ${next.title}` : 'STORY COMPLETE',
      pct: d.pct, missionsDone: d.missionsDone, money: d.money,
      time: formatClock(d.clock), place: 'Solmar',
    });
  }
  return out;
}
