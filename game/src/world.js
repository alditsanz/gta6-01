// world.js — the city of Solmar and everything that lives in it.
// Builds the 9x9 street grid, its buildings, traffic, pedestrians, police and the
// three story missions, and steps the whole simulation forward one frame at a time.
import { CITY, WORLD, PLAYER, CARS, POLICE, MISSIONS, COLORS, CONTROLS, SAVE_KEY } from './config.js';
import { makeRng, clamp, dist, angleTo, wrapAngle } from './random.js';

const BLOCK = CITY.block;
const ROAD = CITY.road;
const PITCH = BLOCK + ROAD;

export function roadCenter(i) {
  return ROAD / 2 + i * PITCH;
}

export function isOnRoad(x, y) {
  const gx = ((x % PITCH) + PITCH) % PITCH;
  const gy = ((y % PITCH) + PITCH) % PITCH;
  return gx < ROAD || gy < ROAD;
}

export function nearestRoadPoint(x, y) {
  const gx = ((x % PITCH) + PITCH) % PITCH;
  const gy = ((y % PITCH) + PITCH) % PITCH;
  if (gx < ROAD) return { x, y, along: 'x' };
  if (gy < ROAD) return { x, y, along: 'y' };
  const dx = gx < PITCH / 2 ? gx : gx - PITCH;
  const dy = gy < PITCH / 2 ? gy : gy - PITCH;
  return Math.abs(dx) < Math.abs(dy) ? { x: x - dx, y, along: 'x' } : { x, y: y - dy, along: 'y' };
}

// Breadth-first search over the road graph: police follow the streets, not walls.
export function bfsPath(sx, sy, tx, ty) {
  const n = CITY.blocks + 1;
  const key = (i, j) => i * n + j;
  const startI = clamp(Math.round((sx - ROAD / 2) / PITCH), 0, n - 1);
  const startJ = clamp(Math.round((sy - ROAD / 2) / PITCH), 0, n - 1);
  const goalI = clamp(Math.round((tx - ROAD / 2) / PITCH), 0, n - 1);
  const goalJ = clamp(Math.round((ty - ROAD / 2) / PITCH), 0, n - 1);
  const prev = new Map();
  const queue = [key(startI, startJ)];
  prev.set(key(startI, startJ), -1);
  while (queue.length) {
    const cur = queue.shift();
    const ci = Math.floor(cur / n);
    const cj = cur % n;
    if (ci === goalI && cj === goalJ) break;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = ci + di;
      const nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
      const nk = key(ni, nj);
      if (prev.has(nk)) continue;
      prev.set(nk, cur);
      queue.push(nk);
    }
  }
  const path = [];
  let cur = key(goalI, goalJ);
  if (!prev.has(cur)) return [{ x: roadCenter(goalI), y: roadCenter(goalJ) }];
  while (cur !== -1) {
    path.unshift({ x: roadCenter(Math.floor(cur / n)), y: roadCenter(cur % n) });
    cur = prev.get(cur);
  }
  return path;
}

function buildCity(rng) {
  const buildings = [];
  const palms = [];
  const parks = [];
  for (let bx = 0; bx < CITY.blocks; bx++) {
    for (let by = 0; by < CITY.blocks; by++) {
      const x0 = ROAD + bx * PITCH;
      const y0 = ROAD + by * PITCH;
      const district = CITY.districts[(bx + by) % CITY.districts.length];
      if (rng.chance(0.14)) {
        parks.push({ x: x0, y: y0, w: BLOCK, h: BLOCK, district });
        for (let p = 0; p < 5; p++) {
          palms.push({ x: x0 + rng.range(20, BLOCK - 20), y: y0 + rng.range(20, BLOCK - 20) });
        }
        continue;
      }
      const count = rng.int(1, 3);
      for (let b = 0; b < count; b++) {
        const w = rng.range(50, 90);
        const h = rng.range(50, 90);
        const x = x0 + rng.range(8, BLOCK - w - 8);
        const y = y0 + rng.range(8, BLOCK - h - 8);
        buildings.push({
          x, y, w, h,
          color: rng.pick(COLORS.building),
          floors: rng.int(2, 9),
          district,
          roof: rng.pick(['flat', 'pool', 'garden']),
        });
      }
      if (rng.chance(0.6)) {
        palms.push({ x: x0 + rng.range(14, BLOCK - 14), y: y0 + rng.range(14, BLOCK - 14) });
      }
    }
  }
  return { buildings, palms, parks };
}

