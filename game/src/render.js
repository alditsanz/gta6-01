// Solmar Heat — render: everything the player sees, drawn on one
// canvas. The camera follows the player across the 2440 x 2440 city.
SH.CANVAS_W = 1280;
SH.CANVAS_H = 720;

SH.camera = function (S) {
  var p = S.player;
  return {
    x: SH.clamp(p.x - SH.CANVAS_W / 2, 0, SH.WORLD - SH.CANVAS_W),
    y: SH.clamp(p.y - SH.CANVAS_H / 2, 0, SH.WORLD - SH.CANVAS_H)
  };
};

SH.drawCar = function (ctx, x, y, angle, color, scale) {
  var s = scale || 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s, s);
  // body
  ctx.fillStyle = '#111';
  ctx.fillRect(-19, -11, 38, 22);
  ctx.fillStyle = color;
  ctx.fillRect(-17, -9, 34, 18);
  // cabin + windshield
  ctx.fillStyle = '#20242c';
  ctx.fillRect(-4, -8, 12, 16);
  ctx.fillStyle = '#9fd8e8';
  ctx.fillRect(8, -7, 4, 14);
  // headlights
  ctx.fillStyle = '#fff8c8';
  ctx.fillRect(16, -8, 2, 4);
  ctx.fillRect(16, 4, 2, 4);
  ctx.restore();
};

