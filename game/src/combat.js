// Solmar Heat — combat.js
// One job: shooting, punching and guard health. Bullets use swept
// segment-versus-circle tests, so a fast bullet cannot tunnel past a
// thin target between frames.

import { PLAYER } from './config.js';

export function createBullet(x, y, angle, speed) {
  return {
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 1.1,
    dead: false,
  };
}

export function stepBullet(bullet, dt) {
  bullet.x += bullet.vx * dt;
  bullet.y += bullet.vy * dt;
  bullet.life -= dt;
  if (bullet.life <= 0) bullet.dead = true;
  return bullet;
}

// Does the segment (x1,y1)-(x2,y2) pass within radius r of (tx,ty)?
// This is the anti-tunnelling test: the bullet's whole path is checked,
// not just where it ends up this frame.
export function segmentHitsCircle(x1, y1, x2, y2, tx, ty, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = 0;
  if (lenSq > 0) {
    t = ((tx - x1) * dx + (ty - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
  }
  const cx = x1 + dx * t;
  const cy = y1 + dy * t;
  const ddx = tx - cx;
  const ddy = ty - cy;
  return ddx * ddx + ddy * ddy <= r * r;
}

export function bulletHitsTarget(prevX, prevY, bullet, target, radius) {
  return segmentHitsCircle(prevX, prevY, bullet.x, bullet.y, target.x, target.y, radius);
}

export function createGuard(x, y, hp) {
  return { x, y, hp: hp || 3, maxHp: hp || 3, alive: true, shootCooldown: 1.2 };
}

export function damageGuard(guard, amount) {
  guard.hp -= amount;
  if (guard.hp <= 0) {
    guard.hp = 0;
    guard.alive = false;
  }
  return guard.alive;
}

// Health pips shown above a guard: one pip per hit point left.
export function guardPips(guard) {
  return guard.hp;
}

export function punchHits(attackerX, attackerY, attackerAngle, target) {
  const dx = target.x - attackerX;
  const dy = target.y - attackerY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > PLAYER.punchRange) return false;
  const toTarget = Math.atan2(dy, dx);
  let diff = toTarget - attackerAngle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) < 1.1;
}

export function canReload(ammo) {
  return ammo.mag < PLAYER.magSize && ammo.reserve > 0;
}

export function reloadAmmo(ammo) {
  const need = PLAYER.magSize - ammo.mag;
  const take = Math.min(need, ammo.reserve);
  return { mag: ammo.mag + take, reserve: ammo.reserve - take };
}
