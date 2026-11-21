// combat.js — Rex's fists and pistol. Bullets are tested along
// their whole travel segment each tick, so a fast round can never
// tunnel through a thin target standing in its path.

export const MAG = 12;

export function createCombat() {
  return { bullets: [], tracers: [], particles: [] };
}

export function shoot(world, tx, ty) {
  const p = world.player;
  if (p.ammo <= 0 || p.reloadT > 0) return false;
  p.ammo--;
  const a = Math.atan2(ty - p.y, tx - p.x);
  world.combat.bullets.push({ x: p.x, y: p.y, vx: Math.cos(a) * 720, vy: Math.sin(a) * 720, life: 0.7, from: 'player' });
  world.addHeat(26);
  return true;
}

export function reload(world) {
  const p = world.player;
  if (p.reloadT > 0 || p.ammo >= MAG || p.reserve <= 0) return false;
  p.reloadT = 1.1;
  return true;
}

export function finishReload(world) {
  const p = world.player;
  const take = Math.min(MAG - p.ammo, p.reserve);
  p.ammo += take; p.reserve -= take;
}

export function punch(world) {
  const p = world.player;
  let hit = null;
  for (const g of world.gang) {
    if (Math.hypot(g.x - p.x, g.y - p.y) < 34 && g.hp > 0) { g.hp -= 1; hit = g; }
  }
  return hit;
}

function segHits(b, nx, ny, t) {
  // Sample the segment b->(nx,ny) so nothing thin is skipped.
  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    const x = b.x + (nx - b.x) * (i / steps);
    const y = b.y + (ny - b.y) * (i / steps);
    if (Math.hypot(t.x - x, t.y - y) < 14) return true;
  }
  return false;
}

export function stepCombat(world, dt) {
  const p = world.player;
  if (p.reloadT > 0) { p.reloadT -= dt; if (p.reloadT <= 0) finishReload(world); }
  const keep = [];
  for (const b of world.combat.bullets) {
    const nx = b.x + b.vx * dt; const ny = b.y + b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && b.from === 'player') {
      for (const g of world.gang) {
        if (g.hp > 0 && segHits(b, nx, ny, g)) {
          g.hp -= 1; dead = true;
          world.combat.particles.push({ x: g.x, y: g.y, t: 0.35, color: '#e84e3a' });
          break;
        }
      }
    }
    if (!dead) { b.x = nx; b.y = ny; keep.push(b); }
  }
  world.combat.bullets = keep;
  // Gang shoves toward Rex and brawls when close.
  for (const g of world.gang) {
    if (g.hp <= 0) continue;
    const d = Math.hypot(p.x - g.x, p.y - g.y);
    if (g.flee) { g.x -= (p.x - g.x) / (d || 1) * g.speed * dt; g.y -= (p.y - g.y) / (d || 1) * g.speed * dt; }
    else if (d > 26) { g.x += (p.x - g.x) / d * g.speed * dt; g.y += (p.y - g.y) / d * g.speed * dt; }
    else p.hp -= dt * 7;
  }
  world.gang = world.gang.filter((g) => g.hp > 0);
  for (const pt of world.combat.particles) pt.t -= dt;
  world.combat.particles = world.combat.particles.filter((pt) => pt.t > 0);
  for (const tr of world.combat.tracers) tr.t -= dt;
  world.combat.tracers = world.combat.tracers.filter((tr) => tr.t > 0);
}

export function addTracer(world, x1, y1, x2, y2) {
  world.combat.tracers.push({ x1, y1, x2, y2, t: 0.14 });
}
