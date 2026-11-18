// Solmar Heat — world: the 9x9 street grid, districts, buildings,
// parks, canals, traffic and pedestrians. Everything the city is made
// of, generated once from the seeded RNG so it never moves between runs.

const World = {
  buildings: [],
  parks: [],
  trees: [],
  traffic: [],
  peds: [],

  init() {
    this.buildings = [];
    this.parks = [];
    this.trees = [];
    this.traffic = [];
    this.peds = [];
    this.buildCity();
    this.spawnTraffic();
    this.spawnPeds();
  },

  // --- grid helpers -------------------------------------------------
  isRoadX(x) {
    return CFG.roads.some((r) => Math.abs(x - r) <= CFG.roadWidth / 2 + 2);
  },
  isRoadY(y) {
    return CFG.roads.some((r) => Math.abs(y - r) <= CFG.roadWidth / 2 + 2);
  },
  onRoad(x, y) { return this.isRoadX(x) || this.isRoadY(y); },

  nearestRoad(v) {
    let best = CFG.roads[0];
    for (const r of CFG.roads) if (Math.abs(v - r) < Math.abs(v - best)) best = r;
    return best;
  },
  nearestRoadIndex(v) {
    let bi = 0;
    for (let i = 0; i < CFG.roads.length; i++) {
      if (Math.abs(v - CFG.roads[i]) < Math.abs(v - CFG.roads[bi])) bi = i;
    }
    return bi;
  },

  districtAt(x, y) {
    for (const d of DISTRICTS) {
      if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
    }
    return DISTRICTS[DISTRICTS.length - 1].name;
  },

  // Is (x,y) water? Canals block movement except on a bridge, and a
  // bridge is exactly where a horizontal road crosses a canal.
  inWater(x, y) {
    for (const c of CANALS) {
      if (x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1) {
        if (this.isRoadY(y)) return false; // on a bridge
        return true;
      }
    }
    return false;
  },

  // --- city generation ----------------------------------------------
  buildCity() {
    const rng = mulberry32(777);
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const x0 = CFG.roads[i] + CFG.roadWidth / 2 + 6;
        const x1 = CFG.roads[i + 1] - CFG.roadWidth / 2 - 6;
        const y0 = CFG.roads[j] + CFG.roadWidth / 2 + 6;
        const y1 = CFG.roads[j + 1] - CFG.roadWidth / 2 - 6;
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        // The canal strip has no buildings; the depot block stays open.
        if (x0 > 2180) continue;
        if (chance(rng, 0.22)) {
          // A park with trees instead of buildings.
          this.parks.push({ x0, y0, x1, y1 });
          const n = randInt(rng, 5, 9);
          for (let t = 0; t < n; t++) {
            this.trees.push({
              x: randRange(rng, x0 + 14, x1 - 14),
              y: randRange(rng, y0 + 14, y1 - 14),
              r: randRange(rng, 7, 11),
            });
          }
          continue;
        }
        // One or two buildings per block.
        const nB = chance(rng, 0.45) ? 2 : 1;
        for (let b = 0; b < nB; b++) {
          const w = randRange(rng, 55, 95);
          const h = randRange(rng, 55, 95);
          const bx = nB === 1 ? cx : (b === 0 ? x0 + w / 2 + 8 : x1 - w / 2 - 8);
          const by = nB === 1 ? cy : cy + (b === 0 ? -h / 4 : h / 4);
          this.buildings.push({
            x: bx - w / 2, y: by - h / 2, w, h,
            hue: randInt(rng, 0, 360),
            lit: chance(rng, 0.6),
            tall: chance(rng, 0.3),
          });
        }
      }
    }
  },

  spawnTraffic() {
    const rng = mulberry32(4242);
    const colors = ['#c9c9c9', '#3f7de3', '#e33f2f', '#f2c230', '#39c0a5', '#8a6fd0'];
    for (let i = 0; i < 16; i++) {
      const vertical = chance(rng, 0.5);
      const road = pick(rng, CFG.roads);
      const dir = chance(rng, 0.5) ? 1 : -1;
      const lane = dir > 0 ? 8 : -8;
      this.traffic.push({
        x: vertical ? road + lane : randRange(rng, 60, CFG.world - 60),
        y: vertical ? randRange(rng, 60, CFG.world - 60) : road + lane,
        vertical, dir,
        speed: randRange(rng, 70, 130),
        color: pick(rng, colors),
        angle: vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
        passed: false, // near-miss bookkeeping, reset per pass
      });
    }
  },

  spawnPeds() {
    const rng = mulberry32(999);
    const colors = ['#e8b04b', '#7fb069', '#d76a6a', '#6a8fd7', '#c9a0dc', '#e8e8e8'];
    for (let i = 0; i < 22; i++) {
      const road = pick(rng, CFG.roads);
      const vertical = chance(rng, 0.5);
      this.peds.push({
        x: vertical ? road + (chance(rng, 0.5) ? 26 : -26) : randRange(rng, 60, CFG.world - 60),
        y: vertical ? randRange(rng, 60, CFG.world - 60) : road + (chance(rng, 0.5) ? 26 : -26),
        vertical, dir: chance(rng, 0.5) ? 1 : -1,
        speed: randRange(rng, 22, 45),
        color: pick(rng, colors),
        phase: rng() * Math.PI * 2,
      });
    }
  },

  // --- collisions ----------------------------------------------------
  // Push a circle out of buildings and water; returns true if it hit.
  collideCircle(ent, r) {
    let hit = false;
    for (const b of this.buildings) {
      const cx = clamp(ent.x, b.x, b.x + b.w);
      const cy = clamp(ent.y, b.y, b.y + b.h);
      const dx = ent.x - cx, dy = ent.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        ent.x = cx + (dx / d) * r;
        ent.y = cy + (dy / d) * r;
      } else {
        // Centre inside the building: push out along the shallowest side.
        const left = ent.x - b.x + r, right = b.x + b.w - ent.x + r;
        const top = ent.y - b.y + r, bottom = b.y + b.h - ent.y + r;
        const m = Math.min(left, right, top, bottom);
        if (m === left) ent.x = b.x - r;
        else if (m === right) ent.x = b.x + b.w + r;
        else if (m === top) ent.y = b.y - r;
        else ent.y = b.y + b.h + r;
      }
    }
    // Water is handled by the mover itself (it steps back); buildings
    // are the only hard collision here.
    return hit;
  },

  // --- traffic + pedestrian motion -----------------------------------
  updateTraffic(dt, playerCar) {
    for (const t of this.traffic) {
      if (t.vertical) {
        t.y += t.dir * t.speed * dt;
        if (t.y > CFG.world - 20) t.y = 20;
        if (t.y < 20) t.y = CFG.world - 20;
      } else {
        t.x += t.dir * t.speed * dt;
        if (t.x > CFG.world - 20) t.x = 20;
        if (t.x < 20) t.x = CFG.world - 20;
      }
      // At an intersection, sometimes turn onto the crossing road.
      if (Math.random() < dt * 0.02) {
        const nearV = this.isRoadX(t.x), nearH = this.isRoadY(t.y);
        if (nearV && nearH) {
          t.vertical = !t.vertical;
          t.dir = Math.random() < 0.5 ? 1 : -1;
          if (t.vertical) { t.x = this.nearestRoad(t.x); t.angle = t.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
          else { t.y = this.nearestRoad(t.y); t.angle = t.dir > 0 ? 0 : Math.PI; }
        }
      }
    }
    // Near-miss: player car threads past a traffic car at speed.
    if (playerCar && playerCar.speed > CFG.nearMissMinSpeed) {
      for (const t of this.traffic) {
        const d = dist(playerCar.x, playerCar.y, t.x, t.y);
        if (d < 46 && !t.passed) {
          t.passed = true;
          SideJobs.nearMiss();
        } else if (d > 90) {
          t.passed = false;
        }
      }
    }
  },

  updatePeds(dt) {
    for (const p of this.peds) {
      if (p.vertical) {
        p.y += p.dir * p.speed * dt;
        if (p.y > CFG.world - 30) { p.y = CFG.world - 30; p.dir = -1; }
        if (p.y < 30) { p.y = 30; p.dir = 1; }
      } else {
        p.x += p.dir * p.speed * dt;
        if (p.x > CFG.world - 30) { p.x = CFG.world - 30; p.dir = -1; }
        if (p.x < 30) { p.x = 30; p.dir = 1; }
      }
      p.phase += dt * 6;
    }
  },

  // --- road-graph pathfinding (BFS over intersections) ---------------
  // Returns a list of intersection points from (sx,sy) to (tx,ty).
  findPath(sx, sy, tx, ty) {
    const si = this.nearestRoadIndex(sx), sj = this.nearestRoadIndex(sy);
    const ti = this.nearestRoadIndex(tx), tj = this.nearestRoadIndex(ty);
    const key = (i, j) => i * 9 + j;
    const prev = new Map();
    const queue = [[si, sj]];
    prev.set(key(si, sj), null);
    while (queue.length) {
      const [i, j] = queue.shift();
      if (i === ti && j === tj) break;
      for (const [ni, nj] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
        if (ni < 0 || ni > 8 || nj < 0 || nj > 8) continue;
        if (prev.has(key(ni, nj))) continue;
        prev.set(key(ni, nj), [i, j]);
        queue.push([ni, nj]);
      }
    }
    const path = [];
    let cur = [ti, tj];
    if (!prev.has(key(ti, tj))) return [{ x: tx, y: ty }];
    while (cur) {
      path.unshift({ x: CFG.roads[cur[0]], y: CFG.roads[cur[1]] });
      cur = prev.get(key(cur[0], cur[1]));
    }
    path.push({ x: tx, y: ty });
    return path;
  },
};
