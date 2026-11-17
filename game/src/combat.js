// Combat: shooting with real bullet travel, punching, guards with
// health pips, and ammo pickups. Bullets are tested along their whole
// path each step (segment vs circle), so a fast bullet cannot tunnel
// past a thin target.

import { COMBAT } from './config.js';

/** A fresh pistol: full magazine, starting reserve. */
export function createWeapon() {
  return { mag: COMBAT.magSize, reserve: COMBAT.reserveStart, reloading: 0 };
}

/** Fire one shot. Returns a bullet, or null when the gun cannot fire. */
export function fireWeapon(weapon, x, y, angle) {
  if (weapon.reloading > 0) return null;
  if (weapon.mag <= 0) return null;
  weapon.mag -= 1;
  return {
    x,
    y,
    px: x,
    py: y,
    vx: Math.cos(angle) * COMBAT.bulletSpeed,
    vy: Math.sin(angle) * COMBAT.bulletSpeed,
    life: 0.9,
  };
}

/** Start a reload; finishes in COMBAT.reloadSeconds. Returns true when started. */
export function startReload(weapon) {
  if (weapon.reloading > 0 || weapon.mag >= COMBAT.magSize || weapon.reserve <= 0) return false;
  weapon.reloading = COMBAT.reloadSeconds;
  return true;
}

/** Tick the reload timer; tops the magazine up when it finishes. */
export function tickWeapon(weapon, dt) {
  if (weapon.reloading <= 0) return;
  weapon.reloading -= dt;
  if (weapon.reloading <= 0) {
    weapon.reloading = 0;
    const need = COMBAT.magSize - weapon.mag;
    const take = Math.min(need, weapon.reserve);
    weapon.mag += take;
    weapon.reserve -= take;
  }
}

/**
 * Segment-vs-circle test: does the segment (x1,y1)-(x2,y2) pass within
 * radius r of (cx,cy)? This is the anti-tunnelling check.
 */
export function segmentHitsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 0) {
    t = ((cx - x1) * dx + (cy - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
  }
  const nx = x1 + dx * t;
  const ny = y1 + dy * t;
  const ox = cx - nx;
  const oy = cy - ny;
  return ox * ox + oy * oy <= r * r;
}

/**
 * Advance bullets and resolve hits against guards. `targets` are
 * {x, y, radius, health, alive} objects. Returns the list of targets
 * whose health hit zero this step.
 */
export function updateBullets(bullets, targets, dt) {
  const killed = [];
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.px = b.x;
    b.py = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead) {
      for (const t of targets) {
        if (!t.alive) continue;
        if (segmentHitsCircle(b.px, b.py, b.x, b.y, t.x, t.y, t.radius)) {
          t.health -= COMBAT.bulletDamage;
          if (t.health <= 0) {
            t.health = 0;
            t.alive = false;
            killed.push(t);
          }
          dead = true;
          break;
        }
      }
    }
    if (dead) bullets.splice(i, 1);
  }
  return killed;
}

/** A punch: the nearest living target inside punch range takes damage. */
export function punch(attackerX, attackerY, angle, targets) {
  let best = null;
  let bestD = Infinity;
  for (const t of targets) {
    if (!t.alive) continue;
    const d = Math.hypot(t.x - attackerX, t.y - attackerY);
    if (d > COMBAT.punchRange) continue;
    const want = Math.atan2(t.y - attackerY, t.x - attackerX);
    let diff = want - angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > 1.1) continue;
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  if (!best) return null;
  best.health -= COMBAT.punchDamage;
  if (best.health <= 0) {
    best.health = 0;
    best.alive = false;
  }
  return best;
}

/** Spawn the finale's guards around SCPD Headquarters. */
export function spawnGuards(hqX, hqY) {
  const spots = [
    { dx: -70, dy: -40 },
    { dx: 70, dy: -40 },
    { dx: 0, dy: 70 },
  ];
  return spots.map((s, i) => ({
    id: i,
    x: hqX + s.dx,
    y: hqY + s.dy,
    radius: 16,
    health: COMBAT.guardHealth,
    alive: true,
    angle: Math.PI / 2,
    shootT: 1 + i * 0.6,
    wander: i * 2.1,
  }));
}

/** Guards shuffle in place and take pot-shots at the player when close. */
export function updateGuards(guards, px, py, dt, onGuardShot) {
  for (const g of guards) {
    if (!g.alive) continue;
    g.wander += dt;
    g.x += Math.cos(g.wander) * 6 * dt;
    g.y += Math.sin(g.wander * 0.7) * 6 * dt;
    const d = Math.hypot(px - g.x, py - g.y);
    if (d < 420) {
      g.angle = Math.atan2(py - g.y, px - g.x);
      g.shootT -= dt;
      if (g.shootT <= 0) {
        g.shootT = 1.4;
        if (onGuardShot) onGuardShot(g);
      }
    }
  }
}

/** Health pips for the HUD: one pip per 25 health. */
export function guardPips(guard) {
  return Math.ceil(guard.health / 25);
}

/** An ammo pickup lying on the ground. */
export function createAmmoPickup(x, y) {
  return { x, y, amount: COMBAT.ammoPickup, taken: false };
}
