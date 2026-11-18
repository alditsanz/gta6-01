// Solmar Heat — police: pursuit cruisers on the road grid and the
// roadblocks that appear from 4 stars. Pursuit uses a breadth-first
// search from the player's intersection, so cruisers take real
// routes instead of driving through buildings.
SH.POLICE_SPEED = 185;

// Grid node (intersection) nearest a point.
SH.nodeOf = function (x, y) {
  var ix = Math.round((x - SH.ROAD0) / SH.ROAD_STEP);
  var iy = Math.round((y - SH.ROAD0) / SH.ROAD_STEP);
  return {
    x: SH.clamp(ix, 0, SH.GRID - 1),
    y: SH.clamp(iy, 0, SH.GRID - 1)
  };
};

// BFS distances over the intersection graph from one node.
SH.bfsDist = function (sx, sy) {
  var dist = [];
  for (var y = 0; y < SH.GRID; y++) {
    dist.push([]);
    for (var x = 0; x < SH.GRID; x++) dist[y].push(-1);
  }
  dist[sy][sx] = 0;
  var q = [[sx, sy]];
  while (q.length) {
    var cur = q.shift();
    var cx = cur[0], cy = cur[1];
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var i = 0; i < 4; i++) {
      var nx = cx + dirs[i][0], ny = cy + dirs[i][1];
      if (nx < 0 || ny < 0 || nx >= SH.GRID || ny >= SH.GRID) continue;
      if (dist[ny][nx] >= 0) continue;
      dist[ny][nx] = dist[cy][cx] + 1;
      q.push([nx, ny]);
    }
  }
  return dist;
};

// Add heat for a crime. Carrying a delivery parcel makes the
// police spot you twice as fast.
SH.addHeat = function (S, amount) {
  var mult = S.delivery ? 2 : 1;
  S.heat = Math.min(SH.MAX_HEAT, S.heat + amount * mult);
  S.lastCrimeT = S.time;
};

// Wanted decays when the player lays low.
SH.updateHeat = function (S, dt) {
  if (S.time - S.lastCrimeT > 6) {
    S.heat = Math.max(0, S.heat - SH.HEAT_DECAY * dt);
  }
};

// Keep the cruiser count matched to the stars, and steer each one
// along the roads toward the player.
SH.updatePolice = function (S, dt) {
  var stars = SH.starsOf(S.heat);
  var want = Math.min(stars, 5);
  var p = S.player;
  while (S.police.length < want) {
    var a = Math.random() * Math.PI * 2;
    S.police.push({
      x: SH.clamp(p.x + Math.cos(a) * 700, 20, SH.WORLD - 20),
      y: SH.clamp(p.y + Math.sin(a) * 700, 20, SH.WORLD - 20),
      angle: 0, speed: 0
    });
  }
  while (S.police.length > want) S.police.pop();
  if (want === 0) { SH.updateRoadblocks(S); return; }

  S.bfsT -= dt;
  if (S.bfsT <= 0 || !S.bfs) {
    S.bfsT = 0.5;
    var node = SH.nodeOf(p.x, p.y);
    S.bfs = SH.bfsDist(node.x, node.y);
  }
  for (var i = 0; i < S.police.length; i++) {
    var c = S.police[i];
    var cn = SH.nodeOf(c.x, c.y);
    var cx = SH.roadAt(cn.x), cy = SH.roadAt(cn.y);
    var target = null;
    var best = S.bfs[cn.y][cn.x];
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var d = 0; d < 4; d++) {
      var nx = cn.x + dirs[d][0], ny = cn.y + dirs[d][1];
      if (nx < 0 || ny < 0 || nx >= SH.GRID || ny >= SH.GRID) continue;
      if (S.bfs[ny][nx] >= 0 && S.bfs[ny][nx] < best) {
        best = S.bfs[ny][nx];
        target = { x: SH.roadAt(nx), y: SH.roadAt(ny) };
      }
    }
    if (!target) target = { x: p.x, y: p.y };
    // Drive to the next intersection, then on toward the player.
    var tx = target.x, ty = target.y;
    if (SH.dist(c.x, c.y, cx, cy) > 30) { tx = cx; ty = cy; }
    var ang = SH.angleTo(c.x, c.y, tx, ty);
    c.angle = SH.turnToward(c.angle, ang, 3.2 * dt);
    c.speed = SH.POLICE_SPEED;
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    c.x = SH.clamp(c.x, 10, SH.WORLD - 10);
    c.y = SH.clamp(c.y, 10, SH.WORLD - 10);
    // Ramming the player hurts.
    if (SH.dist(c.x, c.y, p.x, p.y) < 30) {
      if (S.time - (S.lastRamT || -9) > 1) {
        S.lastRamT = S.time;
        SH.hurtPlayer(S, 5);
        SH.sfx('crash');
      }
    }
  }
  SH.updateRoadblocks(S);
};

// From 4 stars, two parked cruisers with striped barriers block
// the road ahead of the player. They clear when the heat drops.
SH.updateRoadblocks = function (S) {
  var stars = SH.starsOf(S.heat);
  if (stars >= 4) {
    if (S.roadblocks.length === 0) {
      var p = S.player;
      var fx = Math.cos(p.angle || 0), fy = Math.sin(p.angle || 0);
      var bx = SH.clamp(p.x + fx * 320, 40, SH.WORLD - 40);
      var by = SH.clamp(p.y + fy * 320, 40, SH.WORLD - 40);
      var perp = Math.atan2(fy, fx) + Math.PI / 2;
      S.roadblocks = [
        { x: bx + Math.cos(perp) * 26, y: by + Math.sin(perp) * 26, angle: perp },
        { x: bx - Math.cos(perp) * 26, y: by - Math.sin(perp) * 26, angle: perp }
      ];
      SH.sfx('siren');
    }
  } else {
    S.roadblocks = [];
  }
};
