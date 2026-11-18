// world.js — the city: roads, buildings, canals and bridges, districts,
// traffic and pedestrians, the clock, weather, and the rush-hour density rule.

function nearestRoad(v) {
  let best = CFG.roads[0], bd = Infinity;
  for (const r of CFG.roads) { const d = Math.abs(v - r); if (d < bd) { bd = d; best = r; } }
  return best;
}

function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  }
  return 'Solmar';
}

function onRoad(x, y) {
  return CFG.roads.some((r) => Math.abs(x - r) <= CFG.roadHalf + 6) ||
    CFG.roads.some((r) => Math.abs(y - r) <= CFG.roadHalf + 6);
}

// Buildings: one per block cell, with a gap for the plaza, HQ, paint shop and depot.
function buildBuildings() {
  const out = [];
  const r = makeRng(1337);
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const x0 = CFG.roads[i] + 34, y0 = CFG.roads[j] + 34;
      const x1 = CFG.roads[i + 1] - 34, y1 = CFG.roads[j + 1] - 34;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      // Keep landmark plots open.
      if (dist(cx, cy, LANDMARKS.hq.x, LANDMARKS.hq.y) < 190) continue;
      if (dist(cx, cy, LANDMARKS.plaza.x, LANDMARKS.plaza.y) < 170) continue;
      if (dist(cx, cy, LANDMARKS.paint.x, LANDMARKS.paint.y) < 150) continue;
      if (dist(cx, cy, LANDMARKS.depot.x, LANDMARKS.depot.y) < 150) continue;
      const park = r() < 0.22;
      out.push({
        x0, y0, x1, y1, park,
        hue: Math.floor(randRange(r, 0, 360)),
        trees: park ? Math.floor(randRange(r, 3, 8)) : 0,
        seed: Math.floor(r() * 100000),
      });
    }
  }
  return out;
}

function buildTrees(buildings) {
  const trees = [];
  const r = makeRng(777);
  for (const b of buildings) {
    if (!b.park) continue;
    for (let t = 0; t < b.trees; t++) {
      trees.push({ x: randRange(r, b.x0 + 15, b.x1 - 15), y: randRange(r, b.y0 + 15, b.y1 - 15), s: randRange(r, 7, 12) });
    }
  }
  return trees;
}

let BUILDINGS = [];
let TREES = [];

// Is the point inside a building (solid)? Landmark plots stay open ground.
function hitsBuilding(x, y, pad) {
  for (const b of BUILDINGS) {
    if (b.park) continue;
    if (x > b.x0 - pad && x < b.x1 + pad && y > b.y0 - pad && y < b.y1 + pad) return b;
  }
  return null;
}

// Is the point in canal water (not on a bridge)?
function inCanal(x, y) {
  for (const c of CANALS) {
    if (x >= c.x0 && x < c.x1 && y >= c.y0 && y < c.y1) {
      for (const br of BRIDGES) {
        if (Math.abs(x - br.x) <= br.half && y >= br.y0 && y < br.y1) return false;
      }
      return true;
    }
  }
  return false;
}

// --- day / night ---
// Sky phase from the in-game hour: day 06:00-18:00, dusk 05-06 & 18-20, night otherwise.
function skyPhaseForHour(h) {
  if (h >= 6 && h < 18) return 'day';
  if ((h >= 5 && h < 6) || (h >= 18 && h < 20)) return 'dusk';
  return 'night';
}

function streetlightsOn(hour) { return skyPhaseForHour(hour) === 'night' || skyPhaseForHour(hour) === 'dusk'; }

// Advance the clock: a full day takes CFG.dayLengthSec real seconds.
function advanceClock(dt) {
  const hoursPerSec = 24 / CFG.dayLengthSec;
  const before = Math.floor(G.clockHours);
  G.clockHours = (G.clockHours + dt * hoursPerSec) % 24;
  const after = Math.floor(G.clockHours);
  if (after !== before) onHourTick(after);
}

function clockText() {
  const h = Math.floor(G.clockHours);
  const m = Math.floor((G.clockHours - h) * 60);
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}

// --- weather ---
function weatherGrip() { return G.weather === 'rain' ? CFG.rainGrip : 1; }
function viewRange() { return G.weather === 'fog' ? 0.6 : 1; }

function rollWeather() {
  const roll = rng();
  G.weather = roll < 0.55 ? 'clear' : roll < 0.8 ? 'rain' : 'fog';
  G.weatherTimer = CFG.weatherChangeSec;
}

function updateWeather(dt) {
  G.weatherTimer -= dt;
  if (G.weatherTimer <= 0) rollWeather();
}

