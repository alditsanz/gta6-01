// Solmar Heat — police: the 5-star wanted system, pursuit cars
// that pathfind on the road grid (BFS over intersections), and
// roadblocks from 4 stars up.

const Police = {
  cars: [],
  roadblocks: [],
  spawnTimer: 0,
  repathTimer: 0,
  quietTimer: 0, // seconds since the last crime

  init() {
    this.cars = [];
    this.roadblocks = [];
    this.spawnTimer = 0;
    this.repathTimer = 0;
    this.quietTimer = 0;
  },

  starsOf(heat) {
    return Math.min(5, Math.floor(clamp(heat, 0, CFG.heatMax) / CFG.heatPerStar));
  },

  // Add heat; crossing into a new star band lands mid-band so the
  // star cannot decay away the very next frame.
  addHeat(state, amount) {
    const before = this.starsOf(state.heat);
    state.heat = clamp(state.heat + amount, 0, CFG.heatMax);
    const after = this.starsOf(state.heat);
    if (after > before) {
      // Mid-band, but never past the cap (5 stars tops out at 500).
      state.heat = Math.min(after * CFG.heatPerStar + CFG.heatPerStar / 2, CFG.heatMax);
    }
    state.stars = after;
    this.quietTimer = 0;
  },

  setStars(state, n) {
    state.stars = clamp(n, 0, 5);
    state.heat = Math.min(state.stars * CFG.heatPerStar + CFG.heatPerStar / 2, CFG.heatMax);
    this.quietTimer = 0;
  },

  update(state, dt) {
    this.quietTimer += dt;
    // Heat decays only once the player has laid low a few seconds.
    if (this.quietTimer > 5 && state.heat > 0) {
      state.heat = Math.max(0, state.heat - CFG.heatDecayPerSec * dt);
      state.stars = this.starsOf(state.heat);
    }

    const want = state.stars;
    // Spawn pursuit cars up to the wanted level's count.
    this.spawnTimer -= dt;
    if (this.cars.length < want && this.spawnTimer <= 0) {
      this.spawnTimer = 2.5;
      const edge = [
        { x: 60, y: state.player.y }, { x: CFG.world - 60, y: state.player.y },
        { x: state.player.x, y: 60 }, { x: state.player.x, y: CFG.world - 60 },
      ][Math.floor(Math.random() * 4)];
      this.cars.push({
        x: clamp(edge.x, 40, CFG.world - 40), y: clamp(edge.y, 40, CFG.world - 40),
        speed: 0, angle: 0, path: [], pathI: 0,
      });
    }
    // Stand down when the heat is gone.
    if (want === 0 && this.cars.length) {
      this.cars = [];
      this.roadblocks = [];
    }

    // Re-path every second toward the player's nearest intersection.
    this.repathTimer -= dt;
    if (this.repathTimer <= 0) {
      this.repathTimer = 1;
      for (const c of this.cars) {
        c.path = World.findPath(c.x, c.y, state.player.x, state.player.y);
        c.pathI = 0;
      }
    }

    // Drive the path, then close in directly.
    for (const c of this.cars) {
      const maxSpd = 300 + want * 18;
      let tx = state.player.x, ty = state.player.y;
      if (c.pathI < c.path.length) {
        tx = c.path[c.pathI].x; ty = c.path[c.pathI].y;
        if (dist(c.x, c.y, tx, ty) < 24) c.pathI++;
      }
      const target = angleTo(c.x, c.y, tx, ty);
      c.angle += clamp(angleDiff(c.angle, target), -2.4 * dt, 2.4 * dt);
      c.speed = lerp(c.speed, maxSpd, dt * 0.8);
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
      c.x = clamp(c.x, 20, CFG.world - 20);
      c.y = clamp(c.y, 20, CFG.world - 20);
      // Ramming the player hurts and spikes the heat.
      if (dist(c.x, c.y, state.player.x, state.player.y) < 34) {
        if (state.car) {
          state.car.health -= 6;
          if (state.car.health <= 0) Cars.wreck(state);
        } else {
          state.player.health -= 12;
          if (state.player.health <= 0) Landmarks.hospitalRespawn(state);
        }
        c.x -= Math.cos(c.angle) * 40;
        c.y -= Math.sin(c.angle) * 40;
        this.addHeat(state, 6);
      }
    }

    // Roadblocks from 4 stars: two cruisers + barriers across the
    // road ahead of the player. They clear when heat drops.
    if (want >= 4 && this.roadblocks.length === 0) {
      const p = state.player;
      const ahead = p.angle || 0;
      const bx = p.x + Math.cos(ahead) * 320;
      const by = p.y + Math.sin(ahead) * 320;
      this.roadblocks = [
        { x: bx - 30, y: by - 30, angle: ahead + Math.PI / 2 },
        { x: bx + 30, y: by + 30, angle: ahead + Math.PI / 2 },
      ];
      AudioSys.sfx('roadblock');
    } else if (want < 4 && this.roadblocks.length) {
      this.roadblocks = [];
    }
    // Touching a roadblock cruiser wrecks the car fast.
    for (const rb of this.roadblocks) {
      if (state.car && dist(state.car.x, state.car.y, rb.x, rb.y) < 30) {
        state.car.health -= 20;
        state.car.x -= Math.cos(state.player.angle) * 50;
        state.car.y -= Math.sin(state.player.angle) * 50;
        if (state.car.health <= 0) Cars.wreck(state);
      }
    }
  },
};
