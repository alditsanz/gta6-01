// combat.js — bullets, fists and the gang members who shoot back.
// One job: own world.bullets and world.gang. Bullets advance in small
// substeps so a fast round cannot tunnel through a thin target, gang
// members strafe toward the player and fire on a cooldown, and hits
// pay out damage, particles and (for the player) real consequences.

import { dist, turnToward } from './config.js';
import { collideBuildings, addHeat } from './world.js';

export const BULLET_SPEED = 640;
const SUBSTEP = 9; // px per collision substep — thinner than any target

export function spawnGang(world, x, y, n, hp = 30) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / Math.max(1, n)) * Math.PI * 2;
    const g = {
      x: x + Math.cos(a) * 44, y: y + Math.sin(a) * 44,
      angle: a + Math.PI, hp, maxHp: hp,
      fireCd: 0.6 + world.rng.range(0, 0.9), walk: 0, strafe: world.rng.chance(0.5) ? 1 : -1,
    };
    world.gang.push(g);
    out.push(g);
  }
  return out;
}

export function fireBullet(world, x, y, angle, from) {
  world.bullets.push({
    x, y,
    vx: Math.cos(angle) * BULLET_SPEED, vy: Math.sin(angle) * BULLET_SPEED,
    from, life: 0.85,
  });
  world.particles.push({
    x: x + Math.cos(angle) * 10, y: y + Math.sin(angle) * 10,
    vx: Math.cos(angle) * 30, vy: Math.sin(angle) * 30,
    life: 0.08, color: '#ffd76a', size: 3,
  });
}

function burst(world, x, y, color, n = 5) {
  for (let i = 0; i < n; i++) {
    const a = world.rng.range(0, Math.PI * 2), sp = world.rng.range(18, 90);
    world.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: world.rng.range(0.15, 0.4), color, size: 2.5 });
  }
}

function damagePlayer(world, dmg) {
  const p = world.player;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, dmg * 0.6);
    p.armor -= absorbed;
    p.hp -= dmg - absorbed;
  } else p.hp -= dmg;
  if (p.hp < 0) p.hp = 0;
}

// The player's own shot, fired toward (tx, ty) in world coords.
export function playerShoot(world, tx, ty) {
  const p = world.player;
  if (p.car || p.reloading > 0 || p.fireCd > 0) return false;
  if (p.ammo <= 0) return false;
  p.ammo -= 1;
  p.shots += 1;
  p.fireCd = 0.16;
  const a = Math.atan2(ty - p.y, tx - p.x);
  fireBullet(world, p.x, p.y, a, 'player');
  world.danger = { x: p.x, y: p.y, t: 1.2 };
  addHeat(world, 7);
  return true;
}

// Start a reload; stepCombat finishes it.
export function playerReload(world) {
  const p = world.player;
  if (p.reloading > 0 || p.ammo >= 12 || p.reserve <= 0) return false;
  p.reloading = 1.1;
  return true;
}

// A swing at whatever is close. Returns true if it connected.
export function playerPunch(world) {
  const p = world.player;
  if (p.car || p.punchCd > 0) return false;
  p.punchCd = 0.32;
  let hit = false;
  for (const g of world.gang) {
    if (dist(p.x, p.y, g.x, g.y) < 34) { g.hp -= 12; burst(world, g.x, g.y, '#e05555', 3); hit = true; }
  }
  for (const ped of world.peds) {
    if (dist(p.x, p.y, ped.x, ped.y) < 30) { ped.flee = true; ped.fleeT = 2; hit = true; }
  }
  if (hit) addHeat(world, 10);
  return hit;
}

