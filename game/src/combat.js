// combat.js — shooting with a real magazine, and the Harbor Boys:
// gangsters who strafe, take cover in doorways and shoot back.
// One job: everything about a gunfight that is not the city itself.
// The world owns the arrays (world.gangsters, world.bullets); this file
// spawns the gangsters, steps their AI and resolves their bullets.
import { PLAYER } from './config.js';
import { dist, angleTo, wrapAngle, clamp, segDist } from './random.js';

export function createAmmo() {
  return { mag: PLAYER.magSize, reserve: PLAYER.reserveAmmo, reloading: 0 };
}

export function startReload(ammo) {
  if (ammo.reloading > 0 || ammo.mag >= PLAYER.magSize || ammo.reserve <= 0) return false;
  ammo.reloading = PLAYER.reloadSeconds;
  return true;
}

export function tickReload(ammo, dt) {
  if (ammo.reloading <= 0) return;
  ammo.reloading -= dt;
  if (ammo.reloading <= 0) {
    ammo.reloading = 0;
    const need = PLAYER.magSize - ammo.mag;
    const take = Math.min(need, ammo.reserve);
    ammo.mag += take;
    ammo.reserve -= take;
  }
}

// Fire one round if the magazine allows it. Returns 'shot', 'empty' or 'reloading'.
export function tryFire(ammo) {
  if (ammo.reloading > 0) return 'reloading';
  if (ammo.mag <= 0) return 'empty';
  ammo.mag -= 1;
  return 'shot';
}

export function spawnGangsters(world, x, y, count, label) {
  const made = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / Math.max(1, count)) * Math.PI * 2;
    const g = {
      id: `harbor-${label}-${i}-${world.time.toFixed(0)}`,
      x: x + Math.cos(angle) * 70,
      y: y + Math.sin(angle) * 70,
      angle: 0,
      health: 60,
      shootCooldown: world.rng.range(0.4, 1.2),
      strafeDir: i % 2 === 0 ? 1 : -1,
      strafeTimer: world.rng.range(0.5, 1.5),
      walkPhase: world.rng.range(0, 6),
    };
    world.gangsters.push(g);
    made.push(g);
  }
  return made;
}

export function gangsterCount(world) {
  return world.gangsters.length;
}

// One frame of gangster AI: strafe sideways, keep distance, shoot at the
// player when the line is clear and the cooldown has run out.
export function updateGangsters(world, dt) {
  const p = world.player;
  for (const g of world.gangsters) {
    g.walkPhase += dt * 6;
    g.shootCooldown -= dt;
    g.strafeTimer -= dt;
    if (g.strafeTimer <= 0) {
      g.strafeDir *= -1;
      g.strafeTimer = world.rng.range(0.6, 1.6);
    }
    const d = dist(g.x, g.y, p.x, p.y);
    const toPlayer = angleTo(g.x, g.y, p.x, p.y);
    g.angle = toPlayer;
    // Strafe sideways, drift in when far, back off when too close.
    const strafe = toPlayer + (Math.PI / 2) * g.strafeDir;
    let mx = Math.cos(strafe) * 55;
    let my = Math.sin(strafe) * 55;
    if (d > 260) {
      mx += Math.cos(toPlayer) * 70;
      my += Math.sin(toPlayer) * 70;
    } else if (d < 120) {
      mx -= Math.cos(toPlayer) * 70;
      my -= Math.sin(toPlayer) * 70;
    }
    g.x = clamp(g.x + mx * dt, 12, world.width - 12);
    g.y = clamp(g.y + my * dt, 12, world.height - 12);
    if (g.shootCooldown <= 0 && d < 420) {
      g.shootCooldown = world.rng.range(0.9, 1.7);
      const spread = world.rng.range(-0.09, 0.09);
      const a = toPlayer + spread;
      world.enemyBullets.push({
        x: g.x + Math.cos(a) * 18,
        y: g.y + Math.sin(a) * 18,
        vx: Math.cos(a) * 520,
        vy: Math.sin(a) * 520,
        life: 1.1,
      });
      world.burst(g.x + Math.cos(a) * 20, g.y + Math.sin(a) * 20, '#ffe9a8', 2);
    }
  }
}

// Enemy bullets: they hurt the player (or the escort van) and die on walls.
export function updateEnemyBullets(world, dt, hitBuilding) {
  const p = world.player;
  for (const b of world.enemyBullets) {
    const ox = b.x;
    const oy = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (hitBuilding(b.x, b.y, 2) || hitBuilding((ox + b.x) / 2, (oy + b.y) / 2, 2)) {
      b.life = 0;
      world.burst(b.x, b.y, '#e8e4d8', 3);
      continue;
    }
    if (p.invuln <= 0 && segDist(p.x, p.y, ox, oy, b.x, b.y) < 14) {
      b.life = 0;
      p.health -= 9;
      p.invuln = 0.35;
      world.burst(p.x, p.y, '#ff9d7d', 6);
      if (p.health <= 0) world.setWasted();
    }
    const van = world.escortVan;
    if (van && segDist(van.x, van.y, ox, oy, b.x, b.y) < 22) {
      b.life = 0;
      van.health -= 4;
      world.burst(van.x, van.y, '#ffb03a', 3);
    }
  }
  world.enemyBullets = world.enemyBullets.filter((b) => b.life > 0);
}

// Player bullets vs gangsters. Bullets are stepped in world.updateBullets,
// which stashes each round's previous position (b.px, b.py) before moving
// it, so the hit test covers the whole segment the round travelled.
export function bulletsVsGangsters(world) {
  let down = 0;
  for (const b of world.bullets) {
    const ox = b.px ?? b.x;
    const oy = b.py ?? b.y;
    for (const g of world.gangsters) {
      if (b.life > 0 && segDist(g.x, g.y, ox, oy, b.x, b.y) < 16) {
        b.life = 0;
        g.health -= PLAYER.bulletDamage;
        world.burst(g.x, g.y, '#ff9d7d', 8);
        if (g.health <= 0) {
          world.gangsters = world.gangsters.filter((o) => o !== g);
          world.kills += 1;
          world.cash += 50;
          world.flash('Harbor Boy down — $50 off him');
          down += 1;
        }
      }
    }
  }
  return down;
}
