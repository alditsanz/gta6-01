// Solmar Heat — fists, guns and consequences. Bullets are swept along
// a segment each tick so fast rounds cannot tunnel through a target;
// gang members fight back, foot cops try to make the bust, and every
// shot fired in anger feeds the heat system.

import { dist, angleTo } from './random.js';
import { addHeat, makePed } from './world.js';

export const WEAPONS = [
  { id: 'fists', name: 'Fists', slot: '1', damage: 16, rate: 0.32, speed: 0, range: 30, ammo: Infinity },
  { id: 'pistol', name: 'Pistol', slot: '2', damage: 26, rate: 0.24, speed: 880, range: 460, ammo: 12 },
  { id: 'smg', name: 'SMG', slot: '3', damage: 17, rate: 0.09, speed: 940, range: 420, ammo: 30 },
];

export function spawnGang(world, count, cx, cy, spread) {
  const crew = [];
  const radius = spread || 80;
  for (let i = 0; i < count; i++) {
    const bearing = (i / count) * Math.PI * 2;
    const member = makePed(world.rng, cx + Math.cos(bearing) * radius, cy + Math.sin(bearing) * radius, { role: 'gang' });
    member.color = '#7a1f1f';
    member.hp = 60;
    member.maxHp = 60;
    member.fireTimer = 1 + world.rng() * 1.6;
    world.gang.push(member);
    crew.push(member);
  }
  return crew;
}

// Does the swept segment (x1,y1)->(x2,y2) pass through the circle?
function segmentHitsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq > 0 ? ((cx - x1) * dx + (cy - y1) * dy) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + dx * t - cx;
  const py = y1 + dy * t - cy;
  return px * px + py * py <= r * r;
}

export function playerShoot(world, aimAngle) {
  const p = world.player;
  const gun = WEAPONS[p.weapon];
  if (!gun || gun.speed === 0) return false;
  if (p.reloading > 0) return false;
  if (p.ammo <= 0) {
    p.reloading = 1.1;
    return false;
  }
  p.ammo -= 1;
  world.stats.shotsFired += 1;
  world.bullets.push({
    x: p.x + Math.cos(aimAngle) * 14,
    y: p.y + Math.sin(aimAngle) * 14,
    vx: Math.cos(aimAngle) * gun.speed,
    vy: Math.sin(aimAngle) * gun.speed,
    life: gun.range / gun.speed,
    damage: gun.damage,
    from: 'player',
    tracer: true,
  });
  addHeat(world, 7);
  return true;
}

export function playerPunch(world) {
  const p = world.player;
  if (p.punchCool > 0) return false;
  p.punchCool = WEAPONS[0].rate;
  for (const g of world.gang) {
    if (g.hp > 0 && dist(p.x, p.y, g.x, g.y) < 34) hurtGang(world, g, WEAPONS[0].damage);
  }
  return true;
}

export function startReload(world) {
  const p = world.player;
  const gun = WEAPONS[p.weapon];
  if (!gun || gun.speed === 0) return;
  if (p.reloading > 0) return;
  if (p.reserve <= 0) return;
  if (p.ammo >= gun.ammo) return;
  p.reloading = 1.1;
}

export function finishReload(world) {
  const p = world.player;
  const gun = WEAPONS[p.weapon];
  if (!gun) return;
  const take = Math.min(gun.ammo - p.ammo, p.reserve);
  p.ammo += take;
  p.reserve -= take;
  p.reloading = 0;
}

export function hurtGang(world, g, damage) {
  g.hp -= damage;
  if (g.hp <= 0) {
    const drop = 25 + Math.floor(world.rng() * 26);
    world.stats.money += drop;
    world.stats.score += 30;
    world.pickups.push({ kind: 'cash', x: g.x, y: g.y, taken: true, silent: true });
    if (!world.events) world.events = [];
    world.events.push('gang-down:' + drop);
  }
}

export function hurtPlayer(world, damage) {
  const p = world.player;
  if (p.car) {
    p.car.hp -= damage * 0.55;
    if (p.car.hp <= 0) wreckCar(world, p.car);
    return;
  }
  let remaining = damage;
  if (p.armour > 0) {
    const soaked = Math.min(p.armour, remaining * 0.7);
    p.armour -= soaked;
    remaining -= soaked;
  }
  p.hp -= remaining;
  if (p.hp <= 0 && !p.dead) {
    p.dead = true;
    if (!world.events) world.events = [];
    world.events.push('wasted');
  }
}