export function stepCombat(world, dt) {
  const p = world.player;

  // Reload timer.
  if (p.reloading > 0) {
    p.reloading -= dt;
    if (p.reloading <= 0) {
      const take = Math.min(12 - p.ammo, p.reserve);
      p.ammo += take; p.reserve -= take;
    }
  }
  if (p.fireCd > 0) p.fireCd -= dt;
  if (p.punchCd > 0) p.punchCd -= dt;

  // Gang behaviour: close to range, strafe, shoot.
  for (const g of world.gang) {
    const d = dist(g.x, g.y, p.x, p.y);
    const want = Math.atan2(p.y - g.y, p.x - g.x);
    g.angle = turnToward(g.angle, want, 5 * dt);
    let mx = 0, my = 0;
    if (d > 190) { mx = Math.cos(g.angle); my = Math.sin(g.angle); }
    else if (d < 110) { mx = -Math.cos(g.angle); my = -Math.sin(g.angle); }
    else { mx = Math.cos(g.angle + Math.PI / 2) * g.strafe; my = Math.sin(g.angle + Math.PI / 2) * g.strafe; }
    g.x += mx * 62 * dt;
    g.y += my * 62 * dt;
    g.walk += dt * 7;
    collideBuildings(world, g, 9);
    g.fireCd -= dt;
    if (g.fireCd <= 0 && d < 300) {
      g.fireCd = 0.85 + world.rng.range(0, 0.6);
      fireBullet(world, g.x, g.y, g.angle + world.rng.range(-0.07, 0.07), 'gang');
    }
  }

  // Bullets, advanced in substeps (anti-tunnelling).
  for (let i = world.bullets.length - 1; i >= 0; i--) {
    const b = world.bullets[i];
    b.life -= dt;
    let dead = b.life <= 0;
    const steps = Math.max(1, Math.round((BULLET_SPEED * dt) / SUBSTEP));
    for (let s = 0; s < steps && !dead; s++) {
      b.x += (b.vx * dt) / steps;
      b.y += (b.vy * dt) / steps;
      if (world.buildings.some((bd) => b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h)) {
        burst(world, b.x, b.y, '#cfc8b8', 2);
        dead = true;
        break;
      }
      if (b.from === 'player') {
        for (const g of world.gang) {
          if (dist(b.x, b.y, g.x, g.y) < 11) {
            g.hp -= 16;
            burst(world, g.x, g.y, '#e05555', 4);
            dead = true;
            break;
          }
        }
        if (dead) break;
        for (const cop of world.copsFoot) {
          if (dist(b.x, b.y, cop.x, cop.y) < 11) {
            addHeat(world, 60);
            world.copsFoot.splice(world.copsFoot.indexOf(cop), 1);
            burst(world, cop.x, cop.y, '#3d5a99', 4);
            dead = true;
            break;
          }
        }
      } else if (b.from === 'gang') {
        if (dist(b.x, b.y, p.x, p.y) < 12 && !p.car) {
          damagePlayer(world, 7);
          burst(world, p.x, p.y, '#e05555', 3);
          dead = true;
        } else if (p.car && dist(b.x, b.y, p.car.x, p.car.y) < 24) {
          p.car.hp -= 3;
          if (p.car.hp <= 0) { p.car.hp = 0; p.car.wrecked = true; }
          dead = true;
        }
      }
    }
    if (dead) world.bullets.splice(i, 1);
  }

  // Fallen gang members pay out and clear.
  for (let i = world.gang.length - 1; i >= 0; i--) {
    const g = world.gang[i];
    if (g.hp <= 0) {
      world.gang.splice(i, 1);
      p.money += 25;
      p.score += 40;
      burst(world, g.x, g.y, '#e05555', 9);
      world.floaters.push({ x: g.x, y: g.y - 14, text: '+$25', t: 0.9, color: '#ffe9a8' });
    }
  }

  // Getting run over is bad for gang members and worse for civilians.
  if (p.car && Math.abs(p.car.speed) > 30) {
    for (const g of world.gang) {
      if (dist(p.car.x, p.car.y, g.x, g.y) < 24) g.hp -= 260 * dt;
    }
    for (const ped of world.peds) {
      if (dist(p.car.x, p.car.y, ped.x, ped.y) < 22 && !ped.flee) {
        ped.flee = true; ped.fleeT = 2.5;
        addHeat(world, 30);
      }
    }
  }
}
