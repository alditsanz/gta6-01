// Solmar Heat — combat: shooting, punching, bullets and guards.
// A bullet is tested along its whole path in small steps, so it
// cannot tunnel past a thin target between frames.
SH.spawnGuards = function (S, cx, cy, n) {
  S.guards = [];
  for (var i = 0; i < n; i++) {
    var a = (i / n) * Math.PI * 2;
    S.guards.push({
      x: cx + Math.cos(a) * 70, y: cy + Math.sin(a) * 70,
      hp: 3, maxHp: 3, shootT: 1 + i * 0.7, alive: true
    });
  }
};

// Fire one bullet from the player toward a world point.
SH.shoot = function (S, tx, ty) {
  var p = S.player;
  if (p.ammo <= 0) { SH.sfx('dry'); return false; }
  if (S.reloadT > 0) return false;
  p.ammo--;
  var a = SH.angleTo(p.x, p.y, tx, ty);
  S.bullets.push({ x: p.x, y: p.y, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, life: 1.2, fromPlayer: true });
  SH.sfx('shot');
  SH.addHeat(S, 12);
  return true;
};

// Punch: a short-range swing on foot.
SH.punch = function (S) {
  var p = S.player;
  if (p.punchT > 0 || S.reloadT > 0) return;
  p.punchT = 0.35;
  SH.sfx('punch');
  for (var i = 0; i < S.guards.length; i++) {
    var g = S.guards[i];
    if (g.alive && SH.dist(p.x, p.y, g.x, g.y) < 46) {
      g.hp--;
      if (g.hp <= 0) SH.killGuard(S, g);
    }
  }
};

SH.killGuard = function (S, g) {
  g.alive = false;
  S.money += SH.GUARD_DROP;
  S.score += 150;
  S.message = 'Guard down! +$' + SH.GUARD_DROP;
  S.messageT = 2;
  SH.sfx('guardDown');
};

// Step every bullet forward, testing its path in 4-unit steps so
// nothing between frames is skipped.
SH.updateBullets = function (S, dt) {
  var p = S.player;
  for (var i = S.bullets.length - 1; i >= 0; i--) {
    var b = S.bullets[i];
    b.life -= dt;
    var steps = Math.ceil(SH.dist(0, 0, b.vx * dt, b.vy * dt) / 4) || 1;
    var hit = false;
    for (var s = 1; s <= steps; s++) {
      var nx = b.x + (b.vx * dt * s) / steps;
      var ny = b.y + (b.vy * dt * s) / steps;
      for (var g = 0; g < S.guards.length; g++) {
        var gd = S.guards[g];
        if (!gd.alive) continue;
        if (SH.dist(nx, ny, gd.x, gd.y) < 16) {
          gd.hp--;
          if (gd.hp <= 0) SH.killGuard(S, gd);
          hit = true;
          break;
        }
      }
      if (hit) break;
      // A bullet dies on a building.
      if (SH.hitsBuilding(S.world, nx, ny, 2)) { hit = true; break; }
    }
    if (hit || b.life <= 0) { S.bullets.splice(i, 1); continue; }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    // Enemy bullets (from guards) can hit the player.
    if (!b.fromPlayer && SH.dist(b.x, b.y, p.x, p.y) < 14) {
      SH.hurtPlayer(S, 10);
      S.bullets.splice(i, 1);
    }
  }
};

// Guards stand their ground and shoot back at the player.
SH.updateGuards = function (S, dt) {
  var p = S.player;
  for (var i = 0; i < S.guards.length; i++) {
    var g = S.guards[i];
    if (!g.alive) continue;
    var d = SH.dist(p.x, p.y, g.x, g.y);
    if (d < 420) {
      g.shootT -= dt;
      if (g.shootT <= 0) {
        g.shootT = 1.6;
        var a = SH.angleTo(g.x, g.y, p.x, p.y);
        S.bullets.push({ x: g.x, y: g.y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, life: 1.4, fromPlayer: false });
        SH.sfx('shot');
      }
    }
  }
};

SH.hurtPlayer = function (S, dmg) {
  var p = S.player;
  if (S.screen !== 'play') return;
  p.health -= dmg;
  SH.sfx('hurt');
  if (p.health <= 0) SH.wasted(S);
};

// Reload: R tops the magazine up from the reserve.
SH.reload = function (S) {
  var p = S.player;
  if (S.reloadT > 0 || p.ammo >= 12 || p.reserve <= 0) return;
  S.reloadT = 1.1;
  SH.sfx('reload');
};

SH.finishReload = function (S) {
  var p = S.player;
  var need = 12 - p.ammo;
  var take = Math.min(need, p.reserve);
  p.ammo += take;
  p.reserve -= take;
};

// Ammo pickups scattered on the map.
SH.ammoSpots = function () {
  return [
    { x: 628, y: 882, taken: false }, { x: 1390, y: 1644, taken: false },
    { x: 1898, y: 2152, taken: false }, { x: 374, y: 1390, taken: false }
  ];
};

SH.checkAmmo = function (S) {
  var p = S.player;
  for (var i = 0; i < S.ammo.length; i++) {
    var a = S.ammo[i];
    if (a.taken) continue;
    if (SH.dist(p.x, p.y, a.x, a.y) < 30) {
      a.taken = true;
      p.reserve += 24;
      S.message = 'Ammo +24';
      S.messageT = 1.5;
      SH.sfx('coin');
    }
  }
};