function circleHitsBuilding(buildings, x, y, r) {
  for (const b of buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

export class World {
  constructor(seed = 2026) {
    this.seed = seed;
    this.rng = makeRng(seed);
    const city = buildCity(this.rng);
    this.buildings = city.buildings;
    this.palms = city.palms;
    this.parks = city.parks;
    this.time = 0;
    this.cash = 0;
    this.wanted = 0;
    this.heat = 0;
    this.timeOfDay = 0.42; // late afternoon sun
    this.missionIndex = 0;
    this.mission = null;
    this.missionState = 'idle'; // idle | active | done | failed
    this.missionMessage = '';
    this.message = '';
    this.messageTimer = 0;
    this.policeTimer = 0;
    this.kills = 0;
    this.carsStolen = 0;
    this.shotsFired = 0;

    const cx = roadCenter(4);
    const cy = roadCenter(4);
    this.player = {
      x: cx, y: cy, angle: -Math.PI / 2, speed: 0,
      health: PLAYER.maxHealth, onFoot: true, car: null,
      punchCooldown: 0, shootCooldown: 0, invuln: 0,
    };
    this.cars = [];
    this.traffic = [];
    this.pedestrians = [];
    this.police = [];
    this.bullets = [];
    this.particles = [];
    this.pickups = [];
    this.escortVan = null;
    this.spawnTraffic();
    this.spawnPedestrians();
    this.spawnParkedCars();
    this.spawnPickups();
  }

  // ---- spawning ------------------------------------------------------------
  spawnParkedCars() {
    const spots = [
      [roadCenter(2), roadCenter(5) + 30, 0],
      [roadCenter(6), roadCenter(3) - 30, 1],
      [roadCenter(8), roadCenter(8) + 30, 7],
      [roadCenter(1), roadCenter(7) - 30, 2],
      [roadCenter(5), roadCenter(1) + 30, 3],
      [roadCenter(7), roadCenter(6) - 30, 4],
      [roadCenter(3), roadCenter(2) + 30, 5],
      [roadCenter(4), roadCenter(8) - 30, 6],
    ];
    spots.forEach(([x, y, def], i) => {
      const c = CARS[def];
      this.cars.push({
        id: `parked-${i}`, def, name: c.name, color: c.color,
        x, y, angle: this.rng.chance(0.5) ? 0 : Math.PI / 2,
        speed: 0, parked: true, stolen: false, health: 100,
      });
    });
  }

  spawnTraffic() {
    for (let i = 0; i < 16; i++) {
      const horizontal = this.rng.chance(0.5);
      const lane = this.rng.int(0, CITY.blocks);
      const along = this.rng.range(0, WORLD.width);
      const def = this.rng.int(0, CARS.length - 1);
      const c = CARS[def];
      this.traffic.push({
        id: `traffic-${i}`, def, name: c.name, color: c.color,
        x: horizontal ? along : roadCenter(lane) + (this.rng.chance(0.5) ? 10 : -10),
        y: horizontal ? roadCenter(lane) + (this.rng.chance(0.5) ? 10 : -10) : along,
        angle: horizontal ? (this.rng.chance(0.5) ? 0 : Math.PI) : (this.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2),
        speed: this.rng.range(90, 150),
        cruise: this.rng.range(90, 150),
      });
    }
  }

  spawnPedestrians() {
    for (let i = 0; i < 26; i++) {
      const bx = this.rng.int(0, CITY.blocks - 1);
      const by = this.rng.int(0, CITY.blocks - 1);
      this.pedestrians.push({
        id: `ped-${i}`,
        x: ROAD + bx * PITCH + this.rng.range(20, BLOCK - 20),
        y: ROAD + by * PITCH + this.rng.range(20, BLOCK - 20),
        angle: this.rng.range(0, Math.PI * 2),
        speed: this.rng.range(22, 48),
        color: this.rng.pick(['#e8e0c8', '#d0a060', '#7fb0d0', '#c07070', '#90c090', '#d0d0d0']),
        walkPhase: this.rng.range(0, 6),
        panic: 0,
      });
    }
  }

  spawnPickups() {
    const spots = [[roadCenter(1), roadCenter(2)], [roadCenter(8), roadCenter(4)], [roadCenter(5), roadCenter(7)]];
    for (const [x, y] of spots) {
      this.pickups.push({ x, y, kind: 'health', taken: false });
    }
    this.pickups.push({ x: roadCenter(3), y: roadCenter(6), kind: 'cash', amount: 150, taken: false });
    this.pickups.push({ x: roadCenter(7), y: roadCenter(2), kind: 'cash', amount: 250, taken: false });
  }

  // ---- wanted --------------------------------------------------------------
  addHeat(points, reason) {
    this.heat += points;
    const stars = Math.min(POLICE.maxStars, Math.floor(this.heat / 4));
    if (stars > this.wanted) {
      this.wanted = stars;
      this.flash(`${reason} — WANTED LEVEL ${stars}`);
    }
  }

  flash(text) {
    this.message = text;
    this.messageTimer = 3.2;
  }

  spawnPolice() {
    if (this.wanted === 0 || this.police.length >= this.wanted + 1) return;
    const p = this.player;
    const angle = this.rng.range(0, Math.PI * 2);
    const x = clamp(p.x + Math.cos(angle) * 620, 30, WORLD.width - 30);
    const y = clamp(p.y + Math.sin(angle) * 620, 30, WORLD.height - 30);
    const near = nearestRoadPoint(x, y);
    this.police.push({
      id: `cop-${this.time.toFixed(0)}-${this.police.length}`,
      x: near.x, y: near.y, angle: 0, speed: 0,
      path: [], pathIndex: 0, repath: 0, sirenPhase: this.rng.range(0, 6),
    });
  }

  // ---- missions ------------------------------------------------------------
  startMission(index) {
    const def = MISSIONS[index];
    if (!def) return false;
    this.missionIndex = index;
    this.mission = def;
    this.missionState = 'active';
    this.missionMessage = def.brief;
    this.flash(`MISSION: ${def.title} — ${def.giver}`);
    if (def.id === 'm1') {
      this.missionTarget = { x: roadCenter(2), y: roadCenter(2), label: 'PICK UP LENA' };
      this.missionStage = 'pickup';
    } else if (def.id === 'm2') {
      const falco = this.cars.find((c) => c.def === 7);
      if (falco) { falco.x = roadCenter(8); falco.y = roadCenter(6) + 30; falco.parked = true; }
      this.missionTarget = { x: roadCenter(8), y: roadCenter(6), label: 'STEAL THE FALCO' };
      this.missionStage = 'steal';
    } else {
      this.escortVan = {
        x: roadCenter(7), y: roadCenter(7), angle: Math.PI,
        speed: 0, health: 100, path: bfsPath(roadCenter(7), roadCenter(7), roadCenter(1), roadCenter(1)),
        pathIndex: 0,
      };
      this.missionTarget = { x: roadCenter(1), y: roadCenter(1), label: 'OLD PORT WAREHOUSE' };
      this.missionStage = 'escort';
    }
    return true;
  }

  completeMission() {
    const def = this.mission;
    this.cash += def.reward;
    this.missionState = 'done';
    this.mission = null;
    this.escortVan = null;
    this.flash(`MISSION COMPLETE — $${def.reward} earned`);
    this.missionIndex += 1;
  }

  failMission(reason) {
    this.missionState = 'failed';
    this.mission = null;
    this.escortVan = null;
    this.flash(`MISSION FAILED — ${reason}`);
  }

  updateMission(dt) {
    if (!this.mission || this.missionState !== 'active') return;
    const p = this.player;
    const px = p.onFoot ? p.x : p.car.x;
    const py = p.onFoot ? p.y : p.car.y;
    const t = this.missionTarget;
    if (this.mission.id === 'm1') {
      if (this.missionStage === 'pickup') {
        if (dist(px, py, t.x, t.y) < 70 && !p.onFoot) {
          this.missionStage = 'dropoff';
          this.missionTarget = { x: roadCenter(8), y: roadCenter(1), label: 'MARINA DROP-OFF' };
          this.flash('Lena is in the car — take her to the Marina');
        } else if (dist(px, py, t.x, t.y) < 70) {
          this.flash('Lena needs a car — steal one first');
        }
      } else if (dist(px, py, t.x, t.y) < 80) {
        this.completeMission();
      }
    } else if (this.mission.id === 'm2') {
      if (this.missionStage === 'steal') {
        const falco = this.cars.find((c) => c.def === 7);
        if (falco && falco.stolen) {
          this.missionStage = 'deliver';
          this.missionTarget = { x: roadCenter(6), y: roadCenter(5), label: 'SUNSET GARAGE' };
          this.flash('You have the Falco — lose the cops, reach the garage');
        }
      } else if (dist(px, py, t.x, t.y) < 80 && !p.onFoot) {
        this.completeMission();
      }
    } else if (this.mission.id === 'm3') {
      const van = this.escortVan;
      if (!van) return;
      if (van.health <= 0) { this.failMission('the van was destroyed'); return; }
      if (dist(van.x, van.y, t.x, t.y) < 90) this.completeMission();
    }
  }

  // ---- per-frame update ----------------------------------------------------
  update(input, dt) {
    this.time += dt;
    this.timeOfDay = 0.42 + Math.sin(this.time * 0.00004) * 0.05;
    if (this.messageTimer > 0) this.messageTimer -= dt;
    if (this.wanted > 0) {
      this.heat = Math.max(0, this.heat - POLICE.decayPerSecond * dt);
      const stars = Math.min(POLICE.maxStars, Math.floor(this.heat / 4));
      if (stars < this.wanted && this.police.length === 0) this.wanted = stars;
      this.policeTimer -= dt;
      if (this.policeTimer <= 0) {
        this.spawnPolice();
        this.policeTimer = POLICE.spawnGap;
      }
    }
    this.updatePlayer(input, dt);
    this.updateTraffic(dt);
    this.updatePedestrians(dt);
    this.updatePolice(dt);
    this.updateBullets(dt);
    this.updateParticles(dt);
    this.updateEscort(dt);
    this.updateMission(dt);
    this.checkPickups();
    if (this.player.health <= 0) this.respawn();
  }

  updatePlayer(input, dt) {
    const p = this.player;
    p.punchCooldown = Math.max(0, p.punchCooldown - dt);
    p.shootCooldown = Math.max(0, p.shootCooldown - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    const mx = input.moveX();
    const my = input.moveY();
    if (p.onFoot) {
      const speed = input.sprinting() ? PLAYER.runSpeed : PLAYER.walkSpeed;
      const len = Math.hypot(mx, my) || 1;
      const nx = p.x + (mx / len) * speed * dt * (mx || my ? 1 : 0);
      const ny = p.y + (my / len) * speed * dt * (mx || my ? 1 : 0);
      if (mx || my) p.angle = Math.atan2(my, mx);
      if (!circleHitsBuilding(this.buildings, nx, p.y, PLAYER.radius)) p.x = clamp(nx, 12, WORLD.width - 12);
      if (!circleHitsBuilding(this.buildings, p.x, ny, PLAYER.radius)) p.y = clamp(ny, 12, WORLD.height - 12);
      if (input.tapped(CONTROLS.enterCar)) this.tryEnterCar();
      if (input.tapped(CONTROLS.punch)) this.punch();
      // on-foot aiming is driven by main.js (mouse world position -> angle)
    } else {
      const car = p.car;
      const def = CARS[car.def];
      const throttle = my < 0 ? 1 : my > 0 ? -0.55 : 0;
      car.speed += throttle * def.accel * dt;
      car.speed -= car.speed * 0.6 * dt;
      if (!throttle) car.speed -= car.speed * 1.4 * dt;
      car.speed = clamp(car.speed, -90, def.top);
      const steer = mx * def.grip * (car.speed >= 0 ? 1 : -1) * clamp(Math.abs(car.speed) / 60, 0, 1);
      car.angle += steer * dt * (car.speed >= 0 ? 1 : -1) * 0.9;
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const hit = circleHitsBuilding(this.buildings, nx, ny, 16);
      if (hit) {
        car.speed *= -0.25;
        this.burst(car.x, car.y, '#e8e4d8', 8);
      } else {
        car.x = clamp(nx, 14, WORLD.width - 14);
        car.y = clamp(ny, 14, WORLD.height - 14);
      }
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      if (Math.abs(car.speed) > 120) this.kickDust(car);
      if (input.tapped(CONTROLS.exitCar)) this.exitCar();
      if (input.mouse.down && p.shootCooldown <= 0) this.shoot(p.angle); // drive-by, straight ahead
    }
  }

  tryEnterCar() {
    const p = this.player;
    let best = null;
    let bestD = 60;
    for (const car of [...this.cars, ...this.traffic]) {
      const d = dist(p.x, p.y, car.x, car.y);
      if (d < bestD) { best = car; bestD = d; }
    }
    if (!best) return;
    if (best.parked && !best.stolen) {
      best.stolen = true;
      this.carsStolen += 1;
      this.addHeat(2, 'Car stolen');
      this.flash(`Stole the ${best.name} — the owner called it in`);
    }
    if (this.traffic.includes(best)) {
      this.traffic = this.traffic.filter((c) => c !== best);
      this.addHeat(2, 'Carjacked in traffic');
    }
    best.parked = false;
    p.onFoot = false;
    p.car = best;
  }

  exitCar() {
    const p = this.player;
    const car = p.car;
    car.speed = 0;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 26;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 26;
    p.onFoot = true;
    p.car = null;
  }

  punch() {
    const p = this.player;
    if (p.punchCooldown > 0) return;
    p.punchCooldown = 0.45;
    const reach = 34;
    const hx = p.x + Math.cos(p.angle) * reach;
    const hy = p.y + Math.sin(p.angle) * reach;
    for (const ped of this.pedestrians) {
      if (dist(hx, hy, ped.x, ped.y) < 26) {
        ped.panic = 3;
        this.addHeat(1, 'Assault reported');
        this.burst(ped.x, ped.y, '#ffd27d', 6);
      }
    }
    for (const cop of this.police) {
      if (dist(hx, hy, cop.x, cop.y) < 30) {
        this.addHeat(3, 'Cop attacked');
        this.burst(cop.x, cop.y, '#7fb0ff', 8);
      }
    }
  }

  shoot(angle) {
    const p = this.player;
    p.shootCooldown = 0.28;
    this.shotsFired += 1;
    const ox = p.x + Math.cos(angle) * 18;
    const oy = p.y + Math.sin(angle) * 18;
    this.bullets.push({ x: ox, y: oy, vx: Math.cos(angle) * 620, vy: Math.sin(angle) * 620, life: 0.9 });
    this.addHeat(1, 'Shots fired');
    if (this.onShoot) this.onShoot();
  }

  updateBullets(dt) {
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (circleHitsBuilding(this.buildings, b.x, b.y, 2)) {
        b.life = 0;
        this.burst(b.x, b.y, '#e8e4d8', 4);
      }
      for (const cop of this.police) {
        if (dist(b.x, b.y, cop.x, cop.y) < 20) {
          b.life = 0;
          this.burst(cop.x, cop.y, '#7fb0ff', 10);
          this.police = this.police.filter((c) => c !== cop);
          this.kills += 1;
          this.addHeat(3, 'Officer down');
        }
      }
      for (const ped of this.pedestrians) {
        if (dist(b.x, b.y, ped.x, ped.y) < 14) {
          b.life = 0;
          ped.panic = 4;
          this.burst(ped.x, ped.y, '#ff9d7d', 8);
          this.addHeat(2, 'Civilian hit');
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
  }

  updateTraffic(dt) {
    for (const car of this.traffic) {
      const aheadX = car.x + Math.cos(car.angle) * 46;
      const aheadY = car.y + Math.sin(car.angle) * 46;
      let blocked = false;
      for (const other of [...this.traffic, ...this.cars]) {
        if (other === car) continue;
        if (dist(aheadX, aheadY, other.x, other.y) < 34) blocked = true;
      }
      const target = blocked ? 0 : car.cruise;
      car.speed += (target - car.speed) * dt * 1.5;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      if (car.x < -60) car.x = WORLD.width + 40;
      if (car.x > WORLD.width + 60) car.x = -40;
      if (car.y < -60) car.y = WORLD.height + 40;
      if (car.y > WORLD.height + 60) car.y = -40;
    }
  }

  updatePedestrians(dt) {
    for (const ped of this.pedestrians) {
      ped.walkPhase += dt * 6;
      if (ped.panic > 0) {
        ped.panic -= dt;
        ped.angle = angleTo(ped.x, ped.y, this.player.x, this.player.y) + Math.PI;
        ped.speed = 120;
      } else {
        ped.speed = 34;
        if (this.rng.chance(dt * 0.2)) ped.angle = this.rng.range(0, Math.PI * 2);
      }
      const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
      const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
      if (!circleHitsBuilding(this.buildings, nx, ny, 8)) {
        ped.x = clamp(nx, 12, WORLD.width - 12);
        ped.y = clamp(ny, 12, WORLD.height - 12);
      } else {
        ped.angle += Math.PI / 2;
      }
    }
  }

  updatePolice(dt) {
    const p = this.player;
    for (const cop of this.police) {
      cop.sirenPhase += dt * 4;
      cop.repath -= dt;
      if (cop.repath <= 0) {
        cop.path = bfsPath(cop.x, cop.y, p.x, p.y);
        cop.pathIndex = 0;
        cop.repath = 1.6;
      }
      const node = cop.path[Math.min(cop.pathIndex, cop.path.length - 1)];
      if (node && dist(cop.x, cop.y, node.x, node.y) < 30) cop.pathIndex += 1;
      const target = node || { x: p.x, y: p.y };
      const desired = angleTo(cop.x, cop.y, target.x, target.y);
      cop.angle += wrapAngle(desired - cop.angle) * Math.min(1, dt * 4);
      cop.speed = POLICE.chaseSpeed;
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      if (dist(cop.x, cop.y, p.x, p.y) < POLICE.bustRadius && p.invuln <= 0) {
        if (this.wanted >= 3 || this.rng.chance(dt * 0.5)) {
          this.busted();
        }
      }
    }
  }

  updateEscort(dt) {
    const van = this.escortVan;
    if (!van) return;
    const node = van.path[Math.min(van.pathIndex, van.path.length - 1)];
    if (node && dist(van.x, van.y, node.x, node.y) < 34) van.pathIndex += 1;
    const target = node || { x: van.x, y: van.y };
    const desired = angleTo(van.x, van.y, target.x, target.y);
    van.angle += wrapAngle(desired - van.angle) * Math.min(1, dt * 3);
    van.speed = 130;
    van.x += Math.cos(van.angle) * van.speed * dt;
    van.y += Math.sin(van.angle) * van.speed * dt;
    if (this.wanted > 0 && this.rng.chance(dt * 0.4)) {
      van.health -= 2;
      this.burst(van.x, van.y, '#ffb03a', 3);
    }
  }

  busted() {
    const p = this.player;
    p.health = Math.max(20, p.health - 25);
    this.cash = Math.max(0, this.cash - 100);
    this.heat = 0;
    this.wanted = 0;
    this.police = [];
    p.invuln = 3;
    if (!p.onFoot) this.exitCar();
    p.x = roadCenter(4);
    p.y = roadCenter(4);
    this.flash('BUSTED — fined $100, dropped at Civic Plaza');
  }

  respawn() {
    const p = this.player;
    p.health = PLAYER.maxHealth;
    p.x = roadCenter(4);
    p.y = roadCenter(4);
    p.invuln = 2;
    if (!p.onFoot) { p.car = null; p.onFoot = true; }
    this.heat = 0;
    this.wanted = 0;
    this.police = [];
    this.flash('You woke up at the clinic — Solmar forgives, once.');
  }

  checkPickups() {
    const p = this.player;
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      if (dist(p.x, p.y, pk.x, pk.y) < 30) {
        pk.taken = true;
        if (pk.kind === 'health') {
          p.health = Math.min(PLAYER.maxHealth, p.health + 50);
          this.flash('Health +50');
        } else {
          this.cash += pk.amount;
          this.flash(`Found $${pk.amount} in a dropped bag`);
        }
        if (this.onPickup) this.onPickup();
      }
    }
  }

  burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const s = this.rng.range(30, 130);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, color });
    }
  }

  kickDust(car) {
    if (this.rng.chance(0.3)) {
      this.particles.push({
        x: car.x - Math.cos(car.angle) * 16, y: car.y - Math.sin(car.angle) * 16,
        vx: this.rng.range(-20, 20), vy: this.rng.range(-20, 20),
        life: 0.4, color: '#cbb98f',
      });
    }
  }

  updateParticles(dt) {
    for (const pt of this.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
  }

  // ---- save / load -----------------------------------------------------------
  save() {
    const p = this.player;
    const data = {
      cash: this.cash, missionIndex: this.missionIndex, carsStolen: this.carsStolen,
      kills: this.kills, x: p.x, y: p.y, health: p.health, seed: this.seed,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      this.flash('Progress saved');
      return true;
    } catch {
      return false;
    }
  }

  static load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  applySave(data) {
    if (!data) return;
    this.cash = data.cash || 0;
    this.missionIndex = data.missionIndex || 0;
    this.carsStolen = data.carsStolen || 0;
    this.kills = data.kills || 0;
    this.player.x = data.x ?? this.player.x;
    this.player.y = data.y ?? this.player.y;
    this.player.health = data.health ?? PLAYER.maxHealth;
  }
}
