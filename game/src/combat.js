// Solmar Heat — combat: shooting with ammo and reload, punching,
// bullets that test their whole travel segment (no tunnelling past
// thin targets), guards with health pips, and ammo pickups.

const Combat = {
  bullets: [],
  guards: [],
  ammoPickups: [],
  punchTimer: 0,
  reloadTimer: 0,

  init() {
    this.bullets = [];
    this.guards = [];
    this.ammoPickups = [];
    this.punchTimer = 0;
    this.reloadTimer = 0;
    // A couple of ammo crates lying around the city.
    this.ammoPickups = [
      { x: 561, y: 826, taken: false },
      { x: 1621, y: 1091, taken: false },
      { x: 1091, y: 2151, taken: false },
    ];
  },

  // Spawn the HQ guards for the ledger job.
  spawnGuards() {
    if (this.guards.length) return;
    const base = LANDMARKS.scpdHq;
    this.guards = [
      { x: base.x - 46, y: base.y - 30, health: CFG.guardHealth, max: CFG.guardHealth, alive: true },
      { x: base.x + 46, y: base.y - 30, health: CFG.guardHealth, max: CFG.guardHealth, alive: true },
      { x: base.x, y: base.y + 52, health: CFG.guardHealth, max: CFG.guardHealth, alive: true },
    ];
  },

  guardsAlive() { return this.guards.filter((g) => g.alive).length; },

  // Distance from point (px,py) to segment (x1,y1)-(x2,y2).
  segDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
    t = clamp(t, 0, 1);
    return dist(px, py, x1 + t * dx, y1 + t * dy);
  },

  shoot(state, tx, ty) {
    const p = state.player;
    if (state.car) return; // no drive-by shooting in this build
    if (this.reloadTimer > 0) return;
    if (state.ammo <= 0) {
      AudioSys.sfx('dryfire');
      this.startReload(state);
      return;
    }
    state.ammo--;
    const a = angleTo(p.x, p.y, tx, ty);
    this.bullets.push({
      x: p.x, y: p.y, vx: Math.cos(a) * CFG.bulletSpeed, vy: Math.sin(a) * CFG.bulletSpeed,
      life: 1.2,
    });
    AudioSys.sfx('shot');
    Police.addHeat(state, CFG.heatShot);
  },

  startReload(state) {
    if (this.reloadTimer > 0 || state.ammo >= CFG.magSize || state.reserve <= 0) return;
    this.reloadTimer = 1.1;
    AudioSys.sfx('reload');
  },

  punch(state) {
    if (this.punchTimer > 0 || state.car) return;
    this.punchTimer = 0.35;
    const p = state.player;
    const reach = CFG.punchRange + 14;
    // Guards in front take the hit.
    for (const g of this.guards) {
      if (!g.alive) continue;
      if (dist(p.x, p.y, g.x, g.y) < reach) {
        this.damageGuard(state, g, CFG.punchDamage);
      }
    }
    // Pedestrians too — and the law notices.
    for (const ped of World.peds) {
      if (dist(p.x, p.y, ped.x, ped.y) < reach) {
        ped.x += Math.cos(p.angle) * 60;
        ped.y += Math.sin(p.angle) * 60;
        Police.addHeat(state, CFG.heatKill);
      }
    }
    AudioSys.sfx('punch');
  },

  damageGuard(state, g, dmg) {
    g.health -= dmg;
    if (g.health <= 0 && g.alive) {
      g.alive = false;
      g.health = 0;
      state.money += 50; // guard drops
      state.score += 40;
      state.toast = 'Guard down — $50 dropped';
      state.toastTimer = 1.6;
      AudioSys.sfx('guardDown');
    }
  },

  update(state, dt) {
    this.punchTimer = Math.max(0, this.punchTimer - dt);
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const need = CFG.magSize - state.ammo;
        const take = Math.min(need, state.reserve);
        state.ammo += take;
        state.reserve -= take;
      }
    }
    // Bullets: move in small steps and test the whole segment so a
    // fast bullet cannot tunnel past a thin target.
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
      let dead = false;
      for (const g of this.guards) {
        if (!g.alive) continue;
        if (this.segDist(g.x, g.y, b.x, b.y, nx, ny) < 20) {
          this.damageGuard(state, g, CFG.bulletDamage);
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (const ped of World.peds) {
          if (this.segDist(ped.x, ped.y, b.x, b.y, nx, ny) < 14) {
            ped.x += Math.cos(Math.atan2(b.vy, b.vx)) * 80;
            ped.y += Math.sin(Math.atan2(b.vy, b.vx)) * 80;
            Police.addHeat(state, CFG.heatKill);
            dead = true;
            break;
          }
        }
      }
      b.x = nx; b.y = ny;
      b.life -= dt;
      if (dead || b.life <= 0 || b.x < 0 || b.y < 0 || b.x > CFG.world || b.y > CFG.world) {
        this.bullets.splice(i, 1);
      }
    }
    // Ammo pickups.
    for (const a of this.ammoPickups) {
      if (a.taken) continue;
      if (dist(state.player.x, state.player.y, a.x, a.y) < 28) {
        a.taken = true;
        state.reserve += 24;
        state.toast = 'Ammo +24';
        state.toastTimer = 1.5;
        AudioSys.sfx('coin');
      }
    }
    // Guards shuffle toward the player when the ledger job is live.
    const mission = state.mission;
    if (mission && mission.job.id === 7 && mission.step >= 1) {
      for (const g of this.guards) {
        if (!g.alive) continue;
        const d = dist(g.x, g.y, state.player.x, state.player.y);
        if (d < 320 && d > 60) {
          const a = angleTo(g.x, g.y, state.player.x, state.player.y);
          g.x += Math.cos(a) * 55 * dt;
          g.y += Math.sin(a) * 55 * dt;
        }
      }
    }
  },
};
