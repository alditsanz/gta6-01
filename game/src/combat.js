// Solmar Heat — combat.js
// Pistol with a 12-round mag and reload, punches, gang members who
// strafe and shoot back, and swept bullet collision so fast bullets
// cannot tunnel through thin targets.

import { dist } from './random.js';

export function shoot(world, from, angle, friendly) {
  const p = world.player;
  if (friendly) {
    if (p.reloading > 0) return false;
    if (p.ammo <= 0) { startReload(world); return false; }
    p.ammo -= 1;
  }
  world.bullets.push({
    x: from.x, y: from.y, px: from.x, py: from.y,
    vx: Math.cos(angle) * 920, vy: Math.sin(angle) * 920,
    life: 0.55, friendly: !!friendly, dmg: friendly ? 16 : 7,
  });
  world.events.push({ type: 'shot', friendly: !!friendly });
  return true;
}
export function startReload(world) {
  const p = world.player;
  if (p.reloading > 0 || p.ammo >= 12 || p.reserve <= 0) return false;
  p.reloading = 1.1; return true;
}
export function punch(world) {
  const p = world.player;
  if (p.punchCd > 0 || p.car) return false;
  p.punchCd = 0.35;
  world.events.push({ type: 'punch' });
  for (const g of world.gang) if (dist(p.x, p.y, g.x, g.y) < 42) hurtGang(world, g, 14);
  for (const ped of world.peds) if (dist(p.x, p.y, ped.x, ped.y) < 40) ped.flee = 1.5;
  return true;
}
export function hurtGang(world, g, dmg) {
  g.hp -= dmg;
  if (g.hp <= 0 && !g.dead) { g.dead = true; world.player.money += 25; world.events.push({ type: 'gangDown', drop: 25 }); }
}
function sweptHit(b, tx, ty, r) {
  // Check the segment the bullet crossed this step, not just its tip.
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (dist(b.px + (b.x - b.px) * t, b.py + (b.y - b.py) * t, tx, ty) < r) return true;
  }
  return false;
}
export function stepCombat(world, dt) {
  const p = world.player;
  p.punchCd = Math.max(0, p.punchCd - dt);
  if (p.reloading > 0) {
    p.reloading -= dt;
    if (p.reloading <= 0) { const take = Math.min(12 - p.ammo, p.reserve); p.ammo += take; p.reserve -= take; }
  }
  for (const b of world.bullets) {
    b.px = b.x; b.py = b.y; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.friendly) {
      for (const g of world.gang) if (!g.dead && sweptHit(b, g.x, g.y, 15)) { hurtGang(world, g, b.dmg); b.life = 0; spawnSparks(world, g.x, g.y); }
      for (const cop of world.cops) if (sweptHit(b, cop.x, cop.y, 14)) { b.life = 0; }
    } else if (!p.car && sweptHit(b, p.x, p.y, 14)) {
      p.health -= b.dmg; b.life = 0; spawnSparks(world, p.x, p.y);
      if (p.health <= 0) { p.health = 0; p.dead = true; }
    }
  }
  world.bullets = world.bullets.filter((b) => b.life > 0);
  for (const g of world.gang) {
    if (g.dead) continue;
    const d = dist(g.x, g.y, p.x, p.y);
    g.x += Math.cos(g.angle + Math.PI / 2) * g.strafe * 26 * dt;
    if (world.time % 2.4 < dt) g.strafe *= -1;
    g.shootCd -= dt;
    if (d < 330 && g.shootCd <= 0) { g.shootCd = 1.15; shoot(world, g, Math.atan2(p.y - g.y, p.x - g.x), false); }
  }
  world.gang = world.gang.filter((g) => !g.dead);
  for (const pt of world.particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt; }
  world.particles = world.particles.filter((pt) => pt.life > 0);
}
export function spawnSparks(world, x, y) {
  for (let i = 0; i < 5; i++) world.particles.push({ x, y, vx: (Math.random() - 0.5) * 130, vy: (Math.random() - 0.5) * 130, life: 0.3, color: '#ffd76b' });
}
export function gangHealthPips(g) { return Math.max(0, Math.ceil(g.hp / 10)); }
