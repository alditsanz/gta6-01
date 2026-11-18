// Solmar Heat — turf (NEW in round 6): gang territory.
// Ten districts, three gangs. The player starts holding Sunset Mile;
// the Vipers and the Crows hold the rest. Stand on a rival district's
// flag (G) to start a takeover: survive 30 seconds inside the district
// while rival gang cars hunt you down, and the district flips to the
// Solmar Kings. Owned districts pay $40 every minute, and the minimap
// tints each district by its owner so the map tells the whole story.

const Turf = {
  owners: {},        // district name -> 'player' | 'vipers' | 'crows'
  war: null,         // { district, timer, outTimer }
  cooldown: 0,
  gangCars: [],
  incomeTimer: 0,

  init(savedOwners) {
    this.owners = {};
    for (const d of DISTRICTS) {
      this.owners[d.name] = (savedOwners && savedOwners[d.name]) || TURF_START[d.name] || 'vipers';
    }
    this.war = null;
    this.cooldown = 0;
    this.gangCars = [];
    this.incomeTimer = CFG.turfIncomeEverySec;
  },

  ownedCount() {
    return Object.values(this.owners).filter((o) => o === 'player').length;
  },

  ownerOf(x, y) {
    return this.owners[World.districtAt(x, y)];
  },

  districtCenter(name) {
    const d = DISTRICTS.find((dd) => dd.name === name);
    return { x: (d.x0 + d.x1) / 2, y: (d.y0 + d.y1) / 2 };
  },

  // The flag the player stands on to start a war: the district centre.
  tryStartWar(state) {
    if (this.war || this.cooldown > 0) return;
    const name = World.districtAt(state.player.x, state.player.y);
    if (this.owners[name] === 'player') {
      state.toast = `${name} is already yours`;
      state.toastTimer = 1.5;
      return;
    }
    const c = this.districtCenter(name);
    if (dist(state.player.x, state.player.y, c.x, c.y) > 120) {
      state.toast = `Go to the ${name} flag to start a takeover`;
      state.toastTimer = 2;
      return;
    }
    const rival = this.owners[name];
    this.war = { district: name, rival, timer: CFG.turfWarDuration, outTimer: 0 };
    this.gangCars = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      this.gangCars.push({
        x: state.player.x + Math.cos(a) * 420,
        y: state.player.y + Math.sin(a) * 420,
        speed: 0, angle: a, hitTimer: 0,
        color: GANGS[rival].color,
      });
    }
    state.toast = `TURF WAR — hold ${name} for ${CFG.turfWarDuration}s against the ${GANGS[rival].name}!`;
    state.toastTimer = 3;
    AudioSys.sfx('turfwar');
  },

  update(state, dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    // Turf income: every minute, each owned district pays.
    this.incomeTimer -= dt;
    if (this.incomeTimer <= 0) {
      this.incomeTimer = CFG.turfIncomeEverySec;
      const n = this.ownedCount();
      if (n > 0) {
        const pay = n * CFG.turfIncomePerDistrict;
        state.money += pay;
        state.toast = `Turf income +$${pay} (${n} district${n > 1 ? 's' : ''})`;
        state.toastTimer = 2;
        AudioSys.sfx('cash');
      }
    }
    if (!this.war) return;
    const w = this.war;
    const inside = World.districtAt(state.player.x, state.player.y) === w.district;
    if (!inside) {
      w.outTimer += dt;
      if (w.outTimer > 5) {
        state.toast = 'Turf war lost — you left the district';
        state.toastTimer = 2;
        this.war = null;
        this.gangCars = [];
        this.cooldown = CFG.turfWarCooldown;
        return;
      }
    } else {
      w.outTimer = 0;
    }
    w.timer -= dt;
    // Rival gang cars chase and ram the player.
    for (const g of this.gangCars) {
      const target = angleTo(g.x, g.y, state.player.x, state.player.y);
      g.angle += clamp(angleDiff(g.angle, target), -2.2 * dt, 2.2 * dt);
      g.speed = lerp(g.speed, 330, dt * 0.9);
      g.x += Math.cos(g.angle) * g.speed * dt;
      g.y += Math.sin(g.angle) * g.speed * dt;
      g.hitTimer = Math.max(0, g.hitTimer - dt);
      if (g.hitTimer <= 0 && dist(g.x, g.y, state.player.x, state.player.y) < 34) {
        g.hitTimer = 1;
        if (state.car) {
          state.car.health -= CFG.gangCarDamage;
          if (state.car.health <= 0) Cars.wreck(state);
        } else {
          state.player.health -= 10;
          if (state.player.health <= 0) {
            Landmarks.hospitalRespawn(state);
            this.war = null;
            this.gangCars = [];
            this.cooldown = CFG.turfWarCooldown;
            return;
          }
        }
        AudioSys.sfx('crash');
      }
    }
    if (w.timer <= 0) {
      this.owners[w.district] = 'player';
      state.money += CFG.turfTakeoverPay;
      state.score += 100;
      state.toast = `${w.district} is YOURS now! +$${CFG.turfTakeoverPay}`;
      state.toastTimer = 3;
      AudioSys.sfx('cash');
      this.war = null;
      this.gangCars = [];
      SaveGame.save(state);
    }
  },
};
