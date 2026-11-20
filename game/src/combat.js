// combat.js — shooting, punching, guards and ammo.
// Bullets are swept along their whole travel each step (segment vs
// circle), so a fast bullet can never tunnel through a thin target.

import { dist } from './config.js';
import { segmentNearPoint } from './random.js';

export const MAG_SIZE = 12;
export const RESERVE_START = 48;
export const BULLET_SPEED = 880;
export const BULLET_RANGE = 460;
export const PUNCH_RANGE = 42;
export const RELOAD_TIME = 1.1;

export function createCombatState() {
  return { mag: MAG_SIZE, reserve: RESERVE_START, reloading: 0, cooldown: 0, bullets: [] };
}

export function startReload(state) {
  if (state.reloading > 0 || state.mag >= MAG_SIZE || state.reserve <= 0) return false;
  state.reloading = RELOAD_TIME;
  return true;
}

export function finishReload(state) {
  const need = MAG_SIZE - state.mag;
  const take = Math.min(need, state.reserve);
  state.mag += take; state.reserve -= take;
  state.reloading = 0;
  return take;
}

export function tryShoot(state, x, y, angle) {
  if (state.reloading > 0 || state.cooldown > 0) return null;
  if (state.mag <= 0) { startReload(state); return null; }
  state.mag -= 1;
  state.cooldown = 0.16;
  const bullet = {
    x, y, px: x, py: y,
    vx: Math.cos(angle) * BULLET_SPEED, vy: Math.sin(angle) * BULLET_SPEED,
    travelled: 0, alive: true,
  };
  state.bullets.push(bullet);
  return bullet;
}

export function tryPunch(px, py, angle, targets) {
  const hx = px + Math.cos(angle) * PUNCH_RANGE;
  const hy = py + Math.sin(angle) * PUNCH_RANGE;
  for (const t of targets) {
    if (t.alive !== false && t.health > 0 && dist(hx, hy, t.x, t.y) <= 30) {
      t.health -= 1;
      if (t.health <= 0) t.alive = false;
      return t;
    }
  }
  return null;
}

// Step bullets; targets are {x,y,health,alive,r?}. Returns hit events.
export function stepBullets(state, dt, targets, isBlocked) {
  const hits = [];
  if (state.cooldown > 0) state.cooldown -= dt;
  if (state.reloading > 0) {
    state.reloading -= dt;
    if (state.reloading <= 0) finishReload(state);
  }
  for (const b of state.bullets) {
    if (!b.alive) continue;
    b.px = b.x; b.py = b.y;
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.travelled += BULLET_SPEED * dt;
    if (b.travelled > BULLET_RANGE) { b.alive = false; continue; }
    if (isBlocked && isBlocked(b.x, b.y)) { b.alive = false; continue; }
    for (const t of targets) {
      if (t.alive === false || t.health <= 0) continue;
      if (segmentNearPoint(b.px, b.py, b.x, b.y, t.x, t.y, t.r || 16)) {
        t.health -= 1;
        if (t.health <= 0) t.alive = false;
        b.alive = false;
        hits.push({ target: t, killed: t.alive === false });
        break;
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.alive);
  return hits;
}

export function createAmmoPickup(x, y) {
  return { x, y, amount: 24, taken: false, kind: 'ammo' };
}

export function checkAmmoPickup(pickups, state, x, y) {
  for (const p of pickups) {
    if (!p.taken && dist(x, y, p.x, p.y) <= 30) {
      p.taken = true;
      state.reserve += p.amount;
      return p;
    }
  }
  return null;
}