SH.drawWorld = function (ctx, S, cam) {
  // Ground: sun-baked sand and grass blocks.
  ctx.fillStyle = '#cbb37e';
  ctx.fillRect(0, 0, SH.CANVAS_W, SH.CANVAS_H);
  // Roads.
  ctx.fillStyle = '#3c3f46';
  for (var i = 0; i < SH.GRID; i++) {
    var r = SH.roadAt(i);
    ctx.fillRect(r - SH.ROAD_W / 2 - cam.x, 0, SH.ROAD_W, SH.CANVAS_H);
    ctx.fillRect(0, r - SH.ROAD_W / 2 - cam.y, SH.CANVAS_W, SH.ROAD_W);
  }
  // Dashed lane markings.
  ctx.strokeStyle = '#e8d44d';
  ctx.lineWidth = 2;
  ctx.setLineDash([14, 18]);
  ctx.beginPath();
  for (var j = 0; j < SH.GRID; j++) {
    var rr = SH.roadAt(j);
    ctx.moveTo(0, rr - cam.y); ctx.lineTo(SH.CANVAS_W, rr - cam.y);
    ctx.moveTo(rr - cam.x, 0); ctx.lineTo(rr - cam.x, SH.CANVAS_H);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // Canals and their bridges.
  for (var c = 0; c < SH.CANALS.length; c++) {
    var band = SH.CANALS[c];
    ctx.fillStyle = '#2a7fa8';
    ctx.fillRect(SH.CANAL.x0 - cam.x, band.y0 - cam.y, SH.WORLD - SH.CANAL.x0, band.y1 - band.y0);
    ctx.fillStyle = '#57b8d8';
    ctx.fillRect(SH.CANAL.x0 - cam.x, band.y0 - cam.y, SH.WORLD - SH.CANAL.x0, 3);
    // bridges where roads cross
    ctx.fillStyle = '#3c3f46';
    for (var k = 0; k < SH.GRID; k++) {
      var bx = SH.roadAt(k);
      if (bx < SH.CANAL.x0) continue;
      ctx.fillRect(bx - SH.BRIDGE_HALF - cam.x, band.y0 - cam.y, SH.BRIDGE_HALF * 2, band.y1 - band.y0);
    }
  }
  // Buildings and parks.
  var bs = S.world.buildings;
  for (var b = 0; b < bs.length; b++) {
    var bd = bs[b];
    if (bd.park) {
      ctx.fillStyle = '#5d8a3c';
      ctx.fillRect(bd.x - cam.x, bd.y - cam.y, bd.w, bd.h);
      ctx.fillStyle = '#3f6b28';
      for (var t = 0; t < 4; t++) {
        ctx.beginPath();
        ctx.arc(bd.x + 20 + t * 40 - cam.x, bd.y + 24 + (t % 2) * 40 - cam.y, 11, 0, Math.PI * 2);
        ctx.fill();
      }
      continue;
    }
    ctx.fillStyle = bd.color;
    ctx.fillRect(bd.x - cam.x, bd.y - cam.y, bd.w, bd.h);
    ctx.fillStyle = bd.roof;
    ctx.fillRect(bd.x + 5 - cam.x, bd.y + 5 - cam.y, bd.w - 10, bd.h - 10);
    ctx.fillStyle = '#ffe9a8';
    for (var w = 0; w < 3; w++) {
      ctx.fillRect(bd.x + 10 + w * 18 - cam.x, bd.y + 10 - cam.y, 8, 6);
    }
  }
  // Landmarks.
  for (var l = 0; l < SH.LANDMARKS.length; l++) {
    var lm = SH.LANDMARKS[l];
    ctx.fillStyle = lm.color;
    ctx.beginPath();
    ctx.arc(lm.x - cam.x, lm.y - cam.y, lm.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(lm.name, lm.x - cam.x, lm.y - lm.r * 0.55 - 8 - cam.y);
  }
  // Solmar coins.
  for (var i = 0; i < SH.COINS.length; i++) {
    if (S.coinsGot[i]) continue;
    var cn = SH.COINS[i];
    var pulse = 1 + Math.sin(S.time * 4 + i) * 0.12;
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(cn.x - cam.x, cn.y - cam.y, 10 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a6a00';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('S', cn.x - cam.x, cn.y + 4 - cam.y);
  }
  // Ammo pickups.
  for (var a = 0; a < S.ammo.length; a++) {
    var ap = S.ammo[a];
    if (ap.taken) continue;
    ctx.fillStyle = '#ff5a3c';
    ctx.fillRect(ap.x - 8 - cam.x, ap.y - 6 - cam.y, 16, 12);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('AMMO', ap.x - cam.x, ap.y + 4 - cam.y);
  }
  // Race starter flags.
  for (var r = 0; r < SH.RACES.length; r++) {
    var rc = SH.RACES[r];
    var bob = Math.sin(S.time * 3 + r) * 3;
    ctx.fillStyle = '#222';
    ctx.fillRect(rc.start.x - 1 - cam.x, rc.start.y - 34 + bob - cam.y, 2, 34);
    for (var q = 0; q < 4; q++) {
      ctx.fillStyle = q % 2 ? '#fff' : '#111';
      ctx.fillRect(rc.start.x + (q % 2) * 7 - cam.x, rc.start.y - 34 + bob + Math.floor(q / 2) * 7 - cam.y, 7, 7);
    }
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(rc.name, rc.start.x - cam.x, rc.start.y + 26 - cam.y);
  }
  // Delivery pickup parcel.
  if (!S.delivery) {
    var pk = SH.DELIVERY.pickup;
    ctx.fillStyle = '#b06a1f';
    ctx.fillRect(pk.x - 9 - cam.x, pk.y - 9 - cam.y, 18, 18);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(pk.x - 9 - cam.x, pk.y - 9 - cam.y, 18, 18);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PARCEL', pk.x - cam.x, pk.y + 26 - cam.y);
  }
};

SH.drawEntities = function (ctx, S, cam) {
  var p = S.player;
  // Traffic.
  for (var i = 0; i < S.world.traffic.length; i++) {
    var tp = SH.trafficPos(S.world.traffic[i]);
    var tc = S.world.traffic[i];
    var tang = tc.axis === 'x' ? (tc.dir > 0 ? 0 : Math.PI) : (tc.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    SH.drawCar(ctx, tp.x - cam.x, tp.y - cam.y, tang, tc.color, 0.9);
  }
  // Pedestrians.
  for (var j = 0; j < S.world.peds.length; j++) {
    var pp = SH.pedPos(S.world.peds[j]);
    ctx.fillStyle = S.world.peds[j].color;
    ctx.beginPath();
    ctx.arc(pp.x - cam.x, pp.y - cam.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Parked / stealable cars.
  for (var k = 0; k < S.cars.length; k++) {
    var car = S.cars[k];
    if (p.car === car) continue;
    SH.drawCar(ctx, car.x - cam.x, car.y - cam.y, car.angle, car.color, 1);
    if (car.totaled) {
      ctx.strokeStyle = '#ff3b30';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(car.x - 12 - cam.x, car.y - 12 - cam.y);
      ctx.lineTo(car.x + 12 - cam.x, car.y + 12 - cam.y);
      ctx.moveTo(car.x + 12 - cam.x, car.y - 12 - cam.y);
      ctx.lineTo(car.x - 12 - cam.x, car.y + 12 - cam.y);
      ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(car.modelName, car.x - cam.x, car.y - 24 - cam.y);
  }
  // Police cruisers.
  for (var m = 0; m < S.police.length; m++) {
    var pc = S.police[m];
    SH.drawCar(ctx, pc.x - cam.x, pc.y - cam.y, pc.angle, '#1a2a4a', 1);
    ctx.fillStyle = '#ff3b30';
    ctx.fillRect(pc.x - 6 - cam.x, pc.y - 12 - cam.y, 12, 4);
    ctx.fillStyle = '#3a6bd8';
    ctx.fillRect(pc.x - 6 - cam.x, pc.y + 8 - cam.y, 12, 4);
  }
  // Roadblocks: striped barriers + parked cruisers.
  for (var rb = 0; rb < S.roadblocks.length; rb++) {
    var bl = S.roadblocks[rb];
    ctx.save();
    ctx.translate(bl.x - cam.x, bl.y - cam.y);
    ctx.rotate(bl.angle);
    ctx.fillStyle = '#ff3b30';
    ctx.fillRect(-26, -5, 52, 10);
    ctx.fillStyle = '#fff';
    for (var s = 0; s < 4; s++) ctx.fillRect(-26 + s * 13, -5, 6, 10);
    ctx.restore();
    SH.drawCar(ctx, bl.x - cam.x, bl.y + 26 - cam.y, bl.angle, '#1a2a4a', 0.9);
  }
  // Helicopter: shadow, searchlight cone, body.
  if (S.heli.active) {
    var h = S.heli;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(h.x + 26 - cam.x, h.y + 30 - cam.y, 26, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // searchlight cone down to the player
    var grad = ctx.createLinearGradient(h.x - cam.x, h.y - cam.y, p.x - cam.x, p.y - cam.y);
    grad.addColorStop(0, 'rgba(255,244,180,0.35)');
    grad.addColorStop(1, 'rgba(255,244,180,0.05)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(h.x - cam.x, h.y - cam.y);
    ctx.lineTo(p.x - 26 - cam.x, p.y - cam.y);
    ctx.lineTo(p.x + 26 - cam.x, p.y - cam.y);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.translate(h.x - cam.x, h.y - cam.y);
    ctx.rotate(h.angle);
    ctx.fillStyle = '#222';
    ctx.fillRect(-22, -2, 44, 4);
    ctx.fillStyle = '#3a4a5a';
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9fd8e8';
    ctx.beginPath();
    ctx.ellipse(10, 0, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SCPD HELI', h.x - cam.x, h.y - 26 - cam.y);
  }
  // Guards with health pips.
  for (var g = 0; g < S.guards.length; g++) {
    var gd = S.guards[g];
    if (!gd.alive) continue;
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(gd.x - cam.x, gd.y - cam.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff3b30';
    ctx.fillRect(gd.x - 12 - cam.x, gd.y - 22 - cam.y, 24, 4);
    ctx.fillStyle = '#3aff5a';
    ctx.fillRect(gd.x - 12 - cam.x, gd.y - 22 - cam.y, 24 * (gd.hp / gd.maxHp), 4);
  }
  // Bullets.
  ctx.fillStyle = '#ffe14d';
  for (var b = 0; b < S.bullets.length; b++) {
    var bl2 = S.bullets[b];
    ctx.beginPath();
    ctx.arc(bl2.x - cam.x, bl2.y - cam.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player: in a car, or on foot.
  if (p.car) {
    SH.drawCar(ctx, p.x - cam.x, p.y - cam.y, p.angle, p.car.color, 1.1);
  } else {
    ctx.fillStyle = '#f2c200';
    ctx.beginPath();
    ctx.arc(p.x - cam.x, p.y - cam.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.stroke();
    // aim line
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.moveTo(p.x - cam.x, p.y - cam.y);
    ctx.lineTo(p.x + Math.cos(p.aim) * 34 - cam.x, p.y + Math.sin(p.aim) * 34 - cam.y);
    ctx.stroke();
  }
  // Mission / race / taxi / delivery target markers.
  SH.drawTargetMarker(ctx, S, cam);
};

SH.drawTargetMarker = function (ctx, S, cam) {
  var t = null, color = '#ffd94d';
  if (S.race) { t = SH.raceTarget(S); color = '#ff7ab8'; }
  else if (S.taxi) {
    t = S.taxi.stage === 'pickup' ? S.taxi.pickup : S.taxi.drop;
    color = '#ffd94d';
  } else if (S.delivery) { t = SH.DELIVERY.drop; color = '#ff9a3c'; }
  else if (S.mission && S.mission.target) { t = S.mission.target; color = '#3aff5a'; }
  if (!t) return;
  var pulse = 1 + Math.sin(S.time * 5) * 0.15;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(t.x - cam.x, t.y - cam.y, 26 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(t.x - cam.x, t.y - cam.y, 5, 0, Math.PI * 2);
  ctx.fill();
};

// ---- HUD ---------------------------------------------------------------
SH.drawHUD = function (ctx, S) {
  var p = S.player;
  ctx.textAlign = 'left';
  // Top-left: money, score, stats.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(10, 10, 250, 108);
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('$' + S.money, 20, 36);
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  ctx.fillText('Score ' + S.score + '   Cars ' + S.carsStolen + '   Fares ' + S.fares, 20, 58);
  ctx.fillText('Near misses ' + S.nearMisses + '   Coins ' + SH.coinsCollected(S) + '/10', 20, 78);
  ctx.fillText('Races won ' + (S.racesWon || 0) + '   Rank: ' + SH.rankFor(S.score, S.storyDone), 20, 98);
  // Top-right: wanted stars.
  var stars = SH.starsOf(S.heat);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(SH.CANVAS_W - 190, 10, 180, 46);
  for (var i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? '#ffd94d' : 'rgba(255,255,255,0.25)';
    ctx.font = '26px sans-serif';
    ctx.fillText('★', SH.CANVAS_W - 178 + i * 34, 42);
  }
  // Bottom-left: health and car condition, ammo, speed.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(10, SH.CANVAS_H - 92, 280, 82);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('HEALTH', 20, SH.CANVAS_H - 68);
  ctx.fillStyle = '#3aff5a';
  ctx.fillRect(90, SH.CANVAS_H - 78, 180 * (p.health / 100), 12);
  ctx.strokeStyle = '#fff';
  ctx.strokeRect(90, SH.CANVAS_H - 78, 180, 12);
  ctx.fillStyle = '#fff';
  ctx.fillText('CAR', 20, SH.CANVAS_H - 46);
  if (p.car) {
    ctx.fillStyle = p.car.health > 40 ? '#3aa8ff' : '#ff3b30';
    ctx.fillRect(90, SH.CANVAS_H - 56, 180 * (p.car.health / 100), 12);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(90, SH.CANVAS_H - 56, 180, 12);
    ctx.fillStyle = '#fff';
    ctx.fillText(p.car.modelName + '  ' + Math.round(p.speed) + ' km/h', 20, SH.CANVAS_H - 24);
  } else {
    ctx.fillStyle = '#fff';
    ctx.fillText('On foot — press E near a car to steal it', 90, SH.CANVAS_H - 46);
  }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('Ammo ' + p.ammo + '/' + p.reserve, 300, SH.CANVAS_H - 24);
  if (S.reloadT > 0) ctx.fillText('Reloading…', 400, SH.CANVAS_H - 24);
  // Mission banner + timer.
  if (S.mission) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(300, 10, SH.CANVAS_W - 600, 52);
    ctx.fillStyle = '#3aff5a';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(S.mission.def.name, SH.CANVAS_W / 2, 30);
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.fillText(S.mission.def.banner, SH.CANVAS_W / 2, 50);
    if (S.mission.timer > 0) {
      ctx.fillStyle = S.mission.timer < 15 ? '#ff3b30' : '#ffd94d';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(Math.ceil(S.mission.timer) + 's', SH.CANVAS_W / 2, 84);
    }
    ctx.textAlign = 'left';
  }
  // Race HUD: timer, checkpoint count, next-checkpoint arrow.
  if (S.race) {
    var r = S.race;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(SH.CANVAS_W / 2 - 130, 96, 260, 56);
    ctx.fillStyle = '#ff7ab8';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(r.def.name + ' — ' + r.def.level, SH.CANVAS_W / 2, 116);
    ctx.fillStyle = r.timer < 15 ? '#ff3b30' : '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(Math.ceil(r.timer) + 's   ' + r.next + '/' + r.def.checkpoints.length + ' checkpoints', SH.CANVAS_W / 2, 142);
    ctx.textAlign = 'left';
    var cp = SH.raceTarget(S);
    if (cp) {
      var a = SH.angleTo(p.x, p.y, cp.x, cp.y);
      var ax = SH.CANVAS_W / 2, ay = 190;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(a);
      ctx.fillStyle = '#ff7ab8';
      ctx.beginPath();
      ctx.moveTo(18, 0); ctx.lineTo(-10, -10); ctx.lineTo(-10, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  // Delivery timer.
  if (S.delivery) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(SH.CANVAS_W / 2 - 130, 96, 260, 40);
    ctx.fillStyle = '#ff9a3c';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Delivery — ' + Math.ceil(S.delivery.timer) + 's to Pier 9', SH.CANVAS_W / 2, 122);
    ctx.textAlign = 'left';
  }
  // Toast message.
  if (S.messageT > 0 && S.message) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    var mw = ctx.measureText(S.message).width + 30;
    ctx.fillRect(SH.CANVAS_W / 2 - mw / 2, SH.CANVAS_H - 150, mw, 34);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(S.message, SH.CANVAS_W / 2, SH.CANVAS_H - 128);
    ctx.textAlign = 'left';
  }
  if (S.heli.active) {
    ctx.fillStyle = '#ff3b30';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('HELICOPTER OVERHEAD', SH.CANVAS_W - 190, 76);
  }
};

// ---- Minimap -----------------------------------------------------------
SH.drawMinimap = function (ctx, S) {
  var size = 190, ox = SH.CANVAS_W - size - 12, oy = SH.CANVAS_H - size - 32;
  var k = size / SH.WORLD;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(ox - 4, oy - 4, size + 8, size + 8);
  ctx.fillStyle = '#2b2f36';
  ctx.fillRect(ox, oy, size, size);
  // canals
  ctx.fillStyle = '#2a7fa8';
  for (var c = 0; c < SH.CANALS.length; c++) {
    var band = SH.CANALS[c];
    ctx.fillRect(ox + SH.CANAL.x0 * k, oy + band.y0 * k, (SH.WORLD - SH.CANAL.x0) * k, (band.y1 - band.y0) * k);
  }
  // roads
  ctx.strokeStyle = '#5a5f68';
  ctx.lineWidth = 1;
  for (var i = 0; i < SH.GRID; i++) {
    var r = SH.roadAt(i) * k;
    ctx.beginPath(); ctx.moveTo(ox, oy + r); ctx.lineTo(ox + size, oy + r); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox + r, oy); ctx.lineTo(ox + r, oy + size); ctx.stroke();
  }
  var dot = function (x, y, color, rad) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(ox + x * k, oy + y * k, rad || 3, 0, Math.PI * 2);
    ctx.fill();
  };
  // coins
  for (var i = 0; i < SH.COINS.length; i++) {
    if (!S.coinsGot[i]) dot(SH.COINS[i].x, SH.COINS[i].y, '#ffd94d', 2.5);
  }
  // race starters
  for (var r = 0; r < SH.RACES.length; r++) dot(SH.RACES[r].start.x, SH.RACES[r].start.y, '#ff7ab8', 4);
  // delivery pickup
  if (!S.delivery) dot(SH.DELIVERY.pickup.x, SH.DELIVERY.pickup.y, '#ff9a3c', 4);
  // cars
  for (var j = 0; j < S.cars.length; j++) dot(S.cars[j].x, S.cars[j].y, '#fff', 2.5);
  // police
  for (var m = 0; m < S.police.length; m++) dot(S.police[m].x, S.police[m].y, '#3a6bd8', 3);
  // heli
  if (S.heli.active) dot(S.heli.x, S.heli.y, '#ff3b30', 4);
  // mission target
  var t = null;
  if (S.race) t = SH.raceTarget(S);
  else if (S.taxi) t = S.taxi.stage === 'pickup' ? S.taxi.pickup : S.taxi.drop;
  else if (S.delivery) t = SH.DELIVERY.drop;
  else if (S.mission && S.mission.target) t = S.mission.target;
  if (t) {
    ctx.strokeStyle = '#3aff5a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ox + t.x * k, oy + t.y * k, 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  // player
  dot(S.player.x, S.player.y, '#3aff5a', 4);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.strokeRect(ox - 4, oy - 4, size + 8, size + 8);
  // District name under the minimap.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(SH.districtAt(S.player.x, S.player.y), ox + size / 2, oy + size + 18);
  ctx.textAlign = 'left';
};

// ---- Screens -----------------------------------------------------------
SH.drawTitle = function (ctx, S) {
  ctx.fillStyle = '#f2a541';
  ctx.fillRect(0, 0, SH.CANVAS_W, SH.CANVAS_H);
  ctx.fillStyle = '#1a1a22';
  ctx.fillRect(0, 0, SH.CANVAS_W, 150);
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SOLMAR HEAT', SH.CANVAS_W / 2, 108);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText('An open-world crime story — steal, drive, run, survive.', SH.CANVAS_W / 2, 190);
  ctx.font = '16px sans-serif';
  ctx.fillText('WASD / arrows — move & drive    E — steal / exit car    Mouse — aim & shoot', SH.CANVAS_W / 2, 240);
  ctx.fillText('R — reload    F — punch    Space — handbrake    T — taxi fare    Shift — sprint', SH.CANVAS_W / 2, 268);
  ctx.fillText('P — pause    M — mute    E near a flag — street race    E at the market — delivery', SH.CANVAS_W / 2, 296);
  ctx.fillStyle = '#1a1a22';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('7 story jobs, 3 street races, 10 hidden Solmar coins, taxi fares,', SH.CANVAS_W / 2, 350);
  ctx.fillText('the paint shop, a helicopter at 5 stars — progress saves automatically', SH.CANVAS_W / 2, 376);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('Click or press Enter to play', SH.CANVAS_W / 2, 450);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#333';
  ctx.fillText('A wholly original game. No part of it comes from any commercial game.', SH.CANVAS_W / 2, 690);
  ctx.textAlign = 'left';
};

SH.drawBoard = function (ctx, S) {
  ctx.fillStyle = '#14141c';
  ctx.fillRect(0, 0, SH.CANVAS_W, SH.CANVAS_H);
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('MISSION BOARD', SH.CANVAS_W / 2, 64);
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  ctx.fillText('Story jobs — pick one. Click a card or press its number key.', SH.CANVAS_W / 2, 96);
  for (var i = 0; i < SH.MISSIONS.length; i++) {
    var m = SH.MISSIONS[i];
    var col = i % 4, row = Math.floor(i / 4);
    var x = 40 + col * 305, y = 130 + row * 190;
    var done = S.completed.indexOf(m.id) >= 0;
    ctx.fillStyle = done ? '#1e4d2a' : '#23232e';
    ctx.fillRect(x, y, 285, 170);
    ctx.strokeStyle = done ? '#3aff5a' : '#ffd94d';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, 285, 170);
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText((i + 1) + '. ' + m.name, x + 14, y + 32);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    SH.wrapText(ctx, m.desc, x + 14, y + 56, 257, 17);
    ctx.fillStyle = done ? '#3aff5a' : '#ffd94d';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(done ? 'DONE' : 'Pays $' + m.payout, x + 14, y + 148);
  }
  // Race routes on the board too.
  ctx.fillStyle = '#ff7ab8';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Street races — find the checkered flags in the city:', 40, 540);
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  for (var r = 0; r < SH.RACES.length; r++) {
    var rc = SH.RACES[r];
    ctx.fillText(rc.name + ' (' + rc.level + ') — ' + rc.checkpoints.length + ' checkpoints, par ' + rc.par + 's, pays $' + rc.payout, 40, 570 + r * 26);
  }
  ctx.fillStyle = '#aaa';
  ctx.font = '14px sans-serif';
  ctx.fillText('Press B or Esc to go back. Delivery job: parcel at Old Town Market, $250 to Pier 9.', 40, 680);
};

SH.wrapText = function (ctx, text, x, y, maxW, lh) {
  var words = text.split(' ');
  var line = '';
  for (var i = 0; i < words.length; i++) {
    var test = line ? line + ' ' + words[i] : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      line = words[i];
      y += lh;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y);
};

SH.drawPause = function (ctx, S) {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, SH.CANVAS_W, SH.CANVAS_H);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', SH.CANVAS_W / 2, 140);
  ctx.font = '18px sans-serif';
  ctx.textAlign = 'left';
  var lines = [
    'Money $' + S.money + '   Score ' + S.score + '   Rank ' + SH.rankFor(S.score, S.storyDone),
    'Coins ' + SH.coinsCollected(S) + '/10   Fares ' + S.fares + '   Races won ' + (S.racesWon || 0),
    'Story jobs done: ' + (S.completed.length ? S.completed.join(', ') : 'none') + ' of 7'
  ];
  if (S.mission) lines.push('Current job: ' + S.mission.def.name + ' — ' + S.mission.def.banner);
  if (S.race) lines.push('Race in progress: ' + S.race.def.name + ' — ' + S.race.next + '/' + S.race.def.checkpoints.length + ' checkpoints, ' + Math.ceil(S.race.timer) + 's left');
  if (S.delivery) lines.push('Delivery in progress: ' + Math.ceil(S.delivery.timer) + 's left to Pier 9');
  if (S.taxi) lines.push('Taxi fare in progress: ' + (S.taxi.stage === 'pickup' ? 'pick up the passenger' : 'drive to the drop-off'));
  for (var i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 380, 220 + i * 34);
  }
  ctx.fillStyle = '#ffd94d';
  ctx.textAlign = 'center';
  ctx.fillText('P — resume    B — mission board', SH.CANVAS_W / 2, 480);
  ctx.textAlign = 'left';
};

SH.drawWasted = function (ctx, S) {
  ctx.fillStyle = 'rgba(20,0,0,0.85)';
  ctx.fillRect(0, 0, SH.CANVAS_W, SH.CANVAS_H);
  ctx.fillStyle = '#ff3b30';
  ctx.font = 'bold 80px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WASTED', SH.CANVAS_W / 2, 320);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText('You wake up at Sunset Hospital, $100 lighter.', SH.CANVAS_W / 2, 380);
  ctx.fillText('Click or press Enter to keep going.', SH.CANVAS_W / 2, 420);
  ctx.textAlign = 'left';
};

