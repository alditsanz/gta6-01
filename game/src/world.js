// Solmar Heat — world: the city blocks, the buildings on them, the
// traffic driving the roads and the pedestrians on the sidewalks.
// Everything is built from a seed, so the same seed is the same city.
SH.buildWorld = function (seed) {
  var rng = SH.makeRng(seed);
  var buildings = [];
  var half = SH.ROAD_W / 2 + 8;
  for (var bx = 0; bx < SH.GRID - 1; bx++) {
    for (var by = 0; by < SH.GRID - 1; by++) {
      var x0 = SH.roadAt(bx) + half, x1 = SH.roadAt(bx + 1) - half;
      var y0 = SH.roadAt(by) + half, y1 = SH.roadAt(by + 1) - half;
      var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      // Canal Row blocks stay open water and marina, not towers.
      if (cx >= SH.CANAL.x0 && cy >= SH.CANAL.y0) continue;
      // Leave room around landmarks and the plaza.
      var nearLandmark = false;
      for (var l = 0; l < SH.LANDMARKS.length; l++) {
        var lm = SH.LANDMARKS[l];
        if (SH.dist(cx, cy, lm.x, lm.y) < lm.r + 120) { nearLandmark = true; break; }
      }
      if (nearLandmark) {
        if (rng() < 0.35) {
          buildings.push({ x: x0 + 20, y: y0 + 20, w: 60, h: 60, park: true });
        }
        continue;
      }
      // A park with trees, or one or two buildings.
      if (rng() < 0.22) {
        buildings.push({ x: x0 + 14, y: y0 + 14, w: x1 - x0 - 28, h: y1 - y0 - 28, park: true });
        continue;
      }
      var n = rng() < 0.6 ? 1 : 2;
      for (var b = 0; b < n; b++) {
        var w = SH.range(rng, 55, 95), h = SH.range(rng, 55, 95);
        var px = SH.range(rng, x0 + 6, x1 - w - 6);
        var py = SH.range(rng, y0 + 6, y1 - h - 6);
        buildings.push({
          x: px, y: py, w: w, h: h, park: false,
          color: SH.pick(rng, ['#b98d5f', '#8a7f74', '#a89a80', '#7d8a96', '#c4a882', '#96705a']),
          roof: SH.pick(rng, ['#6b4a2f', '#4a5a6b', '#5a6b4a', '#7a6a8a'])
        });
      }
    }
  }
  // Traffic: a dozen cars cruising the roads.
  var traffic = [];
  var colors = ['#d8d8d8', '#3a6bd8', '#d83a3a', '#3ad88a', '#e0a83a', '#8a5ad8'];
  for (var t = 0; t < 14; t++) {
    var axis = rng() < 0.5 ? 'x' : 'y';
    traffic.push({
      axis: axis, road: Math.floor(rng() * SH.GRID),
      pos: SH.range(rng, 100, SH.WORLD - 100),
      dir: rng() < 0.5 ? 1 : -1,
      speed: SH.range(rng, 70, 130),
      color: colors[t % colors.length],
      off: (rng() < 0.5 ? -1 : 1) * 12
    });
  }
  // Pedestrians strolling the sidewalks.
  var peds = [];
  for (var p = 0; p < 26; p++) {
    var paxis = rng() < 0.5 ? 'x' : 'y';
    peds.push({
      axis: paxis, road: Math.floor(rng() * SH.GRID),
      pos: SH.range(rng, 100, SH.WORLD - 100),
      dir: rng() < 0.5 ? 1 : -1,
      speed: SH.range(rng, 18, 38),
      off: (rng() < 0.5 ? -1 : 1) * 34,
      color: SH.pick(rng, ['#e8c8a0', '#c8a0e8', '#a0c8e8', '#e8a0a0', '#a0e8c8'])
    });
  }
  return { buildings: buildings, traffic: traffic, peds: peds };
};

// Does a circle at (x, y) with radius r touch a building?
SH.hitsBuilding = function (world, x, y, r) {
  for (var i = 0; i < world.buildings.length; i++) {
    var b = world.buildings[i];
    if (b.park) continue;
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
};

// Is a circle at (x, y) blocked by a building or canal water?
SH.blockedAt = function (world, x, y, r) {
  return !!SH.hitsBuilding(world, x, y, r) || SH.inCanalWater(x, y);
};

// Move an entity, stopping at buildings, canal water and the world
// edge. The path is sampled in small steps, so a fast move cannot
// tunnel through a wall or a canal. Returns {movedX, movedY} and
// sets hitWall when a building or the edge stopped the move.
SH.tryMove = function (world, ent, dx, dy, r) {
  var out = { movedX: false, movedY: false, hitWall: false };
  var step = 8;
  // X axis, in small steps.
  var remaining = dx;
  while (remaining !== 0) {
    var sx = Math.abs(remaining) < step ? remaining : Math.sign(remaining) * step;
    var nx = SH.clamp(ent.x + sx, r, SH.WORLD - r);
    if (nx !== ent.x + sx) out.hitWall = true;
    if (SH.blockedAt(world, nx, ent.y, r)) { out.hitWall = true; break; }
    ent.x = nx;
    out.movedX = true;
    remaining -= sx;
  }
  // Y axis, in small steps.
  remaining = dy;
  while (remaining !== 0) {
    var sy = Math.abs(remaining) < step ? remaining : Math.sign(remaining) * step;
    var ny = SH.clamp(ent.y + sy, r, SH.WORLD - r);
    if (ny !== ent.y + sy) out.hitWall = true;
    if (SH.blockedAt(world, ent.x, ny, r)) { out.hitWall = true; break; }
    ent.y = ny;
    out.movedY = true;
    remaining -= sy;
  }
  return out;
};

// Traffic and pedestrians keep moving on their own.
SH.updateTraffic = function (world, dt) {
  for (var i = 0; i < world.traffic.length; i++) {
    var c = world.traffic[i];
    c.pos += c.dir * c.speed * dt;
    if (c.pos < 60) { c.pos = 60; c.dir = 1; }
    if (c.pos > SH.WORLD - 60) { c.pos = SH.WORLD - 60; c.dir = -1; }
    // At an intersection, sometimes turn onto the crossing road.
    var near = SH.nearestRoad(c.pos);
    if (Math.abs(c.pos - near) < 4 && Math.random() < 0.004) {
      var ni = Math.round((near - SH.ROAD0) / SH.ROAD_STEP);
      if (c.axis === 'x') { c.axis = 'y'; c.road = ni; c.pos = SH.roadAt(c.road) + c.off; }
      else { c.axis = 'x'; c.road = ni; c.pos = SH.roadAt(c.road) + c.off; }
      c.dir = Math.random() < 0.5 ? 1 : -1;
    }
  }
  for (var j = 0; j < world.peds.length; j++) {
    var p = world.peds[j];
    p.pos += p.dir * p.speed * dt;
    if (p.pos < 60) { p.pos = 60; p.dir = 1; }
    if (p.pos > SH.WORLD - 60) { p.pos = SH.WORLD - 60; p.dir = -1; }
  }
};

SH.trafficPos = function (c) {
  if (c.axis === 'x') return { x: c.pos, y: SH.roadAt(c.road) + c.off };
  return { x: SH.roadAt(c.road) + c.off, y: c.pos };
};

SH.pedPos = function (p) {
  if (p.axis === 'x') return { x: p.pos, y: SH.roadAt(p.road) + p.off };
  return { x: SH.roadAt(p.road) + p.off, y: p.pos };
};
