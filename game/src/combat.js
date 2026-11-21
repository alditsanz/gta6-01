// combat.js — guns, fists and the people who shoot back. Bullets
// travel in sub-steps so a fast round can never tunnel through a
// thin target; gang members are real state with health pips.

import { addHeat } from './world.js';

export const WEAPONS = [
  { id: 'fists',  name: 'FISTS',  slot: 1, damage: 12, rate: 0.32, ammo: null },
  { id: 'pistol', name: 'PISTOL', slot: 2, damage: 26, rate: 0.24, ammo: 'pistol', mag: 12, reload: 0.9, speed: 900, spread: 0.02 },
  { id: 'smg',    name: 'SMG',    slot: 3, damage: 17, rate: 0.09, ammo: 'smg', mag: 30, reload: 1.3, speed: 980, spread: 0.07 },
];
export function weaponById(id) { return WEAPONS.find(w => w.id === id); }

export function spawnGang(world, x, y, n, hp = 50) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const g = {
      x: x + (i % 3 - 1) * 44, y: y + Math.floor(i / 3) * 44 - 22,
      angle: Math.PI, hp, maxHp: hp, color: '#7c2434', fireT: 1 + i * 0.3,
    };
    world.gang.push(g); out.push(g);
  }
  return out;
}

// Damage the player, armour first. Returns true if the player died.
export function damagePlayer(world, amount) {
  const p = world.player;
  if (p.armour > 0) {
    const absorbed = Math.min(p.armour, amount * 0.7);
    p.armour -= absorbed;
    amount -= absorbed;
  }
  p.hp -= amount;
  world.missionDamage += amount;
  return p.hp <= 0;
}

// The player fires toward (tx,ty). Fists swing instead of shooting.
export function playerShoot(world, tx, ty, events) {
  const p = world.player;
  const w = weaponById(WEAPONS[p.weapon].id);
  if (p.fireT > 0 || p.reloadT > 0) return;
  const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
  if (w.id === 'fists') {
    p.fireT = w.rate; p.punchT = 0.18;
    // A punch lands on anyone within arm's reach in front.
    for (const g of [...world.gang]) {
      if (Math.hypot(g.x - px, g.y - py) < 42) hurtGang(world, g, w.damage, events);
    }
    for (const f of world.footCops) {
      if (Math.hypot(f.x - px, f.y - py) < 42) { f.hp -= w.damage; addHeat(world, 30); }
    }
    return;
  }
  if (p.mag[w.ammo] <= 0) { startReload(world); return; }
  p.mag[w.ammo]--;
  p.fireT = w.rate;
  world.stats.shotsFired++;
  const ang = Math.atan2(ty - py, tx - px) + (world.rng() - 0.5) * 2 * w.spread;
  world.bullets.push({ x: px, y: py, vx: Math.cos(ang) * w.speed, vy: Math.sin(ang) * w.speed, life: 0.55, from: 'player', damage: w.damage });
  addHeat(world, 12);
  events.push({ type: 'shot', x: px, y: py });
}

export function startReload(world) {
  const p = world.player;
  const w = WEAPONS[p.weapon];
  if (!w.ammo || p.reloadT > 0) return;
  const need = w.mag - p.mag[w.ammo];
  if (need <= 0 || p.ammo[w.ammo] <= 0) return;
  p.reloadT = w.reload;
  p.reloadWeapon = w.ammo;
}

function finishReload(world) {
  const p = world.player;
  const w = weaponById(p.reloadWeapon === 'smg' ? 'smg' : 'pistol');
  const move = Math.min(w.mag - p.mag[w.ammo], p.ammo[w.ammo]);
  p.mag[w.ammo] += move;
  p.ammo[w.ammo] -= move;
  p.reloadT = 0;
}

function hurtGang(world, g, damage, events) {
  g.hp -= damage;
  if (g.hp <= 0) {
    world.gang.splice(world.gang.indexOf(g), 1);
    world.player.money += 25;
    events.push({ type: 'gang-down', x: g.x, y: g.y });
  }
}

// Bullets move in 3 sub-steps per frame (anti-tunnelling) and test
// every plausible target along the way.
export function stepCombat(world, dt, events) {
  const p = world.player;
  if (p.fireT > 0) p.fireT -= dt;
  if (p.punchT > 0) p.punchT -= dt;
  if (p.reloadT > 0) { p.reloadT -= dt; if (p.reloadT <= 0) finishReload(world); }

  const sub = 3, sdt = dt / sub;
  for (let s = 0; s < sub; s++) {
    for (const b of [...world.bullets]) {
      b.x += b.vx * sdt; b.y += b.vy * sdt; b.life -= sdt;
      let dead = b.life <= 0;
      if (!dead && b.from === 'player') {
        for (const g of [...world.gang]) {
          if (Math.hypot(g.x - b.x, g.y - b.y) < 13) { hurtGang(world, g, b.damage, events); dead = true; break; }
        }
        if (!dead) for (const f of world.footCops) {
          if (f.hp > 0 && Math.hypot(f.x - b.x, f.y - b.y) < 13) { f.hp -= b.damage; addHeat(world, 40); dead = true; break; }
        }
        if (!dead) for (const c of world.cops) {
          if (Math.hypot(c.x - b.x, c.y - b.y) < 24) { c.hp -= b.damage; dead = true; break; }
        }
      } else if (!dead && b.from === 'gang') {
        const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
        const rr = p.car ? 24 : 13;
        if (Math.hypot(px - b.x, py - b.y) < rr) {
          if (p.car) { p.car.hp -= b.damage * 0.4; world.missionDamage += b.damage * 0.4; }
          else damagePlayer(world, b.damage * 0.55);
          dead = true;
        }
      }
      if (dead) world.bullets.splice(world.bullets.indexOf(b), 1);
    }
  }

  // Gang members shoot back at intervals when the player is close.
  const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
  for (const g of world.gang) {
    const d = Math.hypot(px - g.x, py - g.y);
    g.angle = Math.atan2(py - g.y, px - g.x);
    if (d > 120) { g.x += Math.cos(g.angle) * 55 * dt; g.y += Math.sin(g.angle) * 55 * dt; }
    g.fireT -= dt;
    if (d < 330 && g.fireT <= 0) {
      g.fireT = 0.8 + world.rng() * 0.7;
      const ang = g.angle + (world.rng() - 0.5) * 0.16;
      world.bullets.push({ x: g.x, y: g.y, vx: Math.cos(ang) * 760, vy: Math.sin(ang) * 760, life: 0.5, from: 'gang', damage: 14 });
    }
  }
  // Downed foot cops leave the response.
  world.footCops = world.footCops.filter(f => f.hp > 0);
  world.cops = world.cops.filter(c => c.hp > 25);
}
