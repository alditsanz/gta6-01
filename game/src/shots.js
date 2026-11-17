// shots.js — deterministic screenshot states for Solmar Heat.
// ?shot=start|drive|chase|mission&seed=2026 sets the game up in a fixed,
// reproducible pose so the four screenshots are real renders of the game
// with several systems visible at once. Nothing here is used by normal play
// except the query parsing; the game plays the same either way.

import { placeCenter, parkingSpotNear, makeCar } from './world.js';

// Read the shot parameters from the page URL (?shot=...&seed=...).
export function readShotParams() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  const seed = parseInt(q.get('seed') || '2026', 10);
  if (!shot) return null;
  return { shot, seed: Number.isFinite(seed) ? seed : 2026 };
}

// Put the live game object into the pose a screenshot needs. Called once,
// right after the world is built, before the first frame is drawn.
export function applyShot(G, shot, rng) {
  const world = G.world;
  const P = G.player;
  if (shot === 'start') {
    G.state = 'menu';
    return;
  }
  G.state = 'play';
  G.time = 9.5 * 3600; // 09:30, low morning sun
  if (shot === 'drive') {
    // Rex in a blue Falco GT on the long avenue by Marlowe Park, traffic
    // around him, pedestrians on the sidewalks.
    const c = placeCenter('park');
    const car = makeCar('falco', c.x - 260, c.y, 0, { driver: 'player' });
    car.speed = 300;
    G.playerCar = car;
    P.x = car.x; P.y = car.y; P.angle = 0;
    G.camera.x = car.x; G.camera.y = car.y;
    world.traffic[0].x = car.x + 240; world.traffic[0].y = car.y - 20;
    world.traffic[1].x = car.x - 420; world.traffic[1].y = car.y + 22;
    world.traffic[2].x = car.x + 60; world.traffic[2].y = car.y + 24;
    G.missionIndex = 0;
    G.missionStage = 0;
    G.hudNote = 'Drive the Falco GT — WASD to drive, E to get out';
  } else if (shot === 'chase') {
    // Three stars, two cruisers on Rex's tail, a foot cop closing in, and
    // mission two's objective live on the HUD — wanted level, minimap,
    // mission marker and traffic in one frame.
    G.startMission(1);
    G.wanted = 3;
    G.heat = 3;
    G.lastCrime = 999999;
    const c = placeCenter('motel');
    const car = makeCar('cab', c.x - 420, c.y + 140, 0, { driver: 'player' });
    car.speed = 380;
    G.playerCar = car;
    P.x = car.x; P.y = car.y; P.angle = 0;
    G.camera.x = car.x; G.camera.y = car.y;
    G.spawnPolice(true);
    const cr = world.cruisers[0];
    if (cr) { cr.x = car.x - 150; cr.y = car.y + 30; cr.speed = 420; }
    const cr2 = world.cruisers[1];
    if (cr2) { cr2.x = car.x - 260; cr2.y = car.y - 40; cr2.speed = 430; }
    const cop = world.footCops[0];
    if (cop) { cop.x = car.x + 120; cop.y = car.y + 60; }
    G.hudNote = '3 stars — outrun the SCPD to the paint shop';
  } else if (shot === 'mission') {
    // The Harbor Job at the National Bank: Rex on foot, pistol out, two
    // Harbor Boys gangsters by the vault door, the objective beacon lit.
    G.startMission(2);
    G.missionStage = 1; // crack the vault
    G.updateObjective();
    const bank = placeCenter('bank');
    P.x = bank.x - 95; P.y = bank.y + 45; // close enough to show the Hold-E hint
    P.angle = 0;
    P.ammo = 12;
    G.camera.x = P.x; G.camera.y = P.y;
    world.gangsters = [
      { x: bank.x - 40, y: bank.y - 50, angle: Math.PI, hp: 60, shootCd: 1.2, color: '#3d2b4a', alive: true },
      { x: bank.x + 30, y: bank.y + 90, angle: Math.PI, hp: 60, shootCd: 2.0, color: '#4a2b2b', alive: true },
    ];
    G.hudNote = 'Crack the vault — hold E by the vault door';
  }
  // Keep the frame busy: a few pedestrians near the camera in every shot.
  for (let i = 0; i < 5 && i < world.pedestrians.length; i++) {
    const ped = world.pedestrians[i];
    ped.x = P.x + rng.range(-260, 260);
    ped.y = P.y + rng.range(-180, 220);
  }
}
