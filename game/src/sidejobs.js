// Solmar Heat — side jobs: taxi fares, the Canal Row delivery run,
// and near-miss bonuses for threading traffic at speed.

const SideJobs = {
  fares: [],
  delivery: null,      // { state:'idle'|'carrying', x,y, timer }
  nearMissTimer: 0,
  fareCooldown: 0,

  init() {
    this.fares = [];
    this.delivery = null;
    this.nearMissTimer = 0;
    this.fareCooldown = 0;
    // Fare hails waiting at roadside spots.
    const spots = [
      { x: 296, y: 620, dx: 1621, dy: 826 },
      { x: 1091, y: 340, dx: 561, dy: 1886 },
      { x: 1886, y: 1091, dx: 296, dy: 2151 },
      { x: 826, y: 2151, dx: 2151, dy: 296 },
    ];
    for (const s of spots) {
      this.fares.push({ x: s.x, y: s.y, dx: s.dx, dy: s.dy, active: false, done: false });
    }
  },

  // Press T near a waiting fare to pick them up.
  tryPickupFare(state) {
    if (!state.car) { state.toast = 'You need a car for a fare'; state.toastTimer = 1.5; return; }
    for (const f of this.fares) {
      if (f.done || f.active) continue;
      if (dist(state.player.x, state.player.y, f.x, f.y) < 70) {
        f.active = true;
        state.toast = 'Fare picked up — drive to the marker';
        state.toastTimer = 2;
        AudioSys.sfx('fare');
        return;
      }
    }
  },

  update(state, dt) {
    this.nearMissTimer = Math.max(0, this.nearMissTimer - dt);
    this.fareCooldown = Math.max(0, this.fareCooldown - dt);
    // Taxi drop-offs.
    for (const f of this.fares) {
      if (!f.active) continue;
      if (dist(state.player.x, state.player.y, f.dx, f.dy) < 60) {
        f.active = false;
        f.done = true;
        state.money += CFG.taxiFare;
        state.faresDone++;
        state.score += 30;
        state.toast = `Fare complete +$${CFG.taxiFare}`;
        state.toastTimer = 2;
        AudioSys.sfx('cash');
        SaveGame.save(state);
        // A fresh hail appears elsewhere after a while.
        if (this.fareCooldown <= 0) {
          this.fareCooldown = 8;
          const s = { x: 561 + Math.floor(Math.random() * 3) * 530, y: 561, dx: 296, dy: 1091 };
          this.fares.push({ x: s.x, y: s.y, dx: s.dx, dy: s.dy, active: false, done: false });
        }
      }
    }
    // Delivery run: pickup at the Canal Row depot, drop across the map.
    if (this.delivery) {
      const d = this.delivery;
      if (d.state === 'waiting') {
        if (dist(state.player.x, state.player.y, d.x, d.y) < 55) {
          d.state = 'carrying';
          d.timer = 90;
          state.toast = 'Package picked up — deliver to Sunset Mile in 90s!';
          state.toastTimer = 2;
          AudioSys.sfx('fare');
        }
      } else if (d.state === 'carrying') {
        d.timer -= dt;
        // Spotted by police mid-delivery: heat climbs faster.
        for (const c of Police.cars) {
          if (dist(c.x, c.y, state.player.x, state.player.y) < 300) {
            Police.addHeat(state, 8 * dt);
            break;
          }
        }
        if (dist(state.player.x, state.player.y, d.dx, d.dy) < 60) {
          state.money += CFG.deliveryPay;
          state.score += 40;
          state.toast = `Delivery complete +$${CFG.deliveryPay}`;
          state.toastTimer = 2;
          AudioSys.sfx('cash');
          this.delivery = null;
          SaveGame.save(state);
        } else if (d.timer <= 0) {
          state.toast = 'Delivery failed — the package went cold';
          state.toastTimer = 2;
          this.delivery = null;
        }
      }
    }
  },

  // Start a delivery run from the depot. Free to take, once at a time.
  startDelivery(state) {
    if (this.delivery) return;
    this.delivery = {
      state: 'waiting',
      x: LANDMARKS.canalDepot.x, y: LANDMARKS.canalDepot.y,
      dx: 296, dy: 296, timer: 0,
    };
    state.toast = 'Delivery job: pick up the package at Canal Row Depot';
    state.toastTimer = 2.5;
  },

  nearMiss() {
    if (this.nearMissTimer > 0) return;
    this.nearMissTimer = CFG.nearMissCooldown;
    const state = GameState;
    state.money += CFG.nearMissValue;
    state.nearMisses++;
    state.score += 5;
    state.toast = `Near miss +$${CFG.nearMissValue}`;
    state.toastTimer = 1.2;
    AudioSys.sfx('whoosh');
  },
};