export function wreckCar(world, car) {
  car.wrecked = true;
  car.hp = 0;
  car.speed = 0;
  car.smoke = 1;
  if (world.player.car === car) world.player.car = null;
}

export function stepCombat(world, dt) {
  if (!world.events) world.events = [];
  const p = world.player;

  if (p.reloading > 0) {
    p.reloading -= dt;
    if (p.reloading <= 0) finishReload(world);
  }
  if (p.punchCool > 0) p.punchCool -= dt;

  // --- bullets, swept ---
  for (const b of world.bullets) {
    const nx = b.x + b.vx * dt;
    const ny = b.y + b.vy * dt;
    if (b.from === 'player') {
      for (const g of world.gang) {
        if (g.hp > 0 && segmentHitsCircle(b.x, b.y, nx, ny, g.x, g.y, 13)) {
          hurtGang(world, g, b.damage);
          b.life = 0;
          break;
        }
      }
      if (b.life > 0) {
        for (const cop of world.cops) {
          if (!cop.wrecked && segmentHitsCircle(b.x, b.y, nx, ny, cop.x, cop.y, 24)) {
            cop.hp -= b.damage;
            addHeat(world, 10);
            if (cop.hp <= 25) wreckCar(world, cop);
            b.life = 0;
            break;
          }
        }
      }
    } else {
      const radius = p.car ? 26 : 12;
      if (segmentHitsCircle(b.x, b.y, nx, ny, p.x, p.y, radius)) {
        hurtPlayer(world, b.damage);
        b.life = 0;
      }
    }
    b.x = nx;
    b.y = ny;
    b.life -= dt;
  }
  world.bullets = world.bullets.filter((b) => b.life > 0);

  // --- gang behaviour: close in and shoot in bursts ---
  for (const g of world.gang) {
    if (g.hp <= 0) continue;
    const gap = dist(g.x, g.y, p.x, p.y);
    const want = angleTo(g.x, g.y, p.x, p.y);
    g.angle = want;
    if (gap > 150) {
      g.x += Math.cos(want) * 96 * dt;
      g.y += Math.sin(want) * 96 * dt;
    }
    g.fireTimer = (g.fireTimer || 0) - dt;
    if (g.fireTimer <= 0 && gap < 330) {
      g.fireTimer = 1.1 + world.rng() * 1.3;
      g.muzzle = 0.09;
      const spread = world.rng.range(-0.06, 0.06);
      world.bullets.push({
        x: g.x + Math.cos(want) * 13,
        y: g.y + Math.sin(want) * 13,
        vx: Math.cos(want + spread) * 760,
        vy: Math.sin(want + spread) * 760,
        life: 0.5,
        damage: 7,
        from: 'gang',
        tracer: true,
      });
    }
    if (g.muzzle > 0) g.muzzle -= dt;
  }
  world.gang = world.gang.filter((g) => g.hp > 0);

  // --- foot cops: harassing fire, and the bust if they hold you ---
  for (const fc of world.footCops || []) {
    fc.fireTimer = (fc.fireTimer === undefined ? 1.6 : fc.fireTimer) - dt;
    const gap = dist(fc.x, fc.y, p.x, p.y);
    if (fc.fireTimer <= 0 && gap < 300) {
      fc.fireTimer = 1.9;
      const want = angleTo(fc.x, fc.y, p.x, p.y);
      world.bullets.push({
        x: fc.x, y: fc.y,
        vx: Math.cos(want) * 720,
        vy: Math.sin(want) * 720,
        life: 0.45, damage: 5, from: 'cop', tracer: true,
      });
    }
    if (!p.car && Math.abs(p.speed || 0) < 4 && gap < 30) {
      world.flags.bustTimer = (world.flags.bustTimer || 0) + dt;
      if (world.flags.bustTimer > 2.2 && !p.dead) {
        p.dead = true;
        world.flags.busted = true;
        world.events.push('busted');
      }
    } else {
      world.flags.bustTimer = 0;
    }
  }

  // --- pickups lying in the street ---
  for (const pk of world.pickups) {
    if (pk.taken) continue;
    if (dist(pk.x, pk.y, p.x, p.y) < 26) {
      pk.taken = true;
      if (pk.kind === 'ammo') p.reserve += 36;
      if (pk.kind === 'health') p.hp = Math.min(100, p.hp + 40);
    }
  }
}