// --- rush hour traffic (round 7) ---
// Density is a pure function of the clock hour: peak ~2x, quiet night ~0.5x.
function rushHourMultiplier(hour) {
  const h = Math.floor(hour);
  if ((h >= 7 && h < 9) || (h >= 17 && h < 19)) return 2;
  if (h >= 0 && h < 5) return 0.5;
  return 1;
}

function trafficTarget() {
  return Math.round(CFG.baseTraffic * rushHourMultiplier(G.clockHours));
}

// --- traffic & pedestrians ---
function spawnTrafficCar() {
  // Pick a road point at least 160 units from the player and not on a mission road block.
  for (let tries = 0; tries < 12; tries++) {
    const horizontal = rng() < 0.5;
    const road = pickOne(rng, CFG.roads);
    const along = randRange(rng, 60, CFG.world - 60);
    const x = horizontal ? along : road;
    const y = horizontal ? road : along;
    if (dist(x, y, G.player.x, G.player.y) < 170) continue;
    const dir = rng() < 0.5 ? 1 : -1;
    const model = pickOne(rng, CARS);
    return {
      x, y, angle: horizontal ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
      speed: randRange(rng, 90, 150), color: model.color, model: model.model,
      horizontal, dir, road, nearMissed: false,
    };
  }
  return null;
}

function updateTraffic(dt) {
  const want = trafficTarget();
  // Keep trying until the target is met (a single failed spawn must not
  // abort the whole fill — rush hour needs the full density at once).
  let guard = 0;
  while (G.traffic.length < want && guard++ < 80) {
    const car = spawnTrafficCar();
    if (car) G.traffic.push(car);
  }
  if (G.traffic.length > want + 4) G.traffic.length = want + 4;
  for (const t of G.traffic) {
    if (t.horizontal) {
      t.x += Math.cos(t.angle) * t.speed * dt;
      t.y = t.road + Math.sin(t.angle) * 0; // stay in lane
      if (t.x < 20 || t.x > CFG.world - 20) { t.angle += Math.PI; t.x = clamp(t.x, 20, CFG.world - 20); }
    } else {
      t.y += Math.sin(t.angle) * t.speed * dt;
      t.x = t.road;
      if (t.y < 20 || t.y > CFG.world - 20) { t.angle += Math.PI; t.y = clamp(t.y, 20, CFG.world - 20); }
    }
  }
  // Drop cars that drifted far behind the camera.
  G.traffic = G.traffic.filter((t) => dist(t.x, t.y, G.player.x, G.player.y) < 1600);
}

function spawnPedestrians() {
  G.peds = [];
  const r = makeRng(4242);
  for (let i = 0; i < 26; i++) {
    const road = pickOne(r, CFG.roads);
    const along = randRange(r, 60, CFG.world - 60);
    G.peds.push({
      x: road + (r() < 0.5 ? -26 : 26), y: along, vx: 0, vy: 0,
      speed: randRange(r, 18, 34), dir: pickOne(r, [0, 1, 2, 3]),
      color: ['#e8c9a0', '#c98a5b', '#8a5b3c', '#e8b4b4'][Math.floor(r() * 4)],
      walkPhase: r() * 6,
    });
  }
}

function updatePeds(dt) {
  for (const p of G.peds) {
    p.walkPhase += dt * 6;
    const step = p.speed * dt;
    if (p.dir === 0) p.x += step; else if (p.dir === 1) p.x -= step;
    else if (p.dir === 2) p.y += step; else p.y -= step;
    if (p.x < 30 || p.x > CFG.world - 30 || p.y < 30 || p.y > CFG.world - 30 || rng() < 0.002) {
      p.dir = Math.floor(rng() * 4);
      p.x = clamp(p.x, 30, CFG.world - 30);
      p.y = clamp(p.y, 30, CFG.world - 30);
    }
    // Pedestrians stay out of canal water.
    if (inCanal(p.x, p.y)) p.dir = (p.dir + 2) % 4;
  }
}

// Stealable cars parked around the city (12 models, one each).
function spawnParkedCars() {
  G.cars = [];
  const spots = [
    { x: 420, y: 296 }, { x: 700, y: 561 }, { x: 1500, y: 296 }, { x: 900, y: 826 },
    { x: 2100, y: 561 }, { x: 600, y: 1395 }, { x: 1400, y: 1091 }, { x: 1900, y: 1621 },
    { x: 300, y: 1886 }, { x: 1100, y: 2151 }, { x: 1700, y: 2151 }, { x: 2151, y: 400 },
  ];
  for (let i = 0; i < CARS.length; i++) {
    const c = CARS[i], s = spots[i];
    G.cars.push({
      id: i, model: c.model, color: c.color, top: c.top, accel: c.accel,
      x: s.x, y: s.y, angle: (i % 4) * Math.PI / 2, health: CFG.carMaxHealth, totaled: false,
    });
  }
}
