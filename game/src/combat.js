// combat.js — shooting with anti-tunnelling bullets, punching, guards and the
// helicopter at 5 stars. A bullet is tested as a moving segment against every
// target it crosses, never just its endpoint.

// Does segment (ax,ay)->(bx,by) pass within r of point (px,py)?
function segmentHits(ax, ay, bx, by, px, py, r) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = clamp(t, 0, 1);
  const cx = ax + dx * t, cy = ay + dy * t;
  const ddx = px - cx, ddy = py - cy;
  return ddx * ddx + ddy * ddy <= r * r;
}

function fireBullet() {
  if (G.ammo <= 0) { playSound('empty'); return false; }
  G.ammo--;
  const sx = G.player.x, sy = G.player.y;
  const ang = G.aimAngle !== undefined ? G.aimAngle : G.player.angle;
  const range = 520;
  const ex = sx + Math.cos(ang) * range, ey = sy + Math.sin(ang) * range;
  G.bullets.push({ x: sx, y: sy, px: sx, py: sy, angle: ang, speed: 900, life: 0.7, ex, ey });
  addHeat(2);
  playSound('shot');
  return true;
}

// Move bullets and resolve hits along their whole travel path.
function updateBullets(dt) {
  for (const b of G.bullets) {
    const nx = b.x + Math.cos(b.angle) * b.speed * dt;
    const ny = b.y + Math.sin(b.angle) * b.speed * dt;
    b.px = b.x; b.py = b.y;
    b.x = nx; b.y = ny;
    b.life -= dt;
    // Guards take the hit first.
    for (const g of G.guards) {
      if (g.hp <= 0) continue;
      if (segmentHits(b.px, b.py, b.x, b.y, g.x, g.y, 16)) {
        g.hp -= 34;
        b.life = 0;
        burst(g.x, g.y, '#ffd23f', 6);
        if (g.hp <= 0) {
          G.money += 50;
          G.score += 50;
          showMessage('Guard down! +$50');
        }
        break;
      }
    }
    if (b.life <= 0) continue;
    // Police cars can be hit too.
    for (const p of G.police) {
      if (segmentHits(b.px, b.py, b.x, b.y, p.x, p.y, 20)) {
        p.hp -= 25;
        b.life = 0;
        burst(p.x, p.y, '#ff7a3c', 6);
        if (p.hp <= 0) { p.disabled = true; addHeat(6); }
        break;
      }
    }
    if (b.life <= 0) continue;
    // A wall stops the bullet.
    if (hitsBuilding(b.x, b.y, 0)) b.life = 0;
  }
  G.bullets = G.bullets.filter((b) => b.life > 0 && b.x > 0 && b.x < CFG.world && b.y > 0 && b.y < CFG.world);
}

function punch() {
  const range = 42;
  const ax = G.player.x + Math.cos(G.player.angle) * range;
  const ay = G.player.y + Math.sin(G.player.angle) * range;
  playSound('punch');
  for (const g of G.guards) {
    if (g.hp <= 0) continue;
    if (dist(ax, ay, g.x, g.y) < 30) {
      g.hp -= 20;
      burst(g.x, g.y, '#fff', 4);
      if (g.hp <= 0) { G.money += 50; G.score += 50; showMessage('Guard down! +$50'); }
      return true;
    }
  }
  for (const p of G.peds) {
    if (dist(ax, ay, p.x, p.y) < 26) {
      p.dir = (p.dir + 2) % 4;
      addHeat(3);
      return true;
    }
  }
  return false;
}

// --- guards for the Last Ledger (job 7) ---
function spawnGuards() {
  const hq = LANDMARKS.hq;
  G.guards = [
    { x: hq.x - 90, y: hq.y - 40, hp: 100, maxHp: 100, speed: 55, shootAt: 0 },
    { x: hq.x + 90, y: hq.y - 40, hp: 100, maxHp: 100, speed: 55, shootAt: 0 },
    { x: hq.x, y: hq.y + 90, hp: 100, maxHp: 100, speed: 55, shootAt: 0 },
  ];
}

function guardsAlive() { return G.guards.filter((g) => g.hp > 0).length; }

function updateGuards(dt) {
  for (const g of G.guards) {
    if (g.hp <= 0) continue;
    const d = dist(g.x, g.y, G.player.x, G.player.y);
    if (d < 420) {
      // Chase the player and shoot when close enough.
      const a = angleTo(g.x, g.y, G.player.x, G.player.y);
      g.x += Math.cos(a) * g.speed * dt;
      g.y += Math.sin(a) * g.speed * dt;
      g.shootAt -= dt;
      if (d < 260 && g.shootAt <= 0) {
        g.shootAt = 1.1;
        G.player.hp -= 7;
        burst(G.player.x, G.player.y, '#ff5a5a', 4);
        playSound('hurt');
        if (G.player.hp <= 0) wastedRespawn();
      }
    }
  }
}

// --- helicopter (5 stars) ---
// Spawns the moment wanted hits 5 stars, follows from above faster than any
// police car, and leaves only when heat drops below 5 stars.
function updateHelicopter(dt) {
  const stars = wantedStars();
  if (stars >= 5 && !G.heli) {
    G.heli = { x: G.player.x - 300, y: G.player.y - 300, angle: 0, rotor: 0 };
    showMessage('SCPD helicopter overhead! Lose the heat!');
    playSound('heli');
  }
  if (stars < 5 && G.heli) { G.heli = null; return; }
  if (!G.heli) return;
  const h = G.heli;
  h.rotor += dt * 30;
  const a = angleTo(h.x, h.y, G.player.x, G.player.y);
  const spd = 260;
  h.x += Math.cos(a) * spd * dt;
  h.y += Math.sin(a) * spd * dt;
  h.angle = a;
}
