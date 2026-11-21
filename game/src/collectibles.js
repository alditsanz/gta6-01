// collectibles.js — Solmar coins, Lantern Stashes and stunt ramps.
// Positions are generated once from the world rng, so a seed always
// hides them in the same places. Pickups are real state: taken
// flags live on the world and persist in the save.

import { WORLD } from './config.js';
import { range } from './random.js';

export const COIN_TOTAL = 20;
export const STASH_TOTAL = 12;
export const JUMP_TOTAL = 5;
export const COIN_PAY = 75;
export const STASH_PAY = 50;
export const JUMP_PAY = 100;

export function buildCollectibles(world) {
  const rng = world.rng;
  const coins = [], stashes = [], ramps = [];
  // Coins favour landmarks and street corners — findable, not random dots.
  for (let i = 0; i < COIN_TOTAL; i++) {
    coins.push({ x: range(rng, 120, WORLD - 120), y: range(rng, 120, WORLD - 120), taken: false });
  }
  for (let i = 0; i < STASH_TOTAL; i++) {
    stashes.push({ x: range(rng, 90, WORLD - 90), y: range(rng, 90, WORLD - 90), taken: false });
  }
  // Ramps sit on named roads so a fast run at them is a real line.
  const rampSpots = [
    { x: 754, y: 1900, angle: 0 }, { x: 1954, y: 760, angle: Math.PI / 2 },
    { x: 2754, y: 2350, angle: Math.PI }, { x: 1154, y: 3100, angle: -Math.PI / 2 },
    { x: 3154, y: 1500, angle: 0 },
  ];
  for (const s of rampSpots) ramps.push({ ...s, done: false });
  return { coins, stashes, ramps };
}

export function coinsTaken(world) { return world.coins.filter(c => c.taken).length; }
export function stashesTaken(world) { return world.stashes.filter(s => s.taken).length; }
export function jumpsDone(world) { return world.ramps.filter(r => r.done).length; }

// Per-frame pickup checks for the player (on foot or in a car).
export function stepCollectibles(world, events) {
  const p = world.player;
  const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
  for (const c of world.coins) {
    if (!c.taken && Math.hypot(c.x - px, c.y - py) < 30) {
      c.taken = true; p.money += COIN_PAY; p.rp += 4;
      events.push({ type: 'coin', x: c.x, y: c.y });
    }
  }
  for (const s of world.stashes) {
    if (!s.taken && Math.hypot(s.x - px, s.y - py) < 26) {
      s.taken = true; p.money += STASH_PAY; p.rp += 6;
      events.push({ type: 'stash', x: s.x, y: s.y });
    }
  }
  // Stunt jumps: cross a ramp fast in a car and you are airborne.
  if (p.car && !p.car.wrecked) {
    for (const r of world.ramps) {
      if (Math.hypot(r.x - px, r.y - py) < 30 && Math.abs(p.car.speed) > 240 && p.car.air <= 0) {
        p.car.air = 0.85; p.car.airRamp = r;
        events.push({ type: 'jump-start', x: r.x, y: r.y });
      }
    }
  }
}

// Called when an airborne car lands: score the jump once per ramp.
export function landJump(world, car, events) {
  const r = car.airRamp;
  car.airRamp = null;
  if (r && !r.done) {
    r.done = true;
    world.player.money += JUMP_PAY; world.player.rp += 15;
    world.stats.jumpsLanded++;
    events.push({ type: 'jump', x: car.x, y: car.y });
  }
}
